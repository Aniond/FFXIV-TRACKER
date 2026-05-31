import { useEffect, useState } from 'react'
import Profile from './Profile'
import { buildProfile } from './profileData'
import { API, fetchMe, getToken } from './api'
import './Profile.css'

export default function ProfileRoute({ slug }) {
  const [profile, setProfile] = useState(null)
  const [state, setState] = useState('loading')
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch(`${API}/api/profile/${encodeURIComponent(slug)}`)
        if (!r.ok) { if (alive) setState('notfound'); return }
        const data = await r.json()
        if (!alive) return
        setProfile(buildProfile(data))
        setState('ok')

        if (getToken()) {
          const me = await fetchMe()
          if (me && alive) {
            const meSlug = me.slug || me.username?.toLowerCase()
            setIsOwner(meSlug === slug.toLowerCase())
          }
        }
      } catch {
        if (alive) setState('notfound')
      }
    })()
    return () => { alive = false }
  }, [slug])

  if (state === 'loading') return <div className="wrap" style={{ padding: '40px 16px', color: '#8f846a' }}>Loading…</div>
  if (state === 'notfound') return <div className="wrap" style={{ padding: '40px 16px', color: '#8f846a' }}>No such hunter.</div>
  return <Profile profile={profile} isOwner={isOwner} />
}
