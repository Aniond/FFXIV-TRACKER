import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildItemCatalog, itemPath, itemSlug } from '../src/itemCatalog.js'

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
})
