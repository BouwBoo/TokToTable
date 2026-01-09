// services/geminiService.ts
import { Ingredient, Step } from "../types";

export type ApiErrorCode =
  | "LIMIT_REACHED"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "SERVER_ERROR"
  | "NETWORK_ERROR";

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  retryAfterSeconds?: number;
  meta?: Record<string, any>;

  constructor(
    message: string,
    code: ApiErrorCode,
    status?: number,
    retryAfterSeconds?: number,
    meta?: Record<string, any>
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.meta = meta;
  }
}

/**
 * Stable anonymous user id for server-side usage tracking (V3).
 * Stored in localStorage so it survives reloads.
 */
function getAnonId(): string {
  const k = "ttt_anon_id";
  try {
    const existing = localStorage.getItem(k);
    if (existing && existing.trim()) return existing;

    // Prefer crypto.randomUUID when available
    const uuid =
      (globalThis.crypto && "randomUUID" in globalThis.crypto
        ? // @ts-ignore
          globalThis.crypto.randomUUID()
        : null) || null;

    const fallback =
      "anon_" +
      (uuid ||
        `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}_${Math.random()
          .toString(36)
          .slice(2, 10)}`);

    localStorage.setItem(k, fallback);
    return fallback;
  } catch {
    // If localStorage is blocked, fall back to a per-session-ish id
    return "anon_" + `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function baseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-ttt-user": getAnonId(),
  };
}

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
      headers: baseHeaders(),
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
    const doRequest = async (cap?: string) => {
      return fetch("/api/extract", {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify({ url, caption: cap }),
      });
    };

    const hasCaption = typeof caption === "string" && caption.trim().length > 0;

    // 1) First attempt (with caption if provided)
    let resp = await doRequest(hasCaption ? caption : undefined);

    // 2) Backend guard: if mismatch (409) and we had a caption, retry once without caption
    if (resp.status === 409 && hasCaption) {
      console.warn("extractRecipeFromUrl: context mismatch, retrying without caption");
      resp = await doRequest(undefined);
    }

    // --- 429 handling:
    // Could be:
    //  - V3 limit_reached (our monetization gate)
    //  - legacy rate limit (Retry-After)
    if (resp.status === 429) {
      let body: any = null;
      try {
        body = await resp.json();
      } catch {
        // ignore
      }

      if (body && body.error === "limit_reached") {
        const resetAt = typeof body.resetAt === "string" ? body.resetAt : undefined;
        throw new ApiError(
          "Free limit reached. Upgrade to Pro to keep extracting.",
          "LIMIT_REACHED",
          429,
          undefined,
          {
            plan: body.plan,
            limit: body.limit,
            used: body.used,
            resetAt,
            upgrade: body.upgrade,
          }
        );
      }

      const ra = resp.headers.get("Retry-After");
      const retryAfterSeconds = ra ? Math.max(1, parseInt(ra, 10) || 0) : undefined;
      throw new ApiError(
        `Rate limit. Try again in ${retryAfterSeconds ?? 30}s.`,
        "RATE_LIMITED",
        429,
        retryAfterSeconds
      );
    }

    if (!resp.ok) {
      if (resp.status >= 400 && resp.status < 500) {
        throw new ApiError("Request rejected by server.", "BAD_REQUEST", resp.status);
      }
      throw new ApiError("Server error.", "SERVER_ERROR", resp.status);
    }

    const data = await resp.json();

    if (!data?.ok) {
      // Backend used {ok:false, error:"..."}
      const msg = typeof data?.error === "string" ? data.error : "Extraction failed.";
      throw new ApiError(msg, "SERVER_ERROR", resp.status);
    }

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
      const r = data.result;

      const ingredients: Ingredient[] = Array.isArray(r.ingredients)
        ? r.ingredients.map((ing: any) => ({
            name: String(ing.name || ing.label || "").trim() || "Ingredient",
            quantity: ing.quantity ?? "",
            unit: String(ing.unit || "").trim() || "",
            raw_text: String(ing.raw_text || "").trim(),
            normalized_name: ing.normalized_name,
            foodon_id: ing.foodon_id,
          }))
        : [];

      const steps: Step[] = Array.isArray(r.steps)
        ? r.steps.map((s: any, i: number) => ({
            step_number: s.step_number ?? i + 1,
            instruction: String(s.instruction || s || "").trim(),
            timestamp_start: s.timestamp_start ?? 0,
            timestamp_end: s.timestamp_end ?? 0,
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

    return null;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    console.error("extractRecipeFromUrl failed:", e);
    throw new ApiError("Network error.", "NETWORK_ERROR");
  }
}
