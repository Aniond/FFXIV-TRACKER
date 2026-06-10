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

/** ET hour (0-23) at a real timestamp. */
const etHourAt = (ms) => Math.floor((((ms / 1000) * (3600 / 175)) % 86400) / 3600)
const ET_HOUR_MS = 175 * 1000

/**
 * Next catchable window for a restricted fish.
 * @param zone  the spot's zone (for weather lookups)
 * @param cond  { weather:[], prevWeather:[], start, end } from fishConditions
 * @returns { openMs, closeMs, active } in real ms, or null if no window is
 *          found within the horizon (~7 real days) / zone unmapped.
 */
export function nextFishWindow(zone, cond, ms = Date.now(), horizonPeriods = 1040) {
  const needsWeather = (cond.weather?.length || 0) + (cond.prevWeather?.length || 0) > 0
  if (needsWeather && !ZONE_WEATHER[zone]) return null
  const hourSegs = cond.start < cond.end
    ? [[cond.start, cond.end]]
    : [[cond.start, 24], [0, cond.end]] // ET-midnight-wrapping window

  const periodOk = (start) => {
    if (!needsWeather) return true
    const w = weatherAt(zone, start)
    const p = weatherAt(zone, start - WEATHER_PERIOD_MS)
    const okW = !cond.weather?.length || cond.weather.includes(w)
    const okP = !cond.prevWeather?.length || cond.prevWeather.includes(p)
    return okW && okP
  }

  let start = periodStart(ms)
  for (let i = 0; i < horizonPeriods; i++, start += WEATHER_PERIOD_MS) {
    if (!periodOk(start)) continue
    const h0 = etHourAt(start) // 0, 8 or 16
    for (const [a, b] of hourSegs) {
      const s = Math.max(a, h0)
      const e = Math.min(b, h0 + 8)
      if (s >= e) continue
      const openMs = start + (s - h0) * ET_HOUR_MS
      let closeMs = start + (e - h0) * ET_HOUR_MS
      if (closeMs <= ms) continue
      // Extend the close across consecutive periods while the window truly
      // continues (weather still valid and the hour range carries over).
      let nxt = start + WEATHER_PERIOD_MS
      while (closeMs === nxt && periodOk(nxt)) {
        const nh = etHourAt(nxt)
        const seg = hourSegs.find(([sa, sb]) => sa <= nh && nh < sb)
        if (!seg) break
        closeMs = nxt + (Math.min(seg[1], nh + 8) - nh) * ET_HOUR_MS
        nxt += WEATHER_PERIOD_MS
      }
      return { openMs, closeMs, active: ms >= openMs && ms < closeMs }
    }
  }
  return null
}
