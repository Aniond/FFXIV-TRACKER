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

export { API, getToken, setToken, clearToken, fetchMe, loadProgress, saveProgress, resetProgress, saveStash, savePreferences, fetchJobs, saveJobs, saveCharacterLink, refreshJobsFromLodestone }
