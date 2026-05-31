import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ProfileRoute from './ProfileRoute'

const profileMatch = window.location.pathname.match(/^\/profile\/([^/]+)/)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {profileMatch ? <ProfileRoute slug={profileMatch[1]} /> : <App />}
  </React.StrictMode>
)
