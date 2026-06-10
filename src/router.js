/* ============================================================
   router.js — minimal client-side routing (no dependency).

   The app used full page reloads for every internal link. This
   module gives SPA navigation while keeping ALL existing pages
   untouched: main.jsx keys the routed page by the full URL, so a
   navigation simply unmounts the old page and mounts the new one
   — every mount-time pattern (reading ?highlight/?recipe/?hunt,
   body-class effects, etc.) behaves exactly as it did on a fresh
   page load, except module state (recipe caches, synced-state
   hydration, the universal search index) now survives.

   Two entry points:
   - navigate(to): programmatic internal navigation
   - useUrl(): hook for the root component; also installs a global
     click handler that upgrades plain same-origin <a href="/..">
     links to pushState navigation (modifier/middle clicks, new
     tabs, downloads and external links are left alone).
   ============================================================ */
import { useState, useEffect } from 'react'

const NAV_EVENT = 'ffxiv:navigate'

export function navigate(to) {
  window.history.pushState({}, '', to)
  window.dispatchEvent(new Event(NAV_EVENT))
}

const currentUrl = () => window.location.pathname + window.location.search

export function useUrl() {
  const [url, setUrl] = useState(currentUrl)

  useEffect(() => {
    const onNav = () => {
      setUrl(currentUrl())
      window.scrollTo(0, 0)
    }
    const onPop = () => setUrl(currentUrl()) // back/forward keeps scroll
    window.addEventListener(NAV_EVENT, onNav)
    window.addEventListener('popstate', onPop)

    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target.closest?.('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return
      const href = a.getAttribute('href')
      if (!href || !href.startsWith('/')) return // external + hash links keep default behaviour
      e.preventDefault()
      navigate(href)
    }
    document.addEventListener('click', onClick)

    return () => {
      window.removeEventListener(NAV_EVENT, onNav)
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('click', onClick)
    }
  }, [])

  return url
}
