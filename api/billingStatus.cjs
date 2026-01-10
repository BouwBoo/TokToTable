// api/billingStatus.cjs
// Read-only billing/entitlements status endpoint (Checkpoint 2.1)

const monetization = require("./monetization.cjs");
const usageStore = require("./usageStore.cjs");

const FREE_WEEKLY_EXTRACT_LIMIT = Number(process.env.FREE_WEEKLY_EXTRACT_LIMIT || 5);
const PRO_MONTHLY_EXTRACT_LIMIT = Number(process.env.PRO_MONTHLY_EXTRACT_LIMIT || 200);

function startOfIsoWeek(d) {
  // ISO week starts Monday
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Sunday = 7
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

function buildExtractKey(plan, userId, now) {
  if (plan === "pro") {
    const s = startOfMonth(now);
    const n = startOfNextMonth(now);
    const periodKey = `pro:${s.toISOString().slice(0, 7)}`; // YYYY-MM
    return {
      key: `${userId}:extract:${periodKey}`,
      limit: PRO_MONTHLY_EXTRACT_LIMIT,
      resetAtIso: n.toISOString(),
      period: "month",
    };
  }

  const s = startOfIsoWeek(now);
  const n = startOfNextIsoWeek(now);
  const periodKey = `free:${s.toISOString().slice(0, 10)}`; // YYYY-MM-DD (monday)
  return {
    key: `${userId}:extract:${periodKey}`,
    limit: FREE_WEEKLY_EXTRACT_LIMIT,
    resetAtIso: n.toISOString(),
    period: "week",
  };
}

function handleBillingStatus(req, res) {
  const now = new Date();
  const plan = monetization.getPlan(req);
  const userId = monetization.getAnonUserId(req);

  const x = buildExtractKey(plan, userId, now);
  const row = usageStore.get(x.key);
  const used = row && typeof row.count === "number" ? row.count : 0;
  const remaining = Math.max(0, x.limit - used);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ok: true,
      userId,
      plan,
      isPro: plan === "pro",
      entitlements: {
        extracts: {
          limit: x.limit,
          period: x.period,
          used,
          remaining,
          resetAt: x.resetAtIso,
        },
      },
      source: "stub",
      asOf: now.toISOString(),
    })
  );
}

module.exports = { handleBillingStatus };
