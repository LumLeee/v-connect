import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import { installUnsavedNavigationGuard } from './hooks/useUnsavedChanges.js'
import './styles/global.css'
import './styles/auth.css'
import './styles/workspace-navigation.css'

installUnsavedNavigationGuard()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></React.StrictMode>,
)
