// Protected endpoint to update public/data.json directly via the GitHub API.
//
// POST https://ffxivlog.com/api/update-hunts
//   Headers: Authorization: Bearer <API_SECRET>
//            Content-Type: application/json
//   Body:    { "hunts": [ ... ] }   (a bare [ ... ] array is also accepted)
//
// Env vars (set in Vercel):
//   API_SECRET    - shared secret required in the Authorization header
//   GITHUB_TOKEN  - PAT with write access to public/data.json (Contents: RW)
//   GITHUB_OWNER  - optional, defaults to 'Aniond'
//   GITHUB_REPO   - optional, defaults to 'FFXIV-TRACKER'
//   GITHUB_BRANCH - optional, defaults to 'main'

import { timingSafeEqual } from 'node:crypto'

const OWNER = process.env.GITHUB_OWNER || 'Aniond'
const REPO = process.env.GITHUB_REPO || 'FFXIV-TRACKER'
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const FILE_PATH = 'public/data.json'
const MAX_BODY_BYTES = 1_000_000 // 1 MB guard

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

async function readJsonBody(req) {
  // Vercel may pre-parse the body; otherwise read the raw stream.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {}
    return req.body
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ffxiv-tracker-update-hunts',
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' })
  }

  const apiSecret = process.env.API_SECRET
  if (!apiSecret) {
    return res.status(500).json({ success: false, error: 'Server is missing API_SECRET configuration.' })
  }

  // --- Auth: Authorization: Bearer <API_SECRET> ---
  const auth = req.headers.authorization || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match || !timingSafeEqualStr(match[1], apiSecret)) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' })
  }

  // --- Parse + validate body ---
  let body
  try {
    body = await readJsonBody(req)
  } catch (err) {
    return res.status(400).json({ success: false, error: `Invalid JSON body: ${err.message}` })
  }

  const hunts = Array.isArray(body) ? body : body && body.hunts
  if (!Array.isArray(hunts)) {
    return res
      .status(400)
      .json({ success: false, error: 'Body must be a hunts array or an object with a "hunts" array.' })
  }

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    return res.status(500).json({ success: false, error: 'Server is missing GITHUB_TOKEN configuration.' })
  }

  // --- Build canonical file content (matches the sync script's format) ---
  const content = JSON.stringify({ hunts }, null, 2) + '\n'
  const contentBase64 = Buffer.from(content, 'utf8').toString('base64')

  try {
    // 1) Get the current file SHA (required to update an existing file).
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`
    const getRes = await fetch(getUrl, { headers: ghHeaders(githubToken) })

    let sha
    if (getRes.status === 200) {
      sha = (await getRes.json()).sha
    } else if (getRes.status !== 404) {
      const detail = await getRes.text()
      return res.status(502).json({
        success: false,
        error: `Failed to read current file from GitHub (${getRes.status}).`,
        detail: detail.slice(0, 500),
      })
    }

    // 2) Create/update the file on the target branch.
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { ...ghHeaders(githubToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Update hunt data via update-hunts API (${hunts.length} hunts)`,
        content: contentBase64,
        sha,
        branch: BRANCH,
      }),
    })

    if (!putRes.ok) {
      const detail = await putRes.text()
      return res.status(502).json({
        success: false,
        error: `GitHub update failed (${putRes.status}).`,
        detail: detail.slice(0, 500),
      })
    }

    const result = await putRes.json()
    return res.status(200).json({
      success: true,
      hunts: hunts.length,
      commit: result.commit?.sha,
      url: result.content?.html_url,
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: `Unexpected error: ${err.message}` })
  }
}
