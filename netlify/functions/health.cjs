// netlify/functions/health.cjs
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      geminiKey: process.env.GEMINI_API_KEY ? "present" : "missing",
    }),
  };
};
