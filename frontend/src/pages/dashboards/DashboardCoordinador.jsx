import React, { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Users, Calendar, Dumbbell, Clock, LogOut } from 'lucide-react'
import '../../../css/Dashboard.css'

function DashboardCoordinador() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioSesion = localStorage.getItem('usuario')
    if (!token || !usuarioSesion) {
      navigate('/login')
      return
    }
    const usuario = JSON.parse(usuarioSesion)
    if (usuario.rol !== 'coordinador') {
      navigate('/login')
    }
    document.title = 'Coordinación | Club'
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
          <span className="nav-section-label">COORDINACIÓN</span>
          <a href="#" className="nav-link active"><Users className="nav-icon" /> Instructores</a>
          <a href="#" className="nav-link"><Calendar className="nav-icon" /> Horarios</a>
          <a href="#" className="nav-link"><Dumbbell className="nav-icon" /> Disciplinas</a>
          <a href="#" className="nav-link"><Clock className="nav-icon" /> Asignaciones</a>
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
            <h2>Panel del Coordinador</h2>
            <p>Gestión de instructores y horarios</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        <section className="top-kpi-grid">
          <div className="kpi-card"><Users className="kpi-icon" /><div><h3>12</h3><p>Instructores</p></div></div>
          <div className="kpi-card"><Calendar className="kpi-icon green" /><div><h3>28</h3><p>Clases semanales</p></div></div>
          <div className="kpi-card"><Dumbbell className="kpi-icon blue" /><div><h3>8</h3><p>Disciplinas</p></div></div>
        </section>

        <section className="bottom-row">
          <div className="chart-box">
            <h4>Instructores Activos</h4>
            <ul className="reservation-list">
              <li className="res-item"><div><p className="reservation-name">Ana Torres</p><p className="reservation-detail">Yoga - 6 clases/semana</p></div><span className="badge confirmada">Activo</span></li>
              <li className="res-item"><div><p className="reservation-name">Luis Méndez</p><p className="reservation-detail">Natación - 8 clases/semana</p></div><span className="badge confirmada">Activo</span></li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}

export default DashboardCoordinador