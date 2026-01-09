// server.cjs (CommonJS)
// Minimal API server for local dev.

require("dotenv").config();

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

// Support both styles:
// - module.exports = function(req,res,body){...}
// - module.exports = { handleExtract(...) }
// - module.exports = function(req,res){...}
const extractModule = require("./api/extract.cjs");
const monetization = require("./api/monetization.cjs");

const extractHandler =
  typeof extractModule === "function"
    ? extractModule
    : typeof extractModule.handleExtract === "function"
      ? extractModule.handleExtract
      : extractModule.default;

const imageHandler =
  typeof extractModule.handleImage === "function"
    ? extractModule.handleImage
    : typeof extractModule.imageHandler === "function"
      ? extractModule.imageHandler
      : null;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function callHandler(handler, req, res) {
  // If handler expects (req, res, body), we provide it.
  if (typeof handler !== "function") {
    throw new Error("Handler is not a function");
  }
  const body = await readBody(req);
  if (handler.length >= 3) return handler(req, res, body);
  return handler(req, res);
}

function sendFile(res, filePath, contentType) {
  try {
    const buf = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(buf);
  } catch (err) {
    json(res, 404, { error: "Not found" });
  }
}

const FALLBACK_IMAGE = path.join(__dirname, "public", "image-fallback.jpg");

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url || "", true);

  // ✅ Health (single source of truth)
  if (pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      geminiKey: process.env.GEMINI_API_KEY ? "present" : "missing",
      port: process.env.API_PORT || 8787,
    });
  }

  // ✅ Extract
  if (pathname === "/api/extract") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    // V3 gate: enforce limits BEFORE calling extract handler
    const gate = monetization.checkAndIncrementExtract(req);
    if (!gate.ok) {
      // Optional: log for visibility
      console.log("[V3 gate] blocked", gate.payload);
      return json(res, gate.status, gate.payload);
    }

    // Optional: log usage
    console.log("[V3 gate] allow", { plan: gate.plan, used: gate.used, limit: gate.limit, resetAt: gate.resetAt });

    try {
      return await callHandler(extractHandler, req, res);
    } catch (err) {
      return json(res, 500, { error: "Extract handler failed", detail: String(err) });
    }
  }

  // ✅ Stripe checkout (Checkpoint 1)
  if (pathname === "/api/stripe/checkout" && req.method === "POST") {
    const Stripe = require("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      // ✅ redirect back into the app
      success_url: `${process.env.APP_ORIGIN}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_ORIGIN}/billing/cancel`,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ url: session.url }));
    return;
  }

  // ✅ Stripe webhook (Checkpoint A: mark Pro)
  if (pathname === "/api/stripe/webhook" && req.method === "POST") {
    try {
      const Stripe = require("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const sig = req.headers["stripe-signature"];
      if (!sig) return json(res, 400, { ok: false, error: "Missing stripe-signature header" });

      const rawBody = await readRawBody(req);

      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        return json(res, 400, { ok: false, error: "Invalid signature", detail: String(err) });
      }

      const store = require("./api/stripeStore.cjs");

      if (event.type === "checkout.session.completed") {
        const s = event.data.object;
        store.markPro({
          session_id: s.id,
          customer_id: s.customer,
          subscription_id: s.subscription,
        });
        console.log("[stripe] checkout.session.completed -> pro_enabled=true", {
          session_id: s.id,
          customer: s.customer,
          subscription: s.subscription,
        });
      }

      return json(res, 200, { received: true });
    } catch (err) {
      return json(res, 500, { ok: false, error: "Webhook handler failed", detail: String(err) });
    }
  }

  // ✅ Billing status (dev)
  if (pathname === "/api/billing/status" && req.method === "GET") {
    const store = require("./api/stripeStore.cjs");
    return json(res, 200, store.getStatus());
  }

  // ✅ Image endpoint (existing)
  if (pathname === "/api/image") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    try {
      return await callHandler(imageHandler, req, res);
    } catch (err) {
      return json(res, 500, { error: "Image handler failed", detail: String(err) });
    }
  }

  // ✅ Cached thumbnail serving (same-origin via Vite proxy)
  if (pathname.startsWith("/api/thumb/")) {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

    const id = pathname.replace("/api/thumb/", "");
    const cacheDir = path.join(__dirname, ".cache", "images");
    const f1 = path.join(cacheDir, `${id}.jpg`);
    const f2 = path.join(cacheDir, `${id}.jpeg`);
    const f3 = path.join(cacheDir, `${id}.png`);
    const f4 = path.join(cacheDir, `${id}.webp`);

    try {
      if (fs.existsSync(f1)) return sendFile(res, f1, "image/jpeg");
      if (fs.existsSync(f2)) return sendFile(res, f2, "image/jpeg");
      if (fs.existsSync(f3)) return sendFile(res, f3, "image/png");
      if (fs.existsSync(f4)) return sendFile(res, f4, "image/webp");
    } catch {
      // fallthrough
    }

    // Optional fallback image (prevents broken <img> in UI)
    if (process.env.IMAGE_CACHE_FALLBACK === "1" && fs.existsSync(FALLBACK_IMAGE)) {
      return sendFile(res, FALLBACK_IMAGE, "image/jpeg");
    }

    return json(res, 404, { error: "Not found" });
  }

  return json(res, 404, { error: "Not found" });
});

const PORT = process.env.API_PORT || 8787;

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API server running at http://127.0.0.1:${PORT}`);
  console.log(`Health check:      http://127.0.0.1:${PORT}/api/health`);
});
