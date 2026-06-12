/**
 * scrape-cooking.js — Culinarian (CUL) food recipes + full subcraft chains.
 *
 * Source: FFXIV Teamcraft public data on GitHub.
 *   - recipes.json  : recipe defs (job, rlvl, stars, result id, ingredients[])
 *   - items.json    : id -> { en, de, ja, fr } names
 *   - foods.json    : food items with stat Bonuses (the food buff)
 *   - ilvls.json    : id -> item level
 *
 * What it emits (backend/cooking-recipes.json), two kinds of rows:
 *
 *   1. FOOD DISHES  (is_subcraft = false)
 *      CUL recipes whose RESULT is an actual food (present in foods.json with a
 *      stat buff) AND result item level >= 580. Tagged Endwalker (580-639) or
 *      Dawntrail (>=640) by result item level. This filter excludes the ~35
 *      non-food CUL crafts at the DT tier (Rarefied collectables, Cosmic
 *      Exploration mission turn-ins, repair kits, etc.) — they have no food
 *      buff and never belonged on a cooking page.
 *
 *   2. SUBCRAFTS    (is_subcraft = true)
 *      Every intermediate crafted item transitively required by a dish, from
 *      ANY crafting job (ALC, CUL, WVR, …). These carry no food buff but MUST
 *      exist so the UI can resolve a recipe for every ingredient flagged
 *      subcraft=true. Resolved recursively (a subcraft's own crafted
 *      ingredients are pulled in too).
 *
 * Each ingredient is source-tagged (FISHING / MINING / BOTANY / VENDOR /
 * MARKET_BOARD) by cross-referencing Teamcraft nodes + our gather snapshot.
 *
 * Output: backend/cooking-recipes.json (seed consumed by migrate-cooking.js).
 * Run:  node backend/scripts/scrape-cooking.js
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/master/libs/data/src/lib/json/';
const ALC_JOB = 14;
const EW_MIN_ILVL = 515;  // Endwalker floor (Level 81 recipes start at 515)
const DT_MIN_ILVL = 640;  // Dawntrail floor (Level 91 recipes start at 650, but 640 captures some 90-to-91 bridging)

// Teamcraft job id -> FFXIV class abbreviation (DoH crafters).
const JOB_ABBR = { 8: 'CRP', 9: 'BSM', 10: 'ARM', 11: 'GSM', 12: 'LTW', 13: 'WVR', 14: 'ALC', 15: 'CUL' };

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
  const game = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ai', 'gameData.json'), 'utf8'));
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

// Teamcraft node/fishing location resolver, keyed by item ID.
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

// NPC gil-shop vendor resolver: item ID -> cheapest gil price + NPC location.
function buildVendorIndex(shops, npcs, places) {
  const byItem = new Map();
  for (const shop of Object.values(shops)) {
    if (shop.type !== 'GilShop') continue;
    const npcId = (shop.npcs || [])[0];
    for (const t of (shop.trades || [])) {
      const gil = (t.currencies || []).find((c) => c.id === 1);
      if (!gil) continue;
      for (const it of (t.items || [])) {
        const prev = byItem.get(it.id);
        if (!prev || gil.amount < prev.price) byItem.set(it.id, { price: gil.amount, npcId });
      }
    }
  }
  return (id) => {
    const v = byItem.get(id);
    if (!v) return null;
    const npc = npcs[v.npcId];
    const pos = npc?.position;
    return {
      source: 'VENDOR',
      node_name: npc?.en || 'Vendor',
      zone: pos ? (places[pos.zoneid]?.en || null) : null,
      coords: pos && pos.x != null ? coordStr(pos.x, pos.y) : null,
      node_type: 'Vendor',
      window: null,
      price: v.price,
    };
  };
}

// Special-currency shops (Scrip Exchange, Bicolor Gemstone Trader, …) — these
// are NON-gil shops, so buildVendorIndex (GilShop only) misses them and every
// scrip/gemstone-purchasable ingredient would fall through to MARKET_BOARD.
// We classify the two player-facing sources we care about:
//   SCRIP_EXCHANGE — bought with Crafters'/Gatherers' Scrip (Rowena/Scrip NPCs)
//   GEMSTONE       — bought with Bicolor Gemstones (open-world Gemstone Traders)
// Items here are usually ALSO on the Market Board, but the scrip/gemstone
// vendor is the deterministic, farmable source — prefer it over MB.
function buildSpecialShopIndex(shops, items, npcs, places) {
  const nameOf = (id) => items[id]?.en || '';
  // Rank the currencies we recognise; lower = preferred when a trade offers
  // several (e.g. scrip OR cosmocredit → pick scrip). Returns null for
  // currencies we deliberately ignore (gil is handled elsewhere; tribal/cosmo
  // currencies belong to items already covered by a gather/MB source).
  const classify = (curId) => {
    const n = nameOf(curId);
    if (/orange crafters'? scrip/i.test(n))  return { source: 'SCRIP_EXCHANGE', currency: n, rank: 0 };
    if (/purple crafters'? scrip/i.test(n))  return { source: 'SCRIP_EXCHANGE', currency: n, rank: 1 };
    if (/orange gatherers'? scrip/i.test(n)) return { source: 'SCRIP_EXCHANGE', currency: n, rank: 2 };
    if (/purple gatherers'? scrip/i.test(n)) return { source: 'SCRIP_EXCHANGE', currency: n, rank: 3 };
    if (/scrip/i.test(n))                    return { source: 'SCRIP_EXCHANGE', currency: n, rank: 4 };
    if (/bicolor gemstone/i.test(n))         return { source: 'GEMSTONE',       currency: n, rank: 9 };
    return null;
  };

  const byItem = new Map(); // itemId -> { source, currency, price, npcId, rank }
  for (const shop of Object.values(shops)) {
    const npcId = (shop.npcs || [])[0];
    for (const t of (shop.trades || [])) {
      const offers = (t.currencies || []).map((c) => ({ c, k: classify(c.id) })).filter((x) => x.k);
      if (!offers.length) continue;
      offers.sort((a, b) => a.k.rank - b.k.rank);
      const best = offers[0];
      for (const it of (t.items || [])) {
        // Aethersands are aetherial-reduction byproducts traded mainly on the
        // Market Board; their (steep) Gatherers'-Scrip price is a poor-value
        // edge case, so leave them on MARKET_BOARD rather than mislabel them.
        if (/aethersand/i.test(nameOf(it.id))) continue;
        const prev = byItem.get(it.id);
        if (!prev || best.k.rank < prev.rank)
          byItem.set(it.id, { source: best.k.source, currency: best.k.currency, price: best.c.amount, npcId, rank: best.k.rank });
      }
    }
  }

  return (id) => {
    const v = byItem.get(id);
    if (!v) return null;
    const npc = npcs[v.npcId];
    const pos = npc?.position;
    const label = v.source === 'GEMSTONE' ? 'Gemstone Trader' : 'Scrip Exchange';
    return {
      source: v.source,
      node_name: npc?.en || label,
      zone: pos ? (places[pos.zoneid]?.en || null) : null,
      coords: pos && pos.x != null ? coordStr(pos.x, pos.y) : null,
      node_type: label,
      window: null,
      price: v.price,
      currency: v.currency,
    };
  };
}

const MARKET = { source: 'MARKET_BOARD', node_name: null, zone: null, coords: null, node_type: null, window: null, price: null, currency: null };

function foodBuff(result, foodMap) {
  return null; // ALC recipes generally do not use food stats in Teamcraft
}

function isAlchemyConsumable(id, name) {
  // User requested ALL Endwalker & Dawntrail ALC recipes (including housing, glamour, standard leveling, etc)
  return true;
}

async function main() {
  console.log('Fetching Teamcraft data…');
  const [recipes, items, foods, ilvls, nodes, fspots, places, shops, npcs] = await Promise.all([
    getJson('recipes.json'),
    getJson('items.json'),
    getJson('foods.json'),
    getJson('ilvls.json'),
    getJson('nodes.json'),
    getJson('fishing-spots.json'),
    getJson('places.json'),
    getJson('shops.json'),
    getJson('npcs.json'),
  ]);
  console.log(`  recipes ${recipes.length}, items ${Object.keys(items).length}, foods ${foods.length}, nodes ${Object.keys(nodes).length}`);

  const foodMap = new Map(foods.map((f) => [f.ID, f]));
  const ilvlOf = (id) => ilvls[id] ?? 0;
  const nameOf = (id) => items[id]?.en || `#${id}`;

  // Index every recipe by its result id (first recipe wins) + the set of all
  // crafted item ids (any job) for the subcraft flag.
  const recipeByResult = new Map();
  const craftedIds = new Set();
  for (const r of recipes) {
    craftedIds.add(r.result);
    if (!recipeByResult.has(r.result)) recipeByResult.set(r.result, r);
  }

  const gameLoc = buildGameLocations();
  const tcLoc = buildTeamcraftLocations(nodes, fspots, places);
  const vendorLoc = buildVendorIndex(shops, npcs, places);
  const specialLoc = buildSpecialShopIndex(shops, items, npcs, places);
  // Gather/fish first; then gil NPC vendor; then scrip/gemstone exchange;
  // market board only if nothing else resolves.
  const resolveLoc = (id) => tcLoc(id) || gameLoc.get(norm(nameOf(id))) || vendorLoc(id) || specialLoc(id) || null;

  const mapIngredients = (r) => r.ingredients
    .filter((ing) => ing.id > 19) // drop base shards/crystals/clusters (ids 1-19)
    .map((ing) => {
      const loc = resolveLoc(ing.id) || MARKET;
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
        price: loc.price ?? null,
        currency: loc.currency ?? null,
      };
    });

  // ---- 1. ALCHEMY CONSUMABLES -------------------------------------------
  const dishRecipes = recipes.filter((r) =>
    r.job === ALC_JOB && ilvlOf(r.result) >= EW_MIN_ILVL && isAlchemyConsumable(r.result, nameOf(r.result)));
  const dishIds = new Set(dishRecipes.map((r) => r.result));

  // ---- 2. SUBCRAFTS (transitive crafted ingredients of every dish) ------
  const subcraftIds = new Set();
  const collect = (r) => {
    for (const ing of r.ingredients) {
      if (ing.id <= 19) continue;
      if (!craftedIds.has(ing.id)) continue;
      if (dishIds.has(ing.id) || subcraftIds.has(ing.id)) continue; // dish or already seen
      subcraftIds.add(ing.id);
      const sub = recipeByResult.get(ing.id);
      if (sub) collect(sub);
    }
  };
  dishRecipes.forEach(collect);

  const expansionFor = (resultId) => (ilvlOf(resultId) >= DT_MIN_ILVL ? 'Dawntrail' : 'Endwalker');

  const dishRows = dishRecipes.map((r) => ({
    name: nameOf(r.result),
    job: 'ALC',
    item_level: ilvls[r.result] ?? null,
    stars: r.stars || 0,
    food_buff: foodBuff(r.result, foodMap),
    is_subcraft: false,
    ingredients: mapIngredients(r),
    expansion: expansionFor(r.result),
  }));

  const subRows = [...subcraftIds]
    .map((id) => recipeByResult.get(id))
    .filter(Boolean)
    .map((r) => ({
      name: nameOf(r.result),
      job: JOB_ABBR[r.job] || String(r.job),
      item_level: ilvls[r.result] ?? null,
      stars: r.stars || 0,
      food_buff: null, // subcrafts are not foods
      is_subcraft: true,
      ingredients: mapIngredients(r),
      expansion: expansionFor(r.result),
    }));

  const out = [...dishRows, ...subRows]
    .filter((r) => !r.name.startsWith('#')) // skip unresolved/deprecated results
    .sort((a, b) => (a.is_subcraft - b.is_subcraft) || (a.item_level - b.item_level) || a.name.localeCompare(b.name));

  // ---- summary + invariant check ----------------------------------------
  const dishExp = {};
  dishRows.forEach((r) => (dishExp[r.expansion] = (dishExp[r.expansion] || 0) + 1));
  const recipeNames = new Set(out.map((r) => norm(r.name)));
  const broken = new Set();
  out.forEach((r) => r.ingredients.forEach((i) => { if (i.subcraft && !recipeNames.has(norm(i.name))) broken.add(i.name); }));

  console.log(`\nFood dishes:   ${dishRows.length}  ${JSON.stringify(dishExp)}`);
  console.log(`Subcraft rows: ${subRows.length} (jobs: ${JSON.stringify([...new Set(subRows.map((r) => r.job))])})`);
  console.log(`Total rows:    ${out.length}`);
  console.log(`Broken subcraft chains after resolution: ${broken.size}${broken.size ? ' -> ' + [...broken].join(', ') : ' ✓'}`);

  const dest = path.join(__dirname, '..', 'alchemy-recipes.json');
  fs.writeFileSync(dest, JSON.stringify(out), 'utf8');
  console.log(`\nWrote ${dest} (${out.length} rows)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
