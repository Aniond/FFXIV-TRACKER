/**
 * routes/recipes.js — public crafting recipe catalog with the
 * ingredient_overrides merge applied at request time.
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

// Optional filters: ?job=CUL  ?expansion=Dawntrail
router.get('/api/recipes', async (req, res) => {
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

module.exports = router;
