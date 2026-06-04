const API = 'https://api.ffxivlog.com'

function getToken() {
  return localStorage.getItem('ffxiv-jwt')
}

function setToken(t) {
  localStorage.setItem('ffxiv-jwt', t)
}

function clearToken() {
  localStorage.removeItem('ffxiv-jwt')
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
  API, getToken, setToken, clearToken, fetchMe,
  loadProgress, saveProgress, resetProgress, saveStash, savePreferences,
  fetchJobs, saveJobs, saveCharacterLink, refreshJobsFromLodestone,
  adminStats, adminUsers, adminBanUser, adminQueries,
  adminSubmissions, adminUpdateSubmission, adminFlags, adminToggleFlag, adminApiUsage,
}
