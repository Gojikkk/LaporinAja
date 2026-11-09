import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { SessionProvider } from './shared/session'
import './styles/global.css'
import './styles/admin.css'
import './styles/theme.css'
import './styles/home.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><SessionProvider><App /></SessionProvider></BrowserRouter></React.StrictMode>)
