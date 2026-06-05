/**
 * audit.mjs — comprehensive data + feature audit for ffxivlog.com.
 *
 * Read-only. Reports problems; does NOT fix anything.
 *
 * Sources audited:
 *   - DB recipes + ingredient_overrides (prod, via DATABASE_URL)
 *   - DB integrity (orphans, indexes) for progress / user_jobs / etc.
 *   - Gathering data files: src/fishingData.js, src/miningData.js, src/botanyData.js
 *   - Curated gather snapshot: backend/ai/gameData.json (for cross-reference)
 *
 * Hunt marks are intentionally SKIPPED (confirmed accurate).
 *
 * Run (prod):
 *   railway run sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL NODE_ENV=production node audit.mjs'
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

import { FISHING_SPOTS } from '../src/fishingData.js';
import { MINING_NODES } from '../src/miningData.js';
import { BOTANY_NODES } from '../src/botanyData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ----- report buffer (mirrored to console + file) -------------------------
const LINES = [];
const out = (s = '') => { LINES.push(s); console.log(s); };
const h1 = (s) => { out(''); out('='.repeat(72)); out(s); out('='.repeat(72)); };
const h2 = (s) => { out(''); out('--- ' + s + ' ---'); };
const list = (items, fmt = (x) => x, cap = 60) => {
  items.slice(0, cap).forEach((x) => out('    • ' + fmt(x)));
  if (items.length > cap) out(`    … and ${items.length - cap} more`);
};

const norm = (s) => String(s || '').replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase();

// ----- build gather name-sets for cross-reference -------------------------
// Combine the frontend data files AND the curated gameData snapshot so the
// cross-reference has the widest possible coverage of known gatherables.
const gameData = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai', 'gameData.json'), 'utf8'));

const fishNames = new Set();
const miningNames = new Set();
const botanyNames = new Set();

for (const s of FISHING_SPOTS) for (const f of (s.fish || [])) fishNames.add(norm(f.name));
for (const n of MINING_NODES) for (const it of (n.items || [])) miningNames.add(norm(it.name));
for (const n of BOTANY_NODES) for (const it of (n.items || [])) botanyNames.add(norm(it.name));
for (const s of (gameData.fishing || [])) for (const f of (s.fish || [])) fishNames.add(norm(f));
for (const n of (gameData.mining || [])) for (const it of (n.items || [])) miningNames.add(norm(it));
for (const n of (gameData.botany || [])) for (const it of (n.items || [])) botanyNames.add(norm(it));

// crystals/shards/clusters that legitimately come from many sources / MB
const ELEMENTAL = new Set(['fire','ice','wind','earth','lightning','water']
  .flatMap((e) => [`${e} shard`, `${e} crystal`, `${e} cluster`]));

// Which gather source (if any) a name belongs to. Returns 'FISHING'|'MINING'|'BOTANY'|null.
function gatherSourceOf(name) {
  const k = norm(name);
  if (ELEMENTAL.has(k)) return null;
  if (fishNames.has(k)) return 'FISHING';
  if (miningNames.has(k)) return 'MINING';
  if (botanyNames.has(k)) return 'BOTANY';
  return null;
}

// ----- DB connect ---------------------------------------------------------
const { Pool } = pg;
let pool = null;
let dbOk = false;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

async function q(sql, params = []) { return (await pool.query(sql, params)).rows; }

// ==========================================================================
async function main() {
  const stamp = process.env.AUDIT_STAMP || '(timestamp via wrapper)';
  h1('ffxivlog.com DATA & FEATURE AUDIT');
  out('Generated: ' + stamp);
  out('Scope: recipes, gathering (fishing/mining/botany), DB integrity.');
  out('Hunt marks: SKIPPED (confirmed accurate).');

  // ---- load recipes (from DB, with overrides applied like /api/recipes) --
  let recipes = [];
  let overrides = [];
  if (pool) {
    try {
      recipes = await q('SELECT id, name, job, item_level, stars, food_buff, ingredients, expansion, is_subcraft FROM recipes ORDER BY item_level, name');
      try { overrides = await q('SELECT item_id, item_name, source, node_name, zone, coords, notes FROM ingredient_overrides'); }
      catch (e) { overrides = null; out('[warn] ingredient_overrides not readable: ' + e.message); }
      dbOk = true;
    } catch (e) {
      out('[ERROR] DB query failed: ' + e.message);
    }
  } else {
    out('[ERROR] DATABASE_URL not set — DB-dependent sections will be skipped.');
  }

  // Apply overrides into a normalized source on each ingredient (mirror endpoint logic)
  const NORM = { Fishing: 'FISHING', Mining: 'MINING', Botany: 'BOTANY', 'Market Board': 'MARKET_BOARD' };
  const ovMap = new Map((overrides || []).map((o) => [o.item_id, o]));
  for (const r of recipes) {
    r.ingredients = (r.ingredients || []).map((ing) => {
      const o = ovMap.get(ing.id);
      if (!o) return ing;
      return { ...ing, source: NORM[o.source] || o.source || ing.source, _overridden: true };
    });
  }

  // recipe-name index (normalized) for subcraft chain resolution
  const recipeNames = new Set(recipes.map((r) => norm(r.name)));
  let requiredIndexesOk = false; // set in §7c-verify

  // ======================================================================
  h1('1 · RECIPE AUDIT (CUL — Dawntrail + Endwalker)');
  const dishes = recipes.filter((r) => !r.is_subcraft);
  const subcrafts = recipes.filter((r) => r.is_subcraft);
  const byExp = {};
  for (const r of dishes) byExp[r.expansion] = (byExp[r.expansion] || 0) + 1;
  out(`Total recipe rows in DB: ${recipes.length}  (food dishes: ${dishes.length}, subcrafts: ${subcrafts.length})`);
  out('Dishes by expansion: ' + JSON.stringify(byExp));
  out('Rows by job: ' + JSON.stringify(recipes.reduce((a, r) => ((a[r.job] = (a[r.job] || 0) + 1), a), {})));
  if (!byExp['Endwalker']) out('  ⚠ FINDING: 0 Endwalker CUL food dishes in DB.');
  else out(`  ✓ Endwalker CUL food dishes present: ${byExp['Endwalker']}`);

  // 1c · recipes with 0 ingredients
  h2('1a · Recipes with 0 ingredients (failed import)');
  const emptyRecipes = recipes.filter((r) => !r.ingredients || r.ingredients.length === 0);
  out(`Count: ${emptyRecipes.length}`);
  list(emptyRecipes, (r) => `${r.name} [${r.expansion} ilvl ${r.item_level}] (id ${r.id})`);

  // 1d · duplicate recipes (same name + job + ilvl)
  h2('1b · Duplicate recipes (same name + job + item_level)');
  const dupMap = new Map();
  for (const r of recipes) {
    const k = `${norm(r.name)}|${r.job}|${r.item_level}`;
    if (!dupMap.has(k)) dupMap.set(k, []);
    dupMap.get(k).push(r);
  }
  const dups = [...dupMap.values()].filter((g) => g.length > 1);
  out(`Duplicate groups: ${dups.length}`);
  list(dups, (g) => `${g[0].name} [${g[0].job} ilvl ${g[0].item_level}] ×${g.length} (ids ${g.map((x) => x.id).join(', ')})`);

  // 1e · missing food buff (FOOD DISHES only; subcrafts are expected null)
  h2('1c · Food dishes missing food buff data');
  const noBuff = dishes.filter((r) => !r.food_buff || (Array.isArray(r.food_buff) && r.food_buff.length === 0));
  out(`Food dishes with NULL food_buff (must be 0): ${noBuff.length}`);
  list(noBuff, (r) => `${r.name} [${r.expansion} ilvl ${r.item_level}] (id ${r.id})`);
  out(`(Subcrafts with null food_buff: ${subcrafts.length} — EXPECTED; they are intermediates, not meals.)`);

  // 1f · missing difficulty / star rating
  h2('1d · Recipes missing star rating / item level');
  const noStars = recipes.filter((r) => r.stars === null || r.stars === undefined);
  const noIlvl = recipes.filter((r) => r.item_level === null || r.item_level === undefined);
  out(`stars IS NULL: ${noStars.length}   (note: stars=0 is valid = "no star", not reported)`);
  list(noStars, (r) => `${r.name} (id ${r.id})`);
  out(`item_level IS NULL: ${noIlvl.length}`);
  list(noIlvl, (r) => `${r.name} (id ${r.id})`);

  // 1b · ingredients flagged Market Board that should be a gather source
  h2('1e · Ingredients classified MARKET_BOARD but match a gather source');
  const misMB = [];
  for (const r of recipes) for (const ing of r.ingredients) {
    if (ing.source === 'MARKET_BOARD' || ing.source === 'VENDOR') {
      const g = gatherSourceOf(ing.name);
      if (g) misMB.push({ recipe: r.name, ing: ing.name, id: ing.id, was: ing.source, should: g });
    }
  }
  // de-dupe by ingredient id+should
  const misSeen = new Set();
  const misUniq = misMB.filter((m) => { const k = m.id + m.should; if (misSeen.has(k)) return false; misSeen.add(k); return true; });
  out(`Distinct mis-sourced ingredients: ${misUniq.length} (occurrences: ${misMB.length})`);
  list(misUniq, (m) => `${m.ing} (id ${m.id}) — marked ${m.was}, found in ${m.should} data  [e.g. recipe "${m.recipe}"]`);

  // source distribution
  h2('1f · Ingredient source distribution (after overrides)');
  const srcCount = {};
  let ingTotal = 0;
  for (const r of recipes) for (const ing of r.ingredients) { srcCount[ing.source] = (srcCount[ing.source] || 0) + 1; ingTotal++; }
  out(`Total ingredient rows: ${ingTotal}`);
  Object.entries(srcCount).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => out(`    ${s.padEnd(14)} ${c}`));

  // ======================================================================
  h1('2 · SUBCRAFT CHAIN COMPLETENESS');
  // every ingredient subcraft=true must have a matching recipe row (by name)
  const brokenMap = new Map(); // name -> {id, count, recipes:Set}
  let subcraftCount = 0;
  for (const r of recipes) for (const ing of r.ingredients) {
    if (ing.subcraft) {
      subcraftCount++;
      if (!recipeNames.has(norm(ing.name))) {
        if (!brokenMap.has(norm(ing.name))) brokenMap.set(norm(ing.name), { name: ing.name, id: ing.id, count: 0, recipes: new Set() });
        const b = brokenMap.get(norm(ing.name));
        b.count++; b.recipes.add(r.name);
      }
    }
  }
  const broken = [...brokenMap.values()].sort((a, b) => b.count - a.count);
  out(`Ingredients flagged subcraft=true: ${subcraftCount}`);
  out(`Distinct subcraft items WITHOUT a matching recipe in DB: ${broken.length}`);
  if (broken.length) {
    out('⚠ Broken subcraft chains — the UI flags them as crafted but cannot show a recipe:');
    list(broken, (b) => `${b.name} (id ${b.id}) — used in ${b.count} recipe(s): ${[...b.recipes].slice(0, 4).join(', ')}${b.recipes.size > 4 ? '…' : ''}`, 100);
  } else {
    out('✓ All subcraft-flagged ingredients resolve to a recipe row. No broken chains.');
  }

  // ======================================================================
  h1('3 · FISHING SPOTS AUDIT');
  out(`Total fishing spots: ${FISHING_SPOTS.length}`);
  const fishNoFish = FISHING_SPOTS.filter((s) => !s.fish || s.fish.length === 0);
  const fishNoBait = FISHING_SPOTS.filter((s) => !s.baits || s.baits.length === 0);
  const fishNoCoord = FISHING_SPOTS.filter((s) => !s.coords);
  h2('3a · Spots with 0 fish');         out(`Count: ${fishNoFish.length}`);  list(fishNoFish, (s) => `${s.name} [${s.zone}, ${s.expansion}]`);
  h2('3b · Spots missing bait data');   out(`Count: ${fishNoBait.length}`);  list(fishNoBait, (s) => `${s.name} [${s.zone}, ${s.expansion}]`);
  h2('3c · Spots missing coords');      out(`Count: ${fishNoCoord.length}`); list(fishNoCoord, (s) => `${s.name} [${s.zone}, ${s.expansion}]`);
  h2('3d · Spot counts per zone (Dawntrail) — watch for suspiciously low');
  zoneCounts(FISHING_SPOTS, 'Dawntrail');

  // ======================================================================
  h1('4 · MINING NODES AUDIT');
  auditNodes(MINING_NODES, 'Mining');

  // ======================================================================
  h1('5 · BOTANY NODES AUDIT');
  auditNodes(BOTANY_NODES, 'Botany');

  // ======================================================================
  h1('6 · CROSS-REFERENCE SPOT-CHECK (20 sampled ingredients)');
  // Deterministic spread sample over distinct ingredients (by id) so re-runs match.
  const distinctIng = [];
  const seenIng = new Set();
  for (const r of recipes) for (const ing of r.ingredients) {
    if (!seenIng.has(ing.id)) { seenIng.add(ing.id); distinctIng.push({ ...ing, recipe: r.name }); }
  }
  distinctIng.sort((a, b) => a.id - b.id);
  const N = Math.min(20, distinctIng.length);
  const step = distinctIng.length / N;
  const sample = Array.from({ length: N }, (_, i) => distinctIng[Math.floor(i * step)]);
  out(`Distinct ingredients: ${distinctIng.length}; sampling ${N} (even spread by item id).`);
  const misSample = [];
  for (const ing of sample) {
    const g = gatherSourceOf(ing.name);
    let verdict;
    if (ing.source === 'MARKET_BOARD' || ing.source === 'VENDOR') {
      verdict = g ? `❌ MISCLASSIFIED → should be ${g}` : '✓ ok (no gather match)';
      if (g) misSample.push(ing);
    } else { // FISHING / MINING / BOTANY
      if (g === ing.source) verdict = '✓ confirmed in ' + g + ' data';
      else if (g) { verdict = `❌ MISCLASSIFIED → matches ${g} data, not ${ing.source}`; misSample.push(ing); }
      else verdict = `? unverified (not found in local ${ing.source} dataset)`;
    }
    out(`    ${ing.name.padEnd(26)} src=${String(ing.source).padEnd(13)} ${verdict}`);
  }
  out('');
  out(`Spot-check misclassifications: ${misSample.length} of ${N}`);

  // ======================================================================
  h1('7 · DATABASE INTEGRITY');
  if (!dbOk) { out('SKIPPED — no DB connection.'); }
  else {
    // 7a orphaned progress
    h2('7a · Orphaned progress records (user_id → deleted user)');
    const op = await q('SELECT COUNT(*)::int n FROM progress p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL');
    out(`Orphaned progress rows: ${op[0].n}  (FK is ON DELETE CASCADE, so expected 0)`);

    // 7b orphaned job records
    h2('7b · Orphaned user_jobs records');
    const oj = await q('SELECT COUNT(*)::int n FROM user_jobs j LEFT JOIN users u ON u.id = j.user_id WHERE u.id IS NULL');
    out(`Orphaned user_jobs rows: ${oj[0].n}`);
    // also other user-owned tables
    for (const t of ['submissions', 'user_searches', 'ai_queries']) {
      try {
        const o = await q(`SELECT COUNT(*)::int n FROM ${t} x LEFT JOIN users u ON u.id = x.user_id WHERE x.user_id IS NOT NULL AND u.id IS NULL`);
        out(`Orphaned ${t} rows: ${o[0].n}`);
      } catch (e) { out(`(${t}: ${e.message})`); }
    }

    // 7c indexes on frequently queried columns
    h2('7c · Indexes (frequently-queried columns)');
    const idx = await q(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname`);
    const byTable = {};
    for (const i of idx) (byTable[i.tablename] ||= []).push(i);
    for (const [t, arr] of Object.entries(byTable)) {
      out(`  ${t}:`);
      arr.forEach((i) => out(`      ${i.indexname}  ${i.indexdef.replace(/^.*USING /, 'USING ')}`));
    }
    // explicit verification of the three audit-mandated indexes
    h2('7c-verify · Required indexes (audit Fix 4)');
    const REQUIRED = [
      ['recipes', 'idx_recipes_job_expansion'],
      ['submissions', 'idx_submissions_user_id'],
      ['ai_queries', 'idx_ai_queries_created_at'],
    ];
    requiredIndexesOk = REQUIRED.every(([, name]) => idx.some((i) => i.indexname === name));
    for (const [tbl, name] of REQUIRED) {
      const present = idx.some((i) => i.indexname === name);
      out(`    ${present ? '✓' : '✗ MISSING'}  ${name} on ${tbl}`);
    }

    // heuristic gaps
    h2('7c-gaps · Likely-missing indexes (heuristic)');
    const allDefs = idx.map((i) => i.indexdef.toLowerCase());
    const hasIdxOn = (tbl, col) => allDefs.some((d) => d.includes(` on public.${tbl} `) && d.includes(`(${col}`));
    const gaps = [];
    // /api/recipes filters by job and expansion
    if (!hasIdxOn('recipes', 'job') && !hasIdxOn('recipes', 'expansion'))
      gaps.push('recipes(job, expansion) — /api/recipes filters on these; currently full-scan (small table, low impact).');
    if (!hasIdxOn('progress', 'user_id')) gaps.push('progress(user_id) — per-user progress lookups.');
    if (!hasIdxOn('user_jobs', 'user_id')) gaps.push('user_jobs(user_id) — per-user job lookups.');
    if (!hasIdxOn('submissions', 'user_id')) gaps.push('submissions(user_id) — admin/user submission lookups.');
    if (!hasIdxOn('ai_queries', 'created_at')) gaps.push('ai_queries(created_at) — usage reporting by date.');
    out(gaps.length ? '' : '  None detected beyond existing coverage.');
    gaps.forEach((g) => out('    • ' + g));
    out('  NOTE: UNIQUE(user_id, hunt_id)/(user_id, job_abbr) constraints already provide a leading-column index on user_id.');

    // 7d ingredient_overrides populated correctly
    h2('7d · ingredient_overrides table');
    if (overrides === null) out('  Table not readable.');
    else {
      out(`Rows: ${overrides.length}`);
      list(overrides, (o) => `${o.item_name || '#' + o.item_id} (id ${o.item_id}) → ${o.source}${o.notes ? '  — ' + o.notes : ''}`, 100);
      // sanity: seeded rows present?
      for (const [id, nm] of [[49233, 'Quahog'], [39865, 'Dark Eggplant']]) {
        const row = overrides.find((o) => o.item_id === id);
        out(`    seed check: ${nm} (id ${id}) → ${row ? row.source : '✗ MISSING'}`);
      }
      // overrides whose item_id never appears in any recipe (dead overrides)
      const usedIds = new Set();
      for (const r of recipes) for (const ing of r.ingredients) usedIds.add(ing.id);
      const dead = overrides.filter((o) => !usedIds.has(o.item_id));
      out(`    overrides not referenced by any recipe ingredient: ${dead.length}`);
      list(dead, (o) => `${o.item_name || '#' + o.item_id} (id ${o.item_id})`);
      // recipes that still serve a baked wrong source corrected only by override
      const corrected = [];
      for (const r of recipes) for (const ing of r.ingredients) if (ing._overridden) corrected.push(`${ing.name} in "${r.name}"`);
      out(`    ingredient occurrences corrected at request-time by an override: ${corrected.length}`);
    }
  }

  // ======================================================================
  h1('AUDIT SUMMARY');
  out(`Recipe rows: ${recipes.length}  (food dishes: ${dishes.length} [${Object.entries(byExp).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}], subcrafts: ${subcrafts.length})`);
  out(`  • 0-ingredient recipes ......... ${emptyRecipes.length}`);
  out(`  • duplicate groups ............. ${dups.length}`);
  out(`  • dishes missing food buff ..... ${noBuff.length}`);
  out(`  • missing star rating (null) ... ${noStars.length}`);
  out(`  • MARKET_BOARD→gather mismatches  ${misUniq.length} distinct`);
  out(`  • broken subcraft chains ....... ${broken.length} distinct items`);
  out(`Fishing: ${FISHING_SPOTS.length} spots — ${fishNoFish.length} empty, ${fishNoBait.length} no-bait, ${fishNoCoord.length} no-coords`);
  out(`Mining:  ${MINING_NODES.length} nodes (see §4 for breakdown)`);
  out(`Botany:  ${BOTANY_NODES.length} nodes (see §5 for breakdown)`);
  if (dbOk) out(`DB integrity: checked (orphans, indexes, overrides) — see §7`);

  // ---- explicit post-fix verification gate ----
  h2('POST-FIX VERIFICATION (audit Fixes 1–4)');
  const checks = [
    ['Fix 1', 'Zero non-food (null-buff, non-subcraft) recipes', noBuff.length === 0],
    ['Fix 2', 'Zero broken subcraft chains', broken.length === 0],
    ['Fix 3', 'Endwalker CUL food dishes present', (byExp['Endwalker'] || 0) > 0],
    ['Fix 4', 'All 3 required indexes present', requiredIndexesOk],
  ];
  for (const [fix, desc, ok] of checks) out(`    ${ok ? '✅ PASS' : '❌ FAIL'}  ${fix}: ${desc}`);
  out('');
  out('Reminder: data fixes were applied via scrape-cooking.js + migrate-cooking.js (this');
  out('re-run only READS to verify). Other findings (timed-node windows, thin fishing zones)');
  out('were out of scope for this fix pass.');

  if (pool) await pool.end();
  return LINES.join('\n');

  // ---- helpers defined via hoisted functions below ----
  function zoneCounts(spots, expansion) {
    const z = {};
    for (const s of spots) if (s.expansion === expansion) z[s.zone] = (z[s.zone] || 0) + 1;
    const entries = Object.entries(z).sort((a, b) => a[1] - b[1]);
    if (!entries.length) { out(`    (no ${expansion} spots found)`); return; }
    entries.forEach(([zone, c]) => out(`    ${c < 3 ? '⚠ ' : '  '}${String(c).padStart(3)}  ${zone}`));
    out(`    (${expansion} zones flagged ⚠ have < 3 spots — verify completeness)`);
  }

  function auditNodes(nodes, kind) {
    out(`Total ${kind} nodes: ${nodes.length}`);
    const noItems = nodes.filter((n) => !n.items || n.items.length === 0);
    const noCoords = nodes.filter((n) => !n.coords);
    const noExp = nodes.filter((n) => !n.expansion);
    const timed = nodes.filter((n) => n.type === 'Unspoiled' || n.type === 'Ephemeral' || n.type === 'Legendary');
    const noWindow = timed.filter((n) => !n.window);
    h2(`${kind} · nodes with 0 items`);      out(`Count: ${noItems.length}`);  list(noItems, (n) => `${n.name} [${n.zone}, ${n.expansion}] ${n.type}`);
    h2(`${kind} · nodes missing coords`);    out(`Count: ${noCoords.length}`); list(noCoords, (n) => `${n.name} [${n.zone}] ${n.type}`);
    h2(`${kind} · nodes missing expansion`); out(`Count: ${noExp.length}`);    list(noExp, (n) => `${n.name} [${n.zone}]`);
    h2(`${kind} · Unspoiled/Ephemeral/Legendary missing time window`);
    out(`Timed nodes: ${timed.length}; missing window: ${noWindow.length}`);
    list(noWindow, (n) => `${n.name} [${n.zone}, ${n.expansion}] ${n.type} (time="${n.time}")`);
    // per-expansion counts
    const byExp = {};
    for (const n of nodes) byExp[n.expansion || '(none)'] = (byExp[n.expansion || '(none)'] || 0) + 1;
    h2(`${kind} · nodes per expansion`);
    Object.entries(byExp).forEach(([e, c]) => out(`    ${String(c).padStart(3)}  ${e}`));
  }
}

main().catch((e) => { console.error('AUDIT FAILED:', e); process.exit(1); });
