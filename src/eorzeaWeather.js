/* ============================================================
   eorzeaWeather.js — deterministic Eorzean weather forecasts.

   FFXIV weather is pure math: every 8 Eorzean hours (= 1400 real
   seconds) the game derives a 0-99 "chance" from the timestamp and
   looks it up in the zone's cumulative rate table. Same algorithm
   the in-game skywatchers and every forecast site use — no API,
   no scraping, works offline and arbitrarily far into the future.

   Tables come from generated weatherData.js (Garland skywatcher).
   ============================================================ */
import { ZONE_WEATHER } from './weatherData.js'

export const WEATHER_PERIOD_MS = 1400 * 1000 // 8 ET hours of real time

/** The game's forecast hash for a given real timestamp (0–99). */
export function forecastChance(ms = Date.now()) {
  const unix = Math.floor(ms / 1000)
  const bell = Math.floor(unix / 175)
  // ET hour rounded UP to the period boundary (00/08/16), wrapped to 0-23.
  const increment = (bell + 8 - (bell % 8)) % 24
  const totalDays = Math.floor(unix / 4200)
  const calcBase = totalDays * 100 + increment
  // The game does this in uint32 — >>> 0 keeps JS in that domain.
  const step1 = ((calcBase << 11) ^ calcBase) >>> 0
  const step2 = ((step1 >>> 8) ^ step1) >>> 0
  return step2 % 100
}

/** Start (real ms) of the weather period containing `ms`. */
export function periodStart(ms = Date.now()) {
  return Math.floor(ms / WEATHER_PERIOD_MS) * WEATHER_PERIOD_MS
}

/** Weather name in a zone at a given time, or null if the zone is unmapped. */
export function weatherAt(zone, ms = Date.now()) {
  const table = ZONE_WEATHER[zone]
  if (!table) return null
  const chance = forecastChance(ms)
  for (const [threshold, name] of table) {
    if (chance < threshold) return name
  }
  return table[table.length - 1][1] // tables end at 100; defensive fallback
}

/**
 * Forecast for a zone: `count` periods starting at the current one.
 * @returns [{ start, end, weather }] (real ms; null when zone unmapped)
 */
export function forecast(zone, count = 6, ms = Date.now()) {
  if (!ZONE_WEATHER[zone]) return null
  const out = []
  let start = periodStart(ms)
  for (let i = 0; i < count; i++) {
    out.push({ start, end: start + WEATHER_PERIOD_MS, weather: weatherAt(zone, start) })
    start += WEATHER_PERIOD_MS
  }
  return out
}

/**
 * Current weather plus the next DIFFERENT weather and when it arrives.
 * @returns { now, next, changeMs } — changeMs is real ms until the change;
 *          next/changeMs are null if the weather holds for the horizon.
 */
export function weatherWindow(zone, ms = Date.now(), horizon = 24) {
  const f = forecast(zone, horizon, ms)
  if (!f) return null
  const now = f[0].weather
  for (const p of f.slice(1)) {
    if (p.weather !== now) return { now, next: p.weather, changeMs: p.start - ms }
  }
  return { now, next: null, changeMs: null }
}

export const hasWeather = (zone) => !!ZONE_WEATHER[zone]
