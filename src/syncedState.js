/* ============================================================
   syncedState.js — account sync for per-user UI state.

   localStorage stays the source of truth for instant reads and for
   guests. When a Discord-logged-in user loads any page:

   1. HYDRATE (once per page load): GET /api/user/state pulls every
      synced key and overwrites localStorage (server wins — it's the
      cross-device copy), then fires the 'ffxiv-state-hydrated' event
      so live components re-read.
   2. PUSH: every local write goes to localStorage immediately and is
      PATCHed to the server debounced (batched across keys).

   Guests (no JWT) never touch the network — behaviour is unchanged.

   Use via the hook:
     const [collected, setCollected] = useSyncedState(KEY, {})
   or imperatively (non-React modules like favNodes):
     readState(KEY, fallback) / writeState(KEY, value)
   ============================================================ */
import { useEffect, useState } from 'react'
import { getToken, fetchUserState, saveUserState } from './api.js'

// Must match STATE_KEYS in backend/routes/users.js.
export const SYNCED_KEYS = [
  'ffxiv-mining-collected',
  'ffxiv-botany-collected',
  'ffxiv-fish-caught',
  'ffxiv-cooking-list',
  'ffxiv-saved-recipes',
  'ffxiv-fav-nodes',
  'ffxiv-search-history',
]

export const HYDRATED_EVENT = 'ffxiv-state-hydrated'

export function readState(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch { return fallback }
}

// ── push: debounced, batched PATCH ───────────────────────────
const pending = new Map() // key -> value
let pushTimer = null
function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    if (!getToken() || !pending.size) { pending.clear(); return }
    const states = Object.fromEntries(pending)
    pending.clear()
    try { await saveUserState(states) } catch { /* offline/server hiccup — localStorage still has it */ }
  }, 1500)
}

export function writeState(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota — ignore */ }
  if (getToken() && SYNCED_KEYS.includes(key)) {
    pending.set(key, value)
    schedulePush()
  }
}

// ── hydrate: once per page load ──────────────────────────────
let hydratePromise = null
export function hydrateFromServer() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      if (!getToken()) return false
      const server = await fetchUserState().catch(() => null)
      if (!server) return false
      for (const key of SYNCED_KEYS) {
        if (server[key] !== undefined) {
          try { localStorage.setItem(key, JSON.stringify(server[key])) } catch { /* ignore */ }
        }
      }
      window.dispatchEvent(new Event(HYDRATED_EVENT))
      return true
    })()
  }
  return hydratePromise
}

/**
 * Drop-in replacement for the localStorage-backed useState pattern.
 * Reads localStorage synchronously, hydrates from the server once,
 * and pushes every change back (debounced) when logged in.
 *
 * @param {string} key       storage key (must be in SYNCED_KEYS to sync)
 * @param {*} fallback       value when nothing is stored
 * @param {{fromJSON?, toJSON?}} codec  optional converters (e.g. Set ↔ array)
 */
export function useSyncedState(key, fallback, codec = {}) {
  const fromJSON = codec.fromJSON || ((v) => v)
  const toJSON = codec.toJSON || ((v) => v)
  const [value, setValue] = useState(() => fromJSON(readState(key, fallback)))

  // Hydrate from the server, then re-read (covers both "hydration finished
  // before mount" — promise resolves immediately — and "after mount").
  useEffect(() => {
    let alive = true
    hydrateFromServer().then((changed) => {
      if (alive && changed) setValue(fromJSON(readState(key, fallback)))
    })
    const onHydrated = () => { if (alive) setValue(fromJSON(readState(key, fallback))) }
    window.addEventListener(HYDRATED_EVENT, onHydrated)
    return () => { alive = false; window.removeEventListener(HYDRATED_EVENT, onHydrated) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      writeState(key, toJSON(resolved))
      return resolved
    })
  }
  return [value, set]
}

// Set ↔ array codec for Cooking's listIds/savedIds.
export const SET_CODEC = {
  fromJSON: (v) => new Set(Array.isArray(v) ? v : []),
  toJSON: (v) => [...v],
}
