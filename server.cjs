// server.cjs (CommonJS)
// Minimal API server for local dev.

require("dotenv").config();

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

const extractModule = require("./api/extract.cjs");
const imageModule = require("./api/image.cjs");
const monetization = require("./api/monetization.cjs");

// Billing status module (you already have this in your project)
// NOTE: billing status is served via monetization.getBillingStatus(req) for stability
// Plan truth store (created in V3.1 step 3)
const planStore = require("./api/planStore.cjs");

const extractHandler = extractModule.handleExtract || extractModule;
const imageHandler = imageModule.handleImage || imageModule;

function json(res, statusCode, payload, extraHeaders = {}) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
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
  if (typeof handler !== "function") {
    return json(res, 500, { error: "Handler is not a function" });
  }

  if (handler.length >= 3) {
    const body = await readBody(req);
    return handler(req, res, body);
  }

  return handler(req, res);
}

function sendFile(res, filePath, contentType = "application/octet-stream") {
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  fs.createReadStream(filePath).pipe(res);
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

  // ✅ Billing status (read-only)
  if (pathname === "/api/billing/status") {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

    try {
      return json(res, 200, monetization.getBillingStatus(req));
    } catch (err) {
      return json(res, 500, { ok: false, error: "Billing status failed", detail: String(err) });
    }
  }


  // ✅ Extract
  if (pathname === "/api/extract") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    // V3 gate: enforce limits BEFORE calling extract handler
    const gate = monetization.checkAndIncrementExtract(req);
    if (!gate.ok) {
      console.log("[V3 gate] blocked", gate.payload || gate);
      return json(res, gate.status || 429, gate.payload || gate, { "Retry-After": "60" });
    }

    console.log("[V3 gate] allow", { plan: gate.plan, used: gate.used, limit: gate.limit, resetAt: gate.resetAt });

    try {
      return await callHandler(extractHandler, req, res);
    } catch (err) {
      return json(res, 500, { error: "Extract handler failed", detail: String(err) });
    }
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

  // ✅ Stripe checkout (POST-only)
  if (pathname === "/api/stripe/checkout") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    try {
      const Stripe = require("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const userId = monetization.getAnonUserId(req);

      const origin = process.env.APP_ORIGIN || "http://localhost:3000";
      const priceId = process.env.STRIPE_PRICE_ID;

      if (!priceId) {
        return json(res, 500, { ok: false, error: "Missing STRIPE_PRICE_ID in env" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",

        // ✅ V3.1 step 2: map checkout -> anon user id
        client_reference_id: userId,
        metadata: { ttt_userId: userId },
        subscription_data: { metadata: { ttt_userId: userId } },

        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing/cancel`,
      });

      return json(res, 200, { url: session.url });
    } catch (err) {
      return json(res, 500, { ok: false, error: "Checkout failed", detail: String(err) });
    }
  }

  // ✅ Stripe webhook (V3.1 step 3: truth write)
  if (pathname === "/api/stripe/webhook") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

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
        return json(res, 400, { ok: false, error: "Webhook signature verification failed", detail: String(err) });
      }

      function isActiveSubStatus(status) {
        return status === "active" || status === "trialing";
      }

      // 1) checkout.session.completed → confirm subscription status if possible
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const userId =
          (session && session.client_reference_id) ||
          (session && session.metadata && session.metadata.ttt_userId) ||
          null;

        const customerId = session && session.customer ? String(session.customer) : null;
        const subscriptionId = session && session.subscription ? String(session.subscription) : null;

        if (userId && subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const status = sub && sub.status ? String(sub.status) : "";
            const plan = isActiveSubStatus(status) ? "pro" : "free";
            planStore.set(userId, plan, "stripe", customerId, subscriptionId);
          } catch {
            // conservative: completed checkout -> pro
            planStore.set(userId, "pro", "stripe", customerId, subscriptionId);
          }
        } else if (userId) {
          planStore.set(userId, "pro", "stripe", customerId, subscriptionId);
        }
      }

      // 2) subscription events → direct truth
      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const sub = event.data.object;

        const userId = (sub && sub.metadata && sub.metadata.ttt_userId) || null;

        const status = sub && sub.status ? String(sub.status) : "";
        const customerId = sub && sub.customer ? String(sub.customer) : null;
        const subscriptionId = sub && sub.id ? String(sub.id) : null;

        if (userId) {
          const plan =
            event.type === "customer.subscription.deleted"
              ? "free"
              : isActiveSubStatus(status)
                ? "pro"
                : "free";

          planStore.set(userId, plan, "stripe", customerId, subscriptionId);
        }
      }

      return json(res, 200, { ok: true, received: true });
    } catch (err) {
      return json(res, 500, { ok: false, error: "Webhook handler failed", detail: String(err) });
    }
  }

  // ✅ Cached thumbnail serving (same-origin via Vite proxy)
  if (pathname && pathname.startsWith("/api/thumb/")) {
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

    const id = pathname.split("/").pop();
    if (!id) return json(res, 400, { error: "Missing id" });

    const cacheDir = path.join(__dirname, ".cache", "images");
    const metaPath = path.join(cacheDir, `${id}.json`);

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const filePath = path.join(cacheDir, meta.fileName);
      if (fs.existsSync(filePath)) {
        return sendFile(res, filePath, meta.contentType || "image/jpeg");
      }
    } catch {
      // fallthrough
    }

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
