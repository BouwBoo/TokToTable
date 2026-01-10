import React, { useState, useEffect } from "react";
import { fetchBillingStatus, BillingStatusResponse } from "../services/geminiService";


interface SettingsProps {
  onClearRecipes: () => void;
  onClearPlanner: () => void;
}

type Plan = "free" | "pro";

const Settings: React.FC<SettingsProps> = ({ onClearRecipes, onClearPlanner }) => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);


    const isDev =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost";


  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };

    const loadPlan = () => {
      try {
        const p = localStorage.getItem("ttt_plan_override");
        if (p === "pro" || p === "free") setPlan(p);
        else setPlan("free");
      } catch {
        setPlan("free");
      }
    };

    checkKey();
    loadPlan();

// Checkpoint 2.2: read-only billing status (no gating, no UI behavior change)
(async () => {
  try {
    const s = await fetchBillingStatus();
    setBillingStatus(s);
  } catch (e) {
    // Silent in UI: Settings must never break if API is unavailable (e.g. prod wiring later)
    console.warn("billing status unavailable:", e);
  }
})();


  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const setPlanOverride = (p: Plan) => {
    try {
      localStorage.setItem("ttt_plan_override", p);
    } catch {
      // ignore
    }
    setPlan(p);
    // reload so any stateful flows pick it up immediately
    window.location.reload();
  };

  const clearPlanOverride = () => {
    try {
      localStorage.removeItem("ttt_plan_override");
    } catch {
      // ignore
    }
    setPlan("free");
    window.location.reload();
  };

  const handleUpgradeCheckout = async () => {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
  });

  const data = await res.json();

  if (data?.url) {
    window.location.href = data.url;
  } else {
    alert("Failed to start Stripe checkout");
  }
};


  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black mb-2">
          System <span className="text-pink-500">Settings</span>
        </h2>
        <p className="text-slate-400 font-medium">Configure your AI extraction engine, manage data, and plan your subscription.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* AI CONFIGURATION */}
        <section className="glass-panel p-8 rounded-[32px] border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <i className="fa-solid fa-microchip text-2xl"></i>
            </div>
            <div>
              <h3 className="font-bold text-xl">AI Engine</h3>
              <p className="text-xs text-slate-500">Gemini Integration</p>
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-300">API Key Status</span>
              {hasKey ? (
                <span className="text-[10px] font-black uppercase px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                  Active
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2 py-1 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20">
                  Not Configured
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              TokToTable uses high-quality multimodal models. For best extraction results, select an API key from a paid billing project.
            </p>

            <button
              onClick={handleSelectKey}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20"
            >
              <i className="fa-solid fa-key"></i> {hasKey ? "Update API Key" : "Configure API Key"}
            </button>

            <a
              href="https://ai.google.dev/gemini-api/docs/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[10px] text-cyan-500 hover:underline font-bold"
            >
              <i className="fa-solid fa-circle-info mr-1"></i> Learn about API Billing
            </a>
          </div>
        </section>

        {/* DATA MANAGEMENT */}
        <section className="glass-panel p-8 rounded-[32px] border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400">
              <i className="fa-solid fa-database text-2xl"></i>
            </div>
            <div>
              <h3 className="font-bold text-xl">Data Vault</h3>
              <p className="text-xs text-slate-500">Local Storage Management</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Recipe Vault</p>
                <p className="text-[10px] text-slate-500">Remove all extracted recipes</p>
              </div>
              <button
                onClick={() => {
                  if (confirm("Delete all recipes?")) onClearRecipes();
                }}
                className="p-3 text-slate-400 hover:text-red-400 transition-colors"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Meal Planner</p>
                <p className="text-[10px] text-slate-500">Clear your weekly schedule</p>
              </div>
              <button
                onClick={() => {
                  if (confirm("Clear meal planner?")) onClearPlanner();
                }}
                className="p-3 text-slate-400 hover:text-red-400 transition-colors"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] text-amber-500 leading-tight">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
              Data is stored locally in your browser. Clearing cache or switching devices can cause data loss until sync/backup is enabled.
            </p>
          </div>
        </section>
      </div>

      {/* SUBSCRIPTION / PRICING */}
      <section className="glass-panel p-8 rounded-[32px] border-white/5 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <i className="fa-solid fa-bolt text-2xl"></i>
            </div>
            <div>
              <h3 className="font-bold text-xl">Subscription</h3>
              <p className="text-xs text-slate-500">Free vs Pro</p>
            </div>
          </div>

          <div>
            {plan === "pro" ? (
              <span className="text-[10px] font-black uppercase px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                Current plan: Pro
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase px-2 py-1 bg-slate-500/10 text-slate-300 rounded-md border border-white/10">
                Current plan: Free
              </span>
            )}
          </div>
          
          {billingStatus?.entitlements?.extracts ? (
            <p className="text-[10px] text-slate-500 mt-2">
              Extracts: {billingStatus.entitlements.extracts.used}/{billingStatus.entitlements.extracts.limit} used •{" "}
              {billingStatus.entitlements.extracts.remaining} left • reset:{" "}
              {new Date(billingStatus.entitlements.extracts.resetAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FREE */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-black text-lg">Free</p>
              <span className="text-[10px] font-black uppercase px-2 py-1 bg-white/5 text-slate-300 rounded-md border border-white/10">
                Limited
              </span>
            </div>
            <ul className="text-xs text-slate-300 space-y-2">
              <li>• 5 extracts / week</li>
              <li>• Local-only</li>
              <li>• Basic experience</li>
            </ul>

            {plan === "free" ? (
              <button
                onClick={clearPlanOverride}
                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-bold transition-all"
              >
                Keep Free
              </button>
                ) : isDev ? (
                  <button
                    onClick={() => setPlanOverride("free")}
                    className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-bold transition-all"
                  >
                    Switch to Free (dev)
                  </button>
                ) : null
                }
          </div>

          {/* PRO */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-black text-lg">Pro</p>
              <span className="text-[10px] font-black uppercase px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                €19 / month
              </span>
            </div>

            <ul className="text-xs text-slate-300 space-y-2">
              <li>• 200 extracts / month</li>
              <li>• AI enhancements included</li>
              <li>• Image handling included</li>
              <li>• Sync & history (coming)</li>
            </ul>

              {plan === "pro" ? (
                <button
                  disabled
                  className="w-full py-3 bg-emerald-600/60 text-white rounded-xl font-black transition-all opacity-80 cursor-not-allowed"
                >
                  Pro active
                </button>
              ) : (
                <button
                  onClick={handleUpgradeCheckout}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all shadow-lg shadow-emerald-900/20"
                >
                  Upgrade to Pro
                </button>
              )}

{isDev && (
            <div className="flex gap-2">
              {plan !== "pro" ? (
                <button
                  onClick={() => setPlanOverride("pro")}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all shadow-lg shadow-emerald-900/20"
                >
                  Enable Pro (dev)
                </button>
              ) : (
                <button
                  onClick={() => setPlanOverride("pro")}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all shadow-lg shadow-emerald-900/20"
                >
                  Pro enabled
                </button>
              )}

              <button
                onClick={clearPlanOverride}
                className="py-3 px-4 bg-white/10 hover:bg-white/15 text-white rounded-xl font-bold transition-all"
                title="Remove local dev override"
              >
                Reset
              </button>
            </div>
)}
            <p className="text-[10px] text-slate-500 leading-tight">
              AI costs money. Pro keeps TokToTable sustainable. (Checkout wiring comes next.)
            </p>
          </div>
        </div>

{isDev && (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-slate-400 leading-tight">
            <i className="fa-solid fa-circle-info mr-1"></i>
            Dev note: “Enable Pro (dev)” stores <code className="text-slate-200">ttt_plan_override</code> in localStorage and sends{" "}
            <code className="text-slate-200">x-ttt-plan</code> on requests.
          </p>
        </div>
        )}
      </section>

      <div className="text-center pt-8 border-t border-white/5">
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">TokToTable AI v2.x — V3 monetization wiring</p>
      </div>
    </div>
  );
};

export default Settings;
