// api/extract.cjs (CommonJS mock)

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mockRecipe(url) {
  const titles = [
    "Crispy Chili Oil Noodles",
    "Korean Street Toast",
    "Creamy Tomato Gnocchi",
    "Spicy Honey Garlic Chicken",
    "15-Minute Butter Paneer",
  ];

  const creators = ["@tokchef", "@homecook", "@streetfood", "@quickbites", "@kitchenhacks"];

  const title = pick(titles);
  const creator = pick(creators);

  return {
    title,
    creator,
    ingredients: [
      { name: "Noodles", quantity: 200, unit: "g" },
      { name: "Soy sauce", quantity: 2, unit: "tbsp" },
      { name: "Chili oil", quantity: 1, unit: "tbsp" },
      { name: "Garlic", quantity: 2, unit: "clove" },
      { name: "Spring onion", quantity: 1, unit: "pc" },
    ],
    steps: [
      { step_number: 1, instruction: "Boil noodles until al dente. Drain and reserve a little pasta water.", timestamp_start: 0, timestamp_end: 8 },
      { step_number: 2, instruction: "Mix soy sauce, chili oil, and minced garlic in a bowl.", timestamp_start: 8, timestamp_end: 14 },
      { step_number: 3, instruction: "Toss noodles with the sauce. Add a splash of pasta water if needed.", timestamp_start: 14, timestamp_end: 22 },
      { step_number: 4, instruction: "Top with sliced spring onion and serve immediately.", timestamp_start: 22, timestamp_end: 28 },
    ],
    sources: [url],
    thumbnail_url: null,
  };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "Method not allowed" }));
    }

    // Read JSON body
    let body = {};
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }

    const url = body?.url || "";
    const result = mockRecipe(url);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, result, sources: result.sources }));
  } catch (err) {
    console.error("MOCK /extract error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Server error" }));
  }
};
