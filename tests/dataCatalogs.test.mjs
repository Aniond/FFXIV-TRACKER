/* Invariant tests for the static gathering catalogs. These codify what the
   2026-06 audit found broken (impossible ET hours from the HHMM decoder bug,
   missing expansion labels) so regenerating data can't silently regress. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MINING_NODES } from '../src/miningData.js'
import { BOTANY_NODES } from '../src/botanyData.js'
import { FISHING_SPOTS, EXPANSIONS } from '../src/fishingData.js'
import { EXP_SHORT } from '../src/crosslinkNodes.js'

const eachWindow = (w) => (Array.isArray(w) ? w : [w])

function checkWindows(nodes, label) {
  for (const n of nodes) {
    if (!n.window) continue
    for (const w of eachWindow(n.window)) {
      for (const [h, m] of [w.open, w.close]) {
        assert.ok(Number.isInteger(h) && h >= 0 && h <= 23,
          `${label} ${n.id}: ET hour ${h} out of range (HHMM decoder bug?)`)
        assert.ok(Number.isInteger(m) && m >= 0 && m <= 59,
          `${label} ${n.id}: ET minute ${m} out of range`)
      }
    }
  }
}

test('all spawn windows use valid ET hours/minutes', () => {
  checkWindows(MINING_NODES, 'mining')
  checkWindows(BOTANY_NODES, 'botany')
  checkWindows(FISHING_SPOTS, 'fishing')
})

test('node/spot ids are unique within and across catalogs', () => {
  const seen = new Map()
  for (const [label, arr] of [['mining', MINING_NODES], ['botany', BOTANY_NODES], ['fishing', FISHING_SPOTS]]) {
    for (const n of arr) {
      assert.ok(n.id, `${label}: entry without id (${n.name})`)
      assert.ok(!seen.has(n.id), `duplicate id ${n.id} (${seen.get(n.id)} vs ${label})`)
      seen.set(n.id, label)
    }
  }
})

test('every entry has the fields the cards render', () => {
  for (const n of [...MINING_NODES, ...BOTANY_NODES]) {
    assert.ok(n.name && n.zone && n.coords, `node ${n.id} missing name/zone/coords`)
    assert.ok(EXP_SHORT[n.expansion], `node ${n.id}: expansion "${n.expansion}" has no badge label`)
    assert.ok(Array.isArray(n.items) && n.items.length, `node ${n.id} has no items`)
  }
  for (const s of FISHING_SPOTS) {
    assert.ok(s.name && s.zone && s.coords, `spot ${s.id} missing name/zone/coords`)
    assert.ok(EXP_SHORT[s.expansion], `spot ${s.id}: expansion "${s.expansion}" has no badge label`)
    assert.ok(Array.isArray(s.fish) && s.fish.length, `spot ${s.id} has no fish`)
  }
})

test('no node lists the same item twice (item name is the React key)', () => {
  for (const n of [...MINING_NODES, ...BOTANY_NODES]) {
    const names = n.items.map((i) => i.name)
    assert.equal(new Set(names).size, names.length, `node ${n.id} has duplicate item names`)
  }
  for (const s of FISHING_SPOTS) {
    const names = s.fish.map((f) => f.name)
    assert.equal(new Set(names).size, names.length, `spot ${s.id} has duplicate fish names`)
  }
})

test('fishing expansion filter covers every expansion present in the data', () => {
  const filterKeys = new Set(EXPANSIONS.map((e) => e.key))
  for (const s of FISHING_SPOTS) {
    assert.ok(filterKeys.has(s.expansion),
      `spot ${s.id} (${s.expansion}) is unreachable through the expansion filter`)
  }
})

test('timed nodes carry a window and a non-Any time label, and vice versa', () => {
  for (const n of [...MINING_NODES, ...BOTANY_NODES]) {
    if (['Unspoiled', 'Ephemeral', 'Legendary'].includes(n.type)) {
      // Some unspoiled entries intentionally have window:null with an
      // explanatory label — but a window with time 'Any' is always a bug.
      if (n.window) assert.notEqual(n.time, 'Any', `node ${n.id} has a window but time "Any"`)
    } else {
      assert.equal(n.window, null, `regular node ${n.id} should not have a window`)
    }
  }
})
