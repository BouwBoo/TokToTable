// hooks/useRecipes.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { Recipe } from "../types";
import { loadRecipes, saveRecipes, clearAllStorage } from "../services/storage";
import { ApiError, extractRecipeFromUrl } from "../services/geminiService";

type ProcessingState = "idle" | "fetching" | "analyzing" | "synthesizing" | "error";
type Filter = "all" | "extracted" | "validated";
type SortBy = "date" | "title" | "status";

function normalizeStatus(s: any): "extracted" | "validated" {
  const v = String(s || "").toLowerCase();
  if (v === "validated") return "validated";
  return "extracted";
}

export function useRecipes() {
  // --- Load & normalize legacy data (status casing, etc.) ---
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const raw = loadRecipes();
    return (raw || []).map((r: any) => ({
      ...r,
      status: normalizeStatus(r.status),
      created_at: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    }));
  });

  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");

  // --- Cooldown state (rate limit UX) ---
  const [isCooldown, setIsCooldown] = useState(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const cooldownTimerRef = useRef<number | null>(null);

  const stopCooldown = () => {
    setIsCooldown(false);
    setCooldownRemainingMs(0);
    if (cooldownTimerRef.current) {
      window.clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  };

  const startCooldown = (seconds: number) => {
    const totalMs = Math.max(1, seconds) * 1000;
    const startedAt = Date.now();

    setIsCooldown(true);
    setCooldownRemainingMs(totalMs);

    if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);

    cooldownTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, totalMs - elapsed);
      setCooldownRemainingMs(remaining);

      if (remaining <= 0) stopCooldown();
    }, 250);
  };

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const filteredAndSortedRecipes = useMemo(() => {
    const toMs = (v: any) => {
      const d = new Date(String(v));
      const ms = d.getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    return recipes
      .filter((r) => {
        if (filter === "all") return true;
        // case-insensitive + legacy-safe
        return normalizeStatus(r.status) === filter;
      })
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "status") return String(a.status).localeCompare(String(b.status));
        return toMs(b.created_at) - toMs(a.created_at);
      });
  }, [recipes, filter, sortBy]);

  const dismissError = () => {
    setProcessingState("idle");
    setErrorMessage(null);
  };

  const extractFromUrl = async (url: string, caption?: string) => {
    const u = url.trim();

    if (!u.includes("tiktok.com")) {
      setErrorMessage("Ongeldige link. Plak een TikTok video-URL.");
      setProcessingState("error");
      return;
    }

    if (isCooldown) {
      const secs = Math.ceil(cooldownRemainingMs / 1000);
      setErrorMessage(`Even wachten: ${secs}s cooldown (rate limit).`);
      setProcessingState("error");
      return;
    }

    setErrorMessage(null);
    setProcessingState("fetching");

    try {
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
      } else {
        setErrorMessage("Extractie lukte niet. Probeer een andere TikTok link.");
        setProcessingState("error");
      }
    } catch (err: any) {
      console.error("Extraction error:", err);

      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        const secs = err.retryAfterSeconds ?? 30;
        startCooldown(secs);
        setErrorMessage(`Rate limit. Probeer opnieuw over ${secs}s.`);
        setProcessingState("error");
        return;
      }

      setErrorMessage(err?.message || "Er ging iets mis. Probeer opnieuw.");
      setProcessingState("error");
    }
  };

  const saveRecipe = (updated: Recipe) => {
    // normalize status always (avoids reintroducing legacy casing)
    const normalized: Recipe = { ...updated, status: normalizeStatus(updated.status) };
    setRecipes((prev) => prev.map((r) => (r.id === normalized.id ? normalized : r)));
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
    stopCooldown();
  };

  return {
    recipes,
    setRecipes,

    processingState,
    setProcessingState,
    errorMessage,
    dismissError,

    // cooldown (for UrlInput/AppRoot)
    isCooldown,
    cooldownRemainingMs,

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
