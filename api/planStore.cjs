// api/planStore.cjs
// Persistent plan truth store (SQLite). Minimal: userId -> plan.
// Uses same DB file location pattern as usageStore (.cache/usage.sqlite).

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Keep this aligned with usageStore.cjs default
const DB_PATH = process.env.TTT_USAGE_DB_PATH || path.join(process.cwd(), ".cache", "usage.sqlite");

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDirExists(DB_PATH);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS plan_state (
    userId TEXT PRIMARY KEY,
    plan TEXT NOT NULL,
    source TEXT NOT NULL,
    stripeCustomerId TEXT,
    stripeSubscriptionId TEXT,
    updatedAtIso TEXT NOT NULL
  );
`);

const stmtGet = db.prepare(
  `SELECT userId, plan, source, stripeCustomerId, stripeSubscriptionId, updatedAtIso
   FROM plan_state
   WHERE userId = ?`
);

const stmtUpsert = db.prepare(`
  INSERT INTO plan_state (userId, plan, source, stripeCustomerId, stripeSubscriptionId, updatedAtIso)
  VALUES (@userId, @plan, @source, @stripeCustomerId, @stripeSubscriptionId, @updatedAtIso)
  ON CONFLICT(userId) DO UPDATE SET
    plan = excluded.plan,
    source = excluded.source,
    stripeCustomerId = excluded.stripeCustomerId,
    stripeSubscriptionId = excluded.stripeSubscriptionId,
    updatedAtIso = excluded.updatedAtIso
`);

function get(userId) {
  return stmtGet.get(userId) || null;
}

function set(userId, plan, source, stripeCustomerId, stripeSubscriptionId) {
  const p = String(plan || "").toLowerCase();
  if (p !== "free" && p !== "pro") throw new Error(`Invalid plan: ${plan}`);

  stmtUpsert.run({
    userId,
    plan: p,
    source: source || "stripe",
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    updatedAtIso: new Date().toISOString(),
  });
}

module.exports = {
  DB_PATH,
  get,
  set,
};
