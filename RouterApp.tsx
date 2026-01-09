import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AppEntry from './pages/AppEntry';

function BillingSuccess() {
  const { search } = useLocation();
  const sessionId = new URLSearchParams(search).get("session_id") || "";

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>✅ Payment successful</h1>
      <p>Thanks! You can close this page and return to TokToTable.</p>
      {sessionId ? (
        <p style={{ color: "#555" }}>
          Session: <code>{sessionId}</code>
        </p>
      ) : null}
      <p>
        <a
          href="/app"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            background: "#16a34a",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 800,
          }}
        >
          Back to app
        </a>
      </p>
      <p style={{ marginTop: 12 }}>
        <a href="/" style={{ color: "#0f172a" }}>
          Back to landing
        </a>
      </p>
    </div>
  );
}

function BillingCancel() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>❌ Payment cancelled</h1>
      <p>No worries — nothing was charged.</p>
      <p>
        <a
          href="/app"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            background: "#0f172a",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 800,
          }}
        >
          Back to app
        </a>
      </p>
      <p style={{ marginTop: 12 }}>
        <a href="/" style={{ color: "#0f172a" }}>
          Back to landing
        </a>
      </p>
    </div>
  );
}

export default function RouterApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppEntry />} />

        {/* ✅ Stripe return routes (minimal) */}
        <Route path="/billing/success" element={<BillingSuccess />} />
        <Route path="/billing/cancel" element={<BillingCancel />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
