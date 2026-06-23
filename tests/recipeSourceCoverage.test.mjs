import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MINING_NODES } from '../src/miningData.js'
import { BOTANY_NODES } from '../src/botanyData.js'
import { FISHING_SPOTS } from '../src/fishingData.js'
import { EXTRA_BOTANY_NODES, EXTRA_MINING_NODES, EXTRA_FISHING_SPOTS } from '../src/crosslinkNodes.js'

const norm = (s) => String(s || '').trim().toLowerCase()

function namesForGathering() {
  const mining = new Set()
  const botany = new Set()
  const fishing = new Set()
  MINING_NODES.forEach((n) => { mining.add(norm(n.name)); n.items.forEach((i) => mining.add(norm(i.name))) })
  BOTANY_NODES.forEach((n) => { botany.add(norm(n.name)); n.items.forEach((i) => botany.add(norm(i.name))) })
  FISHING_SPOTS.forEach((s) => { fishing.add(norm(s.name)); s.fish.forEach((f) => fishing.add(norm(f.name))) })
  EXTRA_MINING_NODES.forEach((n) => { mining.add(norm(n.name)); n.items.forEach((i) => mining.add(norm(i.name))) })
  EXTRA_BOTANY_NODES.forEach((n) => { botany.add(norm(n.name)); n.items.forEach((i) => botany.add(norm(i.name))) })
  EXTRA_FISHING_SPOTS.forEach((s) => { fishing.add(norm(s.name)); s.fish.forEach((f) => fishing.add(norm(f.name))) })
  return { MINING: mining, BOTANY: botany, FISHING: fishing }
}

function loadRecipeSeeds() {
  const dir = join(process.cwd(), 'backend')
  return readdirSync(dir)
    .filter((name) => name.endsWith('-recipes.json'))
    .flatMap((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')).map((recipe) => ({ file: name, recipe })))
}

test('every recipe ingredient has an actionable source link or purchase detail', () => {
  const gather = namesForGathering()
  const seeds = loadRecipeSeeds()
  const recipesByName = new Set(seeds.map(({ recipe }) => norm(recipe.name)))
  const failures = []

  for (const { file, recipe } of seeds) {
    for (const ing of recipe.ingredients || []) {
      const source = ing.source
      const label = `${file} :: ${recipe.name} :: ${source} :: ${ing.name}`
      if (ing.subcraft && !recipesByName.has(norm(ing.name))) failures.push(`${label} missing subcraft recipe`)
      if (gather[source] && !gather[source].has(norm(ing.name)) && !ing.coords && !ing.zone && !ing.node_name) {
        failures.push(`${label} missing gathering page target or inline location`)
      }
      if (source === 'MARKET_BOARD' && !ing.id) failures.push(`${label} missing Universalis item id`)
      if ((source === 'SCRIP_EXCHANGE' || source === 'GEMSTONE') && (!ing.currency || ing.price == null)) {
        failures.push(`${label} missing currency/price`)
      }
      if (source === 'VENDOR' && ing.price == null) failures.push(`${label} missing vendor price`)
      if (source === 'VENDOR' && (!ing.node_name || !ing.zone || !ing.coords)) {
        failures.push(`${label} missing vendor npc/zone/coords`)
      }
      if ((source === 'SCRIP_EXCHANGE' || source === 'GEMSTONE') && (!ing.node_name || !ing.zone || !ing.coords)) {
        failures.push(`${label} missing exchange npc/zone/coords`)
      }
    }
  }

  assert.deepEqual(failures, [])
})
