/**
 * check-crosslinks.mjs — verifies every gathering-sourced recipe ingredient
 * resolves on a gathering page (?highlight= matches a node/spot/item name).
 *
 * Run from the repo root:  node backend/check-crosslinks.mjs
 * Needs backend/gtmp/prod-recipes.json (dump of the prod recipes table; see
 * build-crosslink-nodes.js header). Writes backend/gtmp/missing-gather.json —
 * the input build-crosslink-nodes.js consumes.
 */
import { MINING_NODES } from '../src/miningData.js'
import { BOTANY_NODES } from '../src/botanyData.js'
import { FISHING_SPOTS } from '../src/fishingData.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const recipes = JSON.parse(fs.readFileSync(path.join(here, 'gtmp', 'prod-recipes.json')))
const norm = s => String(s||'').trim().toLowerCase()
const mining = new Set(), botany = new Set(), fishing = new Set()
MINING_NODES.forEach(n => { mining.add(norm(n.name)); n.items.forEach(i => mining.add(norm(i.name))) })
BOTANY_NODES.forEach(n => { botany.add(norm(n.name)); n.items.forEach(i => botany.add(norm(i.name))) })
FISHING_SPOTS.forEach(s => { fishing.add(norm(s.name)); s.fish.forEach(f => fishing.add(norm(f.name))) })
const sets = { MINING: mining, BOTANY: botany, FISHING: fishing }
const out = [], seen = new Set()
for (const r of recipes) for (const ing of (r.ingredients||[])) {
  if (!sets[ing.source] || seen.has(ing.name)) continue
  if (!sets[ing.source].has(norm(ing.name))) { seen.add(ing.name); out.push(ing) }
}
fs.writeFileSync(path.join(here, 'gtmp', 'missing-gather.json'), JSON.stringify(out, null, 1))
console.log(out.length ? `${out.length} UNRESOLVED items — rerun build-crosslink-nodes.js:\n` +
  out.map(i => `  ${i.source} :: ${i.name}`).join('\n') : 'ALL gathering ingredients resolve ✓')
