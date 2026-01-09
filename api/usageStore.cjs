// api/usageStore.cjs
// Persistent usage counters using SQLite (better-sqlite3).
// Stores per-user/per-period counters so limits survive server restarts.

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Location: .cache/usage.sqlite (fits local-first + already ignored)
const DB_PATH = process.env.TTT_USAGE_DB_PATH || path.join(process.cwd(), ".cache", "usage.sqlite");

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDirExists(DB_PATH);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS usage_counters (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    resetAtIso TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_usage_reset ON usage_counters (resetAtIso);
`);

const stmtGet = db.prepare(`SELECT key, count, resetAtIso FROM usage_counters WHERE key = ?`);
const stmtUpsert = db.prepare(`
  INSERT INTO usage_counters (key, count, resetAtIso)
  VALUES (@key, @count, @resetAtIso)
  ON CONFLICT(key) DO UPDATE SET
    count = excluded.count,
    resetAtIso = excluded.resetAtIso
`);

const stmtDelete = db.prepare(`DELETE FROM usage_counters WHERE key = ?`);

// Optional housekeeping: remove expired keys (safe, not required)
const stmtDeleteExpired = db.prepare(`DELETE FROM usage_counters WHERE resetAtIso <= ?`);

function get(key) {
  return stmtGet.get(key) || null;
}

function set(key, count, resetAtIso) {
  stmtUpsert.run({ key, count, resetAtIso });
}

/**
 * Increments usage counter if within limit.
 * - Resets the counter automatically if stored resetAtIso != expected resetAtIso (new period)
 * - Returns { ok, used, limit, resetAtIso }
 */
function incrWithLimit(key, limit, expectedResetAtIso) {
  const row = get(key);

  // New key or period changed → reset
  if (!row || row.resetAtIso !== expectedResetAtIso) {
    const next = 1;
    if (next > limit) {
      // edge-case: limit 0
      set(key, 0, expectedResetAtIso);
      return { ok: false, used: 0, limit, resetAtIso: expectedResetAtIso };
    }
    set(key, next, expectedResetAtIso);
    return { ok: true, used: next, limit, resetAtIso: expectedResetAtIso };
  }

  const next = (row.count || 0) + 1;
  if (next > limit) {
    return { ok: false, used: row.count, limit, resetAtIso: row.resetAtIso };
  }

  set(key, next, row.resetAtIso);
  return { ok: true, used: next, limit, resetAtIso: row.resetAtIso };
}

function resetKey(key) {
  stmtDelete.run(key);
}

function cleanupExpired() {
  try {
    stmtDeleteExpired.run(new Date().toISOString());
  } catch {
    // ignore
  }
}

module.exports = {
  DB_PATH,
  get,
  set,
  incrWithLimit,
  resetKey,
  cleanupExpired,
};
