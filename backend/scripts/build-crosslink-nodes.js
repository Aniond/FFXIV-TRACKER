/**
 * build-crosslink-nodes.js — generates src/crosslinkNodes.js: gathering-catalog
 * entries for every recipe ingredient whose node is NOT already on the
 * Mining/Botany/Fishing pages (older-expansion nodes, mostly). This is what
 * makes ingredient deep-links (?highlight=<item>) land on a real card.
 *
 * Inputs:
 *   - backend/gtmp/missing-gather.json  (dump of unresolved gathering
 *     ingredients from the prod recipes table — see xcheck.tmp.mjs / README)
 *   - Garland Tools item API (node/fishing-spot membership, levels, zones)
 *
 * The baked ingredient rows already carry coords/window/node_type from
 * scrape-cooking.js (Teamcraft); Garland fills in true zone, level, and the
 * gathering discipline. Items whose real discipline disagrees with the baked
 * source (e.g. spearfished "botany" items) are reported so an
 * ingredient_overrides row can fix the source.
 *
 * Run:  node backend/scripts/build-crosslink-nodes.js          (writes src/crosslinkNodes.js)
 */
const fs = require('fs');
const path = require('path');

const GARLAND = 'https://www.garlandtools.org/db/doc';
const RATE_MS = 200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').trim().toLowerCase();

// Garland node `t` → page + gatherType
const NODE_T = { 0: ['mining', 'Mining'], 1: ['mining', 'Quarrying'], 2: ['botany', 'Logging'], 3: ['botany', 'Harvesting'] };

function expansionForLevel(l) {
  if (l <= 50) return 'A Realm Reborn';
  if (l <= 60) return 'Heavensward';
  if (l <= 70) return 'Stormblood';
  if (l <= 80) return 'Shadowbringers';
  if (l <= 90) return 'Endwalker';
  return 'Dawntrail';
}

const fmtH = ([h, m]) => `${h}:${String(m || 0).padStart(2, '0')}`;
const timeStr = (w) => (w ? `${fmtH(w.open)}–${fmtH(w.close)} ET` : 'Any');

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ffxivlog.com/1.0 build-crosslink' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function main() {
  const missing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'gtmp', 'missing-gather.json'), 'utf8'));
  const core = await getJson(`${GARLAND}/core/en/3/data.json`);
  const locName = (z) => core.locationIndex[z]?.name || null;

  // node key -> { node entry, items[] } ; fishing spot key -> { spot, fish[] }
  const botany = new Map(), mining = new Map(), fishing = new Map();
  const sourceMismatches = [];

  for (const ing of missing) {
    await sleep(RATE_MS);
    let doc;
    try { doc = await getJson(`${GARLAND}/item/en/3/${ing.id}.json`); }
    catch (e) { console.warn(`  !! ${ing.name} (${ing.id}): ${e.message}`); continue; }

    const nodes = (doc.partials || []).filter((p) => p.type === 'node').map((p) => p.obj);
    const spots = (doc.partials || []).filter((p) => p.type === 'fishing').map((p) => p.obj);

    if (nodes.length) {
      // Prefer the node scrape-cooking resolved (baked node_name), else first.
      const n = nodes.find((x) => norm(x.n) === norm(ing.node_name)) || nodes[0];
      const [page, gatherType] = NODE_T[n.t] || ['botany', 'Harvesting'];
      if ((page === 'botany') !== (ing.source === 'BOTANY')) sourceMismatches.push({ ...ing, real: page });
      const matchesBaked = norm(n.n) === norm(ing.node_name) || norm(n.n) === norm(ing.zone);
      const bucket = page === 'botany' ? botany : mining;
      const key = `g${n.i}`;
      if (!bucket.has(key)) {
        bucket.set(key, {
          id: `xl-${page === 'botany' ? 'b' : 'm'}-${n.i}`,
          name: n.n,
          gatherType,
          zone: locName(n.z) || ing.zone,
          expansion: expansionForLevel(n.l),
          type: matchesBaked ? (ing.node_type || 'Regular') : 'Regular',
          coords: matchesBaked ? ing.coords : null,
          level: String(n.l),
          time: matchesBaked ? timeStr(ing.window) : 'Any',
          window: matchesBaked ? ing.window : null,
          items: [],
        });
      }
      const icon = page === 'botany' ? 'herb' : (gatherType === 'Quarrying' ? 'gem' : 'ore');
      bucket.get(key).items.push({ name: ing.name, tag: 'common', icon });
    } else if (spots.length) {
      const s = spots.find((x) => norm(x.n) === norm(ing.node_name)) || spots[0];
      if (ing.source !== 'FISHING') sourceMismatches.push({ ...ing, real: 'fishing' });
      const key = `f${s.i}`;
      if (!fishing.has(key)) {
        fishing.set(key, {
          id: `xl-f-${s.i}`,
          name: s.n,
          zone: locName(s.z) || ing.zone,
          expansion: expansionForLevel(s.l),
          coords: s.x != null ? `X:${s.x.toFixed(1)}, Y:${s.y.toFixed(1)}` : ing.coords,
          weather: null,
          time: 'Any',
          baits: [],
          fish: [],
        });
      }
      fishing.get(key).fish.push({ name: ing.name, rarity: 'common', note: '' });
    } else {
      console.warn(`  ?? ${ing.name} (${ing.id}): no node or fishing spot on Garland`);
    }
    process.stdout.write('.');
  }
  console.log('');

  const js = `/* Auto-generated by backend/scripts/build-crosslink-nodes.js — DO NOT EDIT BY HAND.
   Gathering catalog entries for recipe-ingredient nodes missing from the main
   (EW/DT endgame) catalogs, so cooking-page deep-links resolve. Node coords &
   windows come from the recipes DB (Teamcraft); zones/levels from Garland Tools. */

import { MANUAL_EXTRA_BOTANY_NODES, MANUAL_EXTRA_MINING_NODES, MANUAL_EXTRA_FISHING_SPOTS } from './manualCrosslinkNodes.js'

export const EXTRA_BOTANY_NODES = [
  ...MANUAL_EXTRA_BOTANY_NODES,
  ...${JSON.stringify([...botany.values()], null, 2)}
]

export const EXTRA_MINING_NODES = [
  ...MANUAL_EXTRA_MINING_NODES,
  ...${JSON.stringify([...mining.values()], null, 2)}
]

export const EXTRA_FISHING_SPOTS = [
  ...MANUAL_EXTRA_FISHING_SPOTS,
  ...${JSON.stringify([...fishing.values()], null, 2)}
]

// Short badge labels for node/spot cards — extras span all expansions.
export const EXP_SHORT = {
  'A Realm Reborn': 'ARR', Heavensward: 'HW', Stormblood: 'SB',
  Shadowbringers: 'ShB', Endwalker: 'EW', Dawntrail: 'DT',
}
`;
  const out = path.join(__dirname, '..', '..', 'src', 'crosslinkNodes.js');
  fs.writeFileSync(out, js);
  console.log(`wrote ${out}: botany ${botany.size} nodes, mining ${mining.size} nodes, fishing ${fishing.size} spots`);
  if (sourceMismatches.length) {
    console.log('\nSOURCE MISMATCHES (fix via ingredient_overrides):');
    sourceMismatches.forEach((m) => console.log(`  ${m.name} (${m.id}): baked ${m.source} → real ${m.real}`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
