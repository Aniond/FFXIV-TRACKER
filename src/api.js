import { eorzeaMinuteOfDay } from './etWindow.js'

const API = import.meta.env?.VITE_API_URL || 'https://api.ffxivlog.com'

function getToken() {
  return localStorage.getItem('ffxiv-jwt')
}

function setToken(t) {
  localStorage.setItem('ffxiv-jwt', t)
}

function clearToken() {
  localStorage.removeItem('ffxiv-jwt')
}

// Capture the OAuth redirect token and scrub it from the URL. The backend now
// delivers it in the fragment (#token=) so it never reaches server logs or
// Referer headers; the query-string form is still read for backward compat.
function consumeUrlToken(cleanPath = window.location.pathname) {
  let token = null
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    token = hash.get('token') || new URLSearchParams(window.location.search).get('token')
  } catch { /* malformed URL — ignore */ }
  if (token) {
    setToken(token)
    window.history.replaceState({}, '', cleanPath)
  }
  return token
}

async function apiFetch(path, opts = {}) {
  const token = getToken()
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  })
}

async function fetchMe() {
  const r = await apiFetch('/auth/me')
  if (!r.ok) { clearToken(); return null }
  return r.json()
}

async function loadProgress() {
  const r = await apiFetch('/api/progress')
  if (!r.ok) return null
  const rows = await r.json()
  const map = {}
  rows.forEach(({ hunt_id, status }) => { map[hunt_id] = status === 'done' })
  return map
}

async function saveProgress(hunt_id, status) {
  return apiFetch('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ hunt_id, status }),
  })
}

async function resetProgress() {
  return apiFetch('/api/progress', { method: 'DELETE' })
}

async function saveStash(nuts) {
  const r = await apiFetch('/api/user/stash', {
    method: 'PATCH',
    body: JSON.stringify({ nuts }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(`saveStash ${r.status}: ${body.error || 'unknown'}`)
  }
  return r
}

async function savePreferences({ view, accent, density }) {
  return apiFetch('/api/user/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ view, accent, density }),
  })
}

async function refreshJobsFromLodestone() {
  const r = await apiFetch('/api/user/refresh-jobs', { method: 'POST' })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(body.error || `Refresh failed (${r.status})`)
  }
  return r.json()
}

async function saveCharacterLink({ lodestone_id, world, dc, portrait_url }) {
  const r = await apiFetch('/api/user/character', {
    method: 'PATCH',
    body: JSON.stringify({ lodestone_id, world, dc, portrait_url }),
  })
  if (!r.ok) throw new Error('Failed to link character')
  return r.json()
}

async function fetchJobs() {
  const r = await apiFetch('/api/user/jobs')
  if (!r.ok) return []
  return r.json()
}

async function saveJobs(jobs) {
  const r = await apiFetch('/api/user/jobs', {
    method: 'PATCH',
    body: JSON.stringify({ jobs }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(`saveJobs ${r.status}: ${body.error || 'unknown'}`)
  }
  return r.json()
}

// ── Account-synced UI state (user_state table) ───────────────────────────────

// All synced keys for the logged-in user: { key: value, ... }
async function fetchUserState() {
  const r = await apiFetch('/api/user/state')
  if (!r.ok) throw new Error(`fetchUserState ${r.status}`)
  return r.json()
}

// Upsert a batch: { 'ffxiv-fav-nodes': [...], ... }
async function saveUserState(states) {
  const r = await apiFetch('/api/user/state', {
    method: 'PATCH',
    body: JSON.stringify({ states }),
  })
  if (!r.ok) throw new Error(`saveUserState ${r.status}`)
  return r.json()
}

// ── AI search ────────────────────────────────────────────────────────────────

// Public feature flags (so the UI can decide whether to show the AI entry point).
async function fetchFlags() {
  const r = await apiFetch('/api/flags')
  if (!r.ok) return {}
  return r.json().catch(() => ({}))
}

// POST a natural-language query to the Centurio assistant. Throws with a
// .status on non-2xx so callers can distinguish 401/403/429/422.
async function aiSearch(query, history = [], shoppingList = []) {
  const et = eorzeaMinuteOfDay()
  const etTime = `${Math.floor(et / 60)}:${String(et % 60).padStart(2, '0')}`

  const r = await apiFetch('/api/ai/search', {
    method: 'POST',
    body: JSON.stringify({ query, history, etTime, shoppingList }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(body.error || `Search failed (${r.status})`), { status: r.status })
  return body
}

// POST to the AI crafting guide generator.
async function aiCraftGuide(recipe, level, craft, control, cp) {
  const r = await apiFetch('/api/ai/search/craft_guide', {
    method: 'POST',
    body: JSON.stringify({ recipe, job: recipe.job || 'CUL', level, craft, control, cp }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(body.error || `Failed to generate guide (${r.status})`), { status: r.status })
  return body
}


// ── Recipes ──────────────────────────────────────────────────────────────────

// Public crafting recipes (currently Dawntrail Culinarian). No auth required.
async function fetchRecipes({ job = 'CUL', expansion = 'Dawntrail', includeSubcraft = false } = {}) {
  const qs = new URLSearchParams()
  if (job) qs.set('job', job)
  if (expansion) qs.set('expansion', expansion)
  if (includeSubcraft) qs.set('include_subcraft', '1')
  const r = await apiFetch(`/api/recipes?${qs.toString()}`)
  if (!r.ok) return []
  return r.json().catch(() => [])
}

// ── Market prices (Universalis via our cached proxy) ─────────────────────────

// { dc, prices: { [itemId]: { nq, hq } } }; {} on failure.
async function fetchPrices(ids) {
  if (!ids.length) return { prices: {} }
  const r = await apiFetch(`/api/prices?ids=${ids.slice(0, 100).join(',')}`)
  if (!r.ok) return { prices: {} }
  return r.json().catch(() => ({ prices: {} }))
}

// ── Admin API helpers ────────────────────────────────────────────────────────

async function adminFetch(path, opts = {}) {
  return apiFetch(`/api/admin${path}`, opts)
}

async function adminStats() {
  const r = await adminFetch('/stats')
  if (!r.ok) throw Object.assign(new Error('admin fetch failed'), { status: r.status })
  return r.json()
}

async function adminUsers() {
  const r = await adminFetch('/users')
  if (!r.ok) throw Object.assign(new Error('admin fetch failed'), { status: r.status })
  return r.json()
}

async function adminBanUser(id, banned) {
  const r = await adminFetch(`/users/${id}/ban`, {
    method: 'POST',
    body: JSON.stringify({ banned }),
  })
  if (!r.ok) throw new Error('ban failed')
  return r.json()
}

async function adminQueries() {
  const r = await adminFetch('/queries')
  if (!r.ok) throw Object.assign(new Error('admin fetch failed'), { status: r.status })
  return r.json()
}

async function adminSubmissions() {
  const r = await adminFetch('/submissions')
  if (!r.ok) throw Object.assign(new Error('admin fetch failed'), { status: r.status })
  return r.json()
}

async function adminUpdateSubmission(id, status) {
  const r = await adminFetch(`/submissions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!r.ok) throw new Error('submission update failed')
  return r.json()
}

async function adminFlags() {
  const r = await adminFetch('/flags')
  if (!r.ok) throw Object.assign(new Error('admin fetch failed'), { status: r.status })
  return r.json()
}

async function adminToggleFlag(key, enabled) {
  const r = await adminFetch(`/flags/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
  if (!r.ok) throw new Error('flag update failed')
  return r.json()
}

async function adminApiUsage() {
  const r = await adminFetch('/api-usage')
  if (!r.ok) throw Object.assign(new Error('admin fetch failed'), { status: r.status })
  return r.json()
}

export {
  API, getToken, setToken, clearToken, consumeUrlToken, fetchMe,
  fetchUserState, saveUserState,
  loadProgress, saveProgress, resetProgress, saveStash, savePreferences,
  fetchJobs, saveJobs, saveCharacterLink, refreshJobsFromLodestone,
  fetchFlags, aiSearch, aiCraftGuide, fetchRecipes, fetchPrices,
  adminStats, adminUsers, adminBanUser, adminQueries,
  adminSubmissions, adminUpdateSubmission, adminFlags, adminToggleFlag, adminApiUsage,
}
