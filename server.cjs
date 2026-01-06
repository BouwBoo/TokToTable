// server.cjs (CommonJS)
// Minimal API server for local dev.

require("dotenv").config();

const http = require("http");
const url = require("url");

// Support both styles:
// - module.exports = function(req,res,body){...}
// - module.exports = { handleExtract(...) }
// - module.exports = function(req,res){...}
const extractModule = require("./api/extract.cjs");
const imageModule = require("./api/image.cjs");

const extractHandler = extractModule.handleExtract || extractModule;
const imageHandler = imageModule.handleImage || imageModule;

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
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

async function callHandler(handler, req, res) {
  // If handler expects (req, res, body), we provide it.
  if (typeof handler !== "function") {
    return json(res, 500, { error: "Handler is not a function" });
  }

  if (handler.length >= 3) {
    const body = await readBody(req);
    return handler(req, res, body);
  }

  // Otherwise handler can read req itself.
  return handler(req, res);
}

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

  if (pathname === "/api/extract") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    try {
      return await callHandler(extractHandler, req, res);
    } catch (err) {
      return json(res, 500, { error: "Extract handler failed", detail: String(err) });
    }
  }

  if (pathname === "/api/image") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    try {
      return await callHandler(imageHandler, req, res);
    } catch (err) {
      return json(res, 500, { error: "Image handler failed", detail: String(err) });
    }
  }

  return json(res, 404, { error: "Not found" });
});

const PORT = process.env.API_PORT || 8787;

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API server running at http://127.0.0.1:${PORT}`);
  console.log(`Health check:      http://127.0.0.1:${PORT}/api/health`);
});
