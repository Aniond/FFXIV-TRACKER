/**
 * middleware.js — auth guards and shared request helpers.
 * Extracted verbatim from index.js (2026-06 foundations refactor).
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const BAN_CACHE = new Map(); // user id -> { banned, at }
const BAN_CACHE_MS = 60_000;
async function isBanned(userId) {
  const hit = BAN_CACHE.get(userId);
  if (hit && Date.now() - hit.at < BAN_CACHE_MS) return hit.banned;
  const r = await pool.query('SELECT banned FROM users WHERE id = $1', [userId]);
  const banned = r.rows[0]?.banned === true;
  BAN_CACHE.set(userId, { banned, at: Date.now() });
  return banned;
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  // Enforce bans everywhere, not just the AI endpoint — a 7-day token must not
  // outlive the ban. DB failure here fails open (auth already proved identity).
  try {
    if (await isBanned(req.user.id)) return res.status(403).json({ error: 'Account banned' });
  } catch (err) {
    console.error('[auth] ban check failed:', err.message);
  }
  next();
}

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  // Constant-time compare — `!==` leaks how many leading bytes matched.
  const a = Buffer.from(token);
  const b = Buffer.from(process.env.API_SECRET || '');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function isFlagEnabled(key) {
  const r = await pool.query('SELECT enabled FROM feature_flags WHERE key = $1', [key]);
  return r.rows[0]?.enabled === true;
}

// Minimal fixed-window per-key rate limiter (in-memory, per instance) for the
// unauthenticated Lodestone proxy routes — they trigger real scrapes of
// Square Enix's site, so unbounded anonymous use risks an IP ban + table bloat.
function rateLimit({ windowMs, max }) {
  const hits = new Map(); // key -> { n, resetAt }
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.resetAt <= now) { h = { n: 0, resetAt: now + windowMs }; hits.set(key, h); }
    if (++h.n > max) return res.status(429).json({ error: 'Too many requests — slow down' });
    next();
  };
}
const lodestoneLimiter = rateLimit({ windowMs: 60_000, max: 10 });

// ── Admin middleware ────────────────────────────────────────────────────────
// Verifies JWT and checks discord_id against ADMIN_DISCORD_ID env var.
// Returns 401 for missing/invalid token, 403 for wrong user (silent — no hint).
function adminJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.discord_id !== process.env.ADMIN_DISCORD_ID) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}


module.exports = { authenticate, adminAuth, adminJWT, isFlagEnabled, rateLimit, lodestoneLimiter, BAN_CACHE };
