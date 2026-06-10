require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const pool = require('./db');
const { searchCharacter, fetchCharacter } = require('./lodestone');
const { refreshUserJobs } = require('./refresh');
const aiSearchRouter = require('./ai/search');

// Fail fast: without JWT_SECRET every login 500s and every verify silently
// rejects — a misconfigured deploy should die loudly at boot instead.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set — refusing to start');
}

const app = express();
// Railway terminates TLS at a proxy; trust X-Forwarded-For so req.ip is the
// real client IP (needed for the per-IP Lodestone rate limit below).
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

// Ban checks hit the DB; cache verdicts briefly so hot users cost one query/min.
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

// Public profile — no auth required
app.get('/api/profile/:slug', async (req, res) => {
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
// the Lodestone, so don't let one user hammer it.
const REFRESH_COOLDOWN_MS = 5 * 60_000;
const lastRefresh = new Map(); // user id -> timestamp
app.post('/api/user/refresh-jobs', authenticate, async (req, res) => {
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

// Daily Lodestone refresh — 04:00 UTC every day
cron.schedule('0 4 * * *', async () => {
  console.log('[cron] Lodestone daily refresh started');
  try {
    // Purge expired cache rows — nothing else ever deletes them, and every
    // unique anonymous search inserts one.
    const purged = await pool.query('DELETE FROM lodestone_cache WHERE expires_at < NOW()');
    console.log(`[cron] purged ${purged.rowCount} expired lodestone_cache rows`);
    const users = await pool.query(
      'SELECT id, username, lodestone_id FROM users WHERE lodestone_id IS NOT NULL'
    );
    for (const user of users.rows) {
      try {
        const result = await refreshUserJobs(pool, user.id, user.lodestone_id);
        console.log(`[cron] ${user.username}: ${result.jobCount} jobs refreshed`);
      } catch (err) {
        console.error(`[cron] ${user.username} failed:`, err.message);
      }
      // Brief pause between users to be polite to Lodestone
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log('[cron] Lodestone daily refresh complete');
  } catch (err) {
    console.error('[cron] Fatal error:', err.message);
  }
});

// Lodestone character search — unauthenticated, cached 24 h, rate-limited per IP
app.post('/api/character/search', lodestoneLimiter, async (req, res) => {
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
app.get('/api/character/:id', lodestoneLimiter, async (req, res) => {
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

// Link Lodestone character (saves lodestone_id, world, dc, portrait_url)
app.patch('/api/user/character', authenticate, async (req, res) => {
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
app.get('/api/user/jobs', authenticate, async (req, res) => {
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

app.patch('/api/user/jobs', authenticate, async (req, res) => {
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
    const dest = req.user.discord_id === process.env.ADMIN_DISCORD_ID ? '/admin' : '/';
    // Fragment, not query string: #token= never leaves the browser (no server
    // logs, no Referer leak, no proxy/CDN capture of a 7-day bearer token).
    res.redirect(`${process.env.FRONTEND_URL}${dest}#token=${token}`);
  }
);

const USER_SELECT = 'SELECT id, discord_id, username, avatar, nuts_stash, pref_view, pref_accent, pref_density, created_at FROM users WHERE id = $1';

app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(USER_SELECT, [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ ...result.rows[0], is_admin: req.user.discord_id === process.env.ADMIN_DISCORD_ID });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(USER_SELECT, [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ ...result.rows[0], is_admin: req.user.discord_id === process.env.ADMIN_DISCORD_ID });
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

// Recipes — Dawntrail crafting data (currently Culinarian). Public read.
// Optional filters: ?job=CUL  ?expansion=Dawntrail
app.get('/api/recipes', async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.job) { params.push(String(req.query.job).toUpperCase()); where.push(`job = $${params.length}`); }
  if (req.query.expansion) { params.push(String(req.query.expansion)); where.push(`expansion = $${params.length}`); }
  // Subcrafts (intermediate crafted ingredients) are excluded by default — the
  // cooking page lists food dishes only. Pass ?include_subcraft=1 to fetch them.
  if (!['1', 'true'].includes(String(req.query.include_subcraft))) where.push('is_subcraft = false');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT id, name, job, item_level, stars, food_buff, ingredients, expansion, is_subcraft
       FROM recipes ${clause} ORDER BY item_level, name`,
      params
    );

    // Apply manual ingredient overrides (precedence over baked Teamcraft data).
    const NORM = {
      Fishing: 'FISHING', Mining: 'MINING', Botany: 'BOTANY',
      'Market Board': 'MARKET_BOARD', 'Scrip Exchange': 'SCRIP_EXCHANGE', Gemstone: 'GEMSTONE',
    };
    let overrides = new Map();
    try {
      const ov = await pool.query('SELECT item_id, source, node_name, zone, coords, notes, price, currency FROM ingredient_overrides');
      overrides = new Map(ov.rows.map((o) => [o.item_id, o]));
    } catch { /* table not migrated yet — serve baked data */ }

    const rows = result.rows.map((r) => ({
      ...r,
      ingredients: (r.ingredients || []).map((ing) => {
        const o = overrides.get(ing.id);
        if (!o) return ing;
        return {
          ...ing,
          source: NORM[o.source] || o.source || ing.source,
          node_name: o.node_name ?? ing.node_name,
          zone: o.zone ?? ing.zone,
          coords: o.coords ?? ing.coords,
          notes: o.notes ?? null,
          price: o.price ?? ing.price ?? null,
          currency: o.currency ?? ing.currency ?? null,
        };
      }),
    }));
    // Recipes change rarely and pages are separate full loads — let the
    // browser reuse the catalog across navigations instead of refetching.
    res.set('Cache-Control', 'public, max-age=300');
    res.json(rows);
  } catch (err) {
    console.error('[recipes]', err.message);
    res.status(500).json({ error: 'Failed to load recipes' });
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

// Community hunt submissions — gated by the ENABLE_SUBMISSIONS feature flag
app.post('/api/submit-hunt', authenticate, async (req, res) => {
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

// ── Admin: overview stats ───────────────────────────────────────────────────
app.get('/api/admin/stats', adminJWT, async (req, res) => {
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
app.get('/api/admin/users', adminJWT, async (req, res) => {
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
app.post('/api/admin/users/:id/ban', adminJWT, async (req, res) => {
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
app.get('/api/admin/queries', adminJWT, async (req, res) => {
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
app.get('/api/admin/submissions', adminJWT, async (req, res) => {
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

app.patch('/api/admin/submissions/:id', adminJWT, async (req, res) => {
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
app.get('/api/admin/flags', adminJWT, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, enabled, description FROM feature_flags ORDER BY key');
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/flags]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/admin/flags/:key', adminJWT, async (req, res) => {
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

// ── Admin: Anthropic API usage (from ai_queries log) ───────────────────────
app.get('/api/admin/api-usage', adminJWT, async (req, res) => {
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

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
