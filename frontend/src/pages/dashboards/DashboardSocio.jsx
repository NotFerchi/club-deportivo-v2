import React, { useState, useEffect } from 'react'
import SocioLayout from '../../components/SocioLayout'
import { CheckCircle } from 'lucide-react'

function DashboardSocio() {
  // Estados para datos reales
  const [clasesHoy, setClasesHoy] = useState(0)
  const [espaciosLibres, setEspaciosLibres] = useState(0)
  const [proximasClases, setProximasClases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Obtener día actual en formato para la API
  const getDiaActual = () => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
    return dias[new Date().getDay()]
  }

  // Cargar datos al montar el componente
  useEffect(() => {
    const fetchDatos = async () => {
      const token = localStorage.getItem('token')
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }

      try {
        // Obtener clases del día y espacios
        const [sesionesRes, espaciosRes] = await Promise.all([
          fetch(`http://localhost:3000/api/sesiones/dia/${getDiaActual()}`, { headers }),
          fetch('http://localhost:3000/api/espacios', { headers })
        ])

        const sesionesData = sesionesRes.ok ? await sesionesRes.json() : []
        const espaciosData = espaciosRes.ok ? await espaciosRes.json() : []

        setClasesHoy(sesionesData.length)
        setEspaciosLibres(espaciosData.filter(e => e.activo).length)
        setProximasClases(sesionesData.slice(0, 5))
      } catch (err) {
        setError('Error al cargar datos')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchDatos()
  }, [])

  // Obtener nombre del usuario
  const usuarioSesion = localStorage.getItem('usuario')
  const userName = usuarioSesion ? JSON.parse(usuarioSesion).nombre || "Socio" : "Socio"

  // Formatear fecha actual
  const fechaActual = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <SocioLayout activeTab="inicio" title="Club Social y Deportivo | Inicio">
      
      {/* Card Hero */}
      <section className="ds-welcome-card">
        <div className="ds-welcome-info">
          <h2 className="ds-title-serif">Buen dia, {userName.split(' ')[0]}</h2>
          <p className="ds-subtitle">{fechaActual}</p>
        </div>
        <div className="ds-status-tags">
          <span className="tag-active"><CheckCircle size={14} /> Activo</span>
          <span className="tag-category">Accion Familiar</span>
        </div>
      </section>

      {/* KPI Cards - Ahora con datos reales */}
      <div className="ds-grid-kpi">
        <div className="ds-card-stat">
          <div className="stat-icon gray"><CalendarIcon size={20} /></div>
          <div className="stat-data">
            {loading ? (
              <span className="stat-number">...</span>
            ) : (
              <span className="stat-number">{clasesHoy}</span>
            )}
            <span className="stat-label">Clases hoy</span>
          </div>
        </div>
        <div className="ds-card-stat">
          <div className="stat-icon teal"><LayoutIcon size={20} /></div>
          <div className="stat-data">
            {loading ? (
              <span className="stat-number">...</span>
            ) : (
              <span className="stat-number">{espaciosLibres}</span>
            )}
            <span className="stat-label">Canchas libres</span>
          </div>
        </div>
        <div className="ds-card-stat">
          <div className="stat-icon amber"><BabyIcon size={20} /></div>
          <div className="stat-data">
            <span className="stat-number">-</span>
            <span className="stat-label">Hijos registrados</span>
          </div>
        </div>
        <div className="ds-card-stat">
          <div className="stat-icon red"><AlertIcon size={20} /></div>
          <div className="stat-data">
            <span className="stat-number">-</span>
            <span className="stat-label">No-Shows (30 dias)</span>
          </div>
        </div>
      </div>

      {/* Seccion Listado - Ahora con datos reales */}
      <section className="ds-section-card">
        <header className="section-header">
          <ClockIcon size={18} /> <h3>Proximas 24 horas</h3>
        </header>
        <div className="ds-list">
          {loading ? (
            <div className="ds-list-item">
              <div className="item-info">
                <h4>Cargando...</h4>
              </div>
            </div>
          ) : proximasClases.length > 0 ? (
            proximasClases.map((sesion, index) => (
              <div key={index} className="ds-list-item">
                <div className="item-info">
                  <h4>{sesion.disciplina}</h4>
                  <p>{sesion.hora_inicio?.substring(0, 5)} - {sesion.hora_fin?.substring(0, 5)} - {sesion.espacio}</p>
                </div>
                <div className="item-badge">{sesion.cupo_actual || 0}/{sesion.cupo_maximo}</div>
              </div>
            ))
          ) : (
            <div className="ds-list-item">
              <div className="item-info">
                <h4>No hay clases programadas</h4>
                <p>Hoy no hay sesiones disponibles</p>
              </div>
            </div>
          )}
        </div>
      </section>

    </SocioLayout>
  )
}

// Iconos auxiliares
const CalendarIcon = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const LayoutIcon = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
const BabyIcon = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 19c4 0 6-2 8-2"/><path d="M12 2v2"/><path d="M12 20v2"/></svg>
const AlertIcon = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const ClockIcon = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>

export default DashboardSocio