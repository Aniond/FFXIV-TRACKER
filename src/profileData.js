/* ============================================================
   profileData.js - assemble the Profile `profile` object from
   account, character, and job data.
   ============================================================ */

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

/**
 * Build the `profile` object Profile.jsx expects.
 *
 * @param {object}   args
 * @param {object}   args.user      DB user row ({ username, slug, ... })
 * @param {object}   [args.xivapi]  character payload from Lodestone/XIVAPI shape
 * @param {object[]} args.jobs      manual job rows { job_abbr, level }
 */
export function buildProfile({ user, xivapi, jobs = [] }) {
  const manualLevels = Object.fromEntries((jobs || []).map((j) => [j.job_abbr, j.level]))
  const xivapiLevels = xivapiJobLevels(xivapi)
  const roles = ROLE_DEFS.map((rd) => ({
    key: rd.key,
    name: rd.name,
    color: rd.color,
    jobs: rd.jobs.map((abbr) => [abbr, manualLevels[abbr] ?? xivapiLevels[abbr] ?? 0]),
  }))

  return {
    slug: user.slug || user.username?.toLowerCase(),
    name: xivapi?.Character?.Name || user.username,
    title: xivapi?.Character?.Title?.Name || null,
    world: xivapi?.Character?.Server || user.world || '-',
    dc: xivapi?.Character?.DC || user.dc || null,
    portrait: user.portrait_url || xivapi?.Character?.Portrait || null,
    gc: xivapi?.Character?.GrandCompany
      ? { name: xivapi.Character.GrandCompany.Company?.Name, rank: xivapi.Character.GrandCompany.Rank?.Name }
      : null,
    roles,
  }
}

/* Map XIVAPI ClassJobs array -> { ABBR: level }. Abbreviations come from
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
   Docs: https://xivapi.com/docs - data=CJ includes ClassJobs.
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
