const https = require("https");

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

    return { title: String(any.title).trim() || "Untitled recipe", ingredients: ing, steps };
  }

  if (any && typeof any === "object" && any.result) return normalizeToRecipeShape(any.result);

  return MOCK_RECIPE;
}

function httpsJson({ hostname, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          bodyText: data,
          bodyJson: safeJsonParse(data, null),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
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
  return models.slice().sort((a, b) => score(b) - score(a));
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

    // TikTok may return HTML on blocks; handle gracefully.
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
  });
}

async function handleExtract(req, res, body) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, source: "mock", recipe: MOCK_RECIPE }));
    return;
  }

  const payload = safeJsonParse(body || "{}", {});
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const caption = typeof payload.caption === "string" ? payload.caption.trim() : "";

  // --- Build best possible input context ---
  let creator = null;
  let thumbnail_url = null;

  let inputText = text || caption || url || "Extract a cooking recipe.";

  // If caller only sends URL, try TikTok oEmbed for context
  if (!text && !caption && url && url.includes("tiktok.com")) {
    const meta = await fetchTikTokOEmbed(url);
    if (meta) {
      creator = meta.author_name ? `@${meta.author_name.replace(/^@/, "")}` : null;
      thumbnail_url = meta.thumbnail_url || null;

      const metaBlock = [
        "TIKTOK META:",
        meta.title ? `- Title: ${meta.title}` : "- Title: (unknown)",
        creator ? `- Creator: ${creator}` : "- Creator: (unknown)",
        `- URL: ${url}`,
        "",
        "Use the meta above as context for the recipe extraction.",
      ].join("\n");

      inputText = metaBlock;
    }
  }

  const lm = await listModels(apiKey);
  if (!lm.ok || lm.models.length === 0) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, source: "mock-fallback", recipe: MOCK_RECIPE }));
    return;
  }

  const preferred = (process.env.GEMINI_MODEL || "").trim();
  let models = lm.models;
  if (preferred) models = [preferred, ...models.filter((m) => m !== preferred)];
  models = rankModels(models).slice(0, 5);

  const attempts = [];

  for (const model of models) {
    const resp = await callGemini({ apiKey, model, inputText });
    const parsed = resp.bodyJson;
    const textOut = parsed ? extractTextFromGeminiResponse(parsed) : "";

    attempts.push({ model, statusCode: resp.statusCode, hasText: !!textOut });

    if (textOut) {
      // Defensive: strip possible ```json fences
      let cleaned = textOut.trim();
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
      cleaned = cleaned.replace(/^\s*```/, "").replace(/```\s*$/, "").trim();

      const raw = safeJsonParse(cleaned, null);
      if (!raw) continue;

      const recipe = normalizeToRecipeShape(raw);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          source: "gemini",
          model,
          creator,
          thumbnail_url,
          recipe,
          sources: url ? [{ title: url, uri: url }] : [],
        })
      );
      return;
    }
  }

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
      sources: url ? [{ title: url, uri: url }] : [],
    })
  );
}

module.exports = { handleExtract };
