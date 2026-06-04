import { useState, useEffect, useCallback } from 'react'
import './AdminDashboard.css'
import { getToken, setToken, API,
  adminStats, adminUsers, adminBanUser, adminQueries,
  adminSubmissions, adminUpdateSubmission, adminFlags, adminToggleFlag, adminApiUsage,
} from './api'

// Claude Sonnet 4.6 pricing ($/1M tokens) — update when model changes
const PRICE_IN  = 3.00
const PRICE_OUT = 15.00

function fmtCost(tokensIn, tokensOut) {
  const cost = (tokensIn * PRICE_IN + tokensOut * PRICE_OUT) / 1_000_000
  return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDateShort(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({ label, value }) {
  return (
    <div className="adm-stat-card">
      <span className="adm-stat-value">{value ?? '—'}</span>
      <span className="adm-stat-label">{label}</span>
    </div>
  )
}

// ── STATS ────────────────────────────────────────────────────────────────────
function StatsSection({ stats }) {
  if (!stats) return <div className="adm-loading">Loading stats…</div>
  return (
    <div className="adm-stat-grid">
      <StatCard label="Total Users"          value={stats.totalUsers} />
      <StatCard label="AI Queries Today"     value={stats.queriesToday} />
      <StatCard label="New Users Today"      value={stats.newUsersToday} />
      <StatCard label="Active Users (7 d)"   value={stats.activeUsersWeek} />
    </div>
  )
}

// ── USERS ────────────────────────────────────────────────────────────────────
function UsersSection({ users, onBan }) {
  if (!users) return <div className="adm-loading">Loading users…</div>
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Discord ID</th>
            <th>Joined</th>
            <th>Last Active</th>
            <th>Queries</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.banned ? 'adm-row-banned' : ''}>
              <td className="adm-user-cell">
                {u.avatar
                  ? <img className="adm-avatar" src={`https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.webp?size=32`} alt="" />
                  : <span className="adm-avatar-placeholder" />}
                <span>{u.username}</span>
              </td>
              <td className="adm-mono">{u.discord_id}</td>
              <td>{fmtDateShort(u.created_at)}</td>
              <td>{fmtDateShort(u.last_active)}</td>
              <td>{u.query_count}</td>
              <td>
                {u.banned
                  ? <span className="adm-badge adm-badge-banned">Banned</span>
                  : <span className="adm-badge adm-badge-ok">Active</span>}
              </td>
              <td>
                <button
                  className={`adm-btn ${u.banned ? 'adm-btn-unban' : 'adm-btn-ban'}`}
                  onClick={() => onBan(u.id, !u.banned)}
                >
                  {u.banned ? 'Unban' : 'Ban'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <div className="adm-empty">No users yet.</div>}
    </div>
  )
}

// ── QUERY LOG ────────────────────────────────────────────────────────────────
function QueryLogSection({ queries }) {
  if (!queries) return <div className="adm-loading">Loading query log…</div>
  return (
    <div className="adm-table-wrap">
      <table className="adm-table adm-table-queries">
        <thead>
          <tr>
            <th>Time</th>
            <th>User</th>
            <th>Query</th>
            <th>In</th>
            <th>Out</th>
            <th>Cached</th>
          </tr>
        </thead>
        <tbody>
          {queries.map((q) => (
            <tr key={q.id}>
              <td className="adm-mono adm-nowrap">{fmtDate(q.created_at)}</td>
              <td>{q.username || <span className="adm-dim">guest</span>}</td>
              <td className="adm-query-text">{q.query_text}</td>
              <td className="adm-mono">{q.tokens_in.toLocaleString()}</td>
              <td className="adm-mono">{q.tokens_out.toLocaleString()}</td>
              <td>{q.cached ? <span className="adm-badge adm-badge-ok">Yes</span> : <span className="adm-badge adm-badge-no">No</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {queries.length === 0 && <div className="adm-empty">No AI queries logged yet.</div>}
    </div>
  )
}

// ── SUBMISSIONS ──────────────────────────────────────────────────────────────
function SubmissionsSection({ submissions, onUpdateStatus }) {
  if (!submissions) return <div className="adm-loading">Loading submissions…</div>
  return (
    <div className="adm-submissions">
      {submissions.length === 0 && <div className="adm-empty">No submissions.</div>}
      {submissions.map((s) => (
        <div key={s.id} className={`adm-submission adm-submission-${s.status}`}>
          <div className="adm-submission-header">
            <span className="adm-submission-user">{s.username || 'unknown'}</span>
            <span className="adm-dim">{fmtDate(s.created_at)}</span>
            <span className={`adm-badge adm-badge-${s.status === 'approved' ? 'ok' : s.status === 'rejected' ? 'banned' : 'pending'}`}>
              {s.status}
            </span>
          </div>
          <pre className="adm-submission-data">{JSON.stringify(s.hunt_data, null, 2)}</pre>
          {s.status === 'pending' && (
            <div className="adm-submission-actions">
              <button className="adm-btn adm-btn-approve" onClick={() => onUpdateStatus(s.id, 'approved')}>Approve</button>
              <button className="adm-btn adm-btn-ban"     onClick={() => onUpdateStatus(s.id, 'rejected')}>Reject</button>
            </div>
          )}
          {s.status !== 'pending' && (
            <div className="adm-submission-actions">
              <button className="adm-btn adm-btn-sm" onClick={() => onUpdateStatus(s.id, 'pending')}>Reset to Pending</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── FEATURE FLAGS ────────────────────────────────────────────────────────────
function FlagsSection({ flags, onToggle }) {
  if (!flags) return <div className="adm-loading">Loading flags…</div>
  return (
    <div className="adm-flags">
      {flags.length === 0 && <div className="adm-empty">No feature flags.</div>}
      {flags.map((f) => (
        <div key={f.key} className="adm-flag-row">
          <div className="adm-flag-info">
            <span className="adm-flag-key">{f.key}</span>
            {f.description && <span className="adm-flag-desc">{f.description}</span>}
          </div>
          <label className="adm-toggle">
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={(e) => onToggle(f.key, e.target.checked)}
            />
            <span className="adm-toggle-track">
              <span className="adm-toggle-thumb" />
            </span>
            <span className={`adm-toggle-label ${f.enabled ? 'adm-toggle-on' : ''}`}>
              {f.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      ))}
    </div>
  )
}

// ── API USAGE ────────────────────────────────────────────────────────────────
function ApiUsageSection({ usage }) {
  if (!usage) return <div className="adm-loading">Loading API usage…</div>
  const { today, month } = usage
  return (
    <div className="adm-usage">
      <div className="adm-usage-group">
        <h3 className="adm-usage-period">Today</h3>
        <div className="adm-stat-grid">
          <StatCard label="Queries"      value={today.queries} />
          <StatCard label="Input tokens"  value={today.tokens_in.toLocaleString()} />
          <StatCard label="Output tokens" value={today.tokens_out.toLocaleString()} />
          <StatCard label="Est. cost"     value={fmtCost(today.tokens_in, today.tokens_out)} />
        </div>
      </div>
      <div className="adm-usage-group">
        <h3 className="adm-usage-period">This month</h3>
        <div className="adm-stat-grid">
          <StatCard label="Queries"       value={month.queries} />
          <StatCard label="Input tokens"  value={month.tokens_in.toLocaleString()} />
          <StatCard label="Output tokens" value={month.tokens_out.toLocaleString()} />
          <StatCard label="Est. cost"     value={fmtCost(month.tokens_in, month.tokens_out)} />
        </div>
      </div>
      <p className="adm-usage-note">Cost estimate uses Claude Sonnet 4.6 pricing ($3/$15 per 1M tokens in/out).</p>
    </div>
  )
}

// ── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'stats',       label: 'Stats' },
  { id: 'users',       label: 'Users' },
  { id: 'queries',     label: 'Query Log' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'flags',       label: 'Feature Flags' },
  { id: 'api-usage',   label: 'API Usage' },
]

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [authState, setAuthState] = useState('checking') // 'checking' | 'ok' | 'unauth' | 'forbidden'
  const [tab, setTab]             = useState('stats')
  const [stats, setStats]         = useState(null)
  const [users, setUsers]         = useState(null)
  const [queries, setQueries]     = useState(null)
  const [submissions, setSubs]    = useState(null)
  const [flags, setFlags]         = useState(null)
  const [usage, setUsage]         = useState(null)

  // On mount: capture token from OAuth redirect URL, then verify admin access
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      setToken(urlToken)
      window.history.replaceState({}, '', '/admin')
    }

    if (!getToken()) {
      setAuthState('unauth')
      return
    }
    adminStats()
      .then((data) => {
        setStats(data)
        setAuthState('ok')
      })
      .catch((err) => {
        if (err.status === 403) setAuthState('forbidden')
        else if (err.status === 401) setAuthState('unauth')
        else { console.error(err); setAuthState('unauth') }
      })
  }, [])

  // Redirect based on auth state
  useEffect(() => {
    if (authState === 'unauth') {
      window.location.href = `${API}/auth/discord`
    } else if (authState === 'forbidden') {
      window.location.href = '/'
    }
  }, [authState])

  // Lazy-load tab data on first visit
  useEffect(() => {
    if (authState !== 'ok') return
    if (tab === 'users'       && !users)       adminUsers()      .then(setUsers)      .catch(console.error)
    if (tab === 'queries'     && !queries)     adminQueries()    .then(setQueries)    .catch(console.error)
    if (tab === 'submissions' && !submissions) adminSubmissions().then(setSubs)       .catch(console.error)
    if (tab === 'flags'       && !flags)       adminFlags()      .then(setFlags)      .catch(console.error)
    if (tab === 'api-usage'   && !usage)       adminApiUsage()   .then(setUsage)      .catch(console.error)
  }, [tab, authState])

  const handleBan = useCallback(async (id, banned) => {
    const updated = await adminBanUser(id, banned)
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, banned: updated.banned } : u))
  }, [])

  const handleSubmissionStatus = useCallback(async (id, status) => {
    const updated = await adminUpdateSubmission(id, status)
    setSubs((prev) => prev.map((s) => s.id === id ? { ...s, status: updated.status } : s))
  }, [])

  const handleFlagToggle = useCallback(async (key, enabled) => {
    const updated = await adminToggleFlag(key, enabled)
    setFlags((prev) => prev.map((f) => f.key === key ? { ...f, enabled: updated.enabled } : f))
  }, [])

  if (authState === 'checking' || authState === 'unauth' || authState === 'forbidden') {
    return <div className="adm-splash"><span className="adm-splash-dot" /></div>
  }

  return (
    <div className="adm-root">
      <header className="adm-header">
        <h1 className="adm-title">Admin</h1>
        <a href="/" className="adm-back">← Back to site</a>
      </header>

      <nav className="adm-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`adm-tab ${tab === t.id ? 'adm-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="adm-content">
        {tab === 'stats'       && <StatsSection stats={stats} />}
        {tab === 'users'       && <UsersSection users={users} onBan={handleBan} />}
        {tab === 'queries'     && <QueryLogSection queries={queries} />}
        {tab === 'submissions' && <SubmissionsSection submissions={submissions} onUpdateStatus={handleSubmissionStatus} />}
        {tab === 'flags'       && <FlagsSection flags={flags} onToggle={handleFlagToggle} />}
        {tab === 'api-usage'   && <ApiUsageSection usage={usage} />}
      </main>
    </div>
  )
}
