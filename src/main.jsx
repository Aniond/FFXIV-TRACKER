import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ProfileRoute from './ProfileRoute'
import AdminDashboard from './AdminDashboard'
import Fishing from './Fishing'
import Mining from './Mining'
import Botany from './Botany'

const path = window.location.pathname
const profileMatch = path.match(/^\/profile\/([^/]+)/)
const isFishing  = path === '/gathering/fishing'
const isMining   = path === '/gathering/mining'
const isBotany   = path === '/gathering/botany'
const isForaging = path === '/gathering/foraging'
const isAdmin    = path === '/admin'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin      ? <AdminDashboard /> :
     isMining     ? <Mining /> :
     isFishing    ? <Fishing /> :
     isBotany     ? <Botany /> :
     isForaging   ? <Botany /> :
     profileMatch ? <ProfileRoute slug={profileMatch[1]} /> :
     <App />}
  </React.StrictMode>
)
