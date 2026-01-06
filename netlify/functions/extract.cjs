// netlify/functions/extract.cjs
// Hardened Netlify Function: TikTok oEmbed -> Gemini -> JSON recipe (with safe fallbacks)

const https = require("https");

// --------------------
// Hardening knobs
// --------------------
const RATE_WINDOW_MS = 60_000; // 1 min
const RATE_MAX = 10; // 10 req/min per IP (soft)
const MAX_BODY_BYTES = 20_000; // 20 KB
const MAX_URL_LEN = 2_000;

const UPSTREAM_TIMEOUT_MS = 12_000;
const UPSTREAM_MAX_BYTES = 1_000_000;

const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_MAX_BYTES = 2_000_000;

const ipBuckets = new Map(); // soft limiter (per warm instance)

// --------------------
// Mock fallback recipe
// --------------------
const MOCK_RECIPE = {
  title: "5-Minute Garlic Butter Pasta",
  ingredients: [
    { ingredientKey: "spaghetti", label: "Spaghetti", quantity: 200, unit: "g" },
    { ingredientKey: "butter", label: "Butter", quantity: 50, unit: "g" },
    { ingredientKey: "garlic", label: "Garlic", quantity: 4, unit: "pcs" },
  ],
  steps: ["Cook pasta.", "Melt butter and sauté garlic.", "Combine and serve."],
};

// --------------------
// Utilities
// --------------------
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

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

  // small prune to avoid unbounded growth
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

function isValidTikTokUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    return host.endsWith("tiktok.com");
  } catch {
    return false;
  }
}

function normalizeUnit(u) {
  const unit = String(u || "").toLowerCase().trim();
  if (unit === "grams" || unit === "gram") return "g";
  if (unit === "milliliters" || unit === "milliliter") return "ml";
  if (unit === "pieces" || unit === "piece" || unit === "pc") return "pcs";
  if (unit === "clove" || unit === "cloves") return "pcs";
  if (unit === "tbsp" || unit === "tablespoon" || unit === "tablespoons") return "tbsp";
  if (unit === "tsp" || unit === "teaspoon" || unit === "teaspoons") return "tsp";
  return unit || "pcs";
}

function normalizeKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function extractTextFromGeminiResponse(parsed) {
  const parts = parsed?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  for (const p of parts) {
    if (p && typeof p.text === "string" && p.text.trim()) return p.text.trim();
  }
  return "";
}

function normalizeToRecipeShape(any) {
  if (any && typeof any === "object" && any.title && Array.isArray(any.ingredients)) {
    const steps =
      typeof any.steps?.[0] === "string"
        ? any.steps.map((s) => String(s || "").trim()).filter(Boolean)
        : Array.isArray(any.steps)
          ? any.steps
              .map((s) => (typeof s === "string" ? s : s?.instruction))
              .map((s) => String(s || "").trim())
              .filter(Boolean)
          : [];

    const ing = any.ingredients
      .map((it) => {
        const label = String(it.label || it.name || it.ingredientKey || "").trim() || "Ingredient";
        const ingredientKey = normalizeKey(it.ingredientKey || label);
        const qty = Number(it.quantity || 0);
        const unit = normalizeUnit(it.unit);
        return { ingredientKey, label, quantity: qty, unit };
      })
      .filter((i) => i.label && Number.isFinite(i.quantity));

    return {
      title: String(any.title).trim() || "Untitled recipe",
      ingredients: ing,
      steps,
    };
  }

  if (any && typeof any === "object" && any.result) return normalizeToRecipeShape(any.result);

  return MOCK_RECIPE;
}

// --------------------
// HTTPS helper w/ timeout + max bytes
// --------------------
function httpsJson({
  hostname,
  path,
  method,
  headers,
  body,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
  maxBytes = UPSTREAM_MAX_BYTES,
}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = "";
      let bytes = 0;

      res.on("data", (c) => {
        bytes += c.length;
        if (bytes > maxBytes) {
          req.destroy(new Error("Response too large"));
          return;
        }
        data += c;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          bodyText: data,
          bodyJson: safeJsonParse(data, null),
        });
      });
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error("Upstream timeout")));
    req.on("error", reject);

    if (body) req.write(body);
    req.end();
  });
}

// --------------------
// TikTok oEmbed
// --------------------
async function fetchTikTokOEmbed(videoUrl) {
  try {
    const encoded = encodeURIComponent(videoUrl);
    const resp = await httpsJson({
      hostname: "www.tiktok.com",
      path: `/oembed?url=${encoded}`,
      method: "GET",
      headers: { "Content-Type": "application/json", "User-Agent": "TokToTable/1.0" },
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      maxBytes: UPSTREAM_MAX_BYTES,
    });

    const j = resp.bodyJson;
    if (!j || typeof j !== "object") return null;

    return {
      title: typeof j.title === "string" ? j.title : "",
      author_name: typeof j.author_name === "string" ? j.author_name : "",
      thumbnail_url: typeof j.thumbnail_url === "string" ? j.thumbnail_url : null,
    };
  } catch {
    return null;
  }
}

// --------------------
// Gemini: model list + generateContent
// --------------------
async function listModels(apiKey) {
  const resp = await httpsJson({
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models?key=${apiKey}`,
    method: "GET",
    headers: { "Content-Type": "application/json" },
    timeoutMs: UPSTREAM_TIMEOUT_MS,
    maxBytes: UPSTREAM_MAX_BYTES,
  });

  const models = resp.bodyJson?.models;
  if (!Array.isArray(models)) return { ok: false, models: [] };

  const usable = models
    .filter(
      (m) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes("generateContent")
    )
    .map((m) => String(m.name || "").replace(/^models\//, "").trim())
    .filter(Boolean);

  return { ok: true, models: usable };
}

function rankModels(models) {
  const score = (name) => {
    const n = name.toLowerCase();
    if (n.includes("2.5")) return 120;
    if (n.includes("flash")) return 100;
    if (n.includes("pro")) return 80;
    return 50;
  };
  return models.slice().sort((a, b) => score(b) - score(a));
}

async function callGemini({ apiKey, model, inputText }) {
  const prompt = `
Do NOT wrap the JSON in triple backticks.
Do NOT use markdown.
Return raw JSON only.

Return STRICT JSON with this exact shape:

{
  "title": string,
  "ingredients": [
    { "ingredientKey": string, "label": string, "quantity": number, "unit": string }
  ],
  "steps": string[]
}

Rules:
- ingredientKey snake_case
- Units preferred: g, ml, pcs (use pcs if unknown)
- quantity must be numeric (estimate if needed)

INPUT:
${inputText}
`;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  });

  return httpsJson({
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
    body: payload,
    timeoutMs: GEMINI_TIMEOUT_MS,
    maxBytes: GEMINI_MAX_BYTES,
  });
}

// --------------------
// Response helpers
// --------------------
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

// --------------------
// Handler
// --------------------
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

  // Soft rate limit (burst protection)
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

  const payload = safeJsonParse(rawBody || "{}", {});
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const caption = typeof payload.caption === "string" ? payload.caption.trim() : "";

  if (url && url.length > MAX_URL_LEN) {
    return json(400, { ok: false, error: "URL too long", reqId });
  }

  if (!url && !text && !caption) {
    return json(400, { ok: false, error: "Missing input (url/text/caption)", reqId });
  }

  // Restrict URL input to TikTok only (prevents generic scraping endpoint)
  if (url && !isValidTikTokUrl(url)) {
    return json(400, { ok: false, error: "Only TikTok URLs are supported", reqId });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // No key => safe fallback behavior
  if (!apiKey) {
    return json(
      200,
      { ok: true, source: "mock", recipe: MOCK_RECIPE, reqId },
      {
        "X-RateLimit-Limit": String(RATE_MAX),
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(rl.resetAt),
      }
    );
  }

  const t0 = Date.now();

  // Build best input context
  let creator = null;
  let thumbnail_url = null;

  let inputText = text || caption || url || "Extract a cooking recipe.";

  if (!text && !caption && url) {
    const meta = await fetchTikTokOEmbed(url);
    if (meta) {
      creator = meta.author_name ? `@${meta.author_name.replace(/^@/, "")}` : null;
      thumbnail_url = meta.thumbnail_url || null;

      inputText = [
        "TIKTOK META:",
        meta.title ? `- Title: ${meta.title}` : "- Title: (unknown)",
        creator ? `- Creator: ${creator}` : "- Creator: (unknown)",
        `- URL: ${url}`,
        "",
        "Use the meta above as context for the recipe extraction.",
      ].join("\n");
    }
  }

  // Model selection
  const lm = await listModels(apiKey);
  if (!lm.ok || lm.models.length === 0) {
    console.log(JSON.stringify({ reqId, ip, ok: true, source: "mock-fallback", reason: "no-models" }));
    return json(
      200,
      { ok: true, source: "mock-fallback", recipe: MOCK_RECIPE, reqId },
      {
        "X-RateLimit-Limit": String(RATE_MAX),
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(rl.resetAt),
      }
    );
  }

  const preferred = (process.env.GEMINI_MODEL || "").trim();
  let models = lm.models;
  if (preferred) models = [preferred, ...models.filter((m) => m !== preferred)];

  // Only try top 2 to reduce cost/latency
  models = rankModels(models).slice(0, 2);

  const attempts = [];

  for (const model of models) {
    const tModel = Date.now();

    try {
      const resp = await callGemini({ apiKey, model, inputText });
      const parsed = resp.bodyJson;
      const textOut = parsed ? extractTextFromGeminiResponse(parsed) : "";
      const ms = Date.now() - tModel;

      attempts.push({ model, statusCode: resp.statusCode, hasText: !!textOut, ms });

      if (!textOut) continue;

      // Defensive: strip possible ```json fences
      let cleaned = textOut.trim();
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
      cleaned = cleaned.replace(/^\s*```/, "").replace(/```\s*$/, "").trim();

      const raw = safeJsonParse(cleaned, null);
      if (!raw) continue;

      const recipe = normalizeToRecipeShape(raw);

      console.log(
        JSON.stringify({
          reqId,
          ip,
          ok: true,
          source: "gemini",
          model,
          msTotal: Date.now() - t0,
        })
      );

      return json(
        200,
        {
          ok: true,
          source: "gemini",
          model,
          creator,
          thumbnail_url,
          recipe,
          sources: url ? [{ title: url, uri: url }] : [],
          reqId,
        },
        {
          "X-RateLimit-Limit": String(RATE_MAX),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.resetAt),
        }
      );
    } catch (err) {
      const ms = Date.now() - tModel;
      attempts.push({ model, statusCode: 0, hasText: false, ms, error: String(err?.message || err) });
      continue;
    }
  }

  console.log(
    JSON.stringify({
      reqId,
      ip,
      ok: true,
      source: "mock-fallback",
      msTotal: Date.now() - t0,
      attempts,
    })
  );

  return json(
    200,
    {
      ok: true,
      source: "mock-fallback",
      error: "Gemini returned no parseable JSON.",
      debug: attempts,
      recipe: MOCK_RECIPE,
      creator,
      thumbnail_url,
      sources: url ? [{ title: url, uri: url }] : [],
      reqId,
    },
    {
      "X-RateLimit-Limit": String(RATE_MAX),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(rl.resetAt),
    }
  );
};
