/**
 * routes/prices.js — Universalis market-board prices, cached.
 *
 * GET /api/prices?ids=4767,44035[&dc=Crystal]
 *  → { dc, prices: { "4767": { nq: 60, hq: null }, ... } }
 *
 * Prices are DC-level minimum listings from Universalis's aggregated
 * endpoint. Cached in-process for 20 minutes per (dc, item) — crafting
 * prices don't need to be minute-fresh, and it keeps us a polite API
 * citizen (one upstream call per cache window per batch).
 */
const express = require('express');
const { rateLimit } = require('../middleware');

const router = express.Router();

const DEFAULT_DC = process.env.UNIVERSALIS_DC || 'Crystal';
const TTL_MS = 20 * 60_000;
const MAX_IDS = 100;

// (dc -> (itemId -> { at, nq, hq }))
const cache = new Map();
const dcCache = (dc) => { if (!cache.has(dc)) cache.set(dc, new Map()); return cache.get(dc); };

const pricesLimiter = rateLimit({ windowMs: 60_000, max: 30 });

router.get('/api/prices', pricesLimiter, async (req, res) => {
  const dc = String(req.query.dc || DEFAULT_DC).trim();
  if (!/^[A-Za-z-]{2,32}$/.test(dc)) return res.status(400).json({ error: 'invalid dc' });
  const ids = [...new Set(String(req.query.ids || '').split(',').map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return res.status(400).json({ error: 'ids is required' });
  if (ids.length > MAX_IDS) return res.status(400).json({ error: `at most ${MAX_IDS} ids` });

  const store = dcCache(dc);
  const now = Date.now();
  const missing = ids.filter((id) => !(store.has(id) && now - store.get(id).at < TTL_MS));

  if (missing.length) {
    try {
      const r = await fetch(`https://universalis.app/api/v2/aggregated/${encodeURIComponent(dc)}/${missing.join(',')}`, {
        headers: { 'User-Agent': 'ffxivlog.com/1.0' },
      });
      if (r.ok) {
        const data = await r.json();
        const seen = new Set();
        for (const it of data.results || []) {
          const nq = it.nq?.minListing?.dc?.price ?? null;
          const hq = it.hq?.minListing?.dc?.price ?? null;
          store.set(it.itemId, { at: now, nq, hq });
          seen.add(it.itemId);
        }
        // Untradeable/unknown ids: cache the miss so we don't re-ask every call.
        for (const id of missing) if (!seen.has(id)) store.set(id, { at: now, nq: null, hq: null });
      } else if (r.status === 404) {
        return res.status(400).json({ error: 'unknown data center' });
      }
      // other upstream failures: serve whatever cache has (possibly stale/partial)
    } catch (err) {
      console.error('[prices]', err.message);
    }
  }

  const prices = {};
  for (const id of ids) {
    const hit = store.get(id);
    if (hit && (hit.nq != null || hit.hq != null)) prices[id] = { nq: hit.nq, hq: hit.hq };
  }
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ dc, prices });
});

module.exports = router;
