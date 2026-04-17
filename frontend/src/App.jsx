import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/home'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Aquí agregarás más rutas después: /login, /alta-socio, etc. */}
      </Routes>
    </BrowserRouter>
  )
}

export default App