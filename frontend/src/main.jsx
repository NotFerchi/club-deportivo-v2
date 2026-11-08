import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'      // ← design tokens (antes que todo)
import '../css/index.css'         // ← PRIMERO los globales
import '../css/Dashboard.css' // ← DESPUÉS los de dashboard
// App va al final: así el CSS del kit (components/ui) se carga después del CSS viejo y gana los empates
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)