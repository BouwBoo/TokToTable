// hooks/useRecipes.ts
import { useEffect, useMemo, useState } from "react";
import { Recipe } from "../types";
import { loadRecipes, saveRecipes, clearAllStorage } from "../services/storage";
import { extractRecipeFromUrl, ApiError } from "../services/geminiService";

type ProcessingState = "idle" | "fetching" | "analyzing" | "synthesizing" | "error";

export type ErrorKind = "generic" | "limit" | "rate_limit" | "invalid_url" | null;

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);

  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [errorMeta, setErrorMeta] = useState<Record<string, any> | null>(null);

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [filter, setFilter] = useState<"all" | "extracted" | "validated">("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "status">("date");

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  const filteredAndSortedRecipes = useMemo(() => {
    const toMs = (v: any) => {
      const d = new Date(String(v));
      const ms = d.getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    return recipes
      .filter((r) => filter === "all" || r.status === filter)
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "status") return a.status.localeCompare(b.status);
        return toMs(b.created_at) - toMs(a.created_at);
      });
  }, [recipes, filter, sortBy]);

  const extractFromUrl = async (url: string, caption?: string) => {
    const u = url.trim();

    // Reset previous error
    setErrorMessage(null);
    setErrorKind(null);
    setErrorMeta(null);

    if (!u.includes("tiktok.com")) {
      setErrorMessage("Ongeldige link. Plak een TikTok video-URL.");
      setErrorKind("invalid_url");
      setProcessingState("error");
      return;
    }

    setProcessingState("fetching");

    try {
      // geminiService accepteert (url, caption?)
      const result: any = await extractRecipeFromUrl(u, caption);

      if (result && result.title) {
        setProcessingState("synthesizing");

        const baseRecipe: Recipe = {
          id: `recipe-${Date.now()}`,
          title: result.title,
          source_url: u,
          creator: result.creator || "@tiktok_chef",
          thumbnail_url: result.thumbnail_url || "",
          ingredients: (result.ingredients || []).map((ing: any) => ({
            name: ing?.name ?? "",
            quantity: ing?.quantity ?? "",
            unit: ing?.unit ?? "",
            raw_text: ing?.raw_text ?? `${ing?.quantity ?? ""} ${ing?.unit ?? ""} ${ing?.name ?? ""}`.trim(),
            normalized_name: ing?.normalized_name,
            foodon_id: ing?.foodon_id,
          })),
          steps: (result.steps || []).map((s: any, i: number) => ({
            step_number: s?.step_number ?? i + 1,
            instruction: s?.instruction ?? s?.text ?? "",
            timestamp_start: s?.timestamp_start ?? s?.start ?? 0,
            timestamp_end: s?.timestamp_end ?? s?.end ?? 0,
            duration_seconds: s?.duration_seconds,
          })),
          sources: result.sources || [],
          status: "extracted",
          created_at: new Date().toISOString(),
          rating: result.rating,
          likes: result.likes,
          isLiked: result.isLiked,
          comments: result.comments,
        };

        setRecipes((prev) => [baseRecipe, ...prev]);
        setSelectedRecipe(baseRecipe);
        setProcessingState("idle");

        setErrorMessage(null);
        setErrorKind(null);
        setErrorMeta(null);
      } else {
        setErrorMessage("Extractie lukte niet. Probeer een andere TikTok link.");
        setErrorKind("generic");
        setProcessingState("error");
      }
    } catch (err: any) {
      console.error("Extraction error:", err);

      // V3: monetization gate error
      if (err instanceof ApiError) {
        if (err.code === "LIMIT_REACHED") {
          // err.meta should contain { limit, used, resetAt, plan, upgrade }
          setErrorKind("limit");
          setErrorMeta(err.meta || null);

          const resetAt = err.meta?.resetAt ? new Date(err.meta.resetAt) : null;
          const resetText = resetAt ? resetAt.toLocaleString() : null;

          const used = typeof err.meta?.used === "number" ? err.meta.used : undefined;
          const limit = typeof err.meta?.limit === "number" ? err.meta.limit : undefined;

          setErrorMessage(
            `Je Free-limiet is bereikt${typeof used === "number" && typeof limit === "number" ? ` (${used}/${limit})` : ""}. ` +
              `Upgrade naar Pro om door te gaan${resetText ? ` — reset: ${resetText}` : ""}.`
          );
          setProcessingState("error");
          return;
        }

        if (err.code === "RATE_LIMITED") {
          setErrorKind("rate_limit");
          setErrorMeta({ retryAfterSeconds: err.retryAfterSeconds });

          const retry = err.retryAfterSeconds ?? 30;
          setErrorMessage(`Te veel requests. Wacht ${retry}s en probeer opnieuw.`);
          setProcessingState("error");
          return;
        }

        // Other ApiError
        setErrorKind("generic");
        setErrorMessage(err.message || "Er ging iets mis. Probeer opnieuw.");
        setProcessingState("error");
        return;
      }

      // Unknown error
      setErrorKind("generic");
      setErrorMessage("Er ging iets mis. Probeer opnieuw.");
      setProcessingState("error");
    }
  };

  const saveRecipe = (updated: Recipe) => {
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRecipe(null);
  };

  const deleteRecipe = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  const clearAll = () => {
    clearAllStorage();
    setRecipes([]);
    setSelectedRecipe(null);
    setProcessingState("idle");

    setErrorMessage(null);
    setErrorKind(null);
    setErrorMeta(null);
  };

  const dismissError = () => {
    setProcessingState("idle");
    setErrorMessage(null);
    setErrorKind(null);
    setErrorMeta(null);
  };

  return {
    recipes,
    setRecipes,

    processingState,
    setProcessingState,

    errorMessage,
    errorKind,
    errorMeta,
    dismissError,

    selectedRecipe,
    setSelectedRecipe,

    filter,
    setFilter,
    sortBy,
    setSortBy,
    filteredAndSortedRecipes,

    extractFromUrl,
    saveRecipe,
    deleteRecipe,
    clearAll,
  };
}
