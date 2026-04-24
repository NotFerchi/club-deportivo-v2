import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  LayoutDashboard, Calendar, GraduationCap, Baby, 
  AlertCircle, LogOut, ChevronDown, Bell, Trophy
} from 'lucide-react'
import '../../css/socio/DashboardSocio.css'
import '../../css/socio/Reservas.css'
import '../../css/socio/Ludoteca.css'
import '../../css/socio/Sanciones.css'
import '../../css/socio/Torneos.css'
import '../../css/socio/Clases.css'

// Componente reutilizable para el layout de Socio
function SocioLayout({ children, activeTab = 'inicio', title }) {
  const navigate = useNavigate()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [userName, setUserName] = useState("Socio")

  useEffect(() => {
    const usuarioSesion = localStorage.getItem('usuario')
    if (usuarioSesion) {
      const usuario = JSON.parse(usuarioSesion)
      setUserName(usuario.nombre || "Socio")
    }
    document.title = title || 'Club Social y Deportivo'
  }, [title, navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/')
  }

  // Configuración de las tabs
  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, path: '/dashboard-socio' },
    { id: 'reservas', label: 'Reservas', icon: Calendar, path: '/reservas' },
    { id: 'clases', label: 'Clases', icon: GraduationCap, path: '/clases' },
    { id: 'ludoteca', label: 'Ludoteca', icon: Baby, path: '/ludoteca' },
    { id: 'torneos', label: 'Torneos', icon: Trophy, path: '/torneos' },
    { id: 'sanciones', label: 'Historial', icon: AlertCircle, path: '/sanciones' },
  ]

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

      {/* --- NAV TABS --- */}
      <nav className="ds-nav-tabs">
        <div className="ds-tabs-container">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <Link 
                key={tab.id} 
                to={tab.path} 
                className={`ds-tab-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon size={20} /> <span className="tab-text">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="ds-body">
        <div className="ds-content-wrapper">
          {children}
        </div>
      </main>
    </div>
  )
}

export default SocioLayout