import React, { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Calendar, Users, CheckSquare, BarChart3, Clock, LogOut } from 'lucide-react'
import '../../../css/Dashboard.css'  // ← Ruta correcta a frontend/css/Dashboard.css

function DashboardInstructor() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioSesion = localStorage.getItem('usuario')
    if (!token || !usuarioSesion) {
      navigate('/login')
      return
    }
    const usuario = JSON.parse(usuarioSesion)
    if (usuario.rol !== 'instructor') {
      navigate('/login')
    }
    document.title = 'Panel | Instructor'
  }, [navigate])

  return (
    <div className="dashboard-root">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" />
          <span>Club Social</span>
        </div>
        <nav>
            <span className="nav-section-label">MI GESTIÓN</span>
            <a href="#" className="nav-link active"><Calendar className="nav-icon" /> Mi Agenda</a>
            <a href="#" className="nav-link"><CheckSquare className="nav-icon" /> Registrar Asistencia</a>
            <a href="#" className="nav-link"><Users className="nav-icon" /> Mis Alumnos</a>
            <a href="#" className="nav-link"><BarChart3 className="nav-icon" /> Mis Métricas</a>
            
            {/* Agrega esto al final */}
            <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
              <a 
                href="#" 
                className="nav-link" 
                onClick={(e) => {
                  e.preventDefault()
                  localStorage.removeItem('token')
                  localStorage.removeItem('usuario')
                  navigate('/')
                }}
                style={{ color: '#ef4444' }}
              >
                <LogOut className="nav-icon" /> Cerrar Sesión
              </a>
            </div>
          </nav>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>Panel del Instructor</h2>
            <p>Gestiona tus clases y asistencia</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        <section className="top-kpi-grid">
          <div className="kpi-card"><Calendar className="kpi-icon" /><div><h3>4</h3><p>Clases hoy</p></div></div>
          <div className="kpi-card"><Users className="kpi-icon green" /><div><h3>32</h3><p>Alumnos totales</p></div></div>
          <div className="kpi-card"><BarChart3 className="kpi-icon blue" /><div><h3>85%</h3><p>Asistencia promedio</p></div></div>
        </section>

        <section className="bottom-row">
          <div className="chart-box">
            <h4>Agenda del Día</h4>
            <ul className="reservation-list">
              <li className="res-item"><div><p className="reservation-name">Yoga</p><p className="reservation-detail">08:00 - 09:30 | Salón 1 | 12/15 alumnos</p></div><span className="badge confirmada">En curso</span></li>
              <li className="res-item"><div><p className="reservation-name">Natación</p><p className="reservation-detail">10:00 - 11:00 | Alberca | 8/10 alumnos</p></div><span className="badge pendiente">Pendiente</span></li>
              <li className="res-item"><div><p className="reservation-name">Spinning</p><p className="reservation-detail">17:00 - 18:00 | Gimnasio | 15/15 alumnos</p></div><span className="badge confirmada">Confirmada</span></li>
            </ul>
          </div>
          <div className="chart-box">
            <h4>Próximas Clases</h4>
            <ul className="reservation-list">
              <li className="res-item"><div><p className="reservation-name">Pilates</p><p className="reservation-detail">Mañana 09:00 - Salón 2</p></div><span className="badge pendiente">Programada</span></li>
              <li className="res-item"><div><p className="reservation-name">Zumba</p><p className="reservation-detail">Mañana 18:00 - Gimnasio</p></div><span className="badge pendiente">Programada</span></li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}

export default DashboardInstructor