import React, { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Calendar, Dumbbell, Clock, AlertCircle, Users, Baby, History, LogOut } from 'lucide-react'
import '../../../css/Dashboard.css'

function DashboardSocio() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioSesion = localStorage.getItem('usuario')
    if (!token || !usuarioSesion) {
      navigate('/login')
      return
    }
    const usuario = JSON.parse(usuarioSesion)
    if (usuario.rol !== 'socio') {
      navigate('/login')
    }
    document.title = 'Mi Club | Socio'
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
          <span className="nav-section-label">MI ACTIVIDAD</span>
          <a href="#" className="nav-link active"><Calendar className="nav-icon" /> Mis Reservas</a>
          <a href="#" className="nav-link"><Dumbbell className="nav-icon" /> Mis Clases</a>
          <a href="#" className="nav-link"><Clock className="nav-icon" /> Próximas Actividades</a>
          <a href="#" className="nav-link"><Baby className="nav-icon" /> Ludoteca</a>
          <a href="#" className="nav-link"><History className="nav-icon" /> Historial</a>
          <a href="#" className="nav-link"><AlertCircle className="nav-icon" /> Mis Sanciones</a>
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
            <h2>Bienvenido, Socio</h2>
            <p>Gestiona tus actividades deportivas</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        <section className="top-kpi-grid">
          <div className="kpi-card"><Calendar className="kpi-icon" /><div><h3>2</h3><p>Reservas activas</p></div></div>
          <div className="kpi-card"><Dumbbell className="kpi-icon green" /><div><h3>3</h3><p>Clases esta semana</p></div></div>
          <div className="kpi-card"><AlertCircle className="kpi-icon amber" /><div><h3>0</h3><p>Sanciones</p></div></div>
        </section>

        <section className="bottom-row">
          <div className="chart-box">
            <h4>Próximas Reservas</h4>
            <ul className="reservation-list">
              <li className="res-item"><div><p className="reservation-name">Cancha Tenis 1</p><p className="reservation-detail">Hoy - 17:00 a 18:30</p></div><span className="badge confirmada">Confirmada</span></li>
              <li className="res-item"><div><p className="reservation-name">Clase de Natación</p><p className="reservation-detail">Mañana - 09:00 a 10:00</p></div><span className="badge confirmada">Confirmada</span></li>
            </ul>
          </div>
          <div className="chart-box">
            <h4>Actividades Recomendadas</h4>
            <ul className="reservation-list">
              <li className="res-item"><div><p className="reservation-name">Yoga</p><p className="reservation-detail">Lunes y Miércoles - 18:00</p></div><span className="badge pendiente">Disponible</span></li>
              <li className="res-item"><div><p className="reservation-name">Spinning</p><p className="reservation-detail">Martes y Jueves - 19:00</p></div><span className="badge pendiente">Disponible</span></li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}

export default DashboardSocio