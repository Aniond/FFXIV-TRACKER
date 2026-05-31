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

export { API, getToken, setToken, clearToken, fetchMe, loadProgress, saveProgress }
