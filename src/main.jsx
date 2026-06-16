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
import CraftingJob from './CraftingJob'
import SavedRecipes from './SavedRecipes'
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
  if (path === '/crafting/cooking') return <CraftingJob jobKey="CUL" title="Culinarian" icon="knife" color="#d4923a" isFood={true} />
  if (path === '/crafting/alchemy') return <CraftingJob jobKey="ALC" title="Alchemist" icon="flask" color="#c79be0" isFood={false} />
  if (path === '/crafting/armorer') return <CraftingJob jobKey="ARM" title="Armorer" icon="shield" color="#8fb6d6" isFood={false} />
  if (path === '/crafting/blacksmith') return <CraftingJob jobKey="BSM" title="Blacksmith" icon="pick" color="#a3a3a3" isFood={false} />
  if (path === '/crafting/carpenter') return <CraftingJob jobKey="CRP" title="Carpenter" icon="leaf" color="#a38258" isFood={false} />
  if (path === '/crafting/goldsmith') return <CraftingJob jobKey="GSM" title="Goldsmith" icon="gem" color="#fcdb03" isFood={false} />
  if (path === '/crafting/leatherworker') return <CraftingJob jobKey="LTW" title="Leatherworker" icon="leather" color="#a36729" isFood={false} />
  if (path === '/crafting/weaver') return <CraftingJob jobKey="WVR" title="Weaver" icon="thread" color="#c146e6" isFood={false} />
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
