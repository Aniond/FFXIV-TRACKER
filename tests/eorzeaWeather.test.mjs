/* Tests for the Eorzean weather engine (src/eorzeaWeather.js). */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  forecastChance, periodStart, weatherAt, forecast, weatherWindow, WEATHER_PERIOD_MS,
} from '../src/eorzeaWeather.js'
import { ZONE_WEATHER } from '../src/weatherData.js'

test('forecastChance is 0-99, deterministic, and constant within a period', () => {
  const t = 1_750_000_000_000
  const c = forecastChance(t)
  assert.ok(c >= 0 && c < 100)
  assert.equal(forecastChance(t), c)
  // anywhere inside the same 1400s period → same chance
  assert.equal(forecastChance(periodStart(t) + WEATHER_PERIOD_MS - 1), forecastChance(periodStart(t)))
})

test('known vector: the published algorithm result for a fixed timestamp', () => {
  // Computed once from the reference uint32 algorithm; locks the bit math
  // (<<11 ^, >>>8 ^, %100 in uint32 space) against regressions.
  const expect = (() => {
    const unix = 1_700_000_000
    const bell = Math.floor(unix / 175)
    const increment = (bell + 8 - (bell % 8)) % 24
    const calcBase = Math.floor(unix / 4200) * 100 + increment
    const s1 = ((calcBase << 11) ^ calcBase) >>> 0
    const s2 = ((s1 >>> 8) ^ s1) >>> 0
    return s2 % 100
  })()
  assert.equal(forecastChance(1_700_000_000_000), expect)
})

test('weather tables are well-formed (cumulative, ending at 100)', () => {
  for (const [zone, table] of Object.entries(ZONE_WEATHER)) {
    let prev = 0
    for (const [threshold, name] of table) {
      assert.ok(threshold > prev || threshold === prev, `${zone}: thresholds not non-decreasing`)
      assert.ok(typeof name === 'string' && name.length, `${zone}: missing weather name`)
      prev = threshold
    }
    assert.equal(table[table.length - 1][0], 100, `${zone}: table must end at 100`)
  }
})

test('weatherAt returns a table weather for mapped zones, null otherwise', () => {
  const zone = Object.keys(ZONE_WEATHER)[0]
  const names = new Set(ZONE_WEATHER[zone].map(([, n]) => n))
  for (let i = 0; i < 20; i++) {
    const w = weatherAt(zone, 1_600_000_000_000 + i * WEATHER_PERIOD_MS)
    assert.ok(names.has(w), `unexpected weather ${w}`)
  }
  assert.equal(weatherAt('Not A Real Zone'), null)
})

test('forecast covers consecutive periods with no gaps', () => {
  const zone = Object.keys(ZONE_WEATHER)[0]
  const f = forecast(zone, 5, 1_650_000_000_000)
  assert.equal(f.length, 5)
  for (let i = 1; i < f.length; i++) {
    assert.equal(f[i].start, f[i - 1].end)
    assert.equal(f[i].end - f[i].start, WEATHER_PERIOD_MS)
  }
  assert.ok(f[0].start <= 1_650_000_000_000 && 1_650_000_000_000 < f[0].end)
})

test('weatherWindow reports the next change consistently with forecast', () => {
  const zone = 'Labyrinthos'
  const t = 1_690_000_000_000
  const w = weatherWindow(zone, t)
  assert.ok(w.now)
  if (w.next) {
    assert.notEqual(w.next, w.now)
    assert.ok(w.changeMs > 0)
    // the change moment really has the new weather
    assert.equal(weatherAt(zone, t + w.changeMs + 1), w.next)
    assert.equal(weatherAt(zone, t + w.changeMs - WEATHER_PERIOD_MS / 2), w.now)
  }
})
