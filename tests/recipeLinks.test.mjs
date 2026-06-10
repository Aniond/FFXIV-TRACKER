/* Tests for the reverse cross-link index (src/recipeLinks.js): gathering
   item → dishes that need it, including through subcraft chains. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildUsageIndex, usageFor, cookingLink } from '../src/recipeLinks.js'

const dish = (name, ingredients) => ({
  name, is_subcraft: false, food_buff: [{ stat: 'CRT' }], ingredients,
})
const sub = (name, ingredients) => ({
  name, is_subcraft: true, food_buff: null, ingredients,
})
const ing = (name, subcraft = false) => ({ name, amount: 1, subcraft })

test('direct ingredients map to their dishes', () => {
  const idx = buildUsageIndex([
    dish('Archon Burger', [ing('Iceberg Lettuce'), ing('Potent Spice')]),
    dish('Gyros', [ing('Potent Spice')]),
  ])
  assert.equal(usageFor(idx, 'Iceberg Lettuce').count, 1)
  assert.deepEqual(usageFor(idx, 'Potent Spice').dishes.sort(), ['Archon Burger', 'Gyros'])
  assert.equal(usageFor(idx, 'Nonexistent Item'), null)
})

test('subcraft chains resolve transitively (Dark Rye → Flour → Burger)', () => {
  const idx = buildUsageIndex([
    dish('Archon Burger', [ing('Dark Rye Flour', true)]),
    sub('Dark Rye Flour', [ing('Dark Rye')]),
  ])
  const u = usageFor(idx, 'Dark Rye')
  assert.ok(u, 'subcraft-only ingredient missing from index')
  assert.deepEqual(u.dishes, ['Archon Burger'])
})

test('lookup is case- and whitespace-insensitive', () => {
  const idx = buildUsageIndex([dish('Gyros', [ing('Potent Spice')])])
  assert.ok(usageFor(idx, '  potent SPICE '))
})

test('a dish counts once even when an item appears at multiple depths', () => {
  const idx = buildUsageIndex([
    dish('Stew', [ing('Salt'), ing('Broth', true)]),
    sub('Broth', [ing('Salt')]),
  ])
  assert.equal(usageFor(idx, 'Salt').count, 1)
})

test('circular subcraft chains terminate (depth cap)', () => {
  // A ↔ B reference each other; without the depth cap this would recurse forever.
  const idx = buildUsageIndex([
    dish('Paradox Pie', [ing('Loop A', true)]),
    sub('Loop A', [ing('Loop B', true)]),
    sub('Loop B', [ing('Loop A', true), ing('Real Flour')]),
  ])
  assert.deepEqual(usageFor(idx, 'Real Flour').dishes, ['Paradox Pie'])
})

test('subcrafts themselves are not treated as dishes', () => {
  const idx = buildUsageIndex([
    sub('Dark Rye Flour', [ing('Dark Rye')]),
  ])
  // No dishes in the catalog → nothing to index.
  assert.equal(usageFor(idx, 'Dark Rye'), null)
})

test('cookingLink URL-encodes the ingredient name', () => {
  assert.equal(cookingLink("Ut'ohmu Tomato"), "/crafting/cooking?ingredient=Ut'ohmu%20Tomato")
  assert.ok(cookingLink('A&B').includes('A%26B'))
})
