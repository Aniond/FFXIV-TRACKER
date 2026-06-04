import { useState, useEffect, useRef } from 'react'
import { getToken, fetchMe, fetchFlags } from './api'
import './ActivityNav.css'

/* ============================================================
   ActivityNav — site-level activity switcher.
   Mobile (<768px): dropdown pill triggered by button.
   Desktop (≥768px): horizontal tab bar; Gathering sub-items
   appear in a hover dropdown. CSS controls visibility.
   ============================================================ */

const ACTIVITIES = [
  {
    id: 'hunts',
    label: 'Hunts',
    href: '/hunts',
    soon: false,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M12 2 4 5v6c0 5 3.4 8.3 8 11 4.6-2.7 8-6 8-11V5l-8-3Z"/>
        <path d="M12 7v8M8.5 10.5 12 7l3.5 3.5"/>
      </svg>
    ),
  },
  {
    id: 'gathering',
    label: 'Gathering',
    href: null,
    soon: false,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M3 21 13 11M4 9c4-4 12-5 16-2-3-1-7 0-9 2 3-1 6 0 7 2-4-3-11-2-14-2Z"/>
        <path d="m12.5 11.5 2 2"/>
      </svg>
    ),
    children: [
      {
        id: 'fishing',
        label: 'Fishing',
        href: '/gathering/fishing',
        soon: false,
        icon: (p) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M3 12c3-5 8-6 12-6 3 0 5 2 6 6-1 4-3 6-6 6-4 0-9-1-12-6Z"/>
            <path d="M3 12c-1 1.5-1 3 0 4.5M3 12c-1-1.5-1-3 0-4.5"/>
            <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/>
          </svg>
        ),
      },
      {
        id: 'mining',
        label: 'Mining',
        href: '/gathering/mining',
        soon: false,
        icon: (p) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M3 21 13 11M4 9c4-4 12-5 16-2-3-1-7 0-9 2 3-1 6 0 7 2-4-3-11-2-14-2Z"/>
            <path d="m12.5 11.5 2 2"/>
          </svg>
        ),
      },
      {
        id: 'foraging',
        label: 'Foraging',
        href: '/gathering/foraging',
        soon: false,
        icon: (p) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
        ),
      },
      {
        id: 'botany',
        label: 'Botany',
        href: '/gathering/botany',
        soon: false,
        icon: (p) => (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M12 22V11"/>
            <path d="M5 9c0-4 3-7 7-7 4 0 7 3 7 7-2-1-4-1-7-1s-5 0-7 1Z"/>
            <path d="M5 13c0-2 3-3 7-3s7 1 7 3c-2 1-4 2-7 2s-5-1-7-2Z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'crafting',
    label: 'Crafting',
    href: '/crafting',
    soon: true,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="m14.7 6.3-8 8a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l8-8-3-3Z"/>
        <path d="m16 2 6 6-2 2-6-6 2-2ZM4 20l1-4 3 3-4 1Z"/>
      </svg>
    ),
  },
]

// Home → personal dashboard. Shown only to logged-in users (prepended at runtime).
const HOME_ITEM = {
  id: 'home',
  label: 'Home',
  href: '/',
  soon: false,
  icon: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 11.5 12 4l9 7.5"/>
      <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/>
      <path d="M9.5 20v-5h5v5"/>
    </svg>
  ),
}

// Admin-only entry (until ENABLE_AI_PUBLIC flips on) — appended at runtime.
const AI_ITEM = {
  id: 'ai',
  label: 'AI Search',
  href: '/ai',
  soon: false,
  icon: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>
      <circle cx="12" cy="12" r="2.6"/>
    </svg>
  ),
}

const ChevronDown = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

function findCurrent(path, activities) {
  for (const a of activities) {
    if (a.children) {
      const child = a.children.find((c) => c.href && path.startsWith(c.href))
      if (child) return { top: a, leaf: child }
    } else if (a.href) {
      if (a.href === '/' ? (path === '/' || path === '') : path.startsWith(a.href)) {
        return { top: a, leaf: a }
      }
    }
  }
  return { top: activities[0], leaf: activities[0] }
}

export default function ActivityNav() {
  const path = window.location.pathname

  // Home link for logged-in users; AI entry for admins (or everyone once ENABLE_AI_PUBLIC is on).
  const [showAi, setShowAi] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  useEffect(() => {
    Promise.all([getToken() ? fetchMe().catch(() => null) : Promise.resolve(null), fetchFlags()])
      .then(([me, flags]) => {
        setLoggedIn(!!me)
        if (me?.is_admin || flags?.ENABLE_AI_PUBLIC) setShowAi(true)
      })
      .catch(() => {})
  }, [])

  const activities = [
    ...(loggedIn ? [HOME_ITEM] : []),
    ...ACTIVITIES,
    ...(showAi ? [AI_ITEM] : []),
  ]
  const { top: currentTop, leaf: currentLeaf } = findCurrent(path, activities)

  const [open, setOpen] = useState(false)
  const [gatheringOpen, setGatheringOpen] = useState(currentTop.id === 'gathering')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const CurrentIcon = currentLeaf.icon

  return (
    <div className="act-nav" ref={ref}>
      {/* Mobile-only trigger button — hidden on desktop via CSS */}
      <button
        className={`act-nav__trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <CurrentIcon className="act-nav__ico" />
        <span className="act-nav__label">{currentLeaf.label}</span>
        <ChevronDown className="act-nav__chevron" />
      </button>

      {/* Menu: hidden on mobile until open; always visible on desktop as tab bar */}
      <div className={`act-nav__menu${open ? ' is-open' : ''}`} role="menu">
        {activities.map((a) => {
          const Icon = a.icon
          const isActiveTop = a.id === currentTop.id

          if (a.children) {
            return (
              <div key={a.id} className={`act-nav__group${isActiveTop ? ' is-active-top' : ''}`}>
                <button
                  className={`act-nav__group-hd${isActiveTop ? ' is-active' : ''}`}
                  onClick={() => setGatheringOpen((o) => !o)}
                >
                  <Icon className="act-nav__item-ico" />
                  <span className="act-nav__item-label">{a.label}</span>
                  <ChevronDown className={`act-nav__group-chevron${gatheringOpen ? ' is-open' : ''}`} />
                </button>

                {/* Always in DOM; mobile shows via is-open class, desktop shows on hover */}
                <div className={`act-nav__children${gatheringOpen ? ' is-open' : ''}`}>
                  {a.children.map((c) => {
                    const CIcon = c.icon
                    const isActiveChild = c.id === currentLeaf.id
                    return (
                      <a
                        key={c.id}
                        className={`act-nav__child${isActiveChild ? ' is-active' : ''}${c.soon ? ' is-soon' : ''}`}
                        href={c.soon ? undefined : c.href}
                        role="menuitem"
                        onClick={c.soon ? (e) => e.preventDefault() : () => setOpen(false)}
                        aria-disabled={c.soon}
                      >
                        <CIcon className="act-nav__item-ico" />
                        <span className="act-nav__item-label">{c.label}</span>
                        {c.soon && <span className="act-nav__soon">Soon</span>}
                        {isActiveChild && <span className="act-nav__active-dot" />}
                      </a>
                    )
                  })}
                </div>
              </div>
            )
          }

          const isActive = a.id === currentLeaf.id
          return (
            <a
              key={a.id}
              className={`act-nav__item${isActive ? ' is-active' : ''}${a.soon ? ' is-soon' : ''}`}
              href={a.soon ? undefined : a.href}
              role="menuitem"
              onClick={a.soon ? (e) => e.preventDefault() : () => setOpen(false)}
              aria-disabled={a.soon}
            >
              <Icon className="act-nav__item-ico" />
              <span className="act-nav__item-label">{a.label}</span>
              {a.soon && <span className="act-nav__soon">Soon</span>}
              {isActive && <span className="act-nav__active-dot" />}
            </a>
          )
        })}
      </div>
    </div>
  )
}
