import React, { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Puzzle,
  Dumbbell,
  ShieldAlert,
  UserCheck,
  UserPlus,
  CalendarDays,
  User,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import './Dashboard.css'

function Dashboard() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioSesion = localStorage.getItem('usuario')
    if (!token || !usuarioSesion) {
      navigate('/login')
      return
    }

    const usuario = JSON.parse(usuarioSesion)
    if (!['gerente', 'admin'].includes(usuario.rol)) {
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    document.title = 'Dashboard Ejecutivo | Club Social y Deportivo'
  }, [])

  return (
    <div className="dashboard-root">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" />
          <span>Club Social</span>
        </div>

        <nav>
          <span className="nav-section-label">NAVEGACIÓN</span>
          <a href="/homepage-gerente" className="nav-link active"><LayoutDashboard className="nav-icon" /> Dashboard</a>
          <a href="/socios" className="nav-link"><Users className="nav-icon" /> Socios</a>
          <a href="/recepcion" className="nav-link"><ClipboardList className="nav-icon" /> Recepción y Visitas</a>
          <a href="/reservas" className="nav-link"><Calendar className="nav-icon" /> Reservas</a>
          <a href="/ludoteca" className="nav-link"><Puzzle className="nav-icon" /> Ludoteca</a>
          <a href="/disciplinas" className="nav-link"><Dumbbell className="nav-icon" /> Disciplinas</a>
          <a href="/sanciones" className="nav-link"><ShieldAlert className="nav-icon" /> Sanciones</a>
        </nav>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>Dashboard Ejecutivo</h2>
            <p>Vista general del club - Lunes, 2 de Marzo 2026</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        <section className="top-kpi-grid">
          <div className="kpi-card"><Users className="kpi-icon" /><div><h3>1,247</h3><p>Total Socios</p></div></div>
          <div className="kpi-card"><UserCheck className="kpi-icon green" /><div><h3>834</h3><p>Accionistas</p></div></div>
          <div className="kpi-card"><UserPlus className="kpi-icon blue" /><div><h3>413</h3><p>Rentistas</p></div></div>
          <div className="kpi-card"><CalendarDays className="kpi-icon amber" /><div><h3>86</h3><p>Reservas Hoy</p></div></div>
          <div className="kpi-card"><ShieldAlert className="kpi-icon red" /><div><h3>14</h3><p>Sanciones Activas</p></div></div>
        </section>

        <section className="charts-row">
          <div className="chart-box">
            <h4>Ocupación por Hora</h4>
            <p>Porcentaje de uso de instalaciones hoy</p>
            <div className="placeholder-visual">Espacio para Gráfico de Líneas (Sprint 5)</div>
          </div>
          <div className="chart-box">
            <h4>Composición de Socios</h4>
            <p>Accionistas vs Rentistas</p>
            <div className="placeholder-visual">Espacio para Gráfico Donut (Sprint 5)</div>
          </div>
        </section>

        <section className="bottom-row">
          <div className="chart-box">
            <h4>Resumen del Día</h4>
            <div className="summary-grid">
              <div className="mini-card"><User className="mini-icon" /><div><p>23</p><p>Visitas hoy</p></div></div>
              <div className="mini-card"><Puzzle className="mini-icon" /><div><p>8</p><p>Ludoteca activos</p></div></div>
              <div className="mini-card"><TrendingUp className="mini-icon" /><div><p>71%</p><p>Ocupación prom.</p></div></div>
              <div className="mini-card"><AlertTriangle className="mini-icon" /><div><p>14</p><p>No-Shows mes</p></div></div>
            </div>
          </div>
          <div className="chart-box">
            <h4>Reservas Recientes</h4>
            <ul className="reservation-list">
              <li className="res-item"><div><p className="reservation-name">Carlos Mendoza R.</p><p className="reservation-detail">Cancha Tenis 1 - 08:00 a 09:30</p></div><span className="badge confirmada">Confirmada</span></li>
              <li className="res-item"><div><p className="reservation-name">Ana Patricia Reyes F.</p><p className="reservation-detail">Cancha Pádel 1 - 10:00 a 11:00</p></div><span className="badge pendiente">Pendiente</span></li>
              <li className="res-item"><div><p className="reservation-name">Jorge Vargas L.</p><p className="reservation-detail">Alberca Olímpica - 07:00 a 08:00</p></div><span className="badge confirmada">Confirmada</span></li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Dashboard
