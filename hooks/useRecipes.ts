// hooks/useRecipes.ts
import { useEffect, useMemo, useState } from "react";
import { Recipe } from "../types";
import { loadRecipes, saveRecipes, clearAllStorage } from "../services/storage";
import { extractRecipeFromUrl } from "../services/geminiService";

type ProcessingState = "idle" | "fetching" | "analyzing" | "synthesizing" | "error";

const COOLDOWN_UNTIL_KEY = "toktotable.cooldownUntilMs";

function isProdEnv(): boolean {
  // Vite
try {
  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    return Boolean((import.meta as any).env.PROD);
  }
} catch {
  // ignore
}

  // Fallback
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

function newId(): string {
  // browser crypto
if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
  return crypto.randomUUID();
}

  return `recipe-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);

  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [filter, setFilter] = useState<"all" | "extracted" | "validated">("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "status">("date");

  // --- Cooldown (PROD only) ---
  const prod = isProdEnv();
  const [cooldownUntilMs, setCooldownUntilMs] = useState<number>(() => {
    if (!prod) return 0;
    const raw = localStorage.getItem(COOLDOWN_UNTIL_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  });

  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  useEffect(() => {
    if (!prod) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [prod]);

  useEffect(() => {
    if (!prod) return;
    if (cooldownUntilMs > 0) {
      localStorage.setItem(COOLDOWN_UNTIL_KEY, String(cooldownUntilMs));
    } else {
      localStorage.removeItem(COOLDOWN_UNTIL_KEY);
    }
  }, [prod, cooldownUntilMs]);

  const cooldownRemainingMs = prod ? Math.max(0, cooldownUntilMs - nowMs) : 0;
  const isCooldown = prod ? cooldownRemainingMs > 0 : false;

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

  const startCooldown = (ms: number) => {
    if (!prod) return; // DEV: nooit blokkeren
    const until = Date.now() + Math.max(0, ms);
    setCooldownUntilMs(until);
  };

  const extractFromUrl = async (url: string, caption?: string) => {
    const u = url.trim();

    if (!u.includes("tiktok.com")) {
      setErrorMessage("Ongeldige link. Plak een TikTok video-URL.");
      setProcessingState("error");
      return;
    }

    // PROD cooldown gate
    if (prod && isCooldown) {
      const secs = Math.ceil(cooldownRemainingMs / 1000);
      setErrorMessage(`Even wachten (${secs}s)… te veel extracties kort achter elkaar.`);
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
          id: newId(),
          title: result.title,
          source_url: u,
          creator: result.creator || "@tiktok_chef",
          thumbnail_url: result.thumbnail_url || "",
          ingredients: (result.ingredients || []).map((ing: any) => ({
            name: ing?.name ?? "",
            quantity: ing?.quantity ?? "",
            unit: ing?.unit ?? "",
            raw_text:
              ing?.raw_text ??
              `${ing?.quantity ?? ""} ${ing?.unit ?? ""} ${ing?.name ?? ""}`.trim(),
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
        return;
      }

      // Als geminiService null teruggeeft, kan dat ook rate-limit zijn.
      // We proberen dat uit een eventuele error te halen (als geminiService dat ooit throwt).
      setErrorMessage("Extractie lukte niet. Probeer een andere TikTok link.");
      setProcessingState("error");
    } catch (err: any) {
      console.error("Extraction error:", err);

      // Best-effort rate limit detectie (werkt als geminiService status/message doorgeeft)
      const status = err?.status ?? err?.response?.status;
      const msg = String(err?.message ?? "");
      const is429 = status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate");

      if (is429) {
        // retry-after: standaard 60s (kan je later verfijnen via headers in geminiService)
        startCooldown(60_000);
        setErrorMessage("Te veel requests. Even cooldown…");
        setProcessingState("error");
        return;
      }

      setErrorMessage(msg && msg !== "[object Object]" ? msg : "Er ging iets mis. Probeer opnieuw.");
      setProcessingState("error");
    }
  };

  const saveRecipe = (updated: Recipe) => {
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRecipe(null);
  };

  const deleteRecipe = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    if (selectedRecipe?.id === id) setSelectedRecipe(null);
  };

  const clearAll = () => {
    clearAllStorage();
    localStorage.removeItem(COOLDOWN_UNTIL_KEY);
    setCooldownUntilMs(0);

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

    // cooldown (PROD only)
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
