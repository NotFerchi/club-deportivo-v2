import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import { 
  AlertTriangle, CheckCircle, XCircle, Shield, 
  Calendar, Clock, MapPin, FileText, DollarSign,
  Info, AlertCircle as AlertIcon, Ban
} from 'lucide-react'
import '../../../../css/socio/Sanciones.css'

function Sanciones() {
  // ==================== ESTADOS ====================
  const [sanciones, setSanciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModalDetalle, setShowModalDetalle] = useState(false)
  const [sancionSeleccionada, setSancionSeleccionada] = useState(null)

  // ==================== DATOS HARDCODEADOS ====================
  // Estado general del socio
  const estadoCuenta = {
    estatus: 'limpio', // limpio | advertencia | sancionado
    ultimaActualizacion: '2026-04-23'
  }

  // Historial de sanciones
  const sancionesData = [
    {
      id: 1,
      tipo: 'Advertencia',
      gravedad: 'Leve',
      descripcion: 'Uso indebido de equipo en área de pesas',
      area: 'Gimnasio',
      fechaInicio: '2026-04-15',
      fechaFin: null, // Sin suspensión, solo advertencia
      monto: 0,
      status: 'activa',
      detalles: 'Se dejó peso sin devolver después de usar la máquina de press banca. No hubo daño material pero incumplió la norma de limpieza.'
    },
    {
      id: 2,
      tipo: 'Suspensión',
      gravedad: 'Media',
      descripcion: 'No presentación a clase reservada',
      area: 'Cancha de Tenis',
      fechaInicio: '2026-03-20',
      fechaFin: '2026-03-27',
      monto: 0,
      status: 'cumplida',
      detalles: 'El socio reservó la cancha 1 para las 9:00 AM y no se presentó. La cancha quedó vacante toda la hora.'
    },
    {
      id: 3,
      tipo: 'Multa',
      gravedad: 'Leve',
      descripcion: 'Estacionamiento en área no autorizada',
      area: 'Estacionamiento',
      fechaInicio: '2026-02-10',
      fechaFin: null,
      monto: 150,
      status: 'pagada',
      detalles: 'Vehículo estacionado en zona de carga/descarga por 45 minutos.'
    }
  ]

  // ==================== EFECTOS ====================
  useEffect(() => {
    setLoading(true)
    setTimeout(() => {
      setSanciones(sancionesData)
      setLoading(false)
    }, 500)
  }, [])

  // ==================== HANDLERS ====================
  const getEstatusColor = () => {
    switch (estadoCuenta.estatus) {
      case 'limpio': return 'verde'
      case 'advertencia': return 'naranja'
      case 'sancionado': return 'rojo'
      default: return 'verde'
    }
  }

  const getEstatusLabel = () => {
    switch (estadoCuenta.estatus) {
      case 'limpio': return 'Cuenta Limpia'
      case 'advertencia': return 'Con Advertencia'
      case 'sancionado': return 'Sancionado'
      default: return 'Cuenta Limpia'
    }
  }

  const getGravedadColor = (gravedad) => {
    switch (gravedad) {
      case 'Leve': return 'leve'
      case 'Media': return 'media'
      case 'Grave': return 'grave'
      default: return 'leve'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'activa': return <AlertIcon size={16} />
      case 'cumplida': return <CheckCircle size={16} />
      case 'pagada': return <CheckCircle size={16} />
      default: return null
    }
  }

  const handleVerDetalle = (sancion) => {
    setSancionSeleccionada(sancion)
    setShowModalDetalle(true)
  }

  // Calcular estadísticas
  const sancionesActivas = sanciones.filter(s => s.status === 'activa').length
  const totalMultas = sanciones.reduce((acc, s) => acc + s.monto, 0)

  return (
    <SocioLayout activeTab="sanciones" title="Club Social | Estado de Cuenta">
      
      {/* ==================== HEADER ==================== */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Estado de Cuenta</h2>
          <p className="rs-subtitle">Historial de sanciones y cumplimiento de reglas</p>
        </div>
        <div className="rs-status-tags">
          <div className={`estatus-cuenta ${getEstatusColor()}`}>
            {getEstatusColor() === 'verde' && <CheckCircle size={18} />}
            {getEstatusColor() === 'naranja' && <AlertTriangle size={18} />}
            {getEstatusColor() === 'rojo' && <Ban size={18} />}
            <span>{getEstatusLabel()}</span>
          </div>
        </div>
      </section>

      {/* ==================== ESTADÍSTICAS ==================== */}
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
          <DollarSign size={24} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">${totalMultas}</span>
            <span className="stat-label">Multas Pendientes</span>
          </div>
        </div>
      </div>

      {/* ==================== LEYENDA ==================== */}
      <div className="leyenda-section">
        <h4>Gravedad de Sanciones</h4>
        <div className="leyenda-grid">
          <div className="leyenda-item">
            <span className="badge-gravedad leve">Leve</span>
            <span>Advertencia verbal o escrita</span>
          </div>
          <div className="leyenda-item">
            <span className="badge-gravedad media">Media</span>
            <span>Suspensión temporal (1-7 días)</span>
          </div>
          <div className="leyenda-item">
            <span className="badge-gravedad grave">Grave</span>
            <span>Suspensión prolongada o expulsión</span>
          </div>
        </div>
      </div>

      {/* ==================== LISTADO DE SANCIONES ==================== */}
      <div className="sanciones-list">
        <h3>Historial de Sanciones</h3>
        
        {loading ? (
          <div className="loading-state">Cargando...</div>
        ) : sanciones.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={48} />
            <h3>¡Excelente!</h3>
            <p>No tienes sanciones registradas</p>
          </div>
        ) : (
          <div className="sanciones-grid">
            {sanciones.map(sancion => (
              <div key={sancion.id} className="sancion-card">
                <div className="sancion-header">
                  <span className={`badge-gravedad ${getGravedadColor(sancion.gravedad)}`}>
                    {sancion.gravedad}
                  </span>
                  <span className={`sancion-status ${sancion.status}`}>
                    {getStatusIcon(sancion.status)}
                    {sancion.status === 'activa' && ' Activa'}
                    {sancion.status === 'cumplida' && ' Cumplida'}
                    {sancion.status === 'pagada' && ' Pagada'}
                  </span>
                </div>

                <h4 className="sancion-tipo">{sancion.tipo}</h4>
                <p className="sancion-desc">{sancion.descripcion}</p>

                <div className="sancion-detalles">
                  <div className="detalle-item">
                    <MapPin size={14} />
                    <span>{sancion.area}</span>
                  </div>
                  <div className="detalle-item">
                    <Calendar size={14} />
                    <span>{sancion.fechaInicio}</span>
                  </div>
                  {sancion.fechaFin && (
                    <div className="detalle-item">
                      <Clock size={14} />
                      <span>Hasta: {sancion.fechaFin}</span>
                    </div>
                  )}
                  {sancion.monto > 0 && (
                    <div className="detalle-item monto">
                      <DollarSign size={14} />
                      <span>${sancion.monto}</span>
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
            ))}
          </div>
        )}
      </div>

      {/* ==================== MODAL: DETALLE ==================== */}
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
                    {sancionSeleccionada.gravedad}
                  </span>
                  <span className={`sancion-status ${sancionSeleccionada.status}`}>
                    {sancionSeleccionada.status === 'activa' && ' Activa'}
                    {sancionSeleccionada.status === 'cumplida' && ' Cumplida'}
                    {sancionSeleccionada.status === 'pagada' && ' Pagada'}
                  </span>
                </div>

                <h2>{sancionSeleccionada.tipo}</h2>
                <p className="detalle-desc">{sancionSeleccionada.descripcion}</p>

                <div className="detalle-info-grid">
                  <div className="info-item">
                    <MapPin size={20} />
                    <div>
                      <strong>Área</strong>
                      <span>{sancionSeleccionada.area}</span>
                    </div>
                  </div>
                  <div className="info-item">
                    <Calendar size={20} />
                    <div>
                      <strong>Fecha de Inicio</strong>
                      <span>{sancionSeleccionada.fechaInicio}</span>
                    </div>
                  </div>
                  {sancionSeleccionada.fechaFin && (
                    <div className="info-item">
                      <Clock size={20} />
                      <div>
                        <strong>Fecha de Fin</strong>
                        <span>{sancionSeleccionada.fechaFin}</span>
                      </div>
                    </div>
                  )}
                  {sancionSeleccionada.monto > 0 && (
                    <div className="info-item">
                      <DollarSign size={20} />
                      <div>
                        <strong>Monto a Pagar</strong>
                        <span>${sancionSeleccionada.monto}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="detalle-explicacion">
                  <h4><Info size={18} /> Detalles de la Infracción</h4>
                  <p>{sancionSeleccionada.detalles}</p>
                </div>

                {sancionSeleccionada.monto > 0 && sancionSeleccionada.status !== 'pagada' && (
                  <div className="detalle-pago">
                    <AlertIcon size={20} />
                    <div>
                      <strong>Instrucciones de Pago</strong>
                      <p>Acude a recepción para liquidar esta multa. Puedes pagar en efectivo o con tarjeta.</p>
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