// netlify/functions/extract.cjs (mock first)
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const url = String(body.url || "");

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      source: "mock",
      creator: "@mock",
      thumbnail_url: null,
      recipe: {
        title: "Mock recipe (Netlify)",
        ingredients: [
          { ingredientKey: "spaghetti", label: "Spaghetti", quantity: 200, unit: "g" },
          { ingredientKey: "butter", label: "Butter", quantity: 50, unit: "g" },
          { ingredientKey: "garlic", label: "Garlic", quantity: 2, unit: "pcs" },
        ],
        steps: ["Cook pasta.", "Melt butter + garlic.", "Combine and serve."],
      },
      sources: url ? [{ title: url, uri: url }] : [],
    }),
  };
};
