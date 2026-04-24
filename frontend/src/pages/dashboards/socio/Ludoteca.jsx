import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import { 
  Baby, Users, Clock, QrCode, AlertTriangle, 
  CheckCircle, XCircle, Plus, Minus, Search,
  UserPlus, Heart, Shield, Calendar, MapPin,
  Phone, Mail, Info, AlertCircle as AlertIcon
} from 'lucide-react'
import '../../../../css/socio/Ludoteca.css'

function Ludoteca() {
  // ==================== ESTADOS ====================
  const [vista, setVista] = useState('mis-hijos') // 'mis-hijos' | 'reservar' | 'historial'
  const [misHijos, setMisHijos] = useState([])
  const [showModalQR, setShowModalQR] = useState(false)
  const [showModalAgregar, setShowModalAgregar] = useState(false)
  const [showModalReservar, setShowModalReservar] = useState(false)
  const [aforoActual, setAforoActual] = useState(0)
  const [aforoMaximo, setAforoMaximo] = useState(15)
  const [tiempoEstancia, setTiempoEstancia] = useState({})
  const [loading, setLoading] = useState(true)

  // ==================== DATOS HARDCODEADOS ====================
  // Hijos registrados
  const hijosData = [
    {
      id: 1,
      nombre: 'Sofía Martínez',
      edad: 5,
      fechaNacimiento: '2020-03-15',
      alergias: ['Maní'],
      cuidadosEspeciales: 'Usa pañal, requiere fórmula específica',
      foto: 'https://i.pravatar.cc/150?img=10',
      qrCode: 'QR-SOFIA-001',
      activo: true
    },
    {
      id: 2,
      nombre: 'Diego Martínez',
      edad: 3,
      fechaNacimiento: '2022-08-22',
      alergias: [],
      cuidadosEspeciales: '',
      foto: 'https://i.pravatar.cc/150?img=11',
      qrCode: 'QR-DIEGO-002',
      activo: true
    }
  ]

  // Instructors de ludoteca
  const instructorLudoteca = {
    nombre: 'Laura Hernández',
    foto: 'https://i.pravatar.cc/150?img=5',
    turno: 'Matutino',
    horaInicio: '08:00',
    horaFin: '14:00'
  }

  // Historial de uso
  const historialData = [
    {
      id: 1,
      hijo: 'Sofía Martínez',
      fecha: '2026-04-20',
      horaEntrada: '09:30',
      horaSalida: '11:45',
      duracion: '2h 15m',
      instructor: 'Laura Hernández',
      status: 'completado'
    },
    {
      id: 2,
      hijo: 'Diego Martínez',
      fecha: '2026-04-18',
      horaEntrada: '10:00',
      horaSalida: '12:00',
      duracion: '2h 0m',
      instructor: 'Carlos Mendoza',
      status: 'completado'
    },
    {
      id: 3,
      hijo: 'Sofía Martínez',
      fecha: '2026-04-15',
      horaEntrada: '16:00',
      horaSalida: '17:30',
      duracion: '1h 30m',
      instructor: 'Ana García',
      status: 'completado'
    }
  ]

  // Familiares autorizados
  const familiaresAutorizados = [
    { id: 1, nombre: 'María López', parentesco: 'Esposa', telefono: '55-1234-5678' },
    { id: 2, nombre: 'Roberto Martínez', parentesco: 'Abuelo', telefono: '55-8765-4321' }
  ]

  // ==================== EFECTOS ====================
  useEffect(() => {
    setLoading(true)
    setTimeout(() => {
      setMisHijos(hijosData)
      setAforoActual(8)
      setLoading(false)
    }, 500)
  }, [])

  // Timer para tiempo de estancia
  useEffect(() => {
    const interval = setInterval(() => {
      // Simular tiempo de estancia
      setTiempoEstancia({
        1: Math.floor(Math.random() * 90) + 30, // minutos
        2: Math.floor(Math.random() * 60) + 10
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // ==================== HANDLERS ====================
  const getAforoPorcentaje = () => {
    return Math.round((aforoActual / aforMaximo) * 100)
  }

  const getAforoColor = () => {
    const porcentaje = getAforoPorcentaje()
    if (porcentaje >= 90) return 'rojo'
    if (porcentaje >= 70) return 'naranja'
    return 'verde'
  }

  const formatTiempo = (minutos) => {
    const horas = Math.floor(minutos / 60)
    const mins = minutos % 60
    if (horas > 0) {
      return `${horas}h ${mins}m`
    }
    return `${mins}m`
  }

  const getAlertaTiempo = (minutos) => {
    if (minutos >= 110) return 'critico'
    if (minutos >= 90) return 'advertencia'
    return null
  }

  return (
    <SocioLayout activeTab="ludoteca" title="Club Social | Ludoteca">
      
      {/* ==================== HEADER ==================== */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Ludoteca</h2>
          <p className="rs-subtitle">Cuida de tus hijos mientras disfrutas del club</p>
        </div>
        <div className="rs-status-tags">
          <button className="btn-qr-flotante" onClick={() => setShowModalQR(true)}>
            <QrCode size={18} /> Mi QR
          </button>
        </div>
      </section>

      {/* ==================== AFORO ==================== */}
      <div className="aforo-card">
        <div className="aforo-info">
          <h3>Aforo Actual</h3>
          <div className="aforo-numeros">
            <span className={`aforo-actual ${getAforoColor()}`}>{aforoActual}</span>
            <span className="aforo-separador">/</span>
            <span className="aforo-maximo">{aforoMaximo}</span>
          </div>
          <div className="aforo-barra">
            <div 
              className={`aforo-fill ${getAforoColor()}`} 
              style={{ width: `${getAforoPorcentaje()}%` }}
            ></div>
          </div>
          <p className="aforo-mensaje">
            {getAforoColor() === 'verde' && 'Hay lugares disponibles'}
            {getAforoColor() === 'naranja' && 'Aforo casi lleno'}
            {getAforoColor() === 'rojo' && 'Aforo lleno, intenta más tarde'}
          </p>
        </div>
        <div className="instructor-card">
          <img src={instructorLudoteca.foto} alt={instructorLudoteca.nombre} />
          <div>
            <strong>{instructorLudoteca.nombre}</strong>
            <span>Encargada Turno {instructorLudoteca.turno}</span>
            <span>{instructorLudoteca.horaInicio} - {instructorLudoteca.horaFin}</span>
          </div>
        </div>
      </div>

      {/* ==================== TABS ==================== */}
      <div className="clases-tabs-container">
        <button 
          className={`clases-tab-btn ${vista === 'mis-hijos' ? 'active' : ''}`}
          onClick={() => setVista('mis-hijos')}
        >
          <Users size={18} /> Mis Hijos ({misHijos.length})
        </button>
        <button 
          className={`clases-tab-btn ${vista === 'reservar' ? 'active' : ''}`}
          onClick={() => setVista('reservar')}
        >
          <Calendar size={18} /> Reservar
        </button>
        <button 
          className={`clases-tab-btn ${vista === 'historial' ? 'active' : ''}`}
          onClick={() => setVista('historial')}
        >
          <Clock size={18} /> Historial
        </button>
      </div>

      {/* ==================== VISTA: MIS HIJOS ==================== */}
      {vista === 'mis-hijos' && (
        <div className="mis-hijos-view">
          <div className="header-actions">
            <h3>Hijos Registrados</h3>
            <button className="btn-agregar" onClick={() => setShowModalAgregar(true)}>
              <Plus size={18} /> Agregar Hijo
            </button>
          </div>

          {loading ? (
            <div className="loading-state">Cargando...</div>
          ) : (
            <div className="hijos-grid">
              {misHijos.map(hijo => (
                <div key={hijo.id} className="hijo-card">
                  <div className="hijo-header">
                    <img src={hijo.foto} alt={hijo.nombre} className="hijo-foto" />
                    <div className="hijo-info">
                      <h4>{hijo.nombre}</h4>
                      <span className="hijo-edad">{hijo.edad} años</span>
                    </div>
                    <span className={`hijo-status ${hijo.activo ? 'activo' : 'inactivo'}`}>
                      {hijo.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {tiempoEstancia[hijo.id] && (
                    <div className={`tiempo-estancia ${getAlertaTiempo(tiempoEstancia[hijo.id])}`}>
                      <Clock size={16} />
                      <span>Tiempo en ludoteca: {formatTiempo(tiempoEstancia[hijo.id])}</span>
                      {getAlertaTiempo(tiempoEstancia[hijo.id]) === 'advertencia' && (
                        <AlertIcon size={16} />
                      )}
                      {getAlertaTiempo(tiempoEstancia[hijo.id]) === 'critico' && (
                        <span className="tiempo-alerta">¡Límite cercano!</span>
                      )}
                    </div>
                  )}

                  {hijo.alergias && hijo.alergias.length > 0 && (
                    <div className="hijo-alergias">
                      <Heart size={14} />
                      <div>
                        <strong>Alergias:</strong>
                        <span>{hijo.alergias.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {hijo.cuidadosEspeciales && (
                    <div className="hijo-cuidados">
                      <Shield size={14} />
                      <div>
                        <strong>Cuidados:</strong>
                        <span>{hijo.cuidadosEspeciales}</span>
                      </div>
                    </div>
                  )}

                  <div className="hijo-qr">
                    <QrCode size={16} />
                    <span>QR: {hijo.qrCode}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Familiares autorizados */}
          <div className="familiares-section">
            <h3>Personas Autorizadas para Recoger</h3>
            <div className="familiares-list">
              {familiaresAutorizados.map(fam => (
                <div key={fam.id} className="familiar-card">
                  <UserPlus size={20} />
                  <div>
                    <strong>{fam.nombre}</strong>
                    <span>{fam.parentesco}</span>
                    <span>{fam.telefono}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== VISTA: RESERVAR ==================== */}
      {vista === 'reservar' && (
        <div className="reservar-view">
          <div className="reservar-info-card">
            <Info size={24} />
            <div>
              <h4>Cómo funciona</h4>
              <p>Para usar la ludoteca, presenta tu QR en recepción al dejar a tu hijo. El sistema registrará automáticamente el check-in y check-out.</p>
            </div>
          </div>

          <div className="instrucciones-card">
            <h4>Pasos para el check-in:</h4>
            <ol>
              <li>Acude a recepción con tu hijo y tu QR disponible</li>
              <li>El recepcionista escaneará tu código</li>
              <li>Recibirás una confirmación de entrada</li>
              <li>Al recoger, vuelve a recepción para el check-out</li>
            </ol>
          </div>

          <button className="btn-reservar-qr" onClick={() => setShowModalQR(true)}>
            <QrCode size={24} /> Mostrar Mi QR
          </button>
        </div>
      )}

      {/* ==================== VISTA: HISTORIAL ==================== */}
      {vista === 'historial' && (
        <div className="historial-view">
          <h3>Historial de Visitas</h3>
          <div className="historial-list">
            {historialData.map(item => (
              <div key={item.id} className="historial-item">
                <div className="historial-fecha">
                  <span className="dia">{item.fecha.split('-')[2]}</span>
                  <span className="mes">Abr</span>
                </div>
                <div className="historial-detalles">
                  <h4>{item.hijo}</h4>
                  <p><Clock size={14} /> {item.horaEntrada} - {item.horaSalida} ({item.duracion})</p>
                  <p><UserPlus size={14} /> {item.instructor}</p>
                </div>
                <span className="historial-status completado">
                  <CheckCircle size={16} /> Completado
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== MODAL: QR ==================== */}
      {showModalQR && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-qr">
            <header className="modal-header">
              <h3>Mi Código QR</h3>
              <button className="close-btn" onClick={() => setShowModalQR(false)}>&times;</button>
            </header>
            <div className="modal-body text-center">
              <div className="qr-display">
                <QrCode size={200} />
              </div>
              <p className="qr-instruccion">
                Presenta este código en recepción para el check-in/check-out de tus hijos
              </p>
              <div className="qr-codigo">
                <strong>Código: </strong>QR-SOCIO-001
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: AGREGAR HIJO ==================== */}
      {showModalAgregar && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <header className="modal-header">
              <h3>Agregar Hijo</h3>
              <button className="close-btn" onClick={() => setShowModalAgregar(false)}>&times;</button>
            </header>
            <div className="modal-body">
              <form className="form-agregar-hijo">
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input type="text" placeholder="Nombre del menor" />
                </div>
                <div className="form-group">
                  <label>Fecha de nacimiento</label>
                  <input type="date" />
                </div>
                <div className="form-group">
                  <label>Alergias (separadas por coma)</label>
                  <input type="text" placeholder="Ej: Maní, Polen" />
                </div>
                <div className="form-group">
                  <label>Cuidados especiales</label>
                  <textarea placeholder="Describe cualquier cuidado especial..."></textarea>
                </div>
              </form>
            </div>
            <footer className="modal-footer">
              <button className="modal-btn confirm" onClick={() => setShowModalAgregar(false)}>
                Guardar
              </button>
              <button className="modal-btn cancel" onClick={() => setShowModalAgregar(false)}>
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      )}

    </SocioLayout>
  )
}

export default Ludoteca