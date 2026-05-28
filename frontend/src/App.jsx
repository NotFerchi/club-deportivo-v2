import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/dashboards/Dashboard'
import DashboardCoordinador from './pages/dashboards/DashboardCoordinador'
import DashboardInstructor from './pages/dashboards/DashboardInstructor'
import DashboardRecepcion from './pages/dashboards/DashboardRecepcion'
import DashboardSocio from './pages/dashboards/DashboardSocio'
import SocioLayout from './components/SocioLayout'
import Reservas from './pages/dashboards/socio/Reservas'
import Clases from './pages/dashboards/socio/Clases'
import Ludoteca from './pages/dashboards/socio/Ludoteca'
import Sanciones from './pages/dashboards/socio/Sanciones'
import Torneos from './pages/dashboards/socio/Torneos'
import Espacios from './pages/Espacios'

function getStoredRol() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}').rol || ''
  } catch {
    return ''
  }
}

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('token')
  const rol = getStoredRol()
  if (!token) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(rol)) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <NotificationProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* Admin y Gerente comparten el mismo dashboard — el componente distingue internamente */}
          <Route
            path="/dashboard-admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-gerente"
            element={
              <ProtectedRoute allowedRoles={['gerente']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard-coordinador"
            element={
              <ProtectedRoute allowedRoles={['coordinador']}>
                <DashboardCoordinador />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-instructor"
            element={
              <ProtectedRoute allowedRoles={['instructor']}>
                <DashboardInstructor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-recepcion"
            element={
              <ProtectedRoute allowedRoles={['recepcion']}>
                <DashboardRecepcion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-socio"
            element={
              <ProtectedRoute allowedRoles={['socio']}>
                <DashboardSocio />
              </ProtectedRoute>
            }
          />

          <Route path="/espacios" element={<Espacios />} />

          <Route path="/reservas" element={<ProtectedRoute allowedRoles={['socio']}><Reservas /></ProtectedRoute>} />
          <Route path="/clases" element={<ProtectedRoute allowedRoles={['socio']}><Clases /></ProtectedRoute>} />
          <Route path="/ludoteca" element={<ProtectedRoute allowedRoles={['socio']}><Ludoteca /></ProtectedRoute>} />
          <Route path="/sanciones" element={<ProtectedRoute allowedRoles={['socio']}><Sanciones /></ProtectedRoute>} />
          <Route path="/torneos" element={<ProtectedRoute allowedRoles={['socio']}><Torneos /></ProtectedRoute>} />
          <Route path="/components/socio-layout" element={<SocioLayout />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </NotificationProvider>
  )
}

export default App
