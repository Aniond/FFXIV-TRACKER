export const SPECIAL_DELIVERIES_KEY = 'ffxiv-special-deliveries'

export const CUSTOM_DELIVERIES = [
  { id: 'zhloe', name: 'Zhloe Aliapoh', level: 55, zone: 'Idyllshire', coords: 'X:4.6, Y:6.7', patch: '3.55a' },
  { id: 'mnaago', name: "M'naago", level: 60, zone: "Rhalgr's Reach", coords: 'X:14.6, Y:9.4', patch: '4.1' },
  { id: 'kurenai', name: 'Kurenai', level: 62, zone: 'The Ruby Sea', coords: 'X:28.3, Y:15.3', patch: '4.3' },
  { id: 'adkiragh', name: 'Adkiragh', level: 66, zone: 'Idyllshire', coords: 'X:4.8, Y:6.6', patch: '4.5' },
  { id: 'kai-shirr', name: 'Kai-Shirr', level: 70, zone: 'Eulmore, The Canopy', coords: 'X:12.2, Y:9.9', patch: '5.1' },
  { id: 'ehll-tou', name: 'Ehll Tou', level: 70, zone: 'The Firmament', coords: 'X:13.5, Y:11.2', patch: '5.3' },
  { id: 'charlemend', name: 'Charlemend', level: 70, zone: 'The Firmament', coords: 'X:8.9, Y:8.5', patch: '5.5' },
  { id: 'ameliance', name: 'Ameliance', level: 80, zone: 'Old Sharlayan', coords: 'X:15.6, Y:7.2', patch: '6.15' },
  { id: 'anden', name: 'Anden', level: 80, zone: 'Il Mheg', coords: 'X:17.0, Y:34.0', patch: '6.3' },
  { id: 'margrat', name: 'Margrat', level: 80, zone: 'Labyrinthos', coords: 'X:20.4, Y:20.1', patch: '6.5' },
  { id: 'nitowikwe', name: 'Nitowikwe', level: 90, zone: 'Shaaloani', coords: 'X:14.3, Y:19.3', patch: '7.15' },
  { id: 'tiisol-ja', name: 'Tiisol Ja', level: 90, zone: 'Tuliyollal', coords: 'X:15.1, Y:12.0', patch: '7.51' },
]

export const CUSTOM_DELIVERY_WEEKLY_LIMIT = 12
export const CUSTOM_DELIVERY_CLIENT_LIMIT = 6
const RESET_DAY_UTC = 2
const RESET_HOUR_UTC = 8

function resetCandidate(date) {
  const candidate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    RESET_HOUR_UTC,
    0,
    0,
    0,
  ))
  const diff = (candidate.getUTCDay() - RESET_DAY_UTC + 7) % 7
  candidate.setUTCDate(candidate.getUTCDate() - diff)
  if (candidate > date) candidate.setUTCDate(candidate.getUTCDate() - 7)
  return candidate
}

export function customDeliveryResetKey(now = new Date()) {
  return resetCandidate(now).toISOString().slice(0, 10)
}

export function nextCustomDeliveryReset(now = new Date()) {
  const last = resetCandidate(now)
  const next = new Date(last)
  next.setUTCDate(next.getUTCDate() + 7)
  return next
}

export function normalizeSpecialDeliveriesState(value, now = new Date()) {
  const resetKey = customDeliveryResetKey(now)
  const counts = value?.resetKey === resetKey && value?.counts && typeof value.counts === 'object'
    ? value.counts
    : {}
  const clean = {}
  for (const client of CUSTOM_DELIVERIES) {
    const raw = Number.parseInt(counts[client.id], 10)
    clean[client.id] = Number.isFinite(raw) ? Math.max(0, Math.min(CUSTOM_DELIVERY_CLIENT_LIMIT, raw)) : 0
  }
  return { resetKey, counts: clean }
}

export function deliveryUsage(state) {
  const counts = state?.counts || {}
  const used = CUSTOM_DELIVERIES.reduce((sum, client) => sum + Math.min(CUSTOM_DELIVERY_CLIENT_LIMIT, Number(counts[client.id]) || 0), 0)
  return {
    used: Math.min(CUSTOM_DELIVERY_WEEKLY_LIMIT, used),
    remaining: Math.max(0, CUSTOM_DELIVERY_WEEKLY_LIMIT - used),
  }
}
