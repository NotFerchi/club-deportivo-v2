import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  AlertTriangle, CheckCircle, Shield,
  Calendar, Clock, FileText,
  Info, AlertCircle as AlertIcon, Ban
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import '../../../../css/socio/Sanciones.css'

function Sanciones() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
  const socioId = usuario?.socio_id

  const [sanciones, setSanciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [estadoCuenta, setEstadoCuenta] = useState('limpio')
  const [showModalDetalle, setShowModalDetalle] = useState(false)
  const [sancionSeleccionada, setSancionSeleccionada] = useState(null)

  useEffect(() => {
    if (!socioId) { setLoading(false); return }
    fetchSanciones()
  }, [socioId])

  const fetchSanciones = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest(`/sanciones/socio/${socioId}`)
      const lista = Array.isArray(data) ? data : []
      setSanciones(lista)
      // Usar el campo booleano `activa` calculado en backend (considera estado + fecha_fin)
      const activas = lista.filter(s => s.activa === true)
      if (activas.some(s => s.gravedad === 'Grave' || s.gravedad === 'Moderada')) {
        setEstadoCuenta('sancionado')
      } else if (activas.length > 0) {
        setEstadoCuenta('advertencia')
      } else {
        setEstadoCuenta('limpio')
      }
    } catch (err) {
      setError('No se pudo cargar el historial de sanciones')
    } finally {
      setLoading(false)
    }
  }

  const getEstatusColor = () => {
    if (estadoCuenta === 'sancionado') return 'rojo'
    if (estadoCuenta === 'advertencia') return 'naranja'
    return 'verde'
  }

  const getEstatusLabel = () => {
    if (estadoCuenta === 'sancionado') return 'Sancionado'
    if (estadoCuenta === 'advertencia') return 'Con Advertencia'
    return 'Cuenta Limpia'
  }

  const getGravedadColor = (gravedad) => {
    if (gravedad === 'Grave') return 'grave'
    if (gravedad === 'Moderada') return 'media'
    return 'leve'
  }

  // Usa el campo booleano `activa` del backend; fallback: compara estado para compatibilidad
  const getNormalizedEstado = (sancion) => {
    if (typeof sancion.activa === 'boolean') return sancion.activa ? 'activa' : 'cumplida'
    const e = (sancion.estado || '').toLowerCase()
    return ['resuelta', 'inactivo', 'inactiva', 'resuelto'].includes(e) ? 'cumplida' : 'activa'
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '—'
    const match = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return fecha
  }

  const handleVerDetalle = (sancion) => {
    setSancionSeleccionada(sancion)
    setShowModalDetalle(true)
  }

  const estatusColor = getEstatusColor()
  const sancionesActivas = sanciones.filter(s => s.activa === true).length
  const sancionesResueltas = sanciones.filter(s => s.activa !== true).length

  return (
    <SocioLayout activeTab="sanciones" title="Club Social | Estado de Cuenta">

      {/* HEADER */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Estado de Cuenta</h2>
          <p className="rs-subtitle">Historial de sanciones y cumplimiento de reglas</p>
        </div>
        <div className="rs-status-tags">
          <div className={`estatus-cuenta ${estatusColor}`}>
            {estatusColor === 'verde' && <CheckCircle size={18} />}
            {estatusColor === 'naranja' && <AlertTriangle size={18} />}
            {estatusColor === 'rojo' && <Ban size={18} />}
            <span>{getEstatusLabel()}</span>
          </div>
        </div>
      </section>

      {/* ESTADÍSTICAS */}
      <div className="stats-grid">
        <div className="stat-card">
          <Shield size={24} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{sancionesActivas}</span>
            <span className="stat-label">Sanciones Activas</span>
          </div>
        </div>
        <div className="stat-card">
          <AlertTriangle size={24} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{sanciones.length}</span>
            <span className="stat-label">Total Historial</span>
          </div>
        </div>
        <div className="stat-card">
          <CheckCircle size={24} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{sancionesResueltas}</span>
            <span className="stat-label">Resueltas</span>
          </div>
        </div>
      </div>

      {/* LEYENDA */}
      <div className="leyenda-section">
        <h4>Gravedad de Sanciones</h4>
        <div className="leyenda-grid">
          <div className="leyenda-item">
            <span className="badge-gravedad leve">Leve</span>
            <span>Advertencia (1 día)</span>
          </div>
          <div className="leyenda-item">
            <span className="badge-gravedad media">Moderada</span>
            <span>Suspensión temporal (7 días)</span>
          </div>
          <div className="leyenda-item">
            <span className="badge-gravedad grave">Grave</span>
            <span>Suspensión prolongada (30 días)</span>
          </div>
        </div>
      </div>

      {/* LISTADO */}
      <div className="sanciones-list">
        <h3>Historial de Sanciones</h3>

        {loading ? (
          <div className="loading-state">Cargando...</div>
        ) : error ? (
          <div className="empty-state">
            <AlertIcon size={48} style={{ color: '#ef4444' }} />
            <h3>Error al cargar</h3>
            <p>{error}</p>
          </div>
        ) : sanciones.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={48} />
            <h3>¡Excelente!</h3>
            <p>No tienes sanciones registradas</p>
          </div>
        ) : (
          <div className="sanciones-grid">
            {sanciones.map(sancion => {
              const estadoNorm = getNormalizedEstado(sancion)
              return (
                <div key={sancion.sancion_id} className="sancion-card">
                  <div className="sancion-header">
                    <span className={`badge-gravedad ${getGravedadColor(sancion.gravedad)}`}>
                      {sancion.gravedad || 'Leve'}
                    </span>
                    <span className={`sancion-status ${estadoNorm}`}>
                      {estadoNorm === 'activa' ? <AlertIcon size={16} /> : <CheckCircle size={16} />}
                      {estadoNorm === 'activa' ? ' Activa' : ' Resuelta'}
                    </span>
                  </div>

                  <h4 className="sancion-tipo">{sancion.origen || 'Sanción'}</h4>
                  <p className="sancion-desc">{sancion.motivo}</p>

                  <div className="sancion-detalles">
                    <div className="detalle-item">
                      <Calendar size={14} />
                      <span>{formatFecha(sancion.fecha_inicio || sancion.fecha)}</span>
                    </div>
                    {sancion.fecha_fin && (
                      <div className="detalle-item">
                        <Clock size={14} />
                        <span>Hasta: {formatFecha(sancion.fecha_fin)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    className="btn-ver-detalle"
                    onClick={() => handleVerDetalle(sancion)}
                  >
                    <FileText size={16} /> Ver Detalle
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DETALLE */}
      {showModalDetalle && sancionSeleccionada && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-detalle">
            <header className="modal-header">
              <h3>Detalle de Sanción</h3>
              <button className="close-btn" onClick={() => setShowModalDetalle(false)}>&times;</button>
            </header>
            <div className="modal-body">
              <div className="detalle-sancion">
                <div className="detalle-header">
                  <span className={`badge-gravedad ${getGravedadColor(sancionSeleccionada.gravedad)}`}>
                    {sancionSeleccionada.gravedad || 'Leve'}
                  </span>
                  <span className={`sancion-status ${getNormalizedEstado(sancionSeleccionada)}`}>
                    {getNormalizedEstado(sancionSeleccionada) === 'activa' ? ' Activa' : ' Resuelta'}
                  </span>
                </div>

                <h2>{sancionSeleccionada.origen || 'Sanción'}</h2>
                <p className="detalle-desc">{sancionSeleccionada.motivo}</p>

                <div className="detalle-info-grid">
                  <div className="info-item">
                    <Calendar size={20} />
                    <div>
                      <strong>Fecha de Inicio</strong>
                      <span>{formatFecha(sancionSeleccionada.fecha_inicio || sancionSeleccionada.fecha)}</span>
                    </div>
                  </div>
                  {sancionSeleccionada.fecha_fin && (
                    <div className="info-item">
                      <Clock size={20} />
                      <div>
                        <strong>Fecha de Fin</strong>
                        <span>{formatFecha(sancionSeleccionada.fecha_fin)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="detalle-explicacion">
                  <h4><Info size={18} /> Motivo de la Sanción</h4>
                  <p>{sancionSeleccionada.motivo}</p>
                </div>

                {getNormalizedEstado(sancionSeleccionada) === 'activa' && (
                  <div className="detalle-pago">
                    <AlertIcon size={20} />
                    <div>
                      <strong>Sanción Vigente</strong>
                      <p>Esta sanción está activa. Acude a recepción para más información sobre cómo resolverla.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <footer className="modal-footer">
              <button className="modal-btn confirm" onClick={() => setShowModalDetalle(false)}>
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}

    </SocioLayout>
  )
}

export default Sanciones
