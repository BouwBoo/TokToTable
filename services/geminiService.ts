// services/geminiService.ts
import { Ingredient } from "../types";

/**
 * Frontend calls backend endpoint that generates an image (mock for now).
 * Returns a data URL string (e.g. data:image/png;base64,...)
 */
export async function generateRecipeImage(
  _ai: any, // legacy param, ignored (keeps existing call sites stable)
  title: string,
  ingredients: Ingredient[]
): Promise<string | null> {
  try {
    const resp = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, ingredients }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    return data?.ok ? (data.dataUrl as string) : null;
  } catch (e) {
    console.error("generateRecipeImage failed:", e);
    return null;
  }
}

/**
 * Extract recipe via backend endpoint (mock for now).
 * Returns the shape your app expects.
 */
export async function extractRecipeFromUrl(url: string) {
  try {
    const resp = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data?.ok || !data?.result) return null;

    const result = data.result;

    // Provide a visual fallback if thumbnail_url is missing
    const fallbackSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial" font-size="48" fill="#e2e8f0">
    TokToTable (no image yet)
  </text>
</svg>
`.trim();

    const fallbackThumbnail = `data:image/svg+xml;base64,${btoa(fallbackSvg)}`;

    return {
      ...result,
      sources: data.sources || [url],
      thumbnail_url: result.thumbnail_url || fallbackThumbnail,
    };
  } catch (e) {
    console.error("extractRecipeFromUrl failed:", e);
    return null;
  }
}
