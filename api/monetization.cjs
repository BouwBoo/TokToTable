// api/monetization.cjs
// Minimal monetization layer (V3).
// Server-side enforced limits with persistent counters (SQLite via usageStore).

const crypto = require("crypto");
const usageStore = require("./usageStore.cjs");
const planStore = require("./planStore.cjs");


// ----------------------------
// Limits (from V3 contract)
// ----------------------------
const FREE_WEEKLY_EXTRACT_LIMIT = Number(process.env.FREE_WEEKLY_EXTRACT_LIMIT || 5);
const PRO_MONTHLY_EXTRACT_LIMIT = Number(process.env.PRO_MONTHLY_EXTRACT_LIMIT || 200);

// ----------------------------
// Helpers: plan + user id
// ----------------------------
function getPlan(req) {
  // Force plan for testing:
  // TTT_FORCE_PLAN=pro node server.cjs
  const forced = String(process.env.TTT_FORCE_PLAN || "").trim().toLowerCase();
  if (forced === "pro" || forced === "free") return forced;

  // Optional header override (used by Settings dev toggle)
  const h = String(req.headers["x-ttt-plan"] || "").trim().toLowerCase();
  if (h === "pro" || h === "free") return h;

  // Stripe truth (stored via webhook). Only used if no forced plan and no header override.
  try {
    const userId = getAnonUserId(req);
    const row = planStore.get(userId);
    if (row && (row.plan === "pro" || row.plan === "free")) return row.plan;
  } catch {
    // ignore
  }

  return "free";
}

function getAnonUserId(req) {
  // Best: frontend sends a stable ID in header x-ttt-user
  const fromHeader = String(req.headers["x-ttt-user"] || "").trim();
  if (fromHeader) return fromHeader.slice(0, 128);

  // Fallback: derive a semi-stable ID from ip + user-agent (dev only)
  const ip =
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown-ip";
  const ua = String(req.headers["user-agent"] || "unknown-ua");
  const raw = `${ip}::${ua}`;
  return "anon_" + crypto.createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

// ----------------------------
// Period logic
// ----------------------------
function startOfIsoWeek(d) {
  // ISO week starts Monday
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Sunday=7
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function startOfNextIsoWeek(d) {
  const s = startOfIsoWeek(d);
  s.setUTCDate(s.getUTCDate() + 7);
  return s;
}

function startOfMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

// ----------------------------
// Read-only status (no increment)
// ----------------------------
function getBillingStatus(req) {
  const now = new Date();
  const plan = getPlan(req);
  const userId = getAnonUserId(req);

  let periodKey, resetAt, limit;

  if (plan === "pro") {
    const s = startOfMonth(now);
    const n = startOfNextMonth(now);
    periodKey = `pro:${s.toISOString().slice(0, 7)}`; // YYYY-MM
    resetAt = n;
    limit = PRO_MONTHLY_EXTRACT_LIMIT;
  } else {
    const s = startOfIsoWeek(now);
    const n = startOfNextIsoWeek(now);
    periodKey = `free:${s.toISOString().slice(0, 10)}`; // YYYY-MM-DD (monday)
    resetAt = n;
    limit = FREE_WEEKLY_EXTRACT_LIMIT;
  }

  const key = `${userId}:extract:${periodKey}`;
  const expectedResetAtIso = resetAt.toISOString();

  // Optional housekeeping (cheap)
  usageStore.cleanupExpired();

  const row = usageStore.get(key);
  const used = row && row.resetAtIso === expectedResetAtIso ? Number(row.count || 0) : 0;

  return {
    ok: true,
    plan,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetAt: expectedResetAtIso,
    upgrade: plan === "free",
    debug: { userId, key, db: usageStore.DB_PATH },
  };
}


// ----------------------------
// Gate + increment (persistent)
// ----------------------------
function checkAndIncrementExtract(req) {
  const now = new Date();
  const plan = getPlan(req);
  const userId = getAnonUserId(req);

  let periodKey, resetAt, limit;

  if (plan === "pro") {
    const s = startOfMonth(now);
    const n = startOfNextMonth(now);
    periodKey = `pro:${s.toISOString().slice(0, 7)}`; // YYYY-MM
    resetAt = n;
    limit = PRO_MONTHLY_EXTRACT_LIMIT;
  } else {
    const s = startOfIsoWeek(now);
    const n = startOfNextIsoWeek(now);
    periodKey = `free:${s.toISOString().slice(0, 10)}`; // YYYY-MM-DD (monday)
    resetAt = n;
    limit = FREE_WEEKLY_EXTRACT_LIMIT;
  }

  const key = `${userId}:extract:${periodKey}`;
  const expectedResetAtIso = resetAt.toISOString();

  // Optional housekeeping (cheap)
  usageStore.cleanupExpired();

  const r = usageStore.incrWithLimit(key, limit, expectedResetAtIso);

  if (!r.ok) {
    return {
      ok: false,
      status: 429,
      payload: {
        ok: false,
        error: "limit_reached",
        plan,
        limit,
        used: r.used,
        resetAt: r.resetAtIso,
        upgrade: plan === "free",
      },
      debug: { userId, key, db: usageStore.DB_PATH },
    };
  }

  return {
    ok: true,
    plan,
    limit,
    used: r.used,
    resetAt: r.resetAtIso,
    debug: { userId, key, db: usageStore.DB_PATH },
  };
}

module.exports = {
  getPlan,
  getAnonUserId,
  getBillingStatus,
  checkAndIncrementExtract,
};

