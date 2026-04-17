import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/homepage-gerente" element={<Dashboard />} />
        {/* Aquí agregarás más rutas después: /alta-socio, etc. */}
      </Routes>
    </BrowserRouter>
  )
}

export default App