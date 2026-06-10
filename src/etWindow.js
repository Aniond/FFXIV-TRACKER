/* ============================================================
   etWindow.js — Eorzea-time spawn-window helpers for timed
   gathering nodes (Unspoiled / Ephemeral / Legendary).
   Pairs with EorzeaClock.jsx (1 ET hour = 175 real seconds).
   ============================================================ */

const ET_MULT = 3600 / 175
const DAY_SEC = 24 * 3600

/** Current Eorzea time, minutes-into-day (0..1439). */
export function eorzeaMinuteOfDay() {
  const etSec = Math.floor((Date.now() / 1000) * ET_MULT)
  return Math.floor(etSec / 60) % 1440
}

/** Real-world ms until the next occurrence of an ET hour:min. */
export function msUntilEt(targetH, targetM = 0) {
  const within = ((Date.now() / 1000) * ET_MULT) % DAY_SEC
  const target = targetH * 3600 + targetM * 60
  let deltaEt = target - within
  if (deltaEt <= 0) deltaEt += DAY_SEC
  return (deltaEt / ET_MULT) * 1000
}

/**
 * Live state for a node's spawn window(s).
 * @param {{open:[h,m], close:[h,m]}|Array<{open,close}>|null} window
 *   Unspoiled/Legendary nodes can pop twice an ET day — pass an array and the
 *   active (or next-opening) window wins.
 * @returns null (always-up) | { state:'up'|'soon'|'closed', pre, ms }
 *   state: up = active now; soon = opens within 30 real min; closed otherwise.
 *   pre:   label ('Closes in' / 'Opens in'); ms: real ms to that boundary.
 */
export function windowState(window) {
  if (!window) return null
  if (Array.isArray(window)) {
    let best = null
    for (const w of window) {
      const s = windowState(w)
      if (s.state === 'up') return s
      if (!best || s.ms < best.ms) best = s // next window to open
    }
    return best
  }
  const { open, close } = window
  const et = eorzeaMinuteOfDay()
  const o = open[0] * 60 + open[1]
  const c = close[0] * 60 + close[1]
  const inWindow = o <= c ? (et >= o && et < c) : (et >= o || et < c)
  if (inWindow) return { state: 'up', pre: 'Closes in', ms: msUntilEt(close[0], close[1]) }
  const ms = msUntilEt(open[0], open[1])
  return { state: ms < 30 * 60 * 1000 ? 'soon' : 'closed', pre: 'Opens in', ms }
}

/** Format real ms as H:MM:SS (or MM:SS under an hour). */
export function fmtDur(ms) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}
