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

function buildGatherIndex() {
  const game = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai', 'gameData.json'), 'utf8'));
  const fishing = new Set();
  const mining = new Set();
  const botany = new Set();
  (game.fishing || []).forEach((s) => (s.fish || []).forEach((f) => fishing.add(norm(f))));
  (game.mining || []).forEach((n) => (n.items || []).forEach((i) => mining.add(norm(i))));
  (game.botany || []).forEach((n) => (n.items || []).forEach((i) => botany.add(norm(i))));
  return { fishing, mining, botany };
}

function ingredientSource(name, gather) {
  const k = norm(name);
  if (gather.botany.has(k)) return 'BOTANY';
  if (gather.mining.has(k)) return 'MINING';
  if (gather.fishing.has(k)) return 'FISHING';
  return 'MARKET_BOARD';
}

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
  const [recipes, items, foods, ilvls] = await Promise.all([
    getJson('recipes.json'),
    getJson('items.json'),
    getJson('foods.json'),
    getJson('ilvls.json'),
  ]);
  console.log(`  recipes ${recipes.length}, items ${Object.keys(items).length}, foods ${foods.length}`);

  const foodMap = new Map(foods.map((f) => [f.ID, f]));
  const craftedIds = new Set(recipes.map((r) => r.result)); // any recipe's result => crafted
  const nameOf = (id) => items[id]?.en || `#${id}`;
  const gather = buildGatherIndex();

  const culDt = recipes.filter((r) => r.job === CUL_JOB && (ilvls[r.result] ?? 0) >= DT_MIN_ILVL);

  const out = culDt.map((r) => ({
    name: nameOf(r.result),
    job: 'CUL',
    item_level: ilvls[r.result] ?? null,
    stars: r.stars || 0,
    food_buff: foodBuff(r.result, foodMap),
    ingredients: r.ingredients
      .filter((ing) => ing.id > 19) // drop base shards/crystals/clusters (ids 1-19)
      .map((ing) => ({
        id: ing.id,
        name: nameOf(ing.id),
        amount: ing.amount,
        source: ingredientSource(nameOf(ing.id), gather),
        subcraft: craftedIds.has(ing.id),
      })),
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
