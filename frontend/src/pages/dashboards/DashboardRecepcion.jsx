import React, { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus, UserCheck, Calendar, Baby, LogIn, LogOut } from 'lucide-react'
import '../../../css/Dashboard.css'

function DashboardRecepcion() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioSesion = localStorage.getItem('usuario')
    if (!token || !usuarioSesion) {
      navigate('/login')
      return
    }
    const usuario = JSON.parse(usuarioSesion)
    if (usuario.rol !== 'recepcion') {
      navigate('/login')
    }
    document.title = 'Recepción | Club'
  }, [navigate])

  const handleLogout = (e) => {
    e.preventDefault()
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/')
  }

  return (
    <div className="dashboard-root">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" />
          <span>Club Social</span>
        </div>
        
        <nav>
          <span className="nav-section-label">CONTROL</span>
          <a href="#" className="nav-link active"><LogIn className="nav-icon" /> Validar Acceso</a>
          <a href="#" className="nav-link"><UserPlus className="nav-icon" /> Registrar Visita</a>
          <a href="#" className="nav-link"><Calendar className="nav-icon" /> Reserva Asistida</a>
          <a href="#" className="nav-link"><Baby className="nav-icon" /> Control Ludoteca</a>
          <a href="#" className="nav-link"><UserCheck className="nav-icon" /> Reporte Diario</a>
        </nav>

        {/* Cerrar Sesión - FUERA del nav */}
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <a 
            href="#" 
            className="nav-link" 
            onClick={handleLogout}
            style={{ color: '#ef4444' }}
          >
            <LogOut className="nav-icon" /> Cerrar Sesión
          </a>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>Módulo de Recepción</h2>
            <p>Control de accesos y visitas</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        <section className="top-kpi-grid">
          <div className="kpi-card"><LogIn className="kpi-icon" /><div><h3>45</h3><p>Ingresos hoy</p></div></div>
          <div className="kpi-card"><UserPlus className="kpi-icon green" /><div><h3>8</h3><p>Visitas activas</p></div></div>
          <div className="kpi-card"><Baby className="kpi-icon amber" /><div><h3>5</h3><p>Niños en ludoteca</p></div></div>
        </section>

        <section className="bottom-row">
          <div className="chart-box">
            <h4>Accesos Recientes</h4>
            <ul className="reservation-list">
              <li className="res-item"><div><p className="reservation-name">Carlos Mendoza</p><p className="reservation-detail">Socio - 08:30</p></div><span className="badge confirmada">Validado</span></li>
              <li className="res-item"><div><p className="reservation-name">Ana Torres</p><p className="reservation-detail">Visitante - 09:15</p></div><span className="badge pendiente">Pase 1 día</span></li>
              <li className="res-item"><div><p className="reservation-name">Roberto Gómez</p><p className="reservation-detail">Socio - 10:00</p></div><span className="badge confirmada">Validado</span></li>
            </ul>
          </div>
          <div className="chart-box">
            <h4>Ludoteca - Infantes</h4>
            <ul className="reservation-list">
              <li className="res-item"><div><p className="reservation-name">Sofía M.</p><p className="reservation-detail">Ingreso: 10:00 | Límite: 12:00</p></div><span className="badge confirmada">Activo</span></li>
              <li className="res-item"><div><p className="reservation-name">Mateo R.</p><p className="reservation-detail">Ingreso: 10:30 | Límite: 12:30</p></div><span className="badge confirmada">Activo</span></li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}

export default DashboardRecepcion