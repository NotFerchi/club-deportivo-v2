import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../css/index.css'         // ← PRIMERO los globales
import '../css/Dashboard.css' // ← DESPUÉS los de dashboard

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)