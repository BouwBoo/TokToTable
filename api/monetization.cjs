// api/monetization.cjs
// Minimal monetization layer for local dev (V3 start).
// Server-side enforced limits (in-memory store).
// No DB, no auth yet.

const crypto = require("crypto");

// ----------------------------
// Limits (from V3 contract)
// ----------------------------
const FREE_WEEKLY_EXTRACT_LIMIT = Number(process.env.FREE_WEEKLY_EXTRACT_LIMIT || 5);
const PRO_MONTHLY_EXTRACT_LIMIT = Number(process.env.PRO_MONTHLY_EXTRACT_LIMIT || 200);

// In-memory counters: key -> { count, resetAtIso }
const counters = new Map();

// ----------------------------
// Helpers: plan + user id
// ----------------------------
function getPlan(req) {
  // Force plan for testing:
  // TTT_FORCE_PLAN=pro node server.cjs
  const forced = String(process.env.TTT_FORCE_PLAN || "").trim().toLowerCase();
  if (forced === "pro" || forced === "free") return forced;

  // Optional header override for dev tooling
  const h = String(req.headers["x-ttt-plan"] || "").trim().toLowerCase();
  if (h === "pro" || h === "free") return h;

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
// Gate + increment
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

  const current = counters.get(key) || { count: 0, resetAtIso: resetAt.toISOString() };
  const nextCount = current.count + 1;

  if (nextCount > limit) {
    return {
      ok: false,
      status: 429,
      payload: {
        ok: false,
        error: "limit_reached",
        plan,
        limit,
        used: current.count,
        resetAt: current.resetAtIso,
        upgrade: plan === "free",
      },
      debug: { userId, key },
    };
  }

  counters.set(key, { count: nextCount, resetAtIso: current.resetAtIso });

  return {
    ok: true,
    plan,
    limit,
    used: nextCount,
    resetAt: current.resetAtIso,
    debug: { userId, key },
  };
}

module.exports = {
  getPlan,
  getAnonUserId,
  checkAndIncrementExtract,
};
