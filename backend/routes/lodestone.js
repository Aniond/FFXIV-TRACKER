/**
 * routes/lodestone.js — Lodestone character search/detail proxy (cached,
 * per-IP rate-limited) and the per-user manual job refresh.
 */
const express = require('express');
const pool = require('../db');
const { searchCharacter, fetchCharacter } = require('../lodestone');
const { refreshUserJobs } = require('../refresh');
const { authenticate, lodestoneLimiter } = require('../middleware');

const router = express.Router();

// the Lodestone, so don't let one user hammer it.
const REFRESH_COOLDOWN_MS = 5 * 60_000;
const lastRefresh = new Map(); // user id -> timestamp
router.post('/api/user/refresh-jobs', authenticate, async (req, res) => {
  const last = lastRefresh.get(req.user.id) || 0;
  if (Date.now() - last < REFRESH_COOLDOWN_MS) {
    const wait = Math.ceil((REFRESH_COOLDOWN_MS - (Date.now() - last)) / 1000);
    return res.status(429).json({ error: `Recently refreshed — try again in ${wait}s` });
  }
  try {
    const u = await pool.query('SELECT lodestone_id FROM users WHERE id = $1', [req.user.id]);
    if (!u.rows[0]?.lodestone_id) {
      return res.status(400).json({ error: 'No Lodestone character linked — use Link Character first' });
    }
    lastRefresh.set(req.user.id, Date.now());
    const result = await refreshUserJobs(pool, req.user.id, u.rows[0].lodestone_id);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[refresh-jobs manual]', err.message);
    res.status(503).json({ error: 'Lodestone refresh failed — try again later' });
  }
});


// Lodestone character search — unauthenticated, cached 24 h, rate-limited per IP
router.post('/api/character/search', lodestoneLimiter, async (req, res) => {
  const name   = (req.body.name   || '').trim();
  const server = (req.body.server || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const cacheKey = `search:${name.toLowerCase()}:${server.toLowerCase()}`;
  try {
    const cached = await pool.query(
      'SELECT data FROM lodestone_cache WHERE cache_key = $1 AND expires_at > NOW()',
      [cacheKey]
    );
    if (cached.rows[0]) return res.json({ ...cached.rows[0].data, cached: true });

    const data = await searchCharacter(name, server || undefined);

    await pool.query(
      `INSERT INTO lodestone_cache (cache_key, data, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')
       ON CONFLICT (cache_key) DO UPDATE SET data = $2, expires_at = NOW() + INTERVAL '24 hours'`,
      [cacheKey, JSON.stringify(data)]
    );
    res.json(data);
  } catch (err) {
    console.error('[lodestone search]', err.message);
    res.status(503).json({ error: 'Lodestone unreachable' });
  }
});

// Lodestone character detail — unauthenticated, cached 1 h, rate-limited per IP
router.get('/api/character/:id', lodestoneLimiter, async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid character ID' });

  const cacheKey = `char:${id}`;
  try {
    const cached = await pool.query(
      'SELECT data FROM lodestone_cache WHERE cache_key = $1 AND expires_at > NOW()',
      [cacheKey]
    );
    if (cached.rows[0]) return res.json({ ...cached.rows[0].data, cached: true });

    const data = await fetchCharacter(id);
    if (!data) return res.status(404).json({ error: 'Character not found' });

    await pool.query(
      `INSERT INTO lodestone_cache (cache_key, data, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')
       ON CONFLICT (cache_key) DO UPDATE SET data = $2, expires_at = NOW() + INTERVAL '1 hour'`,
      [cacheKey, JSON.stringify(data)]
    );
    res.json(data);
  } catch (err) {
    console.error('[lodestone char]', err.message);
    res.status(503).json({ error: 'Lodestone unreachable' });
  }
});


module.exports = router;
