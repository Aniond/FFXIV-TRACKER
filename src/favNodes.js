/* ============================================================
   favNodes — localStorage-backed set of starred gathering nodes.
   Written by the star button on Mining/Botany cards; read by the
   dashboard (HomePage) Favorited Timers rail. Values are node IDs
   (the `id` field on MINING_NODES / BOTANY_NODES entries).
   ============================================================ */

const KEY = 'ffxiv-fav-nodes'

export function getFavNodes() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

export function isFav(id) {
  return getFavNodes().includes(id)
}

// Toggle membership; returns the new boolean state for `id`.
export function toggleFav(id) {
  const cur = getFavNodes()
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
  localStorage.setItem(KEY, JSON.stringify(next))
  return next.includes(id)
}
