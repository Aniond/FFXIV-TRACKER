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
import Timers from './Timers'

const path = window.location.pathname
const profileMatch = path.match(/^\/profile\/([^/]+)/)
const isFishing  = path === '/gathering/fishing'
const isMining   = path === '/gathering/mining'
const isBotany   = path === '/gathering/botany'
const isForaging = path === '/gathering/foraging'
const isAdmin    = path === '/admin'
const isAI       = path === '/ai'
const isHunts    = path === '/hunts'
const isCooking  = path === '/crafting/cooking'
const isTimers   = path === '/gathering/timers'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin      ? <AdminDashboard /> :
     isAI         ? <AISearch /> :
     isHunts      ? <App /> :
     isCooking    ? <Cooking /> :
     isTimers     ? <Timers /> :
     isMining     ? <Mining /> :
     isFishing    ? <Fishing /> :
     isBotany     ? <Botany /> :
     isForaging   ? <Botany /> :
     profileMatch ? <ProfileRoute slug={profileMatch[1]} /> :
     <Home />}
  </React.StrictMode>
)
