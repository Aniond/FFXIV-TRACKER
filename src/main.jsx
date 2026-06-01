import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ProfileRoute from './ProfileRoute'
import Fishing from './Fishing'
import Mining from './Mining'

const path = window.location.pathname
const profileMatch = path.match(/^\/profile\/([^/]+)/)
const isFishing = path === '/fishing'
const isMining  = path === '/mining'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isMining   ? <Mining /> :
     isFishing  ? <Fishing /> :
     profileMatch ? <ProfileRoute slug={profileMatch[1]} /> :
     <App />}
  </React.StrictMode>
)
