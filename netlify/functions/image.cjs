// netlify/functions/image.cjs
// Hardened Netlify Function: returns a mock SVG dataUrl

const RATE_WINDOW_MS = 60_000; // 1 min
const RATE_MAX = 30; // image is cheap, allow more per min
const MAX_BODY_BYTES = 10_000; // 10 KB
const MAX_TITLE_LEN = 80;

const ipBuckets = new Map();

function getClientIp(headers) {
  const h = headers || {};
  const xff = h["x-forwarded-for"] || h["X-Forwarded-For"];
  if (xff) return String(xff).split(",")[0].trim();
  const nfip = h["x-nf-client-connection-ip"] || h["X-Nf-Client-Connection-Ip"];
  if (nfip) return String(nfip).trim();
  return "unknown";
}

function rateLimit(ip) {
  const now = Date.now();

  if (ipBuckets.size > 1000) {
    for (const [k, v] of ipBuckets.entries()) {
      if (now > v.resetAt) ipBuckets.delete(k);
      if (ipBuckets.size <= 700) break;
    }
  }

  const bucket = ipBuckets.get(ip) || { resetAt: now + RATE_WINDOW_MS, count: 0 };

  if (now > bucket.resetAt) {
    bucket.resetAt = now + RATE_WINDOW_MS;
    bucket.count = 0;
  }

  bucket.count += 1;
  ipBuckets.set(ip, bucket);

  const remaining = Math.max(0, RATE_MAX - bucket.count);
  const limited = bucket.count > RATE_MAX;

  return { limited, remaining, resetAt: bucket.resetAt };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...corsHeaders(), ...extraHeaders },
    body: JSON.stringify(payload),
  };
}

// minimal escape to avoid SVG breaking
function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

exports.handler = async (event) => {
  const headers = event.headers || {};
  const reqId =
    headers["x-nf-request-id"] ||
    headers["X-Nf-Request-Id"] ||
    headers["x-request-id"] ||
    `req-${Date.now()}`;

  const ip = getClientIp(headers);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed", reqId });
  }

  // Soft rate limit
  const rl = rateLimit(ip);
  if (rl.limited) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return json(
      429,
      { ok: false, error: "Rate limit exceeded", reqId },
      {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(RATE_MAX),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rl.resetAt),
      }
    );
  }

  // Body size limit
  const rawBody = event.body || "";
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "Payload too large", reqId });
  }

  let payload = {};
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {}

  let title = String(payload.title || "TokToTable");
  title = title.trim().slice(0, MAX_TITLE_LEN);
  const safeTitle = escapeXml(title);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="100%" height="100%" fill="#0b1020"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial" font-size="54" fill="#e2e8f0">${safeTitle}</text>
</svg>`.trim();

  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  process.env.NODE_ENV !== "production" && console.log(JSON.stringify({ reqId, ip, ok: true, endpoint: "image" }));

  return json(
    200,
    { ok: true, dataUrl, reqId },
    {
      "X-RateLimit-Limit": String(RATE_MAX),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(rl.resetAt),
    }
  );
};