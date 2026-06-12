/**
 * routes/admin.js — admin dashboard API. Every route is adminJWT-gated
 * (valid JWT AND discord_id === ADMIN_DISCORD_ID).
 */
const express = require('express');
const pool = require('../db');
const { adminJWT, BAN_CACHE } = require('../middleware');

const router = express.Router();

// ── Admin: overview stats ───────────────────────────────────────────────────
router.get('/api/admin/stats', adminJWT, async (req, res) => {
  try {
    const [totalUsers, activeToday, queriesToday, queriesMonth, signups7d, monthTokens] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE banned = false"),
      pool.query(`
        SELECT COUNT(DISTINCT uid) FROM (
          SELECT user_id AS uid FROM progress   WHERE updated_at > NOW() - INTERVAL '1 day'
          UNION
          SELECT user_id AS uid FROM ai_queries WHERE created_at > NOW() - INTERVAL '1 day' AND user_id IS NOT NULL
        ) t
      `),
      pool.query("SELECT COUNT(*) FROM ai_queries WHERE created_at > NOW() - INTERVAL '1 day'"),
      pool.query("SELECT COUNT(*) FROM ai_queries WHERE created_at >= DATE_TRUNC('month', NOW())"),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days'"),
      pool.query(`
        SELECT
          COALESCE(SUM(tokens_in), 0)::int  AS tokens_in,
          COALESCE(SUM(tokens_out), 0)::int AS tokens_out
        FROM ai_queries
        WHERE created_at >= DATE_TRUNC('month', NOW())
      `),
    ]);
    res.json({
      totalUsers:      parseInt(totalUsers.rows[0].count),
      activeToday:     parseInt(activeToday.rows[0].count),
      queriesToday:    parseInt(queriesToday.rows[0].count),
      queriesMonth:    parseInt(queriesMonth.rows[0].count),
      signups7d:       parseInt(signups7d.rows[0].count),
      monthTokensIn:   monthTokens.rows[0].tokens_in,
      monthTokensOut:  monthTokens.rows[0].tokens_out,
    });
  } catch (err) {
    console.error('[admin/stats]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: users list ───────────────────────────────────────────────────────
router.get('/api/admin/users', adminJWT, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.discord_id, u.username, u.avatar, u.created_at, u.banned,
        GREATEST(MAX(p.updated_at), MAX(aq.created_at)) AS last_active,
        COUNT(DISTINCT aq.id)::int AS query_count
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      LEFT JOIN ai_queries aq ON aq.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/users]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: ban / unban user ─────────────────────────────────────────────────
router.post('/api/admin/users/:id/ban', adminJWT, async (req, res) => {
  const { banned } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET banned = $2 WHERE id = $1 RETURNING id, username, banned',
      [req.params.id, !!banned]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    BAN_CACHE.delete(result.rows[0].id); // take effect immediately, not after the 60s cache
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin/ban]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: AI query log (last 50) ───────────────────────────────────────────
router.get('/api/admin/queries', adminJWT, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT aq.id, aq.user_id, u.username, aq.query_text,
             aq.tokens_in, aq.tokens_out, aq.cached, aq.created_at
      FROM ai_queries aq
      LEFT JOIN users u ON u.id = aq.user_id
      ORDER BY aq.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/queries]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: community submissions ────────────────────────────────────────────
router.get('/api/admin/submissions', adminJWT, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.hunt_data, s.status, s.created_at, u.username, u.discord_id
      FROM submissions s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/submissions]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/api/admin/submissions/:id', adminJWT, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved, rejected, or pending' });
  }
  try {
    const result = await pool.query(
      'UPDATE submissions SET status = $2 WHERE id = $1 RETURNING *',
      [req.params.id, status]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Submission not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin/submissions patch]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: feature flags ────────────────────────────────────────────────────
router.get('/api/admin/flags', adminJWT, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, enabled, description FROM feature_flags ORDER BY key');
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/flags]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/api/admin/flags/:key', adminJWT, async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });
  try {
    const result = await pool.query(
      'UPDATE feature_flags SET enabled = $2 WHERE key = $1 RETURNING *',
      [req.params.key, enabled]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Flag not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin/flags patch]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin: Gemini API usage (from ai_queries log) ──────────────────────────
router.get('/api/admin/api-usage', adminJWT, async (req, res) => {
  try {
    const [today, month] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(tokens_in), 0)::int              AS tokens_in,
          COALESCE(SUM(tokens_out), 0)::int             AS tokens_out,
          COALESCE(SUM(tokens_in + tokens_out), 0)::int AS total_tokens,
          COUNT(*)::int                                 AS queries
        FROM ai_queries
        WHERE created_at > NOW() - INTERVAL '1 day'
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(tokens_in), 0)::int              AS tokens_in,
          COALESCE(SUM(tokens_out), 0)::int             AS tokens_out,
          COALESCE(SUM(tokens_in + tokens_out), 0)::int AS total_tokens,
          COUNT(*)::int                                 AS queries
        FROM ai_queries
        WHERE created_at >= DATE_TRUNC('month', NOW())
      `),
    ]);
    res.json({ today: today.rows[0], month: month.rows[0] });
  } catch (err) {
    console.error('[admin/api-usage]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
