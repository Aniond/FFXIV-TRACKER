/**
 * routes/users.js — public profiles and per-user settings (stash,
 * preferences, jobs, linked character).
 */
const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware');

const router = express.Router();

const USER_SELECT = 'SELECT id, discord_id, username, avatar, nuts_stash, pref_view, pref_accent, pref_density, created_at FROM users WHERE id = $1';

// Public profile — no auth required
router.get('/api/profile/:slug', async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const u = await pool.query(
      `SELECT id, username, slug, world, dc, lodestone_id, xivapi_cache, portrait_url, lifetime_cleared
       FROM users WHERE slug = $1 OR LOWER(username) = $1 LIMIT 1`,
      [slug]
    );
    if (!u.rows.length) return res.status(404).json({ error: 'not found' });
    const user = u.rows[0];
    const [huntsRes, progressRes, jobsRes] = await Promise.all([
      pool.query('SELECT id, name, rank, zone, reward, status FROM hunts ORDER BY id'),
      pool.query('SELECT hunt_id, status, updated_at FROM progress WHERE user_id = $1', [user.id]),
      pool.query('SELECT job_abbr, level FROM user_jobs WHERE user_id = $1', [user.id]),
    ]);
    res.json({ user, hunts: huntsRes.rows, progress: progressRes.rows, xivapi: user.xivapi_cache || null, jobs: jobsRes.rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Manual Lodestone refresh — pulls fresh data for the logged-in user right now.
// Per-user cooldown: each call deliberately busts the cache and live-scrapes

// Link Lodestone character (saves lodestone_id, world, dc, portrait_url)
router.patch('/api/user/character', authenticate, async (req, res) => {
  const { lodestone_id, world, dc, portrait_url } = req.body;
  try {
    await pool.query(
      `UPDATE users SET lodestone_id = $2, world = $3, dc = $4, portrait_url = $5 WHERE id = $1`,
      [req.user.id, lodestone_id || null, world || null, dc || null, portrait_url || null]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Job levels
router.get('/api/user/jobs', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT job_abbr, level FROM user_jobs WHERE user_id = $1 ORDER BY job_abbr',
      [req.user.id]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/api/user/jobs', authenticate, async (req, res) => {
  const { jobs } = req.body;
  if (!Array.isArray(jobs)) return res.status(400).json({ error: 'jobs must be an array' });
  try {
    for (const { job_abbr, level } of jobs) {
      if (!job_abbr || typeof level !== 'number') continue;
      const clean = Math.max(0, Math.min(100, Math.floor(level)));
      await pool.query(
        `INSERT INTO user_jobs (user_id, job_abbr, level)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, job_abbr) DO UPDATE SET level = $3, updated_at = NOW()`,
        [req.user.id, job_abbr.toUpperCase(), clean]
      );
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(USER_SELECT, [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ ...result.rows[0], is_admin: req.user.discord_id === process.env.ADMIN_DISCORD_ID });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/api/user/stash', authenticate, async (req, res) => {
  const { nuts } = req.body;
  if (nuts == null || !Number.isInteger(nuts) || nuts < 0) return res.status(400).json({ error: 'nuts must be a non-negative integer' });
  try {
    await pool.query('UPDATE users SET nuts_stash = $2 WHERE id = $1', [req.user.id, nuts]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/api/user/preferences', authenticate, async (req, res) => {
  const { view, accent, density } = req.body;
  try {
    await pool.query(
      'UPDATE users SET pref_view = COALESCE($2, pref_view), pref_accent = COALESCE($3, pref_accent), pref_density = COALESCE($4, pref_density) WHERE id = $1',
      [req.user.id, view || null, accent || null, density || null]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
module.exports.USER_SELECT = USER_SELECT;
