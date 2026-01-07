// hooks/useRecipes.ts
import { useEffect, useMemo, useState } from "react";
import { Recipe } from "../types";
import { loadRecipes, saveRecipes, clearAllStorage } from "../services/storage";
import { extractRecipeFromUrl } from "../services/geminiService";

type ProcessingState = "idle" | "fetching" | "analyzing" | "synthesizing" | "error";

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);

  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

    if (!u.includes("tiktok.com")) {
      setErrorMessage("Ongeldige link. Plak een TikTok video-URL.");
      setProcessingState("error");
      return;
    }

    setErrorMessage(null);
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
          // In jouw “vannacht werkte alles”-flow kwam dit meestal uit geminiService (real thumb of fallback/mock)
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
      } else {
        setErrorMessage("Extractie lukte niet. Probeer een andere TikTok link.");
        setProcessingState("error");
      }
    } catch (err: any) {
      console.error("Extraction error:", err);
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
  };

  const dismissError = () => {
    setProcessingState("idle");
    setErrorMessage(null);
  };

  return {
    recipes,
    setRecipes,

    processingState,
    setProcessingState,
    errorMessage,
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
