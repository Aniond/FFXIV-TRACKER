require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(passport.initialize());

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3001/auth/discord/callback',
  scope: ['identify'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { id, username, avatar } = profile;
    const result = await pool.query(
      `INSERT INTO users (discord_id, username, avatar)
       VALUES ($1, $2, $3)
       ON CONFLICT (discord_id) DO UPDATE SET username = $2, avatar = $3
       RETURNING *`,
      [id, username, avatar]
    );
    return done(null, result.rows[0]);
  } catch (err) {
    return done(err);
  }
}));

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  if (token !== process.env.API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Discord OAuth
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', { session: false, failureRedirect: `${process.env.FRONTEND_URL}?auth=failed` }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, discord_id: req.user.discord_id, username: req.user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);
  }
);

const USER_SELECT = 'SELECT id, discord_id, username, avatar, nuts_stash, pref_view, pref_accent, pref_density, created_at FROM users WHERE id = $1';

app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(USER_SELECT, [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(USER_SELECT, [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/user/stash', authenticate, async (req, res) => {
  const { nuts } = req.body;
  if (nuts == null || !Number.isInteger(nuts) || nuts < 0) return res.status(400).json({ error: 'nuts must be a non-negative integer' });
  try {
    await pool.query('UPDATE users SET nuts_stash = $2 WHERE id = $1', [req.user.id, nuts]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/user/preferences', authenticate, async (req, res) => {
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

// Hunts — PostgreSQL as source of truth
const HUNT_SELECT = `
  SELECT id, name, rank, type,
    bill_number   AS "billNumber",
    zone, area, coords,
    coords_note   AS "coordsNote",
    targets, reward, authority, tips, status
  FROM hunts ORDER BY id
`;

app.get('/api/hunts', async (req, res) => {
  try {
    const result = await pool.query(HUNT_SELECT);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to load hunt data' });
  }
});

app.post('/api/hunts', adminAuth, async (req, res) => {
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

app.patch('/api/hunts/:id', adminAuth, async (req, res) => {
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

app.delete('/api/hunts/:id', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM hunts WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Hunt not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Progress
app.post('/api/progress', authenticate, async (req, res) => {
  const { hunt_id, status } = req.body;
  if (!hunt_id || !status) return res.status(400).json({ error: 'hunt_id and status are required' });
  try {
    const result = await pool.query(
      `INSERT INTO progress (user_id, hunt_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, hunt_id) DO UPDATE SET status = $3, updated_at = NOW()
       RETURNING *`,
      [req.user.id, hunt_id, status]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/progress', authenticate, async (req, res) => {
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

app.delete('/api/progress', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM progress WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Community hunt submissions
app.post('/api/submit-hunt', authenticate, async (req, res) => {
  const { hunt_data } = req.body;
  if (!hunt_data) return res.status(400).json({ error: 'hunt_data is required' });
  try {
    const result = await pool.query(
      `INSERT INTO submissions (user_id, hunt_data) VALUES ($1, $2) RETURNING *`,
      [req.user.id, JSON.stringify(hunt_data)]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
