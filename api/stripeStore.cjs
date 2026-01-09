// api/stripeStore.cjs
// Minimal dev-only persistence for Stripe webhook results.
// Stores a single global "pro_enabled" flag + last session/subscription IDs.

const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "..", ".cache");
const STORE_PATH = path.join(CACHE_DIR, "stripe.json");

function ensureDir() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { pro_enabled: false };
  }
}

function writeStore(data) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function markPro({ session_id, customer_id, subscription_id } = {}) {
  const cur = readStore();
  const next = {
    ...cur,
    pro_enabled: true,
    last_event_at: new Date().toISOString(),
    session_id: session_id || cur.session_id,
    customer_id: customer_id || cur.customer_id,
    subscription_id: subscription_id || cur.subscription_id,
  };
  writeStore(next);
  return next;
}

function getStatus() {
  return readStore();
}

module.exports = { markPro, getStatus };
