/**
 * routes/hunts.js — hunt catalog (public read, admin CRUD), per-user
 * progress, and community submissions.
 */
const express = require('express');
const pool = require('../db');
const { authenticate, adminAuth, isFlagEnabled } = require('../middleware');

const router = express.Router();

// Hunts — PostgreSQL as source of truth
const HUNT_SELECT = `
  SELECT id, name, rank, type,
    bill_number   AS "billNumber",
    zone, area, coords,
    coords_note   AS "coordsNote",
    targets, reward, authority, tips, status
  FROM hunts ORDER BY id
`;

router.get('/api/hunts', async (req, res) => {
  try {
    const result = await pool.query(HUNT_SELECT);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to load hunt data' });
  }
});

// Recipes — Dawntrail crafting data (currently Culinarian). Public read.


router.post('/api/hunts', adminAuth, async (req, res) => {
  const { name, rank, type, billNumber, zone, area, coords, coordsNote, targets, reward, authority, tips, status } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO hunts (name, rank, type, bill_number, zone, area, coords, coords_note, targets, reward, authority, tips, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, name, rank, type, bill_number AS "billNumber", zone, area, coords,
                 coords_note AS "coordsNote", targets, reward, authority, tips, status`,
      [name, rank, type, billNumber, zone, area, coords, coordsNote, targets ?? 1, reward, authority, tips ?? [], status ?? 'todo']
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/api/hunts/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const fields = { name: req.body.name, rank: req.body.rank, type: req.body.type,
    bill_number: req.body.billNumber, zone: req.body.zone, area: req.body.area,
    coords: req.body.coords, coords_note: req.body.coordsNote, targets: req.body.targets,
    reward: req.body.reward, authority: req.body.authority, tips: req.body.tips,
    status: req.body.status };
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return res.status(400).json({ error: 'No fields to update' });
  const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const values = entries.map(([, v]) => v);
  try {
    const result = await pool.query(
      `UPDATE hunts SET ${sets}, updated_at = NOW() WHERE id = $1
       RETURNING id, name, rank, type, bill_number AS "billNumber", zone, area, coords,
                 coords_note AS "coordsNote", targets, reward, authority, tips, status`,
      [id, ...values]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Hunt not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/api/hunts/:id', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM hunts WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Hunt not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Progress
router.post('/api/progress', authenticate, async (req, res) => {
  const { hunt_id, status } = req.body;
  if (!hunt_id || !status) return res.status(400).json({ error: 'hunt_id and status are required' });
  const huntId = Number(hunt_id);
  if (!Number.isInteger(huntId)) return res.status(400).json({ error: 'hunt_id must be an integer' });
  if (!['todo', 'done'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  try {
    // Single atomic statement: only inserts for real hunts (the SELECT joins
    // hunts, so fabricated ids do nothing), and only updates when the status
    // actually changes (the DO UPDATE WHERE re-evaluates under the row lock,
    // so two concurrent "done" posts can't both report a transition).
    const result = await pool.query(
      `INSERT INTO progress (user_id, hunt_id, status)
       SELECT $1, h.id, $3 FROM hunts h WHERE h.id = $2
       ON CONFLICT (user_id, hunt_id) DO UPDATE SET status = $3, updated_at = NOW()
         WHERE progress.status IS DISTINCT FROM $3
       RETURNING *`,
      [req.user.id, huntId, status]
    );

    if (!result.rows.length) {
      // Either the hunt doesn't exist, or the status didn't change (no-op).
      const exists = await pool.query('SELECT 1 FROM hunts WHERE id = $1', [huntId]);
      if (!exists.rows.length) return res.status(400).json({ error: 'unknown hunt_id' });
      const current = await pool.query(
        'SELECT * FROM progress WHERE user_id = $1 AND hunt_id = $2',
        [req.user.id, huntId]
      );
      return res.json(current.rows[0] || { user_id: req.user.id, hunt_id: huntId, status });
    }

    // A row came back ⇒ a real transition happened; count fresh "done"s.
    // (Resetting progress and redoing still counts — that is a real clear.)
    if (status === 'done') {
      await pool.query(
        'UPDATE users SET lifetime_cleared = lifetime_cleared + 1 WHERE id = $1',
        [req.user.id]
      );
    }

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/api/progress', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT hunt_id, status, updated_at FROM progress WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/api/progress', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM progress WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Community hunt submissions — gated by the ENABLE_SUBMISSIONS feature flag
router.post('/api/submit-hunt', authenticate, async (req, res) => {
  const { hunt_data } = req.body;
  if (!hunt_data) return res.status(400).json({ error: 'hunt_data is required' });
  try {
    if (!(await isFlagEnabled('ENABLE_SUBMISSIONS'))) {
      return res.status(403).json({ error: 'Submissions are not open right now' });
    }
    const result = await pool.query(
      `INSERT INTO submissions (user_id, hunt_data) VALUES ($1, $2) RETURNING *`,
      [req.user.id, JSON.stringify(hunt_data)]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
