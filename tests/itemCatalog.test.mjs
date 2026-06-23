import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildItemCatalog, itemPath, itemSlug } from '../src/itemCatalog.js'
import { CRAFTING_GEAR } from '../src/craftingGearData.js'

function loadRecipeSeeds() {
  const dir = join(process.cwd(), 'backend')
  return readdirSync(dir)
    .filter((name) => name.endsWith('-recipes.json'))
    .flatMap((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')))
}

test('item slugs produce stable canonical paths', () => {
  assert.equal(itemSlug('Blood Tomato'), 'blood-tomato')
  assert.equal(itemPath('Thavnairian Calamari'), '/item/thavnairian-calamari')
})

test('canonical item catalog combines sources, crafting, and recipe usage', () => {
  const catalog = buildItemCatalog(loadRecipeSeeds())
  const bloodTomato = catalog.bySlug.get('blood-tomato')
  assert.ok(bloodTomato)
  assert.equal(bloodTomato.name, 'Blood Tomato')
  assert.ok(bloodTomato.sources.some((s) => s.source === 'BOTANY' && s.zone && s.coords))
  assert.ok(bloodTomato.usedIn.length > 0)

  const calamariRipieni = catalog.bySlug.get('calamari-ripieni')
  assert.ok(calamariRipieni)
  assert.ok(calamariRipieni.craftedRecipe)
  assert.ok(calamariRipieni.sources.some((s) => s.source === 'CRAFTED'))
  assert.ok(calamariRipieni.sources.some((s) => s.source === 'MARKET_BOARD' && s.itemId))
})

test('crafting gear has item pages with market and purchase sources', () => {
  const catalog = buildItemCatalog(loadRecipeSeeds())
  const failures = []
  for (const gear of CRAFTING_GEAR) {
    const item = catalog.bySlug.get(itemSlug(gear.name))
    if (!item) {
      failures.push(`${gear.name} missing item page`)
      continue
    }
    if (!item.sources.some((s) => s.source === 'MARKET_BOARD' && s.itemId)) {
      failures.push(`${gear.name} missing market source`)
    }
    if (gear.vendor && !item.sources.some((s) => s.source === 'VENDOR' && s.nodeName && s.zone && s.coords && s.price != null)) {
      failures.push(`${gear.name} missing vendor source`)
    }
    if (gear.scrip && !item.sources.some((s) => s.source === 'SCRIP_EXCHANGE' && s.nodeName && s.zone && s.coords && s.price != null && s.currency)) {
      failures.push(`${gear.name} missing scrip source`)
    }
  }
  assert.deepEqual(failures, [])
})
