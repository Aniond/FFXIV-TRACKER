/* Tests for the account-sync storage layer (src/syncedState.js) — the pure
   localStorage side. Network push is exercised only when a JWT exists, so a
   guest environment (no token) keeps these tests offline. */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Minimal browser shims (module under test touches localStorage + window).
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  location: { pathname: '/', hash: '', search: '' },
  history: { replaceState: () => {} },
}

const { readState, writeState, SET_CODEC, SYNCED_KEYS } = await import('../src/syncedState.js')

beforeEach(() => store.clear())

test('readState returns fallback for missing or corrupt values', () => {
  assert.deepEqual(readState('ffxiv-fav-nodes', []), [])
  store.set('ffxiv-fav-nodes', 'not json{{{')
  assert.deepEqual(readState('ffxiv-fav-nodes', []), [])
})

test('writeState round-trips through localStorage', () => {
  writeState('ffxiv-fav-nodes', ['mining-a', 'botany-b'])
  assert.deepEqual(readState('ffxiv-fav-nodes', []), ['mining-a', 'botany-b'])
  writeState('ffxiv-mining-collected', { 'node::Ore': true })
  assert.deepEqual(readState('ffxiv-mining-collected', {}), { 'node::Ore': true })
})

test('SET_CODEC converts Set ↔ array', () => {
  const s = SET_CODEC.fromJSON(['a', 'b'])
  assert.ok(s instanceof Set)
  assert.ok(s.has('a') && s.has('b'))
  assert.deepEqual(SET_CODEC.toJSON(new Set(['x'])), ['x'])
  // corrupt input degrades to empty set, not a crash
  assert.equal(SET_CODEC.fromJSON('garbage').size, 0)
})

test('SYNCED_KEYS matches the backend allowlist', async () => {
  // Read the backend source as text (it requires pg, which tests don't load).
  const fs = await import('node:fs')
  const src = fs.readFileSync(new URL('../backend/routes/users.js', import.meta.url), 'utf8')
  for (const key of SYNCED_KEYS) {
    assert.ok(src.includes(`'${key}'`), `backend allowlist missing ${key}`)
  }
})
