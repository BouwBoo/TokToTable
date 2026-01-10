import React, { useEffect, useState } from "react";
import { Recipe } from "./types";

import Navbar from "./components/Navbar";
import UrlInput from "./components/UrlInput";
import RecipeCard from "./components/RecipeCard";
import RecipeEditor from "./components/RecipeEditor";
import Settings from "./components/Settings";
import ProcessingVisualizer from "./components/ProcessingVisualizer";

// Shopping List (NEW)
import ShoppingListView from "./components/ShoppingListView";
import { useShoppingList } from "./hooks/useShoppingList";

import { useRecipes } from "./hooks/useRecipes";
import { usePlanner } from "./hooks/usePlanner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type View = "dashboard" | "planner" | "shopping" | "settings";

type BillingPath = "/billing/success" | "/billing/cancel";

const BillingReturn: React.FC<{ pathname: BillingPath }> = ({ pathname }) => {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const sessionId = params.get("session_id") || "";

  const isSuccess = pathname === "/billing/success";

  // ✅ UX-only: auto return to app after success
  useEffect(() => {
    if (!isSuccess) return;
    const t = window.setTimeout(() => {
      window.location.href = "/app";
    }, 1500);
    return () => window.clearTimeout(t);
  }, [isSuccess]);

  return (
    <div className="min-h-screen bg-[#070A18] text-slate-100 flex items-center justify-center px-6">
      <div className="glass-panel w-full max-w-xl p-8 rounded-[32px] border-white/10">
        <h1 className="text-3xl font-black mb-3">{isSuccess ? "✅ Payment successful" : "❌ Payment cancelled"}</h1>

        {isSuccess ? (
          <p className="text-slate-300 mb-4">Thanks! Redirecting you back to TokToTable…</p>
        ) : (
          <p className="text-slate-300 mb-4">No worries — nothing was charged.</p>
        )}

        {isSuccess && sessionId ? (
          <p className="text-xs text-slate-500 mb-6">
            Session: <code className="text-slate-200">{sessionId}</code>
          </p>
        ) : (
          <div className="mb-6" />
        )}

        <button
          onClick={() => (window.location.href = "/app")}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all shadow-lg shadow-emerald-900/20"
        >
          Back to app
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>("dashboard");

  const {
    recipes,
    processingState,
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
    dismissError,
    errorMessage,
    errorKind,
    errorMeta,
  } = useRecipes();

  // ✅ After successful checkout: if user is Pro, clear any lingering limit error banner
  useEffect(() => {
    try {
      const plan = localStorage.getItem("ttt_plan_override");
      if (plan === "pro") {
        dismissError();
      }
    } catch {
      // ignore
    }
  }, [dismissError]);

  const { planner, showPickerForDay, setShowPickerForDay, addToPlanner, removeFromPlanner, removeRecipeEverywhere, clearPlanner } =
    usePlanner();

  const { shoppingList, generateFromPlanner, toggle, reset, clear } = useShoppingList();

  // ✅ MINIMAL: handle Stripe return paths without adding a router
  const pathname = typeof window !== "undefined" ? (window.location.pathname as string) : "";
  if (pathname === "/billing/success" || pathname === "/billing/cancel") {
    return <BillingReturn pathname={pathname as BillingPath} />;
  }

  const handleDeleteRecipe = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Wil je dit recept definitief verwijderen uit je kluis?")) {
      deleteRecipe(id);
      removeRecipeEverywhere(id);
    }
  };

  const handleClearRecipes = () => {
    clearAll(); // wist recipes storage
    clearPlanner(); // planner ook leeg
    clear(); // shopping list ook leeg
    alert("Recipe Vault cleared.");
  };

  const handleClearPlanner = () => {
    clearPlanner();
    alert("Meal Planner cleared.");
  };

  const handleGenerateShopping = () => {
    generateFromPlanner(planner, recipes);
    setCurrentView("shopping");
  };

const handleUpgradeClick = async () => {
  // A: Direct start Stripe checkout from the limit banner (minimal wiring).
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
    });

    const data = await res.json();

    if (data?.url) {
      // Close the toast so it doesn't linger if user comes back
      dismissError();
      window.location.href = data.url;
      return;
    }

    alert("Failed to start Stripe checkout");
  } catch (e) {
    console.warn("Stripe checkout start failed:", e);
    alert("Failed to start Stripe checkout");
  }

  // Fallback: take user to Settings (so they can still upgrade manually)
  setCurrentView("settings");
  dismissError();

  // Optional nice touch: jump to subscription section if present
  setTimeout(() => {
    const el = document.getElementById("ttt-subscription");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

  const renderErrorToast = () => {
    const isLimit = errorKind === "limit";
    const isRateLimit = errorKind === "rate_limit";

    const title = isLimit ? "Free limit reached" : isRateLimit ? "Even wachten…" : "Extraction Failed";

    // Prefer the detailed errorMessage from hook; fallback otherwise.
    const message =
      errorMessage ||
      (isLimit
        ? "Je Free-limiet is bereikt. Upgrade naar Pro om door te gaan."
        : isRateLimit
        ? "Te veel requests. Wacht even en probeer opnieuw."
        : "Could not find recipe data for this video. Try another link.");

    // Nice small subline for limit
    const sub =
      isLimit && errorMeta
        ? (() => {
            const used = typeof errorMeta.used === "number" ? errorMeta.used : null;
            const limit = typeof errorMeta.limit === "number" ? errorMeta.limit : null;
            const resetAt = typeof errorMeta.resetAt === "string" ? errorMeta.resetAt : null;

            const parts: string[] = [];
            if (used !== null && limit !== null) parts.push(`${used}/${limit} extracts used`);
            if (resetAt) {
              const d = new Date(resetAt);
              parts.push(`reset: ${d.toLocaleString()}`);
            }
            return parts.length ? parts.join(" • ") : null;
          })()
        : null;

    return (
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[200] max-w-[92vw]">
        <i className="fa-solid fa-circle-exclamation text-2xl"></i>

        <div className="min-w-0">
          <p className="font-bold">{title}</p>
          <p className="text-xs opacity-90 break-words">{message}</p>
          {sub && <p className="text-[10px] opacity-80 mt-1">{sub}</p>}
        </div>

        <div className="flex items-center gap-2">
          {isLimit && (
            <button
              onClick={handleUpgradeClick}
              className="bg-white text-red-600 hover:bg-white/90 px-4 py-1 rounded-lg font-black text-xs transition-all"
            >
              Upgrade to Pro
            </button>
          )}

          <button
            onClick={dismissError}
            className="bg-white/20 hover:bg-white/30 px-4 py-1 rounded-lg font-bold text-xs transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#070A18] text-slate-100">
      {/* Landing-style ambient glow (safe fixed layer) */}
      <div className="tt-glow-bg" />

      <Navbar onSetView={setCurrentView} currentView={currentView} />

      <main className="container mx-auto px-6 pt-12">
        {currentView === "dashboard" && (
          <>
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                From Scroll to <span className="tiktok-gradient bg-clip-text text-transparent">Table.</span>
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto text-lg">
                Paste a link from your favorite food creator to instantly extract ingredients and steps.
              </p>
            </div>

            <UrlInput onExtract={extractFromUrl} isLoading={processingState !== "idle" && processingState !== "error"} />

            {["fetching", "analyzing", "synthesizing"].includes(processingState) ? (
              <div className="py-12">
                <ProcessingVisualizer />
              </div>
            ) : (
              <section className="mt-16 animate-fadeIn">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-6 gap-4">
                  <div>
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <i className="fa-solid fa-rectangle-list text-pink-500"></i> My Recipe Vault
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{recipes.length} Recipes Total</p>
                  </div>

                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                      <span className="text-[10px] uppercase font-bold text-slate-500 ml-2 mr-1">Filter</span>
                      {(["all", "extracted", "validated"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                            filter === f ? "bg-pink-500 text-white" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                      <span className="text-[10px] uppercase font-bold text-slate-500 ml-2 mr-1">Sort</span>
                      {(["date", "title", "status"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSortBy(s)}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                            sortBy === s ? "bg-cyan-500 text-white" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredAndSortedRecipes.length === 0 ? (
                  <div className="text-center py-20 glass-panel rounded-3xl border-dashed border-2 border-white/5">
                    <i className="fa-solid fa-utensils text-4xl text-slate-700 mb-4"></i>
                    <p className="text-slate-500">
                      {recipes.length === 0 ? "Your vault is empty. Paste a link to start." : "No recipes match your filter."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filteredAndSortedRecipes.map((recipe) => (
                      <RecipeCard key={recipe.id} recipe={recipe} onClick={setSelectedRecipe} onDelete={handleDeleteRecipe} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {currentView === "planner" && (
          <section className="animate-fadeIn">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black mb-2">
                Weekly <span className="text-cyan-400">Meal Planner</span>
              </h2>
              <p className="text-slate-400">Plan your extracted recipes into your weekly schedule.</p>
            </div>

            <div className="flex justify-center mb-10">
              <button
                onClick={handleGenerateShopping}
                className="px-6 py-3 rounded-2xl font-black bg-pink-500 hover:bg-pink-400 text-white transition-all shadow-xl shadow-pink-900/20 flex items-center gap-3"
              >
                <i className="fa-solid fa-basket-shopping"></i>
                Generate Shopping List
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {DAYS.map((day) => (
                <div key={day} className="glass-panel p-4 rounded-2xl min-h-[350px] flex flex-col border-white/5 bg-slate-900/40">
                  <h4 className="font-bold text-slate-400 mb-4 pb-2 border-b border-white/10 text-center uppercase text-[10px] tracking-widest">
                    {day}
                  </h4>

                  <div className="flex-1 space-y-3">
                    {(planner[day] || []).map((rid) => {
                      const recipe = recipes.find((r) => r.id === rid);
                      if (!recipe) return null;
                      return (
                        <div
                          key={rid}
                          className="group relative bg-slate-800/50 p-3 rounded-xl border border-white/10 hover:border-pink-500/30 transition-all"
                        >
                          <img src={recipe.thumbnail_url} className="w-full h-20 object-cover rounded-lg mb-2 opacity-80" alt="" />
                          <p className="text-[11px] font-bold line-clamp-2 pr-4">{recipe.title}</p>
                          <button
                            onClick={() => removeFromPlanner(day, rid)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all p-1 bg-black/40 rounded-full"
                          >
                            <i className="fa-solid fa-xmark text-[10px]"></i>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setShowPickerForDay(day)}
                    className="mt-4 flex flex-col gap-2 items-center justify-center h-20 border-2 border-dashed border-white/10 rounded-xl text-slate-500 hover:text-pink-400 hover:border-pink-500/30 hover:bg-pink-500/5 transition-all text-[10px] text-center p-2"
                  >
                    <i className="fa-solid fa-plus-circle text-lg"></i>
                    Add Meal
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentView === "shopping" && (
          <ShoppingListView
            shoppingList={shoppingList}
            planner={planner}
            recipes={recipes}
            onGenerate={handleGenerateShopping}
            onToggleItem={toggle}
            onResetChecks={reset}
            onClear={clear}
          />
        )}

        {currentView === "settings" && <Settings onClearRecipes={handleClearRecipes} onClearPlanner={handleClearPlanner} />}
      </main>

      {showPickerForDay && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-panel w-full max-w-lg rounded-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl border-pink-500/20">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900">
              <h3 className="font-bold">Select Recipe for {showPickerForDay}</h3>
              <button onClick={() => setShowPickerForDay(null)} className="text-slate-400 hover:text-white p-2">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-950">
              {recipes.length === 0 ? (
                <p className="text-center text-slate-500 py-12">No recipes in your vault yet.</p>
              ) : (
                recipes.map((r: Recipe) => (
                  <button
                    key={r.id}
                    onClick={() => addToPlanner(showPickerForDay, r.id)}
                    className="w-full text-left p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all flex gap-4 items-center group"
                  >
                    <img src={r.thumbnail_url} className="w-14 h-14 rounded-lg object-cover group-hover:scale-105 transition-transform" alt="" />
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-sm truncate">{r.title}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{r.creator}</p>
                    </div>
                    <i className="fa-solid fa-plus text-slate-700 group-hover:text-pink-500 transition-colors mr-2"></i>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedRecipe && <RecipeEditor recipe={selectedRecipe} onSave={saveRecipe} onClose={() => setSelectedRecipe(null)} />}

      {processingState === "error" && renderErrorToast()}
    </div>
  );
};

export default App;
