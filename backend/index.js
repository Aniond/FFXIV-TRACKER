require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const pool = require('./db');
const aiSearchRouter = require('./ai/search');
const { startJobs } = require('./jobs');

/**
 * index.js — app wiring only. Routes live in backend/routes/* (full paths,
 * mounted at '/'), auth guards in backend/middleware.js, cron in jobs.js.
 */

// Fail fast: without JWT_SECRET every login 500s and every verify silently
// rejects — a misconfigured deploy should die loudly at boot instead.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set — refusing to start');
}

const app = express();
// Railway terminates TLS at a proxy; trust X-Forwarded-For so req.ip is the
// real client IP (needed for the per-IP Lodestone rate limit).
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'https://ffxivlog.com',
  'https://www.ffxivlog.com',
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server calls (no origin) and known frontend origins.
    // Disallowed origins get cb(null, false) — no CORS headers, browser blocks —
    // instead of an Error, which would fall through to Express's 500 handler.
    cb(null, !origin || ALLOWED_ORIGINS.includes(origin));
  },
  credentials: true,
}));
app.use(express.json());
app.use(passport.initialize());

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Public feature-flag read — lets the frontend decide whether to show the AI UI.
app.get('/api/flags', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, enabled FROM feature_flags');
    const flags = Object.fromEntries(result.rows.map((r) => [r.key, r.enabled]));
    res.json(flags);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI search assistant — POST /api/ai/search (JWT + flag/admin gated, see ai/search.js)
app.use('/api/ai/search', aiSearchRouter);

// Feature routers (each keeps its full original paths).
app.use(require('./routes/auth'));
app.use(require('./routes/users'));
app.use(require('./routes/lodestone'));
app.use(require('./routes/hunts'));
app.use(require('./routes/recipes'));
app.use(require('./routes/prices'));
app.use(require('./routes/admin'));

startJobs();

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
