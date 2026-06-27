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
import ItemPage from './ItemPage'
import CraftingGear from './CraftingGear'
import SpecialDeliveries from './SpecialDeliveries'
import CosmicExploration from './CosmicExploration'

import SavedRecipes from './SavedRecipes'
import Timers from './Timers'
import { useUrl } from './router'

// Path → page. Pages are written for "fresh page load" semantics (query
// params read at mount, body-class effects), so Root keys the page by the
// FULL url — every navigation remounts cleanly, while module-level state
// (recipe caches, synced-state hydration, search index) survives.
function pageFor(path) {
  const profileMatch = path.match(/^\/profile\/([^/]+)/)
  const itemMatch = path.match(/^\/item\/([^/]+)/)
  if (path === '/admin') return <AdminDashboard />
  if (itemMatch) return <ItemPage slug={itemMatch[1]} />
  if (path === '/crafting/cosmic-exploration' || path === '/cosmic-exploration') return <CosmicExploration />
  if (path === '/crafting/gear') return <CraftingGear />
  if (path === '/crafting/special-deliveries') return <SpecialDeliveries />
  if (path === '/ai' || path.startsWith('/crafting')) return <AISearch />
  if (path === '/hunts') return <App />
  if (path === '/saved-recipes') return <SavedRecipes />
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
