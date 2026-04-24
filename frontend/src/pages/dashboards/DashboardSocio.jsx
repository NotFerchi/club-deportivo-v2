import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  LayoutDashboard, Calendar, GraduationCap, Baby, 
  AlertCircle, LogOut, CheckCircle, ChevronDown, Bell 
} from 'lucide-react'
import '../../../css/DashboardSocio.css'

function DashboardSocio() {
  document.body.style.overflow = 'auto';
  const navigate = useNavigate()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [userName, setUserName] = useState("Carlos Mendoza")

  useEffect(() => {
    const usuarioSesion = localStorage.getItem('usuario')
    if (usuarioSesion) {
      const usuario = JSON.parse(usuarioSesion)
      setUserName(usuario.nombre || "Socio")
    }
    document.title = 'Club Social y Deportivo | Inicio'
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/')
  }

  return (
    <div className="ds-wrapper">
      {/* --- HEADER PRINCIPAL --- */}
      <header className="ds-top-bar">
        <div className="ds-container-fluid">
          <h1 className="ds-brand-logo">Club Social y Deportivo</h1>
          
          <div className="ds-user-actions">
            <button className="ds-notif-badge-btn">
              <Bell size={20} />
              <span className="notification-ping"></span>
            </button>
            <div className="ds-profile-dropdown-container">
              <div className="ds-profile-trigger" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                <div className="ds-user-text">
                  <span className="ds-name">{userName}</span>
                  <span className="ds-role">Socio Familiar</span>
                </div>
                <div className="ds-avatar-circle">CM</div>
                <ChevronDown size={16} className={`ds-arrow ${isProfileOpen ? 'up' : ''}`} />
              </div>

              {isProfileOpen && (
                <div className="ds-dropdown-menu">
                  <button onClick={handleLogout} className="ds-logout-item">
                    <LogOut size={16} /> Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* --- NAV TABS (Menu principal) --- */}
      <nav className="ds-nav-tabs">
        <div className="ds-tabs-container">
          <Link to="#" className="ds-tab-item active">
            <LayoutDashboard size={20} /> <span className="tab-text">Inicio</span>
          </Link>
          <Link to="/reservas" className="ds-tab-item">
            <Calendar size={20} /> <span className="tab-text">Reservas</span>
          </Link>
          <Link to="#" className="ds-tab-item">
            <GraduationCap size={20} /> <span className="tab-text">Clases</span>
          </Link>
          <Link to="#" className="ds-tab-item">
            <Baby size={20} /> <span className="tab-text">Ludoteca</span>
          </Link>
          <Link to="#" className="ds-tab-item">
            <AlertCircle size={20} /> <span className="tab-text">Historial</span>
          </Link>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="ds-body">
        <div className="ds-content-wrapper">
          
          {/* Card Hero */}
          <section className="ds-welcome-card">
            <div className="ds-welcome-info">
              <h2 className="ds-title-serif">Buen dia, {userName.split(' ')[0]}</h2>
              <p className="ds-subtitle">Martes, 21 De Abril De 2026 - 6:23 P.M.</p>
            </div>
            <div className="ds-status-tags">
              <span className="tag-active"><CheckCircle size={14} /> Activo</span>
              <span className="tag-category">Accion Familiar</span>
            </div>
          </section>

          {/* KPI Cards */}
          <div className="ds-grid-kpi">
            <div className="ds-card-stat">
              <div className="stat-icon gray"><Calendar size={20} /></div>
              <div className="stat-data">
                <span className="stat-number">2</span>
                <span className="stat-label">Clases hoy</span>
              </div>
            </div>
            <div className="ds-card-stat">
              <div className="stat-icon teal"><LayoutDashboard size={20} /></div>
              <div className="stat-data">
                <span className="stat-number">2</span>
                <span className="stat-label">Canchas libres</span>
              </div>
            </div>
            <div className="ds-card-stat">
              <div className="stat-icon amber"><Baby size={20} /></div>
              <div className="stat-data">
                <span className="stat-number">2</span>
                <span className="stat-label">Hijos registrados</span>
              </div>
            </div>
            <div className="ds-card-stat">
              <div className="stat-icon red"><AlertCircle size={20} /></div>
              <div className="stat-data">
                <span className="stat-number">1</span>
                <span className="stat-label">No-Shows (30 dias)</span>
              </div>
            </div>
          </div>

          {/* Seccion Listado */}
          <section className="ds-section-card">
            <header className="section-header">
              <ClockIcon size={18} /> <h3>Proximas 24 horas</h3>
            </header>
            <div className="ds-list">
              <div className="ds-list-item">
                <div className="item-info">
                  <h4>Yoga Matutino</h4>
                  <p>7:00 AM - 8:00 AM - Salon A</p>
                </div>
                <div className="item-badge">8/15</div>
              </div>
              <div className="ds-list-item">
                <div className="item-info">
                  <h4>Zumba Intenso</h4>
                  <p>9:00 AM - 10:00 AM - Salon B</p>
                </div>
                <div className="item-badge">15/15</div>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}

// Icono pequeño auxiliar
const ClockIcon = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>

export default DashboardSocio