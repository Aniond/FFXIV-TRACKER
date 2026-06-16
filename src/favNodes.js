/* ============================================================
   favNodes — account-synced set of starred gathering nodes.
   Written by the star button on Mining/Botany cards; read by the
   dashboard (HomePage) Favorited Timers rail. Values are node IDs
   (the `id` field on MINING_NODES / BOTANY_NODES entries).

   Storage goes through syncedState: localStorage for everyone
   (instant, offline), pushed to Postgres for logged-in users so
   stars follow the account across devices. Components that need
   to react to the initial server hydration listen for
   HYDRATED_EVENT (see FavStar.jsx / HomePage.jsx).
   ============================================================ */
import { readState, writeState } from './syncedState'

const KEY = 'ffxiv-fav-nodes'

export function getFavNodes() {
  const v = readState(KEY, [])
  return Array.isArray(v) ? v : []
}

export function isFav(id) {
  return getFavNodes().includes(id)
}

export function addFav(id) {
  const cur = getFavNodes()
  if (!cur.includes(id)) writeState(KEY, [...cur, id])
}

// Toggle membership; returns the new boolean state for `id`.
export function toggleFav(id) {
  const cur = getFavNodes()
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
  writeState(KEY, next)
  return next.includes(id)
}
