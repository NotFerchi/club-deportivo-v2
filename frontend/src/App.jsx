import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import DashboardGerente from './pages/dashboards/Dashboard'
import DashboardAdmin from './pages/dashboards/Dashboard'  // Mismo componente por ahora
import DashboardCoordinador from './pages/dashboards/DashboardCoordinador'
import DashboardInstructor from './pages/dashboards/DashboardInstructor'
import DashboardRecepcion from './pages/dashboards/DashboardRecepcion'
import DashboardSocio from './pages/dashboards/DashboardSocio'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard-gerente" element={<DashboardGerente />} />
        <Route path="/dashboard-admin" element={<DashboardAdmin />} />
        <Route path="/dashboard-coordinador" element={<DashboardCoordinador />} />
        <Route path="/dashboard-instructor" element={<DashboardInstructor />} />
        <Route path="/dashboard-recepcion" element={<DashboardRecepcion />} />
        <Route path="/dashboard-socio" element={<DashboardSocio />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App