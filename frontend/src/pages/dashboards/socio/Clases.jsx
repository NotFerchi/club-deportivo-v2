import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import { 
  Calendar, Clock, User, Users, Search, Filter, 
  AlertCircle, CheckCircle, XCircle, ChevronDown,
  MapPin, Zap, Info, BookOpen, Timer
} from 'lucide-react'
import '../../../../css/socio/Clases.css'

function Clases() {
  // Obtener datos del usuario desde localStorage
  const usuarioSesion = localStorage.getItem('usuario')
  const usuario = usuarioSesion ? JSON.parse(usuarioSesion) : null
  const userName = usuario?.nombre || "Socio"
  const socioId = usuario?.socio_id

  // ==================== ESTADOS ====================
  const [vista, setVista] = useState('mis-clases') // 'mis-clases' | 'catalogo'
  const [misClases, setMisClases] = useState([])
  const [catalogoClases, setCatalogoClases] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filtros del catálogo
  const [filtros, setFiltros] = useState({
    disciplina: '',
    nivel: '',
    instructor: ''
  })
  
  // Modal de inscripción
  const [claseSeleccionada, setClaseSeleccionada] = useState(null)
  const [showModalInscripcion, setShowModalInscripcion] = useState(false)
  const [showModalConfirmacion, setShowModalConfirmacion] = useState(false)
  
  // Modal de baja
  const [claseABaja, setClaseABaja] = useState(null)
  const [showModalBaja, setShowModalBaja] = useState(false)

  // ==================== DATOS HARDCODEADOS ====================
  const disciplinas = ['Natación', 'Zumba', 'Tenis', 'Yoga', 'Pilates', 'Box', 'Spinning', 'Funcional']
  const niveles = ['Principiante', 'Intermedio', 'Avanzado']
  
  const instructores = [
    { id: 1, nombre: 'María González', foto: 'https://i.pravatar.cc/150?img=1', especialidad: 'Natación' },
    { id: 2, nombre: 'Carlos Ruiz', foto: 'https://i.pravatar.cc/150?img=2', especialidad: 'Zumba' },
    { id: 3, nombre: 'Ana López', foto: 'https://i.pravatar.cc/150?img=3', especialidad: 'Yoga' },
    { id: 4, nombre: 'Pedro Sánchez', foto: 'https://i.pravatar.cc/150?img=4', especialidad: 'Tenis' },
    { id: 5, nombre: 'Laura Martínez', foto: 'https://i.pravatar.cc/150?img=5', especialidad: 'Pilates' },
  ]

  // Mis clases inscritas (hardcodeado para demo)
  const misClasesData = [
    {
      id: 1,
      clase_id: 101,
      nombre: 'Yoga Matutino',
      disciplina: 'Yoga',
      instructor: 'Ana López',
      instructorFoto: 'https://i.pravatar.cc/150?img=3',
      horario: '07:00 - 08:00',
      dias: 'Lun, Mie, Vie',
      salon: 'Salón A',
      estatus: 'confirmado', // confirmado | pendiente | cambio
      materiales: 'Tapete, toalla, agua',
      intensidad: 'Media',
      duracion: '60 min'
    },
    {
      id: 2,
      clase_id: 102,
      nombre: 'Zumba Intenso',
      disciplina: 'Zumba',
      instructor: 'Carlos Ruiz',
      instructorFoto: 'https://i.pravatar.cc/150?img=2',
      horario: '09:00 - 10:00',
      dias: 'Mar, Jue, Vie',
      salon: 'Salón B',
      estatus: 'confirmado',
      materiales: 'Tenis, agua, ropa deportiva',
      intensidad: 'Alta',
      duracion: '60 min'
    },
    {
      id: 3,
      clase_id: 103,
      nombre: 'Natación Avanzada',
      disciplina: 'Natación',
      instructor: 'María González',
      instructorFoto: 'https://i.pravatar.cc/150?img=1',
      horario: '18:00 - 19:00',
      dias: 'Lun, Mie',
      salon: 'Alberca',
      estatus: 'cambio', // Ejemplo de cambio de instructor
      materiales: 'Traje de baño, goggles, toalla',
      intensidad: 'Alta',
      duracion: '60 min'
    }
  ]

  // Catálogo de clases disponibles
  const catalogoData = [
    {
      id: 201,
      nombre: 'Yoga para Principiantes',
      disciplina: 'Yoga',
      nivel: 'Principiante',
      instructor: 'Ana López',
      instructorFoto: 'https://i.pravatar.cc/150?img=3',
      horario: '08:00 - 09:00',
      dias: 'Lun, Mie, Vie',
      salon: 'Salón A',
      cupos: { total: 20, disponibles: 15 },
      duracion: '60 min',
      intensidad: 'Baja',
      descripcion: 'Clase ideal para quienes inician en el mundo del yoga. Enfoque en posturas básicas y respiración.',
      materiales: 'Tapete, toalla, agua'
    },
    {
      id: 202,
      nombre: 'Zumba Fitness',
      disciplina: 'Zumba',
      nivel: 'Intermedio',
      instructor: 'Carlos Ruiz',
      instructorFoto: 'https://i.pravatar.cc/150?img=2',
      horario: '10:00 - 11:00',
      dias: 'Mar, Jue',
      salon: 'Salón B',
      cupos: { total: 25, disponibles: 3 }, // Casi lleno
      duracion: '60 min',
      intensidad: 'Alta',
      descripcion: 'Bailes contagiosos con música latina para quemar calorías divirtiéndote.',
      materiales: 'Tenis, agua, ropa deportiva'
    },
    {
      id: 203,
      nombre: 'Tenis Intermedio',
      disciplina: 'Tenis',
      nivel: 'Intermedio',
      instructor: 'Pedro Sánchez',
      instructorFoto: 'https://i.pravatar.cc/150?img=4',
      horario: '16:00 - 17:30',
      dias: 'Lun, Mie',
      salon: 'Cancha 1',
      cupos: { total: 4, disponibles: 0 }, // Lleno
      duracion: '90 min',
      intensidad: 'Media',
      descripcion: 'Mejora tu técnica con ejercicios de golpeo y juegos tácticos.',
      materiales: 'Raqueta, pelotas, agua'
    },
    {
      id: 204,
      nombre: 'Pilates Reformer',
      disciplina: 'Pilates',
      nivel: 'Avanzado',
      instructor: 'Laura Martínez',
      instructorFoto: 'https://i.pravatar.cc/150?img=5',
      horario: '19:00 - 20:00',
      dias: 'Mar, Jue, Vie',
      salon: 'Salón C',
      cupos: { total: 12, disponibles: 8 },
      duracion: '60 min',
      intensidad: 'Media',
      descripcion: 'Ejercicios en máquina reformer para fortalecer core y mejorar postura.',
      materiales: 'Ropa cómoda, calcetines, agua'
    },
    {
      id: 205,
      nombre: 'Natación para Bebés',
      disciplina: 'Natación',
      nivel: 'Principiante',
      instructor: 'María González',
      instructorFoto: 'https://i.pravatar.cc/150?img=1',
      horario: '09:00 - 09:45',
      dias: 'Sáb',
      salon: 'Alberca',
      cupos: { total: 10, disponibles: 2 }, // Casi lleno
      duracion: '45 min',
      intensidad: 'Baja',
      descripcion: 'Clase acuática para bebés de 6 meses a 3 años con acompañante.',
      materiales: 'Traje de baño para bebé y acompañante, toalla'
    },
    {
      id: 206,
      nombre: 'Box Funcional',
      disciplina: 'Box',
      nivel: 'Intermedio',
      instructor: 'Carlos Ruiz',
      instructorFoto: 'https://i.pravatar.cc/150?img=2',
      horario: '20:00 - 21:00',
      dias: 'Lun, Mie',
      salon: 'Ring',
      cupos: { total: 20, disponibles: 18 },
      duracion: '60 min',
      intensidad: 'Alta',
      descripcion: 'Entrenamiento de boxeo combinado con ejercicios funcionales.',
      materiales: 'Guantes de box (opcional), toalla, agua'
    }
  ]

  // ==================== EFECTOS ====================
  useEffect(() => {
    // Simular carga de datos
    setLoading(true)
    setTimeout(() => {
      setMisClases(misClasesData)
      setCatalogoClases(catalogoData)
      setLoading(false)
    }, 500)
  }, [])

  // ==================== HANDLERS ====================
  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
  }

  const handleLimpiarFiltros = () => {
    setFiltros({ disciplina: '', nivel: '', instructor: '' })
  }

  const handleInscribirse = (clase) => {
    setClaseSeleccionada(clase)
    setShowModalInscripcion(true)
  }

  const handleConfirmarInscripcion = () => {
    // Aquí iría la llamada a la API
    console.log('Inscripción confirmada para:', claseSeleccionada.nombre)
    setShowModalInscripcion(false)
    setShowModalConfirmacion(true)
  }

  const handleCancelarInscripcion = (clase) => {
    setClaseABaja(clase)
    setShowModalBaja(true)
  }

  const handleConfirmarBaja = () => {
    // Aquí iría la llamada a la API
    console.log('Baja confirmada para:', claseABaja.nombre)
    setMisClases(prev => prev.filter(c => c.id !== claseABaja.id))
    setShowModalBaja(false)
  }

  const getEstatusBadge = (estatus) => {
    switch (estatus) {
      case 'confirmado':
        return <span className="badge-confirmado"><CheckCircle size={14} /> Confirmado</span>
      case 'pendiente':
        return <span className="badge-pendiente"><AlertCircle size={14} /> Pendiente</span>
      case 'cambio':
        return <span className="badge-cambio"><AlertCircle size={14} /> Cambio</span>
      default:
        return null
    }
  }

  const getCupoIndicator = (cupos) => {
    const porcentaje = cupos.disponibles / cupos.total
    if (cupos.disponibles === 0) {
      return <span className="badge-lleno"><XCircle size={14} /> Lleno</span>
    } else if (porcentaje <= 0.15) {
      return <span className="badge-casi-lleno"><AlertCircle size={14} /> Casi lleno ({cupos.disponibles})</span>
    } else {
      return <span className="badge-disponible">{cupos.disponibles} de {cupos.total}</span>
    }
  }

  // Filtrar catálogo
  const catalogoFiltrado = catalogoClases.filter(clase => {
    if (filtros.disciplina && clase.disciplina !== filtros.disciplina) return false
    if (filtros.nivel && clase.nivel !== filtros.nivel) return false
    if (filtros.instructor && clase.instructor !== filtros.instructor) return false
    return true
  })

  return (
    <SocioLayout activeTab="clases" title="Club Social | Mis Clases">
      
      {/* ==================== HEADER DE VISTA ==================== */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Clases y Actividades</h2>
          <p className="rs-subtitle">Gestiona tus clases inscritas o explora nuevas opciones</p>
        </div>
        <div className="rs-status-tags">
          <span className="tag-category">Socio: {userName}</span>
        </div>
      </section>

      {/* ==================== TABS DE NAVEGACIÓN ==================== */}
      <div className="clases-tabs-container">
        <button 
          className={`clases-tab-btn ${vista === 'mis-clases' ? 'active' : ''}`}
          onClick={() => setVista('mis-clases')}
        >
          <BookOpen size={18} /> Mis Clases ({misClases.length})
        </button>
        <button 
          className={`clases-tab-btn ${vista === 'catalogo' ? 'active' : ''}`}
          onClick={() => setVista('catalogo')}
        >
          <Search size={18} /> Explorar Catálogo
        </button>
      </div>

      {/* ==================== VISTA: MIS CLASES ==================== */}
      {vista === 'mis-clases' && (
        <div className="mis-clases-view">
          {loading ? (
            <div className="loading-state">Cargando tus clases...</div>
          ) : misClases.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <h3>No tienes clases inscritas</h3>
              <p>Explora el catálogo para encontrar clases que te interesen</p>
              <button className="btn-primary" onClick={() => setVista('catalogo')}>
                Ver Catálogo
              </button>
            </div>
          ) : (
            <div className="mis-clases-grid">
              {misClases.map(clase => (
                <div key={clase.id} className="mi-clase-card">
                  <div className="mi-clase-header">
                    <span className="clase-disciplina">{clase.disciplina}</span>
                    {getEstatusBadge(clase.estatus)}
                  </div>
                  
                  <h3 className="mi-clase-nombre">{clase.nombre}</h3>
                  
                  <div className="mi-clase-info">
                    <div className="info-row">
                      <User size={16} />
                      <span>{clase.instructor}</span>
                    </div>
                    <div className="info-row">
                      <Clock size={16} />
                      <span>{clase.horario} - {clase.dias}</span>
                    </div>
                    <div className="info-row">
                      <MapPin size={16} />
                      <span>{clase.salon}</span>
                    </div>
                    <div className="info-row">
                      <Timer size={16} />
                      <span>{clase.duracion} - Intensidad {clase.intensidad}</span>
                    </div>
                  </div>

                  <div className="mi-clase-materiales">
                    <Info size={14} />
                    <span>Materiales: {clase.materiales}</span>
                  </div>

                  <button 
                    className="btn-baja-clase"
                    onClick={() => handleCancelarInscripcion(clase)}
                  >
                    Cancelar Inscripción
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== VISTA: CATÁLOGO ==================== */}
      {vista === 'catalogo' && (
        <div className="catalogo-view">
          {/* Filtros */}
          <div className="filtros-container">
            <div className="filtro-group">
              <label><Filter size={16} /> Disciplina</label>
              <select 
                value={filtros.disciplina}
                onChange={(e) => handleFiltroChange('disciplina', e.target.value)}
              >
                <option value="">Todas</option>
                {disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            
            <div className="filtro-group">
              <label><Users size={16} /> Nivel</label>
              <select 
                value={filtros.nivel}
                onChange={(e) => handleFiltroChange('nivel', e.target.value)}
              >
                <option value="">Todos</option>
                {niveles.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            
            <div className="filtro-group">
              <label><User size={16} /> Instructor</label>
              <select 
                value={filtros.instructor}
                onChange={(e) => handleFiltroChange('instructor', e.target.value)}
              >
                <option value="">Todos</option>
                {instructores.map(i => <option key={i.id} value={i.nombre}>{i.nombre}</option>)}
              </select>
            </div>

            {(filtros.disciplina || filtros.nivel || filtros.instructor) && (
              <button className="btn-limpiar-filtros" onClick={handleLimpiarFiltros}>
                Limpiar Filtros
              </button>
            )}
          </div>

          {/* Grid de clases */}
          <div className="catalogo-grid">
            {catalogoFiltrado.map(clase => (
              <div key={clase.id} className="clase-card">
                <div className="clase-card-header">
                  <span className="clase-nivel">{clase.nivel}</span>
                  {getCupoIndicator(clase.cupos)}
                </div>
                
                <h3 className="clase-nombre">{clase.nombre}</h3>
                <p className="clase-descripcion">{clase.descripcion}</p>
                
                <div className="clase-instructor">
                  <img src={clase.instructorFoto} alt={clase.instructor} className="instructor-foto" />
                  <span>{clase.instructor}</span>
                </div>
                
                <div className="clase-detalles">
                  <div className="detalle-item">
                    <Clock size={14} />
                    <span>{clase.horario}</span>
                  </div>
                  <div className="detalle-item">
                    <Calendar size={14} />
                    <span>{clase.dias}</span>
                  </div>
                  <div className="detalle-item">
                    <MapPin size={14} />
                    <span>{clase.salon}</span>
                  </div>
                  <div className="detalle-item">
                    <Timer size={14} />
                    <span>{clase.duracion}</span>
                  </div>
                </div>

                <div className="clase-materiales">
                  <Info size={14} />
                  <span>{clase.materiales}</span>
                </div>

                <button 
                  className={`btn-inscribirse ${clase.cupos.disponibles === 0 ? 'disabled' : ''}`}
                  onClick={() => handleInscribirse(clase)}
                  disabled={clase.cupos.disponibles === 0}
                >
                  {clase.cupos.disponibles === 0 ? 'Clase Llena' : <><Zap size={16} /> Inscribirme</>}
                </button>
              </div>
            ))}
          </div>

          {catalogoFiltrado.length === 0 && (
            <div className="empty-state">
              <Search size={48} />
              <h3>No se encontraron clases</h3>
              <p>Intenta con otros filtros o limpia los actuales</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: FICHA TÉCNICA ==================== */}
      {showModalInscripcion && claseSeleccionada && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-ficha">
            <header className="modal-header">
              <h3>Confirmar Inscripción</h3>
              <button className="close-btn" onClick={() => setShowModalInscripcion(false)}>&times;</button>
            </header>
            
            <div className="modal-body">
              <div className="ficha-clase">
                <h2>{claseSeleccionada.nombre}</h2>
                <span className="ficha-disciplina">{claseSeleccionada.disciplina}</span>
                
                <div className="ficha-instructor">
                  <img src={claseSeleccionada.instructorFoto} alt={claseSeleccionada.instructor} />
                  <div>
                    <strong>{claseSeleccionada.instructor}</strong>
                    <span>Instructor</span>
                  </div>
                </div>

                <div className="ficha-detalles">
                  <div className="ficha-detalle">
                    <Clock size={18} />
                    <div>
                      <strong>Horario</strong>
                      <span>{claseSeleccionada.horario} - {claseSeleccionada.dias}</span>
                    </div>
                  </div>
                  <div className="ficha-detalle">
                    <MapPin size={18} />
                    <div>
                      <strong>Ubicación</strong>
                      <span>{claseSeleccionada.salon}</span>
                    </div>
                  </div>
                  <div className="ficha-detalle">
                    <Timer size={18} />
                    <div>
                      <strong>Duración</strong>
                      <span>{claseSeleccionada.duracion}</span>
                    </div>
                  </div>
                  <div className="ficha-detalle">
                    <Zap size={18} />
                    <div>
                      <strong>Intensidad</strong>
                      <span>{claseSeleccionada.intensidad}</span>
                    </div>
                  </div>
                </div>

                <div className="ficha-materiales">
                  <h4>Materiales necesarios:</h4>
                  <p>{claseSeleccionada.materiales}</p>
                </div>

                <div className="ficha-cupos">
                  <span>Lugares disponibles: </span>
                  <strong>{claseSeleccionada.cupos.disponibles} de {claseSeleccionada.cupos.total}</strong>
                </div>
              </div>
            </div>

            <footer className="modal-footer">
              <button className="modal-btn confirm" onClick={handleConfirmarInscripcion}>
                Confirmar Inscripción
              </button>
              <button className="modal-btn cancel" onClick={() => setShowModalInscripcion(false)}>
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONFIRMACIÓN ==================== */}
      {showModalConfirmacion && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-small">
            <header className="modal-header">
              <h3>¡Inscripción Exitosa!</h3>
            </header>
            <div className="modal-body text-center">
              <CheckCircle size={64} className="success-icon" />
              <p>Te has inscrito correctamente en <strong>{claseSeleccionada?.nombre}</strong></p>
              <p className="text-muted">Puedes ver tus clases inscritas en la pestaña "Mis Clases"</p>
            </div>
            <footer className="modal-footer">
              <button className="modal-btn confirm" onClick={() => {
                setShowModalConfirmacion(false)
                setVista('mis-clases')
              }}>
                Ver Mis Clases
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ==================== MODAL: BAJA ==================== */}
      {showModalBaja && claseABaja && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-small">
            <header className="modal-header">
              <h3>Cancelar Inscripción</h3>
              <button className="close-btn" onClick={() => setShowModalBaja(false)}>&times;</button>
            </header>
            <div className="modal-body text-center">
              <AlertCircle size={48} className="warning-icon" />
              <p>¿Estás seguro de que deseas cancelar tu inscripción a <strong>{claseABaja.nombre}</strong>?</p>
              <p className="text-muted">Liberarás tu lugar para otro socio</p>
            </div>
            <footer className="modal-footer">
              <button className="modal-btn confirm" onClick={handleConfirmarBaja}>
                Sí, Cancelar
              </button>
              <button className="modal-btn cancel" onClick={() => setShowModalBaja(false)}>
                Mantener Inscripción
              </button>
            </footer>
          </div>
        </div>
      )}

    </SocioLayout>
  )
}

export default Clases