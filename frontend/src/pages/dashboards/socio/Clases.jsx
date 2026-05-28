import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  Calendar, Clock, User, Search, Filter,
  AlertCircle, CheckCircle, XCircle,
  MapPin, Zap, Info, BookOpen, Timer
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import { useNotification } from '../../../context/NotificationContext'
import '../../../../css/socio/Clases.css'

// ── Avatar de instructor con iniciales ──────────────────────────────────────
const AVATAR_COLORES = [
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#dcfce7', color: '#166534' },
  { bg: '#ede9fe', color: '#5b21b6' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#e0f2fe', color: '#0369a1' },
  { bg: '#ffedd5', color: '#c2410c' },
  { bg: '#f0fdf4', color: '#15803d' },
]

function InstructorAvatar({ nombre, foto, size = 40 }) {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean)
  const iniciales = partes.length >= 2
    ? partes[0][0].toUpperCase() + partes[1][0].toUpperCase()
    : partes[0]?.[0]?.toUpperCase() || '?'

  const hash = (nombre || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const { bg, color } = AVATAR_COLORES[hash % AVATAR_COLORES.length]

  if (foto) {
    return (
      <img
        src={foto}
        alt={nombre || 'Instructor'}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: `2px solid ${color}40`,
        }}
      />
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: Math.round(size * 0.38), letterSpacing: '-0.5px',
      flexShrink: 0, border: `2px solid ${color}40`,
    }}>
      {iniciales}
    </div>
  )
}

// ── Constante para mapeo de días ────────────────────────────────────────────
// sesiones_programadas.dia_semana: Lun=1, Mar=2, Mié=3, Jue=4, Vie=5, Sáb=6, Dom=7
const DIAS_SEMANA = [
  { valor: 1, nombre: 'Lunes'      },
  { valor: 2, nombre: 'Martes'     },
  { valor: 3, nombre: 'Miércoles'  },
  { valor: 4, nombre: 'Jueves'     },
  { valor: 5, nombre: 'Viernes'    },
  { valor: 6, nombre: 'Sábado'     },
  { valor: 7, nombre: 'Domingo'    },
]

// ── Helpers puros (fuera del componente para evitar stale-closures) ─────────
function getNombreDia(diaSemana) {
  const dia = DIAS_SEMANA.find(d => d.valor === Number(diaSemana))
  return dia ? dia.nombre : 'Por definir'
}

function calcularDuracion(horaInicio, horaFin) {
  if (!horaInicio || !horaFin) return '60 min'
  try {
    const [h1, m1] = horaInicio.split(':').map(Number)
    const [h2, m2] = horaFin.split(':').map(Number)
    const minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (minutos >= 60) return `${Math.floor(minutos / 60)}h ${minutos % 60 > 0 ? minutos % 60 + 'min' : ''}`
    return `${minutos} min`
  } catch {
    return '60 min'
  }
}

function transformarInscripcion(i) {
  return {
    id: i.inscripcion_id,
    sesion_id: i.sesion_id,
    nombre: i.disciplina,
    disciplina: i.disciplina,
    instructor: i.instructor || 'Por asignar',
    instructor_foto: i.instructor_foto || null,
    horario: `${i.hora_inicio?.slice(0, 5)} - ${i.hora_fin?.slice(0, 5)}`,
    dias: getNombreDia(i.dia_semana),
    salon: i.espacio,
    estatus: 'confirmado',
    materiales: 'Ropa deportiva, toalla, agua',
    intensidad: 'Media',
    duracion: calcularDuracion(i.hora_inicio, i.hora_fin)
  }
}

// ── Componente principal ─────────────────────────────────────────────────────
function Clases() {
  const { toast } = useNotification()
  // Datos del usuario desde localStorage
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
  const userName = usuario?.nombres || usuario?.nombre || 'Socio'
  const socioId  = usuario?.socio_id   // ← siempre socio_id, nunca usuario_id

  // ── Estados ──────────────────────────────────────────────────────────────
  const [vista,             setVista]             = useState('catalogo')
  const [misClases,         setMisClases]         = useState([])
  const [misInscripcionIds, setMisInscripcionIds] = useState(new Set())  // Set<number> sesion_ids
  const [catalogoClases,    setCatalogoClases]    = useState([])
  const [loading,           setLoading]           = useState(true)
  const [saving,            setSaving]            = useState(false)

  // Listas para filtros
  const [disciplinas,  setDisciplinas]  = useState([])
  const [instructores, setInstructores] = useState([])

  // Filtros del catálogo
  const [filtros,    setFiltros]    = useState({ disciplinas: [], dias: [], instructores: [] })
  const [filtrosTmp, setFiltrosTmp] = useState({ disciplinas: [], dias: [], instructores: [] })
  const [showFiltros, setShowFiltros] = useState(false)

  // Modales
  const [claseSeleccionada,     setClaseSeleccionada]     = useState(null)
  const [showModalInscripcion,  setShowModalInscripcion]  = useState(false)
  const [showModalConfirmacion, setShowModalConfirmacion] = useState(false)
  const [feedbackModal,         setFeedbackModal]         = useState(null)  // { tipo, msg }
  const [claseABaja,    setClaseABaja]    = useState(null)
  const [showModalBaja, setShowModalBaja] = useState(false)

  // ── Función compartida: carga las inscripciones del socio ────────────────
  // Actualiza misClases Y misInscripcionIds. Llamada en mount y tras cada acción.
  async function fetchInscripciones() {
    if (!socioId) { setMisClases([]); setMisInscripcionIds(new Set()); return }
    try {
      const data = await apiRequest(`/inscripciones/mis-inscripciones?socioId=${socioId}`)
      const lista = Array.isArray(data) ? data : []
      setMisInscripcionIds(new Set(lista.map(i => Number(i.sesion_id))))
      setMisClases(lista.map(transformarInscripcion))
    } catch (err) {
      console.error('Error cargando inscripciones:', err)
      setMisClases([])
      setMisInscripcionIds(new Set())
    }
  }

  // ── Efectos ───────────────────────────────────────────────────────────────

  // Cargar listas para filtros (disciplinas e instructores)
  useEffect(() => {
    async function fetchListas() {
      try {
        const [discData, instData] = await Promise.all([
          apiRequest('/disciplinas'),
          apiRequest('/instructores')
        ])
        setDisciplinas(Array.isArray(discData) ? discData : [])
        setInstructores(Array.isArray(instData) ? instData : [])
      } catch {
        setDisciplinas([])
        setInstructores([])
      }
    }
    fetchListas()
  }, [])

  // Carga inicial de inscripciones (para "Mis Clases" y para el estado del catálogo)
  useEffect(() => {
    setLoading(true)
    fetchInscripciones().finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar catálogo de clases
  useEffect(() => {
    if (vista !== 'catalogo') return
    async function fetchCatalogo() {
      try {
        const data = await apiRequest('/sesiones')
        const lista = Array.isArray(data) ? data : []
        setCatalogoClases(lista.map(s => ({
          id: s.sesion_id,
          sesion_id: s.sesion_id,
          nombre: s.disciplina,
          disciplina: s.disciplina,
          instructor: s.instructor || 'Por asignar',
          instructor_foto: s.instructor_foto || null,
          horario: `${s.hora_inicio?.slice(0, 5)} - ${s.hora_fin?.slice(0, 5)}`,
          dias: getNombreDia(s.dia_semana),
          dia_semana: s.dia_semana,
          salon: s.espacio,
          cupos: {
            total: s.cupo_maximo || 20,
            disponibles: (s.cupo_maximo || 20) - (parseInt(s.inscritos_actuales) || 0)
          },
          duracion: calcularDuracion(s.hora_inicio, s.hora_fin),
          intensidad: 'Media',
          descripcion: `Clase de ${s.disciplina} impartida por ${s.instructor || 'instructor por asignar'}`,
          materiales: 'Ropa deportiva, toalla, agua',
          instructor_id: s.instructor_id,
          espacio_id: s.espacio_id,
          disciplina_id: s.disciplina_id
        })))
      } catch (err) {
        console.error('Error cargando catálogo:', err)
        setCatalogoClases([])
      }
    }
    fetchCatalogo()
  }, [vista])

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  const activeFilterCount = filtros.disciplinas.length + filtros.dias.length + filtros.instructores.length
  const tmpFilterCount    = filtrosTmp.disciplinas.length + filtrosTmp.dias.length + filtrosTmp.instructores.length

  function getEstatusBadge(estatus) {
    if (estatus === 'confirmado') return <span className="badge-confirmado"><CheckCircle size={14} /> Confirmado</span>
    if (estatus === 'pendiente')  return <span className="badge-pendiente"><AlertCircle size={14} /> Pendiente</span>
    if (estatus === 'cambio')     return <span className="badge-cambio"><AlertCircle size={14} /> Cambio</span>
    return null
  }

  function getCupoIndicator(cupos) {
    if (!cupos) return <span className="badge-disponible">Consultar</span>
    const { total, disponibles } = cupos
    const pct = total > 0 ? disponibles / total : 0
    if (disponibles === 0)   return <span className="badge-lleno"><XCircle size={14} /> Lleno</span>
    if (pct <= 0.15)         return <span className="badge-casi-lleno"><AlertCircle size={14} /> Casi lleno ({disponibles})</span>
    return <span className="badge-disponible">{disponibles} de {total}</span>
  }

  // ── Handlers de filtros ───────────────────────────────────────────────────
  const handleOpenFiltros = () => {
    setFiltrosTmp({ disciplinas: [...filtros.disciplinas], dias: [...filtros.dias], instructores: [...filtros.instructores] })
    setShowFiltros(true)
  }
  const handleAplicarFiltros = () => { setFiltros({ ...filtrosTmp }); setShowFiltros(false) }
  const handleLimpiarFiltros = () => setFiltros({ disciplinas: [], dias: [], instructores: [] })
  const handleLimpiarTmp     = () => setFiltrosTmp({ disciplinas: [], dias: [], instructores: [] })
  const toggleChip = (campo, valor) => setFiltrosTmp(prev => {
    const lista = prev[campo]
    return { ...prev, [campo]: lista.includes(valor) ? lista.filter(x => x !== valor) : [...lista, valor] }
  })

  // ── Handlers de inscripción ───────────────────────────────────────────────
  const handleInscribirse = (clase) => {
    setClaseSeleccionada(clase)
    setFeedbackModal(null)
    setShowModalInscripcion(true)
  }

  const handleConfirmarInscripcion = async () => {
    if (!claseSeleccionada) return
    if (!socioId) {
      setFeedbackModal({ tipo: 'error', msg: 'Error de sesión: ID de socio no encontrado. Vuelve a iniciar sesión.' })
      return
    }
    setSaving(true)
    setFeedbackModal(null)
    try {
      await apiRequest('/inscripciones/inscribir', {
        method: 'POST',
        body: JSON.stringify({ sesionId: claseSeleccionada.sesion_id, socioId })
      })
      setShowModalInscripcion(false)
      setShowModalConfirmacion(true)
      await fetchInscripciones()  // Actualiza misClases y misInscripcionIds
    } catch (err) {
      setFeedbackModal({ tipo: 'error', msg: err.message || 'Error al procesar la inscripción' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelarInscripcion = (clase) => {
    setClaseABaja(clase)
    setShowModalBaja(true)
  }

  const handleConfirmarBaja = async () => {
    if (!socioId || !claseABaja) return
    try {
      await apiRequest('/inscripciones/cancelar', {
        method: 'POST',
        body: JSON.stringify({ sesionId: claseABaja.sesion_id, socioId })
      })
      setShowModalBaja(false)
      await fetchInscripciones()  // Actualiza misClases y misInscripcionIds
    } catch (err) {
      toast(err.message || 'Error al cancelar', 'error')
    }
  }

  // ── Filtrado del catálogo ──────────────────────────────────────────────────
  const catalogoFiltrado = catalogoClases.filter(c => {
    if (filtros.disciplinas.length > 0 && !filtros.disciplinas.includes(c.disciplina)) return false
    if (filtros.dias.length > 0        && !filtros.dias.includes(String(c.dia_semana))) return false
    if (filtros.instructores.length > 0 && !filtros.instructores.includes(c.instructor)) return false
    return true
  })

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SocioLayout activeTab="clases" title="Club Social | Mis Clases">

      {/* HEADER */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Clases y Actividades</h2>
          <p className="rs-subtitle">Gestiona tus clases inscritas o explora nuevas opciones</p>
        </div>
        <div className="rs-status-tags">
          <span className="tag-category">Socio: {userName}</span>
        </div>
      </section>

      {/* TABS */}
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

      {/* ===== MIS CLASES ===== */}
      {vista === 'mis-clases' && (
        <div className="mis-clases-view">
          {loading ? (
            <div className="loading-state">Cargando tus clases...</div>
          ) : misClases.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <h3>No tienes clases inscritas</h3>
              <p>Explora el catálogo para encontrar clases que te interesen</p>
              <button className="btn-primary" onClick={() => setVista('catalogo')}>Ver Catálogo</button>
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
                    <div className="info-row"><User size={16} /><span>{clase.instructor}</span></div>
                    <div className="info-row"><Clock size={16} /><span>{clase.horario} · {clase.dias}</span></div>
                    <div className="info-row"><MapPin size={16} /><span>{clase.salon}</span></div>
                    <div className="info-row"><Timer size={16} /><span>{clase.duracion} · Intensidad {clase.intensidad}</span></div>
                  </div>
                  <div className="mi-clase-materiales">
                    <Info size={14} />
                    <span>Materiales: {clase.materiales}</span>
                  </div>
                  <button className="btn-baja-clase" onClick={() => handleCancelarInscripcion(clase)}>
                    Cancelar Inscripción
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CATÁLOGO ===== */}
      {vista === 'catalogo' && (
        <div className="catalogo-view">
          {/* Botón filtros */}
          <div className="filtros-btn-row">
            <button
              className={`btn-filtros ${activeFilterCount > 0 ? 'active' : ''}`}
              onClick={handleOpenFiltros}
            >
              <Filter size={16} />
              Filtros
              {activeFilterCount > 0 && <span className="filtros-badge">{activeFilterCount}</span>}
            </button>
            {activeFilterCount > 0 && (
              <button className="btn-limpiar-filtros" onClick={handleLimpiarFiltros}>Limpiar</button>
            )}
          </div>

          {/* Grid de clases */}
          <div className="catalogo-grid">
            {catalogoFiltrado.map(clase => {
              const yaInscrito = misInscripcionIds.has(Number(clase.sesion_id))
              return (
                <div key={clase.id} className="clase-card">
                  <div className="clase-card-header">
                    <span className="clase-nivel">{clase.dias}</span>
                    {getCupoIndicator(clase.cupos)}
                  </div>
                  <h3 className="clase-nombre">{clase.nombre}</h3>
                  <p className="clase-descripcion">{clase.descripcion}</p>
                  <div className="clase-instructor">
                    <InstructorAvatar nombre={clase.instructor} foto={clase.instructor_foto} size={38} />
                    <span>{clase.instructor || 'Por asignar'}</span>
                  </div>
                  <div className="clase-detalles">
                    <div className="detalle-item"><Clock size={14} /><span>{clase.horario}</span></div>
                    <div className="detalle-item"><Calendar size={14} /><span>{clase.dias}</span></div>
                    <div className="detalle-item"><MapPin size={14} /><span>{clase.salon}</span></div>
                    <div className="detalle-item"><Timer size={14} /><span>{clase.duracion}</span></div>
                  </div>
                  <div className="clase-materiales">
                    <Info size={14} />
                    <span>{clase.materiales}</span>
                  </div>

                  {/* Botón según estado */}
                  {yaInscrito ? (
                    <button
                      className="btn-inscribirse"
                      disabled
                      style={{ background: '#dcfce7', color: '#166534', border: '2px solid #86efac', cursor: 'default', opacity: 1 }}
                    >
                      <CheckCircle size={16} /> Ya inscrito
                    </button>
                  ) : clase.cupos?.disponibles === 0 ? (
                    <button className="btn-inscribirse disabled" disabled>
                      Clase Llena
                    </button>
                  ) : (
                    <button className="btn-inscribirse" onClick={() => handleInscribirse(clase)}>
                      <Zap size={16} /> Inscribirme
                    </button>
                  )}
                </div>
              )
            })}
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

      {/* ===== MODAL: INSCRIPCIÓN ===== */}
      {showModalInscripcion && claseSeleccionada && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-ficha">
            <header className="modal-header">
              <h3>Confirmar Inscripción</h3>
              <button className="close-btn" onClick={() => setShowModalInscripcion(false)}>&times;</button>
            </header>

            <div className="modal-body">
              {/* Feedback inline (reemplaza alert) */}
              {feedbackModal && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
                  background: feedbackModal.tipo === 'error' ? '#fee2e2' : '#dcfce7',
                  color:      feedbackModal.tipo === 'error' ? '#991b1b' : '#166534',
                  fontWeight: 600, fontSize: '0.85rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  {feedbackModal.msg}
                </div>
              )}

              <div className="ficha-clase">
                <h2>{claseSeleccionada.nombre}</h2>
                <span className="ficha-disciplina">{claseSeleccionada.disciplina}</span>

                <div className="ficha-instructor">
                  <InstructorAvatar nombre={claseSeleccionada.instructor} foto={claseSeleccionada.instructor_foto} size={52} />
                  <div>
                    <strong>{claseSeleccionada.instructor}</strong>
                    <span>Instructor</span>
                  </div>
                </div>

                <div className="ficha-detalles">
                  <div className="ficha-detalle">
                    <Clock size={18} />
                    <div><strong>Horario</strong><span>{claseSeleccionada.horario} · {claseSeleccionada.dias}</span></div>
                  </div>
                  <div className="ficha-detalle">
                    <MapPin size={18} />
                    <div><strong>Ubicación</strong><span>{claseSeleccionada.salon}</span></div>
                  </div>
                  <div className="ficha-detalle">
                    <Timer size={18} />
                    <div><strong>Duración</strong><span>{claseSeleccionada.duracion}</span></div>
                  </div>
                  <div className="ficha-detalle">
                    <Zap size={18} />
                    <div><strong>Intensidad</strong><span>{claseSeleccionada.intensidad}</span></div>
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
              <button
                className="modal-btn confirm"
                onClick={handleConfirmarInscripcion}
                disabled={saving}
              >
                {saving ? 'Inscribiendo...' : 'Confirmar Inscripción'}
              </button>
              <button className="modal-btn cancel" onClick={() => setShowModalInscripcion(false)}>
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ===== MODAL: CONFIRMACIÓN EXITOSA ===== */}
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

      {/* ===== MODAL: BAJA ===== */}
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

      {/* ===== PANEL: FILTROS ===== */}
      {showFiltros && (
        <div className="filtros-overlay" onClick={() => setShowFiltros(false)}>
          <div className="filtros-panel" onClick={e => e.stopPropagation()}>
            <div className="filtros-panel-header">
              <h3>Filtros</h3>
              <button className="filtros-reset" onClick={handleLimpiarTmp}>Limpiar</button>
            </div>
            <div className="filtros-panel-body">
              <div className="filtro-section">
                <span className="filtro-section-label">Disciplina</span>
                <div className="filtro-chips">
                  {disciplinas.map(d => (
                    <button
                      key={d.disciplina_id}
                      className={`filtro-chip ${filtrosTmp.disciplinas.includes(d.nombre) ? 'selected' : ''}`}
                      onClick={() => toggleChip('disciplinas', d.nombre)}
                    >
                      {d.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filtro-section">
                <span className="filtro-section-label">Día de la semana</span>
                <div className="filtro-chips">
                  {DIAS_SEMANA.map(d => (
                    <button
                      key={d.valor}
                      className={`filtro-chip ${filtrosTmp.dias.includes(String(d.valor)) ? 'selected' : ''}`}
                      onClick={() => toggleChip('dias', String(d.valor))}
                    >
                      {d.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filtro-section">
                <span className="filtro-section-label">Instructor</span>
                <div className="filtro-chips">
                  {instructores.map(i => (
                    <button
                      key={i.instructor_id}
                      className={`filtro-chip ${filtrosTmp.instructores.includes(i.nombre) ? 'selected' : ''}`}
                      onClick={() => toggleChip('instructores', i.nombre)}
                    >
                      {i.nombre}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="filtros-panel-footer">
              <button className="btn-aplicar-filtros" onClick={handleAplicarFiltros}>
                Aplicar filtros{tmpFilterCount > 0 ? ` (${tmpFilterCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

    </SocioLayout>
  )
}

export default Clases
