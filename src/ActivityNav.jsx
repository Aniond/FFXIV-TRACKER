import { useState, useEffect, useRef } from 'react'
import './ActivityNav.css'

/* ============================================================
   ActivityNav — site-level activity switcher.
   Top-level items link directly. Items with `children` expand
   inline as an accordion when clicked (mobile-friendly).
   ============================================================ */

const ACTIVITIES = [
  {
    id: 'hunts',
    label: 'Hunts',
    href: '/',
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
  {
    id: 'treasure',
    label: 'Treasure',
    href: '/treasure',
    soon: true,
    icon: (p) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
        <path d="M4 9v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/>
        <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6Z"/>
        <path d="M12 12v4"/>
      </svg>
    ),
  },
]

const ChevronDown = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

function findCurrent(path) {
  for (const a of ACTIVITIES) {
    if (a.children) {
      const child = a.children.find((c) => c.href && path.startsWith(c.href))
      if (child) return { top: a, leaf: child }
    } else if (a.href) {
      if (a.href === '/' ? (path === '/' || path === '') : path.startsWith(a.href)) {
        return { top: a, leaf: a }
      }
    }
  }
  return { top: ACTIVITIES[0], leaf: ACTIVITIES[0] }
}

export default function ActivityNav() {
  const path = window.location.pathname
  const { top: currentTop, leaf: currentLeaf } = findCurrent(path)

  const [open, setOpen] = useState(false)
  // Gathering group auto-expands when on a gathering sub-page
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

      {open && (
        <div className="act-nav__menu" role="menu">
          {ACTIVITIES.map((a) => {
            const Icon = a.icon
            const isActiveTop = a.id === currentTop.id

            if (a.children) {
              return (
                <div key={a.id} className="act-nav__group">
                  <button
                    className={`act-nav__group-hd${isActiveTop ? ' is-active' : ''}`}
                    onClick={() => setGatheringOpen((o) => !o)}
                  >
                    <Icon className="act-nav__item-ico" />
                    <span className="act-nav__item-label">{a.label}</span>
                    <ChevronDown className={`act-nav__group-chevron${gatheringOpen ? ' is-open' : ''}`} />
                  </button>

                  {gatheringOpen && (
                    <div className="act-nav__children">
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
                  )}
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
      )}
    </div>
  )
}
