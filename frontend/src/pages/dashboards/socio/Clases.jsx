import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import { 
  Calendar, Clock, User, Users, Search, Filter, 
  AlertCircle, CheckCircle, XCircle, ChevronDown,
  MapPin, Zap, Info, BookOpen, Timer
} from 'lucide-react'
import '../../../../css/socio/Clases.css'

// Constante para mapeo de días
const DIAS_SEMANA = [
  { valor: 1, nombre: 'Lunes' },
  { valor: 2, nombre: 'Martes' },
  { valor: 3, nombre: 'Miércoles' },
  { valor: 4, nombre: 'Jueves' },
  { valor: 5, nombre: 'Viernes' },
  { valor: 6, nombre: 'Sábado' },
  { valor: 7, nombre: 'Domingo' }
]

function Clases() {
  // Obtener datos del usuario desde localStorage
  const usuarioSesion = localStorage.getItem('usuario')
  const usuario = usuarioSesion ? JSON.parse(usuarioSesion) : null
  const userName = usuario?.nombre || "Socio"
  const socioId = usuario?.socio_id

  // ==================== ESTADOS ====================
  const [vista, setVista] = useState('catalogo') // 'mis-clases' | 'catalogo'
  const [misClases, setMisClases] = useState([])
  const [catalogoClases, setCatalogoClases] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Listas para filtros (cargadas desde BD)
  const [disciplinas, setDisciplinas] = useState([])
  const [instructores, setInstructores] = useState([])
  
  // Filtros del catálogo
  const [filtros, setFiltros] = useState({
    disciplina: '',
    dia: '',
    instructor: ''
  })
  
  // Modal de inscripción
  const [claseSeleccionada, setClaseSeleccionada] = useState(null)
  const [showModalInscripcion, setShowModalInscripcion] = useState(false)
  const [showModalConfirmacion, setShowModalConfirmacion] = useState(false)
  
  // Modal de baja
  const [claseABaja, setClaseABaja] = useState(null)
  const [showModalBaja, setShowModalBaja] = useState(false)

  // ==================== API BASE URL ====================
  const API_BASE = 'http://localhost:3000/api'

  // ==================== EFECTOS ====================
  
  // Cargar listas para filtros (disciplinas e instructores)
  useEffect(() => {
    const fetchListas = async () => {
      try {
        // Cargar disciplinas
        const discRes = await fetch(`${API_BASE}/disciplinas`)
        const discData = await discRes.json()
        setDisciplinas(discData)
        
        // Cargar instructores con datos del usuario
        const instRes = await fetch(`${API_BASE}/instructores`)
        const instData = await instRes.json()
        setInstructores(instData)
      } catch (error) {
        console.error('Error cargando listas:', error)
      }
    }
    fetchListas()
  }, [])

  // Cargar clases inscritas del socio (Mis Clases)
  useEffect(() => {
    const fetchMisClases = async () => {
      if (vista !== 'mis-clases') return
      
      setLoading(true)
      try {
        // Obtener socioId del usuario en localStorage
        const usuarioSesion = localStorage.getItem('usuario')
        const usuarioData = usuarioSesion ? JSON.parse(usuarioSesion) : null
        const socioId = usuarioData?.id || usuarioData?.socio_id
        
        if (!socioId) {
          console.warn('No se encontró ID del socio')
          setMisClases([])
          setLoading(false)
          return
        }
        
        const response = await fetch(`${API_BASE}/inscripciones/mis-inscripciones?socioId=${socioId}`)
        const data = await response.json()
        
        // Transformar datos al formato de la UI
        const misClasesTransformadas = data.map(inscripcion => ({
          id: inscripcion.inscripcion_id,
          sesion_id: inscripcion.sesion_id,
          nombre: inscripcion.disciplina,
          disciplina: inscripcion.disciplina,
          instructor: inscripcion.instructor || 'Por asignar',
          instructorFoto: `https://i.pravatar.cc/150?img=1`,
          horario: `${inscripcion.hora_inicio?.slice(0, 5)} - ${inscripcion.hora_fin?.slice(0, 5)}`,
          dias: getNombreDia(inscripcion.dia_semana),
          salon: inscripcion.espacio,
          estatus: 'confirmado',
          materiales: 'Ropa deportiva, toalla, agua',
          intensidad: 'Media',
          duracion: calcularDuracion(inscripcion.hora_inicio, inscripcion.hora_fin)
        }))
        
        setMisClases(misClasesTransformadas)
      } catch (error) {
        console.error('Error cargando mis clases:', error)
        setMisClases([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchMisClases()
  }, [vista])

  // Cargar catálogo de clases desde la API
  useEffect(() => {
    const fetchCatalogo = async () => {
      setLoading(true)
      try {
        // Construir query params
        const params = new URLSearchParams()
        if (filtros.disciplina) params.append('disciplina', filtros.disciplina)
        if (filtros.dia) params.append('dia', filtros.dia)
        if (filtros.instructor) params.append('instructor', filtros.instructor)
        
        const queryString = params.toString()
        const url = queryString 
          ? `${API_BASE}/sesiones?${queryString}` 
          : `${API_BASE}/sesiones`
        
        const response = await fetch(url)
        const data = await response.json()
        
        // Transformar datos de la BD al formato de la UI
        const clasesTransformadas = data.map(sesion => ({
          id: sesion.sesion_id,
          sesion_id: sesion.sesion_id,
          nombre: sesion.disciplina, // Título: Nombre de la disciplina
          disciplina: sesion.disciplina,
          instructor: sesion.instructor || 'Por asignar',
          instructorFoto: `https://i.pravatar.cc/150?img=${(sesion.instructor_id % 10) + 1}`,
          horario: `${sesion.hora_inicio?.slice(0, 5)} - ${sesion.hora_fin?.slice(0, 5)}`,
          dias: getNombreDia(sesion.dia_semana),
          dia_semana: sesion.dia_semana,
          salon: sesion.espacio, // Ubicación: Nombre del espacio
          cupos: {
              total: sesion.cupo_maximo || 20,
              // CAMBIO: Usar 'inscritos_actuales' que es el nombre que pusimos en el SQL
              disponibles: (sesion.cupo_maximo || 20) - (parseInt(sesion.inscritos_actuales) || 0)
          },
          duracion: calcularDuracion(sesion.hora_inicio, sesion.hora_fin),
          intensidad: 'Media',
          descripcion: `Clase de ${sesion.disciplina} impartida por ${sesion.instructor || 'instructor por asignar'}`,
          materiales: 'Ropa deportiva, toalla, agua',
          instructor_id: sesion.instructor_id,
          espacio_id: sesion.espacio_id,
          disciplina_id: sesion.disciplina_id
        }))
        
        setCatalogoClases(clasesTransformadas)
      } catch (error) {
        console.error('Error cargando catálogo:', error)
        // Fallback: datos vacíos
        setCatalogoClases([])
      } finally {
        setLoading(false)
      }
    }
    
    // Solo cargar catálogo cuando estamos en esa vista
    if (vista === 'catalogo') {
      fetchCatalogo()
    }
  }, [vista, filtros])

  // ==================== HELPERS ====================
  const getNombreDia = (diaSemana) => {
    const dia = DIAS_SEMANA.find(d => d.valor === diaSemana)
    return dia ? dia.nombre : 'Por definir'
  }

  const calcularDuracion = (horaInicio, horaFin) => {
    if (!horaInicio || !horaFin) return '60 min'
    try {
      const [h1, m1] = horaInicio.split(':').map(Number)
      const [h2, m2] = horaFin.split(':').map(Number)
      const minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
      if (minutos >= 60) {
        return `${Math.floor(minutos / 60)}h ${minutos % 60 > 0 ? minutos % 60 + 'min' : ''}`
      }
      return `${minutos} min`
    } catch {
      return '60 min'
    }
  }

  // ==================== HANDLERS ====================
  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
  }

  const handleLimpiarFiltros = () => {
    setFiltros({ disciplina: '', dia: '', instructor: '' })
  }

  const handleInscribirse = (clase) => {
    setClaseSeleccionada(clase)
    setShowModalInscripcion(true)
  }

  // Función para inscribir al socio en una clase
  const handleInscripcion = async (sesionId) => {
    // Obtener socioId del usuario en localStorage
    const usuarioSesion = localStorage.getItem('usuario')
    const usuarioData = usuarioSesion ? JSON.parse(usuarioSesion) : null
    const socioId = usuarioData?.id;
    
    if (!socioId) {
    console.error("No se encontró el ID del usuario. ¿Iniciaste sesión?");
    return { success: false, message: "Error de sesión: ID no encontrado" };
}
    console.log("Inscribiendo al socio real:", socioId);
    try {
      const response = await fetch(`${API_BASE}/inscripciones/inscribir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sesionId: sesionId,
          socioId: socioId
        })
      })
      
      const data = await response.json()
      
      if (response.status === 201) {
        // Éxito: actualizar el contador de inscritos en el estado
          setCatalogoClases(prev => prev.map(clase => 
            clase.sesion_id === sesionId 
              ? { 
                  ...clase, 
                  // Sumamos 1 al contador de inscritos actuales
                  inscritos_actuales: parseInt(clase.inscritos_actuales) + 1 
                } 
              : clase
          ))
        return { success: true, message: data.message }
      } else {
        // Error: clase llena o ya inscrito
        return { success: false, message: data.error }
      }
    } catch (error) {
      console.error('Error en inscripción:', error)
      return { success: false, message: 'Error de conexión' }
    }
  }

  const handleConfirmarInscripcion = async () => {
    if (!claseSeleccionada) return
    
    // Mostrar estado de carga
    const btnConfirm = document.querySelector('.modal-btn.confirm')
    if (btnConfirm) {
      btnConfirm.disabled = true
      btnConfirm.textContent = 'Inscribiendo...'
    }
    
    const result = await handleInscripcion(claseSeleccionada.sesion_id)
    
    if (result.success) {
      setShowModalInscripcion(false)
      setShowModalConfirmacion(true)
      // Recargar mis clases después de una inscripción exitosa
      setTimeout(() => {
        const fetchMisClases = async () => {
          try {
            const usuarioSesion = localStorage.getItem('usuario')
            const usuarioData = usuarioSesion ? JSON.parse(usuarioSesion) : null
            const socioId = usuarioData?.id || usuarioData?.socio_id
            
            if (socioId) {
              const response = await fetch(`${API_BASE}/inscripciones/mis-inscripciones?socioId=${socioId}`)
              const data = await response.json()
              
              const misClasesTransformadas = data.map(inscripcion => ({
                id: inscripcion.inscripcion_id,
                sesion_id: inscripcion.sesion_id,
                nombre: inscripcion.disciplina,
                disciplina: inscripcion.disciplina,
                instructor: inscripcion.instructor || 'Por asignar',
                instructorFoto: `https://i.pravatar.cc/150?img=1`,
                horario: `${inscripcion.hora_inicio?.slice(0, 5)} - ${inscripcion.hora_fin?.slice(0, 5)}`,
                dias: getNombreDia(inscripcion.dia_semana),
                salon: inscripcion.espacio,
                estatus: 'confirmado',
                materiales: 'Ropa deportiva, toalla, agua',
                intensidad: 'Media',
                duracion: calcularDuracion(inscripcion.hora_inicio, inscripcion.hora_fin)
              }))
              
              setMisClases(misClasesTransformadas)
            }
          } catch (error) {
            console.error('Error recargando mis clases:', error)
          }
        }
        fetchMisClases()
      }, 500)
    } else {
      alert(result.message)
    }
    
    // Restaurar botón
    if (btnConfirm) {
      btnConfirm.disabled = false
      btnConfirm.textContent = 'Confirmar Inscripción'
    }
  }

  const handleCancelarInscripcion = (clase) => {
    setClaseABaja(clase)
    setShowModalBaja(true)
  }

  const handleConfirmarBaja = async () => {
    try {
      // Obtener socioId del usuario en localStorage
      const usuarioSesion = localStorage.getItem('usuario')
      const usuarioData = usuarioSesion ? JSON.parse(usuarioSesion) : null
      const socioId = usuarioData?.id || usuarioData?.socio_id
      
      if (!socioId) {
        alert('Error de sesión')
        return
      }
      
      const response = await fetch(`${API_BASE}/inscripciones/cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sesionId: claseABaja.sesion_id,
          socioId: socioId
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Eliminar la clase de la lista local
        setMisClases(prev => prev.filter(c => c.id !== claseABaja.id))
        setShowModalBaja(false)
      } else {
        alert(data.error || 'Error al cancelar')
      }
    } catch (error) {
      console.error('Error en baja:', error)
      alert('Error de conexión')
    }
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
    if (!cupos) {
      return <span className="badge-disponible">Consultar</span>
    }
    const { total, disponibles } = cupos
    const porcentaje = total > 0 ? disponibles / total : 0
    if (disponibles === 0) {
      return <span className="badge-lleno"><XCircle size={14} /> Lleno</span>
    } else if (porcentaje <= 0.15) {
      return <span className="badge-casi-lleno"><AlertCircle size={14} /> Casi lleno ({disponibles})</span>
    } else {
      return <span className="badge-disponible">{disponibles} de {total}</span>
    }
  }

  // El catálogo ya viene filtrado del backend
  const catalogoFiltrado = catalogoClases

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
                {disciplinas.map(d => <option key={d.disciplina_id} value={d.nombre}>{d.nombre}</option>)}
              </select>
            </div>
            
            <div className="filtro-group">
              <label><Calendar size={16} /> Día</label>
              <select 
                value={filtros.dia}
                onChange={(e) => handleFiltroChange('dia', e.target.value)}
              >
                <option value="">Todos</option>
                {DIAS_SEMANA.map(d => <option key={d.valor} value={d.valor}>{d.nombre}</option>)}
              </select>
            </div>
            
            <div className="filtro-group">
              <label><User size={16} /> Instructor</label>
              <select 
                value={filtros.instructor}
                onChange={(e) => handleFiltroChange('instructor', e.target.value)}
              >
                <option value=" ">Todos</option>
                {instructores.map(i => <option key={i.instructor_id} value={i.nombre}>{i.nombre}</option>)}
              </select>
            </div>

            {(filtros.disciplina || filtros.dia || filtros.instructor) && (
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
                  <span className="clase-nivel">{clase.dias}</span>
                  {getCupoIndicator(clase.cupos)}
                </div>
                
                <h3 className="clase-nombre">{clase.nombre}</h3>
                <p className="clase-descripcion">{clase.descripcion}</p>
                
                <div className="clase-instructor">
                  <img src={clase.instructorFoto} alt={clase.instructor} className="instructor-foto" />
                  <span>{clase.instructor || "Por asignar"}</span>
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
                  className={`btn-inscribirse ${clase.cupos?.disponibles === 0 ? 'disabled' : ''}`}
                  onClick={() => handleInscribirse(clase)}
                  disabled={clase.cupos?.disponibles === 0}
                >
                  {clase.cupos?.disponibles === 0 ? 'Clase Llena' : <><Zap size={16} /> Inscribirme</>}
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