// hooks/useRecipes.ts
import { useEffect, useMemo, useState } from "react";
import { Recipe } from "../types";
import { loadRecipes, saveRecipes, clearAllStorage } from "../services/storage";
import { extractRecipeFromUrl, generateRecipeImage, ApiError } from "../services/geminiService";

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
    return recipes
      .filter((r) => filter === "all" || r.status === filter)
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "status") return a.status.localeCompare(b.status);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
      const result = await extractRecipeFromUrl(u, caption);

      if (result && result.title) {
        setProcessingState("synthesizing");

        // ✅ Build base recipe
        const baseRecipe: Recipe = {
          id: `recipe-${Date.now()}`,
          title: result.title,
          source_url: u,
          creator: result.creator || "@tiktok_chef",
          thumbnail_url: result.thumbnail_url, // may be overwritten by dish image below
          ingredients: result.ingredients || [],
          steps: (result.steps || []).map((s: any, i: number) => ({
            ...s,
            step_number: s.step_number || i + 1,
            timestamp_start: s.timestamp_start || 0,
            timestamp_end: s.timestamp_end || 0,
          })),
          sources: result.sources || [],
          status: "extracted",
          created_at: new Date().toISOString(),
        };

        // Prefer the real TikTok thumbnail (usually a dish frame).
        // Only fallback to our mock image if no thumbnail is available.
        let finalThumb = baseRecipe.thumbnail_url;

        if (!finalThumb) {
          try {
            const dishThumb = await generateRecipeImage(null, baseRecipe.title, baseRecipe.ingredients);
            if (dishThumb) finalThumb = dishThumb;
          } catch (e) {
            console.warn("Dish thumbnail generation failed (non-blocking):", e);
          }
        }

        const newRecipe: Recipe = {
          ...baseRecipe,
          thumbnail_url: finalThumb,
        };

        setRecipes((prev) => [newRecipe, ...prev]);
        setSelectedRecipe(newRecipe);
        setProcessingState("idle");
        setErrorMessage(null);
      } else {
        setErrorMessage("Extractie lukte niet. Probeer een andere TikTok link.");
        setProcessingState("error");
      }
    } catch (err: any) {
      console.error("Extraction error:", err);

      if (err instanceof ApiError) {
        if (err.status === 429) {
          const wait = err.retryAfterSeconds ? ` (${err.retryAfterSeconds}s)` : "";
          setErrorMessage(`Even wachten${wait} — te veel verzoeken achter elkaar.`);
        } else if (err.status === 400) {
          setErrorMessage("Ongeldige link. Plak een TikTok video-URL.");
        } else {
          setErrorMessage("Extractie lukt nu even niet. Probeer later opnieuw.");
        }
      } else {
        setErrorMessage("Er ging iets mis. Probeer opnieuw.");
      }

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
