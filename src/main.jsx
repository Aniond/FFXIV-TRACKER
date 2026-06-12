import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Home from './Home'
import ProfileRoute from './ProfileRoute'
import AdminDashboard from './AdminDashboard'
import Fishing from './Fishing'
import Mining from './Mining'
import Botany from './Botany'
import AISearch from './AISearch'
import Cooking from './Cooking'
import Alchemy from './Alchemy'
import Timers from './Timers'
import { useUrl } from './router'

// Path → page. Pages are written for "fresh page load" semantics (query
// params read at mount, body-class effects), so Root keys the page by the
// FULL url — every navigation remounts cleanly, while module-level state
// (recipe caches, synced-state hydration, search index) survives.
function pageFor(path) {
  const profileMatch = path.match(/^\/profile\/([^/]+)/)
  if (path === '/admin') return <AdminDashboard />
  if (path === '/ai') return <AISearch />
  if (path === '/hunts') return <App />
  if (path === '/crafting/cooking') return <Cooking />
  if (path === '/crafting/alchemy') return <Alchemy />
  if (path === '/gathering/timers') return <Timers />
  if (path === '/gathering/mining') return <Mining />
  if (path === '/gathering/fishing') return <Fishing />
  if (path === '/gathering/botany' || path === '/gathering/foraging') return <Botany />
  if (profileMatch) return <ProfileRoute slug={profileMatch[1]} />
  return <Home />
}

function Root() {
  const url = useUrl() // re-renders on pushState/popstate; installs link interception
  return <React.Fragment key={url}>{pageFor(window.location.pathname)}</React.Fragment>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
