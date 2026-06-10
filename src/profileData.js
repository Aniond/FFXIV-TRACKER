/* ============================================================
   profileData.js — assemble the Profile `profile` object from
   the user's hunt progress + XIVAPI character data.
   Framework-agnostic helpers; import into your route loader.
   ============================================================ */

import { parseReward } from './Dashboard' // reuse the shipped reward parser

/* Hunt zones in display order — Dawntrail first, then Endwalker. Zones not
   listed here still work everywhere; they just sort after these. */
export const ZONE_ORDER = [
  'Urqopacha', "Kozama'uka", "Yak T'el", 'Shaaloani', 'Heritage Found', 'Living Memory',
  'Labyrinthos', 'Thavnair', 'Garlemald', 'Mare Lamentorum', 'Elpis', 'Ultima Thule',
]
export const ZONE_EXPANSION = {
  Urqopacha: 'Dawntrail', "Kozama'uka": 'Dawntrail', "Yak T'el": 'Dawntrail',
  Shaaloani: 'Dawntrail', 'Heritage Found': 'Dawntrail', 'Living Memory': 'Dawntrail',
  Labyrinthos: 'Endwalker', Thavnair: 'Endwalker', Garlemald: 'Endwalker',
  'Mare Lamentorum': 'Endwalker', Elpis: 'Endwalker', 'Ultima Thule': 'Endwalker',
}

const RANK_META = {
  S: { word: 'Elite', sub: 'Notorious Monster' },
  A: { word: 'Notorious', sub: 'Clan Mark' },
  B: { word: 'Wanted', sub: 'Bounty Bill' },
}

/* role grouping + colors (match Profile.css role vars) */
const ROLE_DEFS = [
  { key: 'tank',    name: 'Tank',            color: 'var(--role-tank)',    jobs: ['PLD', 'WAR', 'DRK', 'GNB'] },
  { key: 'heal',    name: 'Healer',          color: 'var(--role-heal)',    jobs: ['WHM', 'SCH', 'AST', 'SGE'] },
  { key: 'melee',   name: 'Melee DPS',       color: 'var(--role-melee)',   jobs: ['MNK', 'DRG', 'NIN', 'SAM', 'RPR', 'VPR'] },
  { key: 'pranged', name: 'Physical Ranged', color: 'var(--role-pranged)', jobs: ['BRD', 'MCH', 'DNC'] },
  { key: 'mranged', name: 'Magical Ranged',  color: 'var(--role-mranged)', jobs: ['BLM', 'SMN', 'RDM', 'PCT'] },
  { key: 'craft',   name: 'Crafters',        color: 'var(--role-craft)',   jobs: ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'] },
  { key: 'gather',  name: 'Gatherers',       color: 'var(--role-gather)',  jobs: ['MIN', 'BTN', 'FSH'] },
]

/* relative time for the "Recent Clears" list */
function relTime(iso) {
  const then = new Date(iso).getTime(), now = Date.now()
  const m = Math.round((now - then) / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * Build the `profile` object Profile.jsx expects.
 *
 * @param {object}   args
 * @param {object}   args.user      DB user row ({ username, slug, ... })
 * @param {object[]} args.hunts     hunt catalog (public/data.json shape: {id,name,rank,zone,reward})
 * @param {object[]} args.progress  rows { hunt_id, status, updated_at } for this user
 * @param {object}   [args.xivapi]  XIVAPI character payload (see fetchXivapiCharacter)
 */
export function buildProfile({ user, hunts, progress, xivapi, jobs = [] }) {
  // Explicit per-user progress entries
  const progressById = Object.fromEntries(progress.map((r) => [r.hunt_id, r.status]))
  // Only explicitly-toggled done rows carry a timestamp (used for Recent Clears)
  const doneRows = progress.filter((r) => r.status === 'done')

  // A hunt counts as cleared if:
  //   – user explicitly marked it done in their progress table, OR
  //   – hunt's default status is 'done' and user hasn't overridden it
  const doneIds = new Set(
    hunts
      .filter((h) => Object.prototype.hasOwnProperty.call(progressById, h.id)
        ? progressById[h.id] === 'done'
        : h.status === 'done')
      .map((h) => h.id)
  )
  const huntById = Object.fromEntries(hunts.map((h) => [h.id, h]))

  // tallies
  const byRank = {
    S: { done: 0, total: 0, ...RANK_META.S },
    A: { done: 0, total: 0, ...RANK_META.A },
    B: { done: 0, total: 0, ...RANK_META.B },
  }
  const zoneMap = Object.fromEntries(ZONE_ORDER.map((z) => [z, { name: z, done: 0, total: 0 }]))
  let gil = 0, nuts = 0, exp = 0

  for (const h of hunts) {
    if (byRank[h.rank]) byRank[h.rank].total++
    if (zoneMap[h.zone]) zoneMap[h.zone].total++
    if (doneIds.has(h.id)) {
      const r = parseReward(h.reward)
      gil += r.gil; nuts += r.nuts; exp += r.exp
      if (byRank[h.rank]) byRank[h.rank].done++
      if (zoneMap[h.zone]) zoneMap[h.zone].done++
    }
  }

  // recent clears (latest 5 by updated_at) — skip rows whose hunt no longer
  // exists (orphans from old reseeds used to render as 'Unknown').
  const recent = [...doneRows]
    .filter((r) => huntById[r.hunt_id])
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5)
    .map((r) => {
      const h = huntById[r.hunt_id]
      return { name: h.name, rank: h.rank || 'B', zone: h.zone || '—', time: relTime(r.updated_at) }
    })

  // job levels: manual entries override XIVAPI, both fall back to 0
  const manualLevels = Object.fromEntries((jobs || []).map((j) => [j.job_abbr, j.level]))
  const xivapiLevels = xivapiJobLevels(xivapi)
  const roles = ROLE_DEFS.map((rd) => ({
    key: rd.key, name: rd.name, color: rd.color,
    jobs: rd.jobs.map((abbr) => [abbr, manualLevels[abbr] ?? xivapiLevels[abbr] ?? 0]),
  }))

  return {
    slug: user.slug || user.username?.toLowerCase(),
    name: xivapi?.Character?.Name || user.username,
    title: xivapi?.Character?.Title?.Name || null,
    world: xivapi?.Character?.Server || user.world || '—',
    dc: xivapi?.Character?.DC || user.dc || null,
    portrait: user.portrait_url || xivapi?.Character?.Portrait || null,
    gc: xivapi?.Character?.GrandCompany
      ? { name: xivapi.Character.GrandCompany.Company?.Name, rank: xivapi.Character.GrandCompany.Rank?.Name }
      : null,
    gil, nuts, exp, byRank,
    zones: ZONE_ORDER.map((z) => zoneMap[z]),
    roles, recent,
    lifetimeCleared: user.lifetime_cleared || 0,
  }
}

/* Map XIVAPI ClassJobs array → { ABBR: level }. Abbreviations come from
   ClassJob.Abbreviation (e.g. "PLD"). Tolerant of missing data. */
function xivapiJobLevels(xivapi) {
  const out = {}
  const list = xivapi?.Character?.ClassJobs || []
  for (const cj of list) {
    const abbr = cj.Abbreviation || cj.UnlockedState?.Name
    if (abbr) out[abbr] = cj.Level || 0
  }
  return out
}

/* ------------------------------------------------------------
   XIVAPI fetch (server-side). Resolve a character id once and
   cache it (e.g. on the users row) so you don't search every load.
   Docs: https://xivapi.com/docs  — data=CJ includes ClassJobs.
   NOTE: XIVAPI hosting/keys change over time; confirm the current
   base URL + params. Lodestone scrapers (e.g. self-hosted XIVAPI)
   follow the same response shape used above.
   ------------------------------------------------------------ */
export async function fetchXivapiCharacter(characterId, { key } = {}) {
  const base = 'https://xivapi.com'
  const q = new URLSearchParams({ data: 'CJ' })
  if (key) q.set('private_key', key)
  const res = await fetch(`${base}/character/${characterId}?${q}`)
  if (!res.ok) return null
  return res.json()
}

export async function searchXivapiCharacter(name, server, { key } = {}) {
  const base = 'https://xivapi.com'
  const q = new URLSearchParams({ name, server })
  if (key) q.set('private_key', key)
  const res = await fetch(`${base}/character/search?${q}`)
  if (!res.ok) return null
  const json = await res.json()
  return json?.Results?.[0]?.ID || null
}
