// server.cjs (CommonJS, no dependencies)
// Minimal API server for local dev when vercel dev is not available.

const http = require("http");
const url = require("url");

// Your API handlers (mock or real) — these should use module.exports = ...
const extractHandler = require("./api/extract.cjs");
const imageHandler = require("./api/image.cjs");


function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url || "", true);

  if (pathname === "/api/health") {
    return json(res, 200, { ok: true });
  }

  if (pathname === "/api/extract") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    return extractHandler(req, res);
  }

  if (pathname === "/api/image") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    return imageHandler(req, res);
  }

  return json(res, 404, { error: "Not found" });
});

const PORT = process.env.API_PORT || 8787;

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API server running at http://127.0.0.1:${PORT}`);
  console.log(`Health check:      http://127.0.0.1:${PORT}/api/health`);
});
