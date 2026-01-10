// pages/BillingSuccess.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function BillingSuccess() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const sessionId = params.get("session_id");

  const [didSetPro, setDidSetPro] = useState(false);
  const [seconds, setSeconds] = useState(2);

  useEffect(() => {
    // ✅ Checkpoint 2 stub:
    // Stripe-success => markeer lokaal als Pro (so Settings + headers meteen kloppen)
    try {
      localStorage.setItem("ttt_plan_override", "pro");
      if (sessionId) localStorage.setItem("ttt_last_stripe_session", sessionId);
    } catch {
      // ignore
    }
    setDidSetPro(true);

    // kleine countdown + auto redirect
    const tick = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    const go = setTimeout(() => {
      window.location.href = "/app";
    }, 1800);

    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen text-slate-100 bg-[#070A18] flex items-start justify-center px-6 pt-24">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <i className="fa-solid fa-check text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black">Payment successful</h1>
            <p className="text-slate-400 text-sm">Thanks! You can close this page and return to TokToTable.</p>
          </div>
        </div>

        <div className="mt-6 space-y-2 text-xs text-slate-400">
          <div>
            <span className="text-slate-500">Session:</span>{" "}
            <span className="font-mono break-all">{sessionId || "(missing session_id)"}</span>
          </div>
          <div>
            <span className="text-slate-500">Local plan:</span>{" "}
            <span className="font-black">{didSetPro ? "pro (stub set)" : "…"}</span>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Link
            to="/app"
            className="inline-flex items-center justify-center px-5 py-3 rounded-2xl font-black bg-emerald-600 hover:bg-emerald-500 transition-all"
          >
            Back to app
          </Link>

          <span className="text-[11px] text-slate-500">Redirecting in {seconds}s…</span>
        </div>

        <p className="mt-6 text-[10px] text-slate-500 leading-tight">
          Dev note: this sets <code className="text-slate-200">ttt_plan_override=pro</code> so the backend receives{" "}
          <code className="text-slate-200">x-ttt-plan</code> and billing status shows Pro.
        </p>
      </div>
    </div>
  );
}
