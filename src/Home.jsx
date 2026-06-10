import { useState, useEffect } from 'react'
import App from './App'
import HomePage from './HomePage'
import { getToken, consumeUrlToken, fetchMe } from './api'

/* ============================================================
   Home — the "/" route. Signed-in users get the personal
   dashboard (HomePage); guests (or an invalid/expired token)
   fall through to the public hunt board (App). The board also
   has its own permanent route at /hunts.
   ============================================================ */
export default function Home() {
  const [view, setView] = useState('loading') // loading | home | board
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Catch the Discord OAuth redirect token (non-admins land back on "/").
    consumeUrlToken()
    if (!getToken()) { setView('board'); return }
    fetchMe()
      .then((me) => { if (me) { setUser(me); setView('home') } else { setView('board') } })
      .catch(() => setView('board'))
  }, [])

  if (view === 'loading') return null
  if (view === 'board') return <App />
  return <HomePage user={user} />
}
