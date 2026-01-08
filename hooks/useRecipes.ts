// hooks/useRecipes.ts
import { useEffect, useMemo, useState } from "react";
import { Recipe } from "../types";
import {
  loadRecipes,
  saveRecipes,
  clearAllStorage,
} from "../services/storage";
import { extractRecipeFromUrl } from "../services/geminiService";

type ProcessingState =
  | "idle"
  | "fetching"
  | "analyzing"
  | "synthesizing"
  | "error";

export function useRecipes() {
  /* ------------------------------------------------------------------
   * Core state
   * ------------------------------------------------------------------ */

  const [recipes, setRecipes] = useState<Recipe[]>(() => loadRecipes());
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [processingState, setProcessingState] =
    useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* ------------------------------------------------------------------
   * Rate-limit / cooldown state (NEW, additive)
   * ------------------------------------------------------------------ */

  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  const isCooldown =
    cooldownUntil !== null && Date.now() < cooldownUntil;

  const cooldownRemainingMs = isCooldown
    ? cooldownUntil! - Date.now()
    : 0;

  /* ------------------------------------------------------------------
   * Filters / sorting
   * ------------------------------------------------------------------ */

  const [filter, setFilter] =
    useState<"all" | "extracted" | "validated">("all");

  const [sortBy, setSortBy] =
    useState<"newest" | "oldest">("newest");

  /* ------------------------------------------------------------------
   * Persistence
   * ------------------------------------------------------------------ */

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  /* ------------------------------------------------------------------
   * Restore cooldown (prod only)
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    const stored = localStorage.getItem("toktotable.cooldownUntil");
    if (!stored) return;

    const ts = Number(stored);
    if (!isNaN(ts) && ts > Date.now()) {
      setCooldownUntil(ts);
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    if (cooldownUntil) {
      localStorage.setItem(
        "toktotable.cooldownUntil",
        String(cooldownUntil)
      );
    } else {
      localStorage.removeItem("toktotable.cooldownUntil");
    }
  }, [cooldownUntil]);

  /* ------------------------------------------------------------------
   * Derived lists
   * ------------------------------------------------------------------ */

  const filteredAndSortedRecipes = useMemo(() => {
    let list = [...recipes];

    if (filter === "extracted") {
      list = list.filter((r) => !r.validated);
    }

    if (filter === "validated") {
      list = list.filter((r) => r.validated);
    }

    list.sort((a, b) => {
      const aTime = Date.parse(a.created_at);
      const bTime = Date.parse(b.created_at);

      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [recipes, filter, sortBy]);

  /* ------------------------------------------------------------------
   * Actions
   * ------------------------------------------------------------------ */

  async function extractFromUrl(url: string, caption?: string) {
    if (isCooldown) {
      setErrorMessage("Please wait before extracting again.");
      return;
    }

    setProcessingState("fetching");
    setErrorMessage(null);

    const result = await extractRecipeFromUrl(url, caption);

    if (result && typeof result === "object" && "kind" in result) {
      if (result.kind === "RATE_LIMIT") {
        const maxMs = import.meta.env.DEV
          ? Math.min(result.retryAfterMs, 5000)
          : result.retryAfterMs;

        setCooldownUntil(Date.now() + maxMs);
        setProcessingState("error");
        setErrorMessage(
          "Too many extractions. Please wait a moment and try again."
        );
        return;
      }

      setProcessingState("error");
      setErrorMessage(result.message ?? "Extraction failed.");
      return;
    }

    if (!result) {
      setProcessingState("error");
      setErrorMessage("Extraction failed.");
      return;
    }

    /* -----------------------------
       SUCCESS (critical fix here)
       ----------------------------- */

    // ⛔ strip any backend created_at (number)
    const { created_at: _ignored, ...safeResult } = result as any;

    const recipe: Recipe = {
      ...safeResult,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(), // ✅ string, guaranteed
      validated: false,
    };

    setRecipes((prev) => [recipe, ...prev]);
    setSelectedRecipe(recipe);
    setProcessingState("idle");
  }

  function saveRecipe(updated: Recipe) {
    setRecipes((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
    setSelectedRecipe(updated);
  }

  function deleteRecipe(id: string) {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    if (selectedRecipe?.id === id) {
      setSelectedRecipe(null);
    }
  }

  function clearAll() {
    clearAllStorage();
    setRecipes([]);
    setSelectedRecipe(null);
    setCooldownUntil(null);
    setErrorMessage(null);
    setProcessingState("idle");
  }

  /* ------------------------------------------------------------------
   * Error helpers (V1 compatibility)
   * ------------------------------------------------------------------ */

  function dismissError() {
    setErrorMessage(null);
    if (processingState === "error") {
      setProcessingState("idle");
    }
  }

  /* ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------ */

  return {
    recipes,
    selectedRecipe,
    setSelectedRecipe,

    processingState,
    errorMessage,
    dismissError,

    isCooldown,
    cooldownRemainingMs,

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
