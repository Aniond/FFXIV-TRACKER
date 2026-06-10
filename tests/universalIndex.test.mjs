/* Tests for the universal instant-search ranking (src/universalIndex.js). */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchIndex } from '../src/universalIndex.js'

const E = (label, cat = 'mining') => ({ label, cat, sub: '', href: `/x?h=${label}` })

const ENTRIES = [
  E('Dark Rye'), E('Dark Rye Flour', 'ingredient'), E('Darksteel Ore'),
  E('Iceberg Lettuce', 'botany'), E('Lettuce Soup', 'recipe'),
  E('Bianaq Bream', 'fishing'), E('Chupacabra', 'hunt'),
  E('Raw Ametrine'), E('Rarefied Raw Ametrine'),
]

test('requires at least 2 characters', () => {
  assert.deepEqual(searchIndex(ENTRIES, ''), [])
  assert.deepEqual(searchIndex(ENTRIES, 'd'), [])
})

test('exact match outranks prefix, prefix outranks substring', () => {
  const r = searchIndex(ENTRIES, 'dark rye')
  assert.equal(r[0].label, 'Dark Rye')          // exact
  assert.equal(r[1].label, 'Dark Rye Flour')    // prefix
  const r2 = searchIndex(ENTRIES, 'raw ametrine')
  assert.equal(r2[0].label, 'Raw Ametrine')     // exact beats the rarefied substring hit
  assert.equal(r2[1].label, 'Rarefied Raw Ametrine')
})

test('word-boundary hits rank above mid-word substrings', () => {
  const r = searchIndex(ENTRIES, 'lettuce')
  // 'Lettuce Soup' starts with it; 'Iceberg Lettuce' has a word-boundary hit.
  assert.deepEqual(r.map((e) => e.label), ['Lettuce Soup', 'Iceberg Lettuce'])
})

test('case-insensitive and respects the result cap', () => {
  assert.equal(searchIndex(ENTRIES, 'CHUPACABRA')[0].label, 'Chupacabra')
  const many = Array.from({ length: 30 }, (_, i) => E(`Copper Ore ${i}`))
  assert.equal(searchIndex(many, 'copper', 8).length, 8)
})

test('same label collapses to at most two categories', () => {
  const dup = [E('Gem Algae', 'botany'), E('Gem Algae', 'ingredient'), E('Gem Algae', 'fishing')]
  assert.equal(searchIndex(dup, 'gem algae').length, 2)
})
