// api/extract.cjs (CommonJS)

const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MOCK_RECIPE = {
  title: "5-Minute Garlic Butter Pasta",
  ingredients: [
    { ingredientKey: "spaghetti", label: "Spaghetti", quantity: 200, unit: "g" },
    { ingredientKey: "butter", label: "Butter", quantity: 50, unit: "g" },
    { ingredientKey: "garlic", label: "Garlic", quantity: 4, unit: "pcs" },
  ],
  steps: ["Cook pasta.", "Melt butter and sauté garlic.", "Combine and serve."],
};

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function extractJsonFromText(text) {
  if (!text) return "";
  const t = String(text);
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
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

    const ingredients = any.ingredients
      .map((ing) => {
        const ingredientKey =
          typeof ing.ingredientKey === "string"
            ? ing.ingredientKey
            : typeof ing.key === "string"
              ? ing.key
              : typeof ing.name === "string"
                ? ing.name
                : "";

        const label =
          typeof ing.label === "string"
            ? ing.label
            : typeof ing.name === "string"
              ? ing.name
              : ingredientKey;

        const quantity =
          typeof ing.quantity === "number"
            ? ing.quantity
            : typeof ing.amount === "number"
              ? ing.amount
              : typeof ing.quantity === "string"
                ? Number(ing.quantity)
                : typeof ing.amount === "string"
                  ? Number(ing.amount)
                  : NaN;

        const unit =
          typeof ing.unit === "string"
            ? ing.unit
            : typeof ing.uom === "string"
              ? ing.uom
              : "pcs";

        if (!ingredientKey || !label) return null;

        return {
          ingredientKey: String(ingredientKey).trim(),
          label: String(label).trim(),
          quantity: Number.isFinite(quantity) ? quantity : 1,
          unit: String(unit || "pcs").trim() || "pcs",
        };
      })
      .filter(Boolean);

    return {
      title: String(any.title || "").trim() || "Untitled recipe",
      ingredients,
      steps,
    };
  }

  return null;
}

function httpsJson({ hostname, path: p, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path: p, method, headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const bodyJson = safeJsonParse(data, null);
          resolve({ statusCode: res.statusCode || 0, bodyText: data, bodyJson });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function extractTextFromGeminiResponse(parsed) {
  const cands = parsed?.candidates;
  const parts = cands?.[0]?.content?.parts;
  const text = parts?.map((p) => p?.text).filter(Boolean).join("\n");
  return text || "";
}

async function listModels(apiKey) {
  const resp = await httpsJson({
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models?key=${apiKey}`,
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const models = resp.bodyJson?.models;
  if (!Array.isArray(models)) return { ok: false, models: [], raw: resp };

  const usable = models
    .filter(
      (m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent")
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
  const arr = Array.isArray(models) ? models : [];
  return arr.slice().sort((a, b) => score(b) - score(a));
}

/**
 * Minimal TikTok context fetch: oEmbed.
 * Returns { title, author_name, thumbnail_url } when available.
 */
async function fetchTikTokOEmbed(videoUrl) {
  try {
    const encoded = encodeURIComponent(videoUrl);
    const resp = await httpsJson({
      hostname: "www.tiktok.com",
      path: `/oembed?url=${encoded}`,
      method: "GET",
      headers: { "Content-Type": "application/json", "User-Agent": "TokToTable/1.0" },
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

/* ---------------- image cache (optional, never breaks extract) ---------------- */

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function cacheDirPath() {
  return path.resolve(__dirname, "..", ".cache", "images");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function pruneCache(dir, max) {
  try {
    const entries = fs.readdirSync(dir).map((name) => ({
      name,
      mtime: fs.statSync(path.join(dir, name)).mtimeMs,
    }));
    entries.sort((a, b) => a.mtime - b.mtime);
    while (entries.length > max) {
      const victim = entries.shift();
      if (!victim) break;
      fs.rmSync(path.join(dir, victim.name));
    }
  } catch {
    // ignore
  }
}

function extFromContentType(ct) {
  const c = String(ct || "").toLowerCase();
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  if (c.includes("jpeg") || c.includes("jpg")) return "jpg";
  return null;
}

function httpsGetBuffer(urlStr, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        method: "GET",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        headers: { "User-Agent": "TokToTable/1.0" },
      },
      (res) => {
        const status = res.statusCode || 0;

        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, urlStr).toString();
          return resolve(httpsGetBuffer(next, redirectsLeft - 1));
        }

        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error(`Image download failed (status ${status})`));
        }

        const contentType = String(res.headers["content-type"] || "");
        const chunks = [];
        let total = 0;
        const MAX = 2_000_000;

        res.on("data", (c) => {
          total += c.length;
          if (total > MAX) {
            req.destroy(new Error("Image too large"));
            return;
          }
          chunks.push(c);
        });

        res.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType }));
      }
    );

    req.setTimeout(10_000, () => req.destroy(new Error("Image download timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function maybeCacheThumbnail(thumbnailUrl) {
  if (process.env.ENABLE_IMAGE_CACHE !== "1") return null;
  if (!thumbnailUrl) return null;

  const id = sha1(thumbnailUrl).slice(0, 16);
  const dir = cacheDirPath();
  ensureDir(dir);

  const metaPath = path.join(dir, `${id}.json`);
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const filePath = path.join(dir, meta.fileName);
      if (fs.existsSync(filePath)) return { id };
    } catch {
      // re-download
    }
  }

  try {
    const { buffer, contentType } = await httpsGetBuffer(thumbnailUrl);
    const ext = extFromContentType(contentType);
    if (!ext) return null;

    const fileName = `${id}.${ext}`;
    const filePath = path.join(dir, fileName);

    fs.writeFileSync(filePath, buffer);
    fs.writeFileSync(metaPath, JSON.stringify({ id, fileName, contentType }, null, 2));

    const max = Number(process.env.IMAGE_CACHE_MAX || 200);
    pruneCache(dir, max);

    return { id };
  } catch {
    return null;
  }
}

/* ---------------- mismatch guard ---------------- */

function titleSimilarity(a, b) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((x) => x.length >= 3);

  const A = new Set(norm(a));
  const B = new Set(norm(b));
  if (A.size === 0 || B.size === 0) return 0;

  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.max(A.size, B.size); // 0..1
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
      "User-Agent": "TokToTable/1.0",
    },
    body: payload,
  });
}

async function handleExtract(req, res, body) {
  const apiKey = process.env.GEMINI_API_KEY;

  // keep existing behavior: if no key, return mock recipe
  if (!apiKey) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, source: "mock", recipe: MOCK_RECIPE }));
    return;
  }

  const payload = safeJsonParse(body || "{}", {});
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const caption = typeof payload.caption === "string" ? payload.caption.trim() : "";

  if (!url && !text && !caption) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Missing url, caption or text" }));
    return;
  }

  // Always try to get TikTok meta if URL looks like TikTok (helps quality + guards mismatch)
  let creator = null;
  let thumbnail_url = null;
  let metaTitle = null;

  if (url && url.includes("tiktok.com")) {
    const meta = await fetchTikTokOEmbed(url);
    if (meta) {
      metaTitle = meta.title || null;
      creator = meta.author_name ? `@${meta.author_name.replace(/^@/, "")}` : null;
      thumbnail_url = meta.thumbnail_url || null;

      // ✅ optional caching behind flag
      if (thumbnail_url) {
        const cached = await maybeCacheThumbnail(thumbnail_url);
        if (cached?.id) thumbnail_url = `/api/thumb/${cached.id}`;
      }
    }
  }

  // Build input context (metaTitle included to reduce drift)
  const inputText = [
    url ? `URL:\n${url}` : "",
    metaTitle ? `TikTok title:\n${metaTitle}` : "",
    caption ? `Caption:\n${caption}` : "",
    text ? `Text:\n${text}` : "",
  ]
    .filter(Boolean)
    .join("\n\n") || "Extract a cooking recipe.";

  const lm = await listModels(apiKey);
  if (!lm.ok || !Array.isArray(lm.models) || lm.models.length === 0) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, source: "mock-fallback", recipe: MOCK_RECIPE, creator, thumbnail_url }));
    return;
  }

  const preferred = (process.env.GEMINI_MODEL || "").trim();
  let models = lm.models;
  if (preferred) models = [preferred, ...models.filter((m) => m !== preferred)];
  models = rankModels(models).slice(0, 5);

  const attempts = [];
  const hasUserContext = Boolean((caption && caption.length > 0) || (text && text.length > 0));

  for (const model of models) {
    const resp = await callGemini({ apiKey, model, inputText });
    const parsed = resp.bodyJson;
    const textOut = parsed ? extractTextFromGeminiResponse(parsed) : "";

    attempts.push({ model, statusCode: resp.statusCode, hasText: !!textOut });

    if (!textOut) continue;

    const jsonCandidate = extractJsonFromText(textOut);
    const recipeObj = safeJsonParse(jsonCandidate, null);
    const recipe = normalizeToRecipeShape(recipeObj);

    if (!recipe) continue;

    // ✅ Guard: if user-provided context exists and metaTitle exists, detect mismatch
    if (hasUserContext && metaTitle && recipe.title) {
      const sim = titleSimilarity(metaTitle, recipe.title);
      if (sim < 0.2) {
        // Fail fast: better than saving wrong recipe under correct thumbnail.
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            error: "Context mismatch",
            detail: {
              metaTitle,
              recipeTitle: recipe.title,
              similarity: sim,
            },
            debug: attempts,
            creator,
            thumbnail_url,
          })
        );
        return;
      }
    }

    // Success
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        source: "gemini",
        recipe,
        creator,
        thumbnail_url,
        debug: attempts,
      })
    );
    return;
  }

  // Fallback: never hard-fail
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      source: "mock-fallback",
      error: "Gemini returned no parseable JSON.",
      debug: attempts,
      recipe: MOCK_RECIPE,
      creator,
      thumbnail_url,
    })
  );
}

module.exports = { handleExtract };
