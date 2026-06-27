import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MINING_NODES } from '../src/miningData.js'
import { BOTANY_NODES } from '../src/botanyData.js'
import { FISHING_SPOTS } from '../src/fishingData.js'
import { BAIT_TACKLE } from '../src/baitTackleData.js'
import { CRAFTING_GEAR } from '../src/craftingGearData.js'
import { EXTRA_BOTANY_NODES, EXTRA_MINING_NODES, EXTRA_FISHING_SPOTS } from '../src/crosslinkNodes.js'
import { buildItemCatalog, itemPath, itemSlug, normItemName, SOURCE_PATH } from '../src/itemCatalog.js'
import { recipeEntries, searchIndex, staticEntries } from '../src/universalIndex.js'

function loadRecipeSeeds() {
  const dir = join(process.cwd(), 'backend')
  return readdirSync(dir)
    .filter((name) => name.endsWith('-recipes.json'))
    .flatMap((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')))
}

function staticDatabaseItemNames() {
  const names = []
  for (const node of [...MINING_NODES, ...EXTRA_MINING_NODES, ...BOTANY_NODES, ...EXTRA_BOTANY_NODES]) {
    for (const item of node.items || []) names.push(item.name)
  }
  for (const spot of [...FISHING_SPOTS, ...EXTRA_FISHING_SPOTS]) {
    for (const fish of spot.fish || []) names.push(fish.name)
  }
  for (const bait of BAIT_TACKLE) names.push(bait.name)
  for (const gear of CRAFTING_GEAR) names.push(gear.name)
  return [...new Set(names.filter(Boolean))]
}

test('canonical item catalog has unique slugs and actionable sources', () => {
  const catalog = buildItemCatalog(loadRecipeSeeds())
  const failures = []
  const slugs = new Map()

  for (const item of catalog.items) {
    const existing = slugs.get(item.slug)
    if (existing && existing !== item.name) failures.push(`slug collision ${item.slug}: ${existing} / ${item.name}`)
    slugs.set(item.slug, item.name)
    if (!item.sources.length) failures.push(`${item.name} has no source rows`)

    for (const source of item.sources) {
      const label = `${item.name} :: ${source.source}`
      if (SOURCE_PATH[source.source] && (!source.zone || !source.coords || !source.nodeName)) {
        const hasActionableGatheringSource = item.sources.some((candidate) => (
          candidate.source === source.source
          && candidate.zone
          && candidate.coords
          && candidate.nodeName
        ))
        if (!hasActionableGatheringSource) failures.push(`${label} missing gathering location`)
      }
      if (source.source === 'VENDOR' && (!source.zone || !source.coords || !source.nodeName || source.price == null)) {
        failures.push(`${label} missing vendor purchase detail`)
      }
      if (source.source === 'SCRIP_EXCHANGE' && (!source.zone || !source.coords || !source.nodeName || source.price == null || !source.currency)) {
        failures.push(`${label} missing scrip purchase detail`)
      }
      if (source.source === 'MARKET_BOARD' && !source.itemId) failures.push(`${label} missing market item id`)
      if (source.source === 'CRAFTED' && !source.recipeName) failures.push(`${label} missing recipe link`)
    }
  }

  assert.deepEqual(failures, [])
})

test('every static database item has an item page and an instant-search item link', () => {
  const catalog = buildItemCatalog(loadRecipeSeeds())
  const itemHrefs = new Set(staticEntries().filter((entry) => entry.href.startsWith('/item/')).map((entry) => entry.href))
  const failures = []

  for (const name of staticDatabaseItemNames()) {
    if (!catalog.bySlug.has(itemSlug(name))) failures.push(`${name} missing canonical item page`)
    if (!itemHrefs.has(itemPath(name))) failures.push(`${name} missing static search item link`)
  }

  assert.deepEqual(failures, [])
})

test('combined universal search entries cover every canonical item by name', () => {
  const recipes = loadRecipeSeeds()
  const catalog = buildItemCatalog(recipes)
  const entries = [...staticEntries(), ...recipeEntries(recipes)]
  const entryNames = new Set(entries.map((entry) => normItemName(entry.label)))
  const itemHrefs = new Set(entries.filter((entry) => entry.href.startsWith('/item/')).map((entry) => entry.href))
  const failures = []

  for (const item of catalog.items) {
    if (!entryNames.has(normItemName(item.name))) failures.push(`${item.name} missing searchable label`)
  }
  for (const href of itemHrefs) {
    const slug = href.replace(/^\/item\//, '')
    if (!catalog.bySlug.has(slug)) failures.push(`${href} points at missing item page`)
  }

  assert.deepEqual(failures, [])
})

test('instant search can find merchant gear and crosslink extras', () => {
  const entries = staticEntries()
  const starTech = searchIndex(entries, 'star tech frypan', 5)
  assert.equal(starTech[0]?.href, itemPath('Star Tech Frypan'))
  assert.equal(starTech[0]?.cat, 'item')

  const extraItem = staticDatabaseItemNames().find((name) => (
    !MINING_NODES.some((node) => node.items?.some((item) => item.name === name))
    && !BOTANY_NODES.some((node) => node.items?.some((item) => item.name === name))
    && !FISHING_SPOTS.some((spot) => spot.fish?.some((fish) => fish.name === name))
  ))
  assert.ok(extraItem)
  assert.ok(searchIndex(entries, extraItem, 5).some((entry) => entry.href === itemPath(extraItem)))
})
