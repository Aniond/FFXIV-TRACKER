/**
 * AI search — POST /api/ai/search
 *
 * An FFXIV companion assistant grounded in the site's own data: hunt marks
 * (live from the `hunts` table), plus fishing spots, mining nodes, and botany
 * nodes (snapshotted into gameData.json by ai/extract-data.mjs).
 *
 * Access:
 *   - Requires a valid JWT (no guests).
 *   - Gated by the ENABLE_AI_PUBLIC feature flag. While that flag is false, only
 *     the admin (JWT discord_id === ADMIN_DISCORD_ID) may use it.
 *   - Rate limited to 20 queries / hour / user.
 *
 * Cost control:
 *   - The large, static game-data context lives in a cached system block
 *     (Anthropic prompt caching) so repeat calls are cheap.
 *   - Identical queries are served from the user_searches table for 60s.
 *   - Every call (admin included) is logged to the ai_usage view, which writes
 *     through to ai_queries — the table the /admin dashboard reads.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');

const router = express.Router();

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096; // headroom for broad queries (e.g. "all unspoiled nodes")
const RATE_LIMIT = 20; // queries per hour per user
const CACHE_SECONDS = 60; // identical-query cache window
const FLAG = 'ENABLE_AI_PUBLIC';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ── Static game-data context (loaded once at startup) ───────────────────────
let GAME_DATA = { fishing: [], mining: [], botany: [], counts: {} };
try {
  GAME_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'gameData.json'), 'utf8'));
} catch (err) {
  console.error('[ai/search] gameData.json missing — run ai/extract-data.mjs:', err.message);
}

// Frozen so prompt caching stays valid: stable bytes, no per-request interpolation.
// The persona/instruction text is the verbatim Centurio system prompt; the
// structured-output contract (enforced by RESPONSE_SCHEMA) is appended so the
// model knows the exact field names to fill.
const SYSTEM_PROMPT =
  `You are an FFXIV companion assistant for ffxivlog.com called Centurio.\n` +
  `You have access to a database of hunt marks, fishing spots, mining nodes\n` +
  `and botany nodes for Dawntrail and Endwalker expansions.\n` +
  `Answer the player's query using only the provided database context.\n` +
  `Be concise and helpful. Format responses clearly.\n` +
  `Always include coordinates when available.\n` +
  `Flag any timed nodes (Unspoiled/Ephemeral) with their time windows.\n` +
  `Return JSON with: { type, summary, results[], tips[] }\n\n` +
  `Field guidance:\n` +
  `- type: dominant category of the answer — hunt / fishing / mining / botany / ` +
  `recipe / mixed (results span categories) / none (nothing matched).\n` +
  `- summary: a short, natural-language answer to the player.\n` +
  `- results[]: one entry per matching mark / spot / node. Set category, zone, and ` +
  `coords (verbatim from the data, e.g. "X:21.4, Y:9.2"; empty string if none). ` +
  `For timed gathering nodes set timed=true and put the Eorzea window in "window" ` +
  `(e.g. "ET 0:00-6:00"); leave timed=false and window empty otherwise. Use "detail" ` +
  `for level, rank, reward, bait, weather, yield items, or other useful specifics.\n` +
  `- tips[]: 0-4 short, actionable tips (routes, timing, what to bring). Omit if none.\n` +
  `- Never invent spots, nodes, coordinates, or items not present in the data. ` +
  `If nothing matches, set type "none", results [], and say so in the summary.\n\n` +
  `GATHERING DATABASE (fishing spots, mining nodes, botany nodes) as JSON:\n` +
  JSON.stringify({ fishing: GAME_DATA.fishing, mining: GAME_DATA.mining, botany: GAME_DATA.botany });

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['hunt', 'fishing', 'mining', 'botany', 'recipe', 'mixed', 'none'] },
    summary: { type: 'string' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'Hunt mark, fish, item, or node name' },
          category: { type: 'string', enum: ['hunt', 'fishing', 'mining', 'botany', 'recipe'] },
          zone: { type: 'string' },
          coords: { type: 'string', description: 'Verbatim coordinates, e.g. "X:21.4, Y:9.2"; "" if none' },
          timed: { type: 'boolean', description: 'true for Unspoiled/Ephemeral/Legendary timed nodes' },
          window: { type: 'string', description: 'Eorzea time window for timed nodes, e.g. "ET 0:00-6:00"; "" otherwise' },
          detail: { type: 'string', description: 'Level, rank, reward, bait, weather, yield items, or other useful note' },
        },
        required: ['name', 'category', 'zone', 'coords', 'timed', 'window', 'detail'],
      },
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['type', 'summary', 'results', 'tips'],
};

// ── Auth: JWT required, then flag/admin gate ────────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function isFlagEnabled(key) {
  const r = await pool.query('SELECT enabled FROM feature_flags WHERE key = $1', [key]);
  return r.rows[0]?.enabled === true;
}

const normalize = (q) => q.trim().replace(/\s+/g, ' ').toLowerCase();

router.post('/', authenticate, async (req, res) => {
  const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  if (!query) return res.status(400).json({ error: 'query is required' });
  if (query.length > 500) return res.status(400).json({ error: 'query too long (max 500 chars)' });

  try {
    // Banned users can't use the assistant.
    const u = await pool.query('SELECT banned FROM users WHERE id = $1', [req.user.id]);
    if (!u.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (u.rows[0].banned) return res.status(403).json({ error: 'Account suspended' });

    // Flag gate: while ENABLE_AI_PUBLIC is off, admin only.
    const publicEnabled = await isFlagEnabled(FLAG);
    const isAdmin = req.user.discord_id === process.env.ADMIN_DISCORD_ID;
    if (!publicEnabled && !isAdmin) {
      return res.status(403).json({ error: 'AI search is not enabled yet' });
    }

    // Rate limit: 20 queries / hour / user (admins exempt for testing).
    if (!isAdmin) {
      const rl = await pool.query(
        "SELECT COUNT(*)::int AS n FROM ai_queries WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
        [req.user.id]
      );
      if (rl.rows[0].n >= RATE_LIMIT) {
        return res.status(429).json({ error: `Rate limit reached (${RATE_LIMIT}/hour). Try again later.` });
      }
    }

    const queryNorm = normalize(query);

    // 60s identical-query cache.
    const cached = await pool.query(
      `SELECT response FROM user_searches
       WHERE query_norm = $1 AND created_at > NOW() - ($2 || ' seconds')::interval
       ORDER BY created_at DESC LIMIT 1`,
      [queryNorm, String(CACHE_SECONDS)]
    );
    if (cached.rows[0]) {
      await pool.query(
        'INSERT INTO ai_usage (user_id, query_text, tokens_in, tokens_out, cached) VALUES ($1, $2, 0, 0, true)',
        [req.user.id, query]
      );
      return res.json({ ...cached.rows[0].response, cached: true });
    }

    // Live hunt data goes in the (uncached) user turn so the big static
    // gathering context stays a stable, cache-hittable prefix.
    const hunts = await pool.query(
      'SELECT name, rank, type, zone, area, coords, coords_note AS note, reward FROM hunts ORDER BY id'
    );
    const userContent =
      `HUNTS DATABASE as JSON:\n${JSON.stringify(hunts.rows)}\n\n` +
      `PLAYER QUERY: ${query}`;

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userContent }],
    });

    // A broad query (e.g. "list every node") can blow past max_tokens, which
    // truncates the JSON mid-string. Surface that as actionable feedback rather
    // than a parse error.
    if (message.stop_reason === 'max_tokens') {
      return res.status(422).json({ error: 'That query returned too many results — try narrowing it (a specific zone, item, or mark).' });
    }

    const textBlock = message.content.find((b) => b.type === 'text');
    let answer;
    try {
      answer = JSON.parse(textBlock?.text ?? '{}');
    } catch {
      return res.status(502).json({ error: 'AI returned an unparseable response' });
    }

    const usage = message.usage || {};
    const tokensIn =
      (usage.input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0) +
      (usage.cache_read_input_tokens || 0);
    const tokensOut = usage.output_tokens || 0;

    await Promise.all([
      pool.query(
        'INSERT INTO ai_usage (user_id, query_text, tokens_in, tokens_out, cached) VALUES ($1, $2, $3, $4, false)',
        [req.user.id, query, tokensIn, tokensOut]
      ),
      pool.query(
        'INSERT INTO user_searches (user_id, query_norm, response) VALUES ($1, $2, $3)',
        [req.user.id, queryNorm, JSON.stringify(answer)]
      ),
    ]);

    res.json({ ...answer, cached: false });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('[ai/search] Anthropic error', err.status, err.message);
      const status = err.status === 429 || err.status >= 500 ? 503 : 502;
      return res.status(status).json({ error: 'AI service unavailable, try again shortly' });
    }
    console.error('[ai/search]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
