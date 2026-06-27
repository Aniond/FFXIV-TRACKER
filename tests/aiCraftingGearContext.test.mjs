import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { craftingGearContextForQuery } = require('../backend/ai/craftingGearContext.js')

test('where-to-buy crafting gear queries provide merchant or scrip source context', () => {
  const rows = craftingGearContextForQuery('Where can I buy level 85 crafting gear')
  assert.ok(rows.length > 0)
  assert.ok(rows.length <= 18)
  assert.ok(rows.every((row) => row.source_url?.startsWith('/item/')))
  assert.ok(rows.some((row) => row.vendor?.npc && row.vendor.zone && row.vendor.coords && row.vendor.price != null
    || row.scrip?.npc && row.scrip.zone && row.scrip.coords && row.scrip.price != null && row.scrip.currency))
})

test('non-gear questions do not add crafting gear prompt context', () => {
  assert.deepEqual(craftingGearContextForQuery('Where is Chupacabra?'), [])
})
