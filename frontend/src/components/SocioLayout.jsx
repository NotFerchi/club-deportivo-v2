import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, GraduationCap, Baby,
  AlertCircle, LogOut, ChevronDown, Bell, Trophy, QrCode, X,
  CheckCheck
} from 'lucide-react'
import { apiRequest } from '../services/api'
import { useNotificacionesSocio } from '../hooks/useNotificacionesSocio'
import '../../css/socio/DashboardSocio.css'
import '../../css/socio/Reservas.css'
import '../../css/socio/Ludoteca.css'
import '../../css/socio/Sanciones.css'
import '../../css/socio/Torneos.css'
import '../../css/socio/Clases.css'

/* ── Toast individual ─────────────────────────────────────── */
function Toast({ noti, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])

  const bg = {
    ludoteca: { bg: '#fff7ed', border: '#fb923c', icon: '⚠' },
    reserva:  { bg: '#eff6ff', border: '#3b82f6', icon: '📅' },
    clase:    { bg: '#f0fdf4', border: '#22c55e', icon: '🎓' },
  }[noti.tipo] || { bg: '#f8fafc', border: '#94a3b8', icon: '🔔' }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      background: bg.bg, border: `1px solid ${bg.border}`,
      borderLeft: `4px solid ${bg.border}`,
      borderRadius: '12px', padding: '0.85rem 1rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      animation: 'slideInRight 0.3s ease',
      width: '100%',
    }}>
      <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{bg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{noti.titulo}</p>
        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>{noti.mensaje}</p>
      </div>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#94a3b8', padding: '2px', flexShrink: 0
      }}>
        <X size={14} />
      </button>
    </div>
  )
}

/* ── Dropdown de notificaciones ───────────────────────────── */
function NotiDropdown({ notificaciones, onMarcarLeida, onMarcarTodas, onEliminar, onClose }) {
  const tipoIcon = (tipo) => {
    if (tipo === 'ludoteca') return '⚠'
    if (tipo === 'reserva')  return '📅'
    if (tipo === 'clase')    return '🎓'
    return '🔔'
  }

  const formatTs = (ts) => {
    const diff = Math.round((Date.now() - ts) / 60000)
    if (diff < 1)  return 'ahora'
    if (diff < 60) return `hace ${diff} min`
    return `hace ${Math.round(diff / 60)} h`
  }

  return (
    <div style={{
      position: 'fixed',
      top: '64px',
      right: '0.5rem',
      width: 'min(360px, calc(100vw - 1rem))',
      maxHeight: 'calc(100vh - 80px)',
      background: 'white', borderRadius: '16px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      border: '1px solid #e2e8f0',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9',
      }}>
        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
          Notificaciones
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {notificaciones.some(n => !n.leida) && (
            <button onClick={onMarcarTodas} title="Marcar todas como leídas" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.72rem', color: '#2563eb', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              <CheckCheck size={13} /> Leer todas
            </button>
          )}
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'
          }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notificaciones.length === 0 ? (
          <div style={{
            padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8'
          }}>
            <Bell size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600 }}>Sin notificaciones</p>
          </div>
        ) : (
          notificaciones.map(n => (
            <div
              key={n.id}
              onClick={() => onMarcarLeida(n.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.85rem 1.25rem',
                background: n.leida ? 'white' : '#f0f7ff',
                borderBottom: '1px solid #f8fafc',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = n.leida ? 'white' : '#f0f7ff'}
            >
              <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}>{tipoIcon(n.tipo)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontWeight: n.leida ? 600 : 800,
                  fontSize: '0.78rem', color: '#0f172a'
                }}>{n.titulo}</p>
                <p style={{
                  margin: '2px 0 4px', fontSize: '0.73rem',
                  color: '#64748b', lineHeight: 1.4
                }}>{n.mensaje}</p>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                  {formatTs(n.ts)}
                </span>
              </div>
              {!n.leida && (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#2563eb', flexShrink: 0, marginTop: 6
                }} />
              )}
              <button
                onClick={e => { e.stopPropagation(); onEliminar(n.id) }}
                title="Eliminar"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#cbd5e1', padding: '2px', flexShrink: 0
                }}
              >
                <X size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ── Layout principal ─────────────────────────────────────── */
function SocioLayout({ children, activeTab = 'inicio', title }) {
  const navigate = useNavigate()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [userName, setUserName] = useState("Socio")
  const [showQR, setShowQR] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [loadingQR, setLoadingQR] = useState(false)
  const [errorQR, setErrorQR] = useState(null)
  const [showNotiDropdown, setShowNotiDropdown] = useState(false)
  const [toasts, setToasts] = useState([])          // toasts visibles
  const prevNoLeidas = useRef(0)
  const notiRef = useRef(null)

  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, eliminar } =
    useNotificacionesSocio()

  /* Detectar nuevas notificaciones y mostrarlas como toast */
  useEffect(() => {
    if (noLeidas > prevNoLeidas.current) {
      const nuevas = notificaciones.filter(n => !n.leida)
        .slice(0, noLeidas - prevNoLeidas.current)
      setToasts(prev => {
        const ids = new Set(prev.map(t => t.id))
        return [...prev, ...nuevas.filter(n => !ids.has(n.id))]
      })
    }
    prevNoLeidas.current = noLeidas
  }, [noLeidas, notificaciones])

  const cerrarToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    marcarLeida(id)
  }, [marcarLeida])

  /* Cerrar dropdown al hacer click fuera */
  useEffect(() => {
    const handler = (e) => {
      if (notiRef.current && !notiRef.current.contains(e.target)) {
        setShowNotiDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const usuarioSesion = localStorage.getItem('usuario')
    if (usuarioSesion) {
      const usuario = JSON.parse(usuarioSesion)
      setUserName(usuario.nombre || "Socio")
    }
    document.title = title || 'Club Social y Deportivo'
  }, [title, navigate])

  const handleLogout = () => {
    sessionStorage.removeItem('noti_keys')
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/')
  }

  const handleOpenQR = useCallback(async () => {
    setShowQR(true)
    setQrData(null)
    setErrorQR(null)
    setLoadingQR(true)
    try {
      const data = await apiRequest('/qr/mi-qr')
      setQrData(data)
    } catch (err) {
      setErrorQR(err.message || 'No se pudo cargar tu QR')
    } finally {
      setLoadingQR(false)
    }
  }, [])

  const tabs = [
    { id: 'inicio',    label: 'Inicio',    icon: LayoutDashboard, path: '/dashboard-socio' },
    { id: 'reservas',  label: 'Reservas',  icon: Calendar,        path: '/reservas' },
    { id: 'clases',    label: 'Clases',    icon: GraduationCap,   path: '/clases' },
    { id: 'ludoteca',  label: 'Ludoteca',  icon: Baby,            path: '/ludoteca' },
    { id: 'torneos',   label: 'Torneos',   icon: Trophy,          path: '/torneos' },
    { id: 'sanciones', label: 'Historial', icon: AlertCircle,     path: '/sanciones' },
  ]

  return (
    <div className="ds-wrapper">

      {/* ── TOASTS ──────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: '1rem', right: '0.5rem',
        zIndex: 99999, display: 'flex', flexDirection: 'column-reverse',
        gap: '0.6rem',
        width: 'min(340px, calc(100vw - 1rem))',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast noti={t} onClose={() => cerrarToast(t.id)} />
          </div>
        ))}
      </div>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="ds-top-bar">
        <div className="ds-container-fluid">
          <h1 className="ds-brand-logo">Club Social y Deportivo</h1>

          <div className="ds-user-actions">
            <button className="ds-qr-btn" onClick={handleOpenQR}>
              <QrCode size={18} />
              <span>Mi QR</span>
            </button>

            {/* Campana con badge y dropdown */}
            <div ref={notiRef} style={{ position: 'relative' }}>
              <button
                className="ds-notif-badge-btn"
                onClick={() => setShowNotiDropdown(v => !v)}
                title="Notificaciones"
                style={{ position: 'relative' }}
              >
                <Bell size={20} />
                {noLeidas > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#ef4444', color: 'white',
                    borderRadius: '50%', width: 18, height: 18,
                    fontSize: '0.65rem', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white', lineHeight: 1,
                  }}>
                    {noLeidas > 9 ? '9+' : noLeidas}
                  </span>
                )}
              </button>

              {showNotiDropdown && (
                <NotiDropdown
                  notificaciones={notificaciones}
                  onMarcarLeida={marcarLeida}
                  onMarcarTodas={marcarTodasLeidas}
                  onEliminar={eliminar}
                  onClose={() => setShowNotiDropdown(false)}
                />
              )}
            </div>

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

      {/* ── NAV TABS ────────────────────────────────────────── */}
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

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <main className="ds-body">
        <div className="ds-content-wrapper">
          {children}
        </div>
      </main>

      {/* ── MODAL MI QR ─────────────────────────────────────── */}
      {showQR && (
        <div className="qr-modal-overlay" onClick={() => setShowQR(false)}>
          <div className="qr-modal-card" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <span className="qr-modal-title">Mi QR de Acceso</span>
              <button className="qr-modal-close" onClick={() => setShowQR(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="qr-modal-body">
              {loadingQR && (
                <div className="qr-loading-state">Cargando tu código QR...</div>
              )}
              {!loadingQR && errorQR && (
                <div className="qr-error-state">
                  <div className="qr-error-icon"><QrCode size={40} opacity={0.3} /></div>
                  <p>{errorQR}</p>
                </div>
              )}
              {!loadingQR && qrData && (
                <>
                  <span className="qr-brand-label">Club Social y Deportivo</span>
                  <div className="qr-image-wrapper">
                    <img src={qrData.qr_image} alt="Mi código QR de acceso" />
                  </div>
                  <span className="qr-member-name">{userName}</span>
                  {qrData.numero_socio && (
                    <span className="qr-member-number">Socio #{qrData.numero_socio}</span>
                  )}
                  <p className="qr-hint">Muestra este QR en recepción para ingresar al club</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SocioLayout
