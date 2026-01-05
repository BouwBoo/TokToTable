// api/image.cjs (CommonJS mock) — returns a UNIQUE svg each time (so regen is visible)

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "Method not allowed" }));
    }

    // read body (optional)
    let body = {};
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }

    const title = escapeXml(body?.title || "TokToTable");
    const stamp = new Date().toLocaleString();

    // random background hue so every regen looks different
    const hue = Math.floor(Math.random() * 360);
    const bg1 = `hsl(${hue}, 60%, 20%)`;
    const bg2 = `hsl(${(hue + 40) % 360}, 60%, 12%)`;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#g)"/>

  <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial" font-size="54" fill="#e2e8f0">
    ${title}
  </text>

  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial" font-size="26" fill="#cbd5e1">
    mock image • ${escapeXml(stamp)}
  </text>
</svg>
`.trim();

    const base64 = Buffer.from(svg).toString("base64");
    const dataUrl = `data:image/svg+xml;base64,${base64}`;

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, dataUrl }));
  } catch (err) {
    console.error("MOCK /image error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Server error" }));
  }
};
