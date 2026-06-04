/**
 * scrape-cooking.js — Dawntrail Culinarian (CUL) recipe scraper.
 *
 * Source: FFXIV Teamcraft public data on GitHub.
 *   - recipes.json  : recipe defs (job, rlvl, stars, result id, ingredients[])
 *   - items.json    : id -> { en, de, ja, fr } names
 *   - foods.json    : food items with stat Bonuses (the food buff)
 *   - ilvls.json    : id -> item level
 *
 * Filters to CUL (job 15) Dawntrail recipes by RESULT ITEM LEVEL >= 640 (the
 * DT food tier). Filtering on item level — not recipe level — deliberately
 * excludes ~200 item-level-1 special crafts that share the DT recipe tier
 * (Cosmic Exploration mission turn-ins, seasonal "Launch Party" foods, etc.)
 * plus a couple of stray Endwalker ilvl-620 resins. Resolves names, extracts
 * the food buff, and tags
 * each ingredient's source by cross-referencing the gathering data snapshot
 * (backend/ai/gameData.json) — FISHING / MINING / BOTANY / MARKET_BOARD —
 * plus a subcraft flag when the ingredient is itself a crafted item.
 *
 * Output: backend/cooking-recipes.json (seed consumed by migrate-cooking.js).
 *
 * Run:  node backend/scrape-cooking.js
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/master/libs/data/src/lib/json/';
const CUL_JOB = 15;
const DT_MIN_ILVL = 640; // Dawntrail food tier (result item level)

// Teamcraft food Bonuses stat name -> FFXIV abbreviation.
const STAT_ABBR = {
  Strength: 'STR', Dexterity: 'DEX', Vitality: 'VIT', Intelligence: 'INT', Mind: 'MND',
  CriticalHit: 'CRT', Determination: 'DET', DirectHitRate: 'DH', Tenacity: 'TEN', Piety: 'PIE',
  SkillSpeed: 'SKS', SpellSpeed: 'SPS', Defense: 'DEF', MagicDefense: 'MDEF',
  CP: 'CP', GP: 'GP', Craftsmanship: 'CMS', Control: 'CTL', Gathering: 'GAT', Perception: 'PER',
};

const getJson = async (file) => {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
};

const norm = (s) => String(s || '').replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase();

const coordStr = (x, y) => `X:${Number(x).toFixed(1)}, Y:${Number(y).toFixed(1)}`;

// Our curated gathering snapshot (backend/ai/gameData.json) — name -> full
// location. Used as a fallback for items Teamcraft's open data misses.
function buildGameLocations() {
  const game = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai', 'gameData.json'), 'utf8'));
  const m = new Map();
  const addNodes = (nodes, source) => (nodes || []).forEach((n) => (n.items || []).forEach((it) => {
    const k = norm(it);
    if (!m.has(k)) m.set(k, { source, node_name: n.zone, zone: n.zone, coords: n.coords, node_type: n.type || 'Regular', window: n.window || null });
  }));
  addNodes(game.mining, 'MINING');
  addNodes(game.botany, 'BOTANY');
  (game.fishing || []).forEach((s) => (s.fish || []).forEach((f) => {
    const k = norm(f);
    if (!m.has(k)) m.set(k, { source: 'FISHING', node_name: s.name || s.zone, zone: s.zone, coords: s.coords, node_type: 'Fishing Hole', window: null });
  }));
  return m;
}

// Teamcraft node/fishing location resolver, keyed by item ID. Nodes carry the
// gather type (0/1 mining, 2/3 botany), zone, coords, and (for timed nodes)
// spawn windows via `spawns` (ET start hours) + `duration` (ET minutes).
function buildTeamcraftLocations(nodes, fspots, places) {
  const byItem = new Map();
  for (const n of Object.values(nodes)) {
    for (const it of (n.items || [])) {
      const id = typeof it === 'object' ? it.id : it;
      if (!byItem.has(id)) byItem.set(id, []);
      byItem.get(id).push(n);
    }
  }
  const fspotByItem = new Map();
  for (const s of Object.values(fspots)) {
    for (const id of (s.fishes || [])) if (!fspotByItem.has(id)) fspotByItem.set(id, s);
  }
  const zoneName = (id) => places[id]?.en || null;

  return (id) => {
    const ns = byItem.get(id);
    if (ns && ns.length) {
      const n = ns.find((x) => x.ephemeral || x.limited || x.legendary) || ns[0];
      const node_type = n.ephemeral ? 'Ephemeral' : n.legendary ? 'Legendary' : n.limited ? 'Unspoiled' : 'Regular';
      const source = (n.type === 0 || n.type === 1) ? 'MINING' : 'BOTANY';
      let window = null;
      if (n.spawns?.length && n.duration) {
        const o = n.spawns[0];
        const c = (o + n.duration / 60) % 24;
        window = { open: [o, 0], close: [Math.floor(c), Math.round((c % 1) * 60)] };
      }
      return { source, node_name: zoneName(n.zoneid), zone: zoneName(n.zoneid), coords: coordStr(n.x, n.y), node_type, window };
    }
    const sp = fspotByItem.get(id);
    if (sp) {
      const zone = zoneName(sp.placeId) || zoneName(sp.zoneId);
      return { source: 'FISHING', node_name: zone, zone, coords: sp.coords ? coordStr(sp.coords.x, sp.coords.y) : null, node_type: 'Fishing Hole', window: null };
    }
    return null;
  };
}

const MARKET = { source: 'MARKET_BOARD', node_name: null, zone: null, coords: null, node_type: null, window: null };

function foodBuff(result, foodMap) {
  const f = foodMap.get(result);
  if (!f || !f.Bonuses) return null;
  const bonuses = Object.entries(f.Bonuses).map(([stat, b]) => ({
    stat: STAT_ABBR[stat] || stat,
    relative: !!b.Relative,
    value: b.Value,
    valueHQ: b.ValueHQ ?? b.Value,
    max: b.Max ?? null,
    maxHQ: b.MaxHQ ?? b.Max ?? null,
  }));
  return bonuses.length ? bonuses : null;
}

async function main() {
  console.log('Fetching Teamcraft data…');
  const [recipes, items, foods, ilvls, nodes, fspots, places] = await Promise.all([
    getJson('recipes.json'),
    getJson('items.json'),
    getJson('foods.json'),
    getJson('ilvls.json'),
    getJson('nodes.json'),
    getJson('fishing-spots.json'),
    getJson('places.json'),
  ]);
  console.log(`  recipes ${recipes.length}, items ${Object.keys(items).length}, foods ${foods.length}, nodes ${Object.keys(nodes).length}`);

  const foodMap = new Map(foods.map((f) => [f.ID, f]));
  const craftedIds = new Set(recipes.map((r) => r.result)); // any recipe's result => crafted
  const nameOf = (id) => items[id]?.en || `#${id}`;
  const gameLoc = buildGameLocations();
  const tcLoc = buildTeamcraftLocations(nodes, fspots, places);
  const resolveLoc = (id, name) => tcLoc(id) || gameLoc.get(norm(name)) || null;

  const culDt = recipes.filter((r) => r.job === CUL_JOB && (ilvls[r.result] ?? 0) >= DT_MIN_ILVL);

  const out = culDt.map((r) => ({
    name: nameOf(r.result),
    job: 'CUL',
    item_level: ilvls[r.result] ?? null,
    stars: r.stars || 0,
    food_buff: foodBuff(r.result, foodMap),
    ingredients: r.ingredients
      .filter((ing) => ing.id > 19) // drop base shards/crystals/clusters (ids 1-19)
      .map((ing) => {
        const loc = resolveLoc(ing.id, nameOf(ing.id)) || MARKET;
        return {
          id: ing.id,
          name: nameOf(ing.id),
          amount: ing.amount,
          subcraft: craftedIds.has(ing.id),
          source: loc.source,
          node_name: loc.node_name,
          zone: loc.zone,
          coords: loc.coords,
          node_type: loc.node_type,
          window: loc.window,
        };
      }),
    expansion: 'Dawntrail',
  }))
    .filter((r) => !r.name.startsWith('#')) // skip unresolved/deprecated results
    .sort((a, b) => (a.item_level - b.item_level) || a.name.localeCompare(b.name));

  // Summary
  const withBuff = out.filter((r) => r.food_buff).length;
  const srcCounts = {};
  out.forEach((r) => r.ingredients.forEach((i) => { srcCounts[i.source] = (srcCounts[i.source] || 0) + 1; }));
  console.log(`\nCUL Dawntrail recipes: ${out.length} (with food buff: ${withBuff})`);
  console.log('ingredient sources:', srcCounts);
  console.log('sample:', JSON.stringify(out.find((r) => r.food_buff) || out[0], null, 1));

  const dest = path.join(__dirname, 'cooking-recipes.json');
  fs.writeFileSync(dest, JSON.stringify(out), 'utf8');
  console.log(`\nWrote ${dest} (${out.length} recipes)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
