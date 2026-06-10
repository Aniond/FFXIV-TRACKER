/* Tests for the Eorzea-time window math (src/etWindow.js).
   1 ET hour = 175 real seconds; a full ET day = 4200 real seconds.
   Time is controlled by stubbing Date.now, so every case is deterministic. */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { eorzeaMinuteOfDay, msUntilEt, windowState, fmtDur } from '../src/etWindow.js'

const ET_DAY_REAL_MS = 4200 * 1000 // 24 ET hours in real ms

// Real timestamp (ms) at which Eorzea time-of-day is exactly h:m.
// ET seconds since epoch = realMs/1000 * (3600/175); pick realMs so that
// (etSec % 86400) == h*3600 + m*60.
const realMsAtEt = (h, m = 0) => ((h * 3600 + m * 60) * 175) / 3600 * 1000

const origNow = Date.now
const setEt = (h, m = 0) => { const ms = realMsAtEt(h, m); Date.now = () => ms }
beforeEach(() => { Date.now = origNow })
afterEach(() => { Date.now = origNow })

test('eorzeaMinuteOfDay maps real time to ET minutes', () => {
  setEt(0, 0);  assert.equal(eorzeaMinuteOfDay(), 0)
  setEt(12, 30); assert.equal(eorzeaMinuteOfDay(), 12 * 60 + 30)
  setEt(23, 59); assert.equal(eorzeaMinuteOfDay(), 23 * 60 + 59)
})

test('msUntilEt counts forward and wraps past midnight', () => {
  setEt(10, 0)
  // 10:00 → 12:00 is 2 ET hours = 350 real seconds
  assert.equal(Math.round(msUntilEt(12, 0)), 350 * 1000)
  // 10:00 → 8:00 wraps a day: 22 ET hours
  assert.equal(Math.round(msUntilEt(8, 0)), 22 * 175 * 1000)
})

test('windowState: null window means always up', () => {
  assert.equal(windowState(null), null)
  assert.equal(windowState(undefined), null)
})

test('windowState: simple window up/closed/soon', () => {
  const w = { open: [10, 0], close: [12, 0] }
  setEt(11, 0)
  let s = windowState(w)
  assert.equal(s.state, 'up')
  assert.equal(s.pre, 'Closes in')
  setEt(9, 45) // opens in 15 ET min ≈ 43.75 real s → soon (< 30 real min)
  s = windowState(w)
  assert.equal(s.state, 'soon')
  setEt(20, 0) // far from the next 10:00
  s = windowState(w)
  assert.equal(s.state, 'closed')
  assert.equal(s.pre, 'Opens in')
})

test('windowState: midnight-crossing window (20:00–0:00 and 22:00–2:00)', () => {
  const w1 = { open: [20, 0], close: [0, 0] }
  setEt(23, 0); assert.equal(windowState(w1).state, 'up')
  setEt(0, 30); assert.equal(windowState(w1).state, 'closed') // just past close
  setEt(19, 59); assert.notEqual(windowState(w1).state, 'up')

  const w2 = { open: [22, 0], close: [2, 0] }
  setEt(1, 0);  assert.equal(windowState(w2).state, 'up')
  setEt(23, 0); assert.equal(windowState(w2).state, 'up')
  setEt(11, 0); assert.equal(windowState(w2).state, 'closed') // 11 ET h out ≈ 32 real min — beyond the 30-min 'soon' horizon
})

test('windowState: every valid hour must be reachable (regression for HHMM bug)', () => {
  // The decoder bug produced open hours like 33 — such a window can never be up.
  // Assert that a window with in-range hours IS up inside its span...
  setEt(20, 30)
  assert.equal(windowState({ open: [20, 0], close: [0, 0] }).state, 'up')
  // ...and document the failure mode: an out-of-range hour never opens.
  assert.notEqual(windowState({ open: [33, 20], close: [0, 0] }).state, 'up')
})

test('windowState: dual windows pick the active one, else the next to open', () => {
  const dual = [
    { open: [10, 0], close: [12, 0] },
    { open: [22, 0], close: [0, 0] },
  ]
  setEt(11, 0)
  assert.equal(windowState(dual).state, 'up')   // first window live
  setEt(23, 0)
  assert.equal(windowState(dual).state, 'up')   // second window live (the old single-window model showed Closed here)
  setEt(15, 0)
  const s = windowState(dual)
  assert.notEqual(s.state, 'up')
  // next opening from 15:00 is 22:00 (7 ET h), not 10:00 (19 ET h)
  assert.equal(Math.round(s.ms), 7 * 175 * 1000)
})

test('windowState: ms is always within one ET day and non-negative', () => {
  setEt(13, 37)
  for (const w of [{ open: [6, 0], close: [8, 0] }, { open: [20, 0], close: [0, 0] }]) {
    const s = windowState(w)
    assert.ok(s.ms > 0 && s.ms <= ET_DAY_REAL_MS, `ms out of range: ${s.ms}`)
  }
})

test('fmtDur formats H:MM:SS / MM:SS and clamps negatives', () => {
  assert.equal(fmtDur(0), '00:00')
  assert.equal(fmtDur(-500), '00:00')
  assert.equal(fmtDur(65 * 1000), '01:05')
  assert.equal(fmtDur((3600 + 125) * 1000), '1:02:05')
})
