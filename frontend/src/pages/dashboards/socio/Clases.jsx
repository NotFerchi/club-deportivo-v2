import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  Calendar, Clock, User, Search, Filter,
  AlertCircle, CheckCircle, XCircle,
  MapPin, Zap, Info, BookOpen, Timer
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import { useNotification } from '../../../context/NotificationContext'
import { Alert, Avatar, Badge, Button, Card, Chip, Modal, Stack, Text } from '../../../components/ui'

// Ícono + texto secundario en una línea
function Dato({ icon, children }) {
  return (
    <Stack direction="row" gap={8} align="center">
      {icon}
      <Text variant="small" muted as="span">{children}</Text>
    </Stack>
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
    if (estatus === 'confirmado') return <Badge variant="success"><CheckCircle size={14} /> Confirmado</Badge>
    if (estatus === 'pendiente')  return <Badge variant="warning"><AlertCircle size={14} /> Pendiente</Badge>
    if (estatus === 'cambio')     return <Badge variant="info"><AlertCircle size={14} /> Cambio</Badge>
    return null
  }

  function getCupoIndicator(cupos) {
    if (!cupos) return <Badge>Consultar</Badge>
    const { total, disponibles } = cupos
    const pct = total > 0 ? disponibles / total : 0
    if (disponibles === 0)   return <Badge variant="danger"><XCircle size={14} /> Lleno</Badge>
    if (pct <= 0.15)         return <Badge variant="warning"><AlertCircle size={14} /> Casi lleno ({disponibles})</Badge>
    return <Badge variant="success">{disponibles} de {total}</Badge>
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
      <Stack gap={24}>

        {/* HEADER */}
        <Stack direction="row" gap={16} align="start" justify="between" wrap>
          <Stack gap={4}>
            <Text variant="heading">Clases y Actividades</Text>
            <Text variant="small" muted>Gestiona tus clases inscritas o explora nuevas opciones</Text>
          </Stack>
          <Badge>Socio: {userName}</Badge>
        </Stack>

        {/* TABS */}
        <Stack direction="row" gap={8} wrap role="tablist">
          <Button
            role="tab"
            aria-selected={vista === 'mis-clases'}
            variant={vista === 'mis-clases' ? 'primary' : 'secondary'}
            onClick={() => setVista('mis-clases')}
          >
            <BookOpen size={18} /> Mis Clases ({misClases.length})
          </Button>
          <Button
            role="tab"
            aria-selected={vista === 'catalogo'}
            variant={vista === 'catalogo' ? 'primary' : 'secondary'}
            onClick={() => setVista('catalogo')}
          >
            <Search size={18} /> Explorar Catálogo
          </Button>
        </Stack>

        {/* ===== MIS CLASES ===== */}
        {vista === 'mis-clases' && (
          loading ? (
            <Text muted>Cargando tus clases...</Text>
          ) : misClases.length === 0 ? (
            <Stack gap={8} align="center" padding={32}>
              <Calendar size={48} />
              <Text variant="subheading">No tienes clases inscritas</Text>
              <Text variant="small" muted>Explora el catálogo para encontrar clases que te interesen</Text>
              <Button onClick={() => setVista('catalogo')}>Ver Catálogo</Button>
            </Stack>
          ) : (
            <Stack direction="row" gap={16} grow minChild={280}>
              {misClases.map(clase => (
                <Card key={clase.id} title={clase.nombre} action={getEstatusBadge(clase.estatus)}>
                  <Stack gap={12}>
                    <Text variant="overline" muted>{clase.disciplina}</Text>
                    <Dato icon={<User size={16} />}>{clase.instructor}</Dato>
                    <Dato icon={<Clock size={16} />}>{clase.horario} · {clase.dias}</Dato>
                    <Dato icon={<MapPin size={16} />}>{clase.salon}</Dato>
                    <Dato icon={<Timer size={16} />}>{clase.duracion} · Intensidad {clase.intensidad}</Dato>
                    <Dato icon={<Info size={14} />}>Materiales: {clase.materiales}</Dato>
                    <Button variant="error" onClick={() => handleCancelarInscripcion(clase)}>
                      Cancelar Inscripción
                    </Button>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )
        )}

        {/* ===== CATÁLOGO ===== */}
        {vista === 'catalogo' && (
          <Stack gap={16}>
            {/* Botón filtros */}
            <Stack direction="row" gap={8} align="center">
              <Button variant={activeFilterCount > 0 ? 'primary' : 'secondary'} onClick={handleOpenFiltros}>
                <Filter size={16} />
                Filtros
                {activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="secondary" onClick={handleLimpiarFiltros}>Limpiar</Button>
              )}
            </Stack>

            {/* Grid de clases */}
            <Stack direction="row" gap={16} grow minChild={280}>
              {catalogoFiltrado.map(clase => {
                const yaInscrito = misInscripcionIds.has(Number(clase.sesion_id))
                return (
                  <Card key={clase.id} title={clase.nombre} action={getCupoIndicator(clase.cupos)}>
                    <Stack gap={12}>
                      <Stack direction="row">
                        <Badge variant="info">{clase.dias}</Badge>
                      </Stack>
                      <Text variant="small" muted>{clase.descripcion}</Text>
                      <Stack direction="row" gap={8} align="center">
                        <Avatar name={clase.instructor} src={clase.instructor_foto} />
                        <Text variant="small" as="span">{clase.instructor || 'Por asignar'}</Text>
                      </Stack>
                      <Dato icon={<Clock size={14} />}>{clase.horario}</Dato>
                      <Dato icon={<Calendar size={14} />}>{clase.dias}</Dato>
                      <Dato icon={<MapPin size={14} />}>{clase.salon}</Dato>
                      <Dato icon={<Timer size={14} />}>{clase.duracion}</Dato>
                      <Dato icon={<Info size={14} />}>{clase.materiales}</Dato>

                      {/* Botón según estado */}
                      {yaInscrito ? (
                        <Button variant="secondary" disabled>
                          <CheckCircle size={16} /> Ya inscrito
                        </Button>
                      ) : clase.cupos?.disponibles === 0 ? (
                        <Button disabled>
                          Clase Llena
                        </Button>
                      ) : (
                        <Button onClick={() => handleInscribirse(clase)}>
                          <Zap size={16} /> Inscribirme
                        </Button>
                      )}
                    </Stack>
                  </Card>
                )
              })}
            </Stack>

            {catalogoFiltrado.length === 0 && (
              <Stack gap={8} align="center" padding={32}>
                <Search size={48} />
                <Text variant="subheading">No se encontraron clases</Text>
                <Text variant="small" muted>Intenta con otros filtros o limpia los actuales</Text>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>

      {/* ===== MODAL: INSCRIPCIÓN ===== */}
      {showModalInscripcion && claseSeleccionada && (
        <Modal
          isOpen
          onClose={() => setShowModalInscripcion(false)}
          title="Confirmar Inscripción"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModalInscripcion(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmarInscripcion} disabled={saving}>
                {saving ? 'Inscribiendo...' : 'Confirmar Inscripción'}
              </Button>
            </>
          }
        >
          {/* Feedback inline (reemplaza alert) */}
          {feedbackModal && (
            <Alert variant={feedbackModal.tipo === 'error' ? 'error' : 'success'}>{feedbackModal.msg}</Alert>
          )}

          <Stack gap={4} align="start">
            <Text variant="subheading">{claseSeleccionada.nombre}</Text>
            <Badge variant="info">{claseSeleccionada.disciplina}</Badge>
          </Stack>

          <Stack direction="row" gap={12} align="center">
            <Avatar name={claseSeleccionada.instructor} src={claseSeleccionada.instructor_foto} size="lg" />
            <Stack gap={0}>
              <Text variant="small"><strong>{claseSeleccionada.instructor}</strong></Text>
              <Text variant="caption" muted>Instructor</Text>
            </Stack>
          </Stack>

          <Stack gap={8}>
            <Dato icon={<Clock size={18} />}><strong>Horario:</strong> {claseSeleccionada.horario} · {claseSeleccionada.dias}</Dato>
            <Dato icon={<MapPin size={18} />}><strong>Ubicación:</strong> {claseSeleccionada.salon}</Dato>
            <Dato icon={<Timer size={18} />}><strong>Duración:</strong> {claseSeleccionada.duracion}</Dato>
            <Dato icon={<Zap size={18} />}><strong>Intensidad:</strong> {claseSeleccionada.intensidad}</Dato>
          </Stack>

          <Stack gap={4}>
            <Text variant="small"><strong>Materiales necesarios:</strong></Text>
            <Text variant="small" muted>{claseSeleccionada.materiales}</Text>
          </Stack>

          <Text variant="small">
            Lugares disponibles: <strong>{claseSeleccionada.cupos.disponibles} de {claseSeleccionada.cupos.total}</strong>
          </Text>
        </Modal>
      )}

      {/* ===== MODAL: CONFIRMACIÓN EXITOSA ===== */}
      {showModalConfirmacion && (
        <Modal
          isOpen
          onClose={() => setShowModalConfirmacion(false)}
          title="¡Inscripción Exitosa!"
          footer={
            <Button onClick={() => {
              setShowModalConfirmacion(false)
              setVista('mis-clases')
            }}>
              Ver Mis Clases
            </Button>
          }
        >
          <Alert variant="success">
            Te has inscrito correctamente en <strong>{claseSeleccionada?.nombre}</strong>
          </Alert>
          <Text variant="small" muted>Puedes ver tus clases inscritas en la pestaña "Mis Clases"</Text>
        </Modal>
      )}

      {/* ===== MODAL: BAJA ===== */}
      {showModalBaja && claseABaja && (
        <Modal
          isOpen
          onClose={() => setShowModalBaja(false)}
          title="Cancelar Inscripción"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModalBaja(false)}>
                Mantener Inscripción
              </Button>
              <Button variant="error" onClick={handleConfirmarBaja}>
                Sí, Cancelar
              </Button>
            </>
          }
        >
          <Alert variant="warning">
            ¿Estás seguro de que deseas cancelar tu inscripción a <strong>{claseABaja.nombre}</strong>?
          </Alert>
          <Text variant="small" muted>Liberarás tu lugar para otro socio</Text>
        </Modal>
      )}

      {/* ===== PANEL: FILTROS ===== */}
      {showFiltros && (
        <Modal
          isOpen
          onClose={() => setShowFiltros(false)}
          closeOnOverlayClick
          title="Filtros"
          footer={
            <>
              <Button variant="secondary" onClick={handleLimpiarTmp}>Limpiar</Button>
              <Button onClick={handleAplicarFiltros}>
                Aplicar filtros{tmpFilterCount > 0 ? ` (${tmpFilterCount})` : ''}
              </Button>
            </>
          }
        >
          <Stack gap={8}>
            <Text variant="overline" muted>Disciplina</Text>
            <Stack direction="row" gap={8} wrap>
              {disciplinas.map(d => (
                <Chip
                  key={d.disciplina_id}
                  selected={filtrosTmp.disciplinas.includes(d.nombre)}
                  onClick={() => toggleChip('disciplinas', d.nombre)}
                >
                  {d.nombre}
                </Chip>
              ))}
            </Stack>
          </Stack>
          <Stack gap={8}>
            <Text variant="overline" muted>Día de la semana</Text>
            <Stack direction="row" gap={8} wrap>
              {DIAS_SEMANA.map(d => (
                <Chip
                  key={d.valor}
                  selected={filtrosTmp.dias.includes(String(d.valor))}
                  onClick={() => toggleChip('dias', String(d.valor))}
                >
                  {d.nombre}
                </Chip>
              ))}
            </Stack>
          </Stack>
          <Stack gap={8}>
            <Text variant="overline" muted>Instructor</Text>
            <Stack direction="row" gap={8} wrap>
              {instructores.map(i => (
                <Chip
                  key={i.instructor_id}
                  selected={filtrosTmp.instructores.includes(i.nombre)}
                  onClick={() => toggleChip('instructores', i.nombre)}
                >
                  {i.nombre}
                </Chip>
              ))}
            </Stack>
          </Stack>
        </Modal>
      )}

    </SocioLayout>
  )
}

export default Clases
