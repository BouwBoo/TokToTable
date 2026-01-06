// services/geminiService.ts
import { Ingredient, Step } from "../types";

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
 * Extract recipe via backend endpoint.
 * Supports BOTH:
 *  - NEW:    { ok:true, recipe:{title, ingredients:[{ingredientKey,label,quantity,unit}], steps:[string]}, creator?, thumbnail_url?, sources? }
 *  - LEGACY: { ok:true, result:{...}, sources? }
 */
export async function extractRecipeFromUrl(url: string, caption?: string) {
  try {
    const resp = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, caption }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data?.ok) return null;

    // Visual fallback if thumbnail_url is missing
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

    // -------------------------
    // NEW CONTRACT
    // -------------------------
    if (data?.recipe) {
      const r = data.recipe;

      const ingredients: Ingredient[] = Array.isArray(r.ingredients)
        ? r.ingredients.map((ing: any) => ({
            name: String(ing.label || ing.ingredientKey || "").trim() || "Ingredient",
            quantity: ing.quantity ?? "",
            unit: String(ing.unit || "").trim() || "",
            raw_text: "",
            normalized_name: undefined,
            foodon_id: undefined,
          }))
        : [];

      const steps: Step[] = Array.isArray(r.steps)
        ? r.steps.map((s: any, i: number) => ({
            step_number: i + 1,
            instruction: String(s || "").trim(),
            timestamp_start: 0,
            timestamp_end: 0,
          }))
        : [];

      const thumb =
        typeof data.thumbnail_url === "string" && data.thumbnail_url.trim()
          ? data.thumbnail_url.trim()
          : fallbackThumbnail;

      return {
        title: String(r.title || "").trim() || "Untitled recipe",
        creator:
          typeof data.creator === "string" && data.creator.trim()
            ? data.creator.trim()
            : "@tiktok_chef",
        thumbnail_url: thumb,
        ingredients,
        steps,
        sources: Array.isArray(data.sources) ? data.sources : [{ title: url, uri: url }],
      };
    }

    // -------------------------
    // LEGACY CONTRACT
    // -------------------------
    if (data?.result) {
      const result = data.result;
      return {
        ...result,
        sources: data.sources || [url],
        thumbnail_url: result.thumbnail_url || fallbackThumbnail,
      };
    }

    return null;
  } catch (e) {
    console.error("extractRecipeFromUrl failed:", e);
    return null;
  }
}
