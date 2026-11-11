import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import { Calendar, Check, Clock, Filter, MapPin, Timer, XCircle, Zap } from 'lucide-react'
import { apiRequest } from '../../../services/api'
import { useNotification } from '../../../context/NotificationContext'
import { Alert, Avatar, AvatarRow, Badge, Button, Card, Chip, ConfirmDialog, DayStrip, EmptyState, EventCard, LoadingState, Modal, PageHeader, Stack, StackDeck, Tabs, Text } from '../../../components/ui'
import { iconoDisciplina } from '../../../components/torneos-ui/disciplinaIcono'
import { fotoClase } from '../../../components/clases-ui/fotoClase'
import { diaSemanaDe, diasDeLaSemana, minutosDeClase, ordenProxima } from '../../../components/clases-ui/semana'

// Ícono + texto secundario en una línea
const ACENTOS = ['blue', 'violet', 'green', 'amber', 'cyan']

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
    dia_semana: i.dia_semana,
    hora_inicio: i.hora_inicio,
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
  // El día arranca en hoy (tira de días); tocar el día elegido lo quita y muestra todos.
  const [filtros,    setFiltros]    = useState(() => ({ disciplinas: [], dias: [String(diaSemanaDe(new Date()))], instructores: [] }))
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
  // El día se elige en la tira, no en la hoja de Filtros: no cuenta en el contador de la hoja.
  const activeFilterCount = filtros.disciplinas.length + filtros.instructores.length
  const tmpFilterCount    = filtrosTmp.disciplinas.length + filtrosTmp.instructores.length
  const semana = diasDeLaSemana()
  const diaElegido = filtros.dias.length === 1 ? Number(filtros.dias[0]) : null

  // ── Handlers de filtros ───────────────────────────────────────────────────
  const handleOpenFiltros = () => {
    setFiltrosTmp({ disciplinas: [...filtros.disciplinas], dias: [...filtros.dias], instructores: [...filtros.instructores] })
    setShowFiltros(true)
  }
  // Aplicar/limpiar solo tocan deporte e instructor; el día elegido en la tira se conserva.
  const handleAplicarFiltros = () => { setFiltros(prev => ({ ...filtrosTmp, dias: prev.dias })); setShowFiltros(false) }
  const handleLimpiarFiltros = () => setFiltros(prev => ({ disciplinas: [], dias: prev.dias, instructores: [] }))
  const handleLimpiarTmp     = () => setFiltrosTmp(prev => ({ ...prev, disciplinas: [], instructores: [] }))
  const handleElegirDia      = (dia) => setFiltros(prev => ({ ...prev, dias: dia ? [String(dia)] : [] }))
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

  // ── Derivados de presentación ─────────────────────────────────────────────
  // Estado del botón de cada clase del catálogo: inscrito > llena > disponible.
  const estadoDe = (clase) => {
    if (misInscripcionIds.has(Number(clase.sesion_id))) return 'inscrito'
    if (clase.cupos?.disponibles === 0) return 'llena'
    return 'disponible'
  }
  const CTA = { inscrito: 'Ya inscrito', llena: 'Clase llena', disponible: 'Inscribirme' }

  // Las 2 clases inscritas más próximas (de hoy en adelante, por día y hora).
  const proximas = [...misClases]
    .sort((a, b) => ordenProxima(a.dia_semana, a.hora_inicio) - ordenProxima(b.dia_semana, b.hora_inicio))
    .slice(0, 2)

  // "Hoy", "Mañana" o el día de la semana, según cuántos días faltan.
  const cuando = (c) => {
    const dias = Math.floor(ordenProxima(c.dia_semana, c.hora_inicio) / 1440)
    return dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : c.dias
  }

  const detalleClase = (c) => `${c.dias} · ${c.horario} · ${c.salon}`

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SocioLayout activeTab="clases" title="Club Social | Mis Clases">
      <Stack gap={24}>

        {/* HEADER */}
        <PageHeader title="Clases" />

        {/* TABS */}
        <Tabs
          ariaLabel="Mis clases o catálogo"
          fullWidth
          value={vista}
          onChange={setVista}
          tabs={[
            { value: 'mis-clases', label: 'Mis clases' },
            { value: 'catalogo', label: 'Catálogo' },
          ]}
        />

        {/* ===== MIS CLASES ===== */}
        {vista === 'mis-clases' && (
          loading ? (
            <LoadingState rows={3} label="Cargando tus clases…" />
          ) : misClases.length === 0 ? (
            <EmptyState
              icon={<Calendar size={24} />}
              title="No tienes clases inscritas"
              message="Explora el catálogo para encontrar clases que te interesen."
              action={<Button onClick={() => setVista('catalogo')}>Ver catálogo</Button>}
            />
          ) : (
            <Stack gap={16}>
              <Alert variant="info">
                {misClases.length === 1 ? 'Tienes 1 clase inscrita.' : `Tienes ${misClases.length} clases inscritas.`}
                {proximas[0] && <> Tu próxima clase es <strong>{proximas[0].nombre}</strong>, {cuando(proximas[0]).toLowerCase()} a las {proximas[0].hora_inicio?.slice(0, 5)}.</>}
              </Alert>
              <Stack direction="row" gap={16} grow minChild={280}>
              {[...misClases].sort((a, b) => ordenProxima(a.dia_semana, a.hora_inicio) - ordenProxima(b.dia_semana, b.hora_inicio)).map((clase, i) => (
                <Card
                  key={clase.id}
                  accent={ACENTOS[i % ACENTOS.length]}
                  footer={
                    <Button variant="secondary" onClick={() => handleCancelarInscripcion(clase)}>
                      Cancelar inscripción
                    </Button>
                  }
                >
                  <Stack gap={12}>
                    <Stack direction="row" gap={8} align="center" justify="between">
                      <Stack direction="row" gap={12} align="center">
                        <Avatar name={clase.disciplina} src={fotoClase(clase.disciplina)} size="lg" />
                        <Stack gap={0}>
                          <Text variant="subheading">{clase.nombre}</Text>
                          <Text variant="small" muted>{clase.instructor}</Text>
                        </Stack>
                      </Stack>
                      <Badge variant={cuando(clase) === 'Hoy' ? 'success' : 'ice'}>{cuando(clase)}</Badge>
                    </Stack>
                    <Dato icon={<Calendar size={16} />}>{clase.dias} · {clase.horario}</Dato>
                    <Dato icon={<Timer size={16} />}>{clase.duracion}</Dato>
                    <Dato icon={<MapPin size={16} />}>{clase.salon}</Dato>
                  </Stack>
                </Card>
              ))}
              </Stack>
            </Stack>
          )
        )}

        {/* ===== CATÁLOGO ===== */}
        {vista === 'catalogo' && (
          <Stack gap={16}>
            {/* Filtros (deporte e instructor) */}
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

            {/* Día de la semana */}
            <DayStrip ariaLabel="Día de la semana" days={semana} value={diaElegido} onChange={handleElegirDia} />

            {/* Mazo de clases */}
            {catalogoFiltrado.length > 0 && (
              <>
                <StackDeck ariaLabel="Clases del club">
                  {catalogoFiltrado.map(clase => {
                    const estado = estadoDe(clase)
                    const minutos = minutosDeClase(clase.horario.slice(0, 5), clase.horario.slice(8, 13))
                    return (
                      <EventCard
                        key={clase.id}
                        gradient="clases"
                        as={estado === 'disponible' ? 'button' : 'div'}
                        kicker={clase.dias}
                        icon={iconoDisciplina(clase.disciplina)}
                        photo={fotoClase(clase.disciplina)}
                        day={clase.horario.slice(0, 5)}
                        month={minutos ? `${minutos} min` : undefined}
                        title={clase.nombre}
                        description={`${clase.instructor} · ${clase.salon}`}
                        progress={{ value: clase.cupos.total - clase.cupos.disponibles, max: clase.cupos.total, label: 'Cupo' }}
                        status={estado === 'llena' ? <Badge variant="danger">Lleno</Badge> : undefined}
                        cta={CTA[estado]}
                        onClick={estado === 'disponible' ? () => handleInscribirse(clase) : undefined}
                        aria-label={`${clase.nombre}, ${clase.dias} ${clase.horario}. ${CTA[estado]}`}
                      />
                    )
                  })}
                </StackDeck>
                <Text variant="caption" muted align="center">
                  {catalogoFiltrado.length} {catalogoFiltrado.length === 1 ? 'clase' : 'clases'} · desliza para ver más
                </Text>
              </>
            )}

            {catalogoFiltrado.length === 0 && (
              <EmptyState
                title="No se encontraron clases"
                message="Prueba con otro día o limpia los filtros."
                action={(activeFilterCount > 0 || diaElegido) ? (
                  <Button variant="secondary" onClick={() => setFiltros({ disciplinas: [], dias: [], instructores: [] })}>
                    Ver todas las clases
                  </Button>
                ) : undefined}
              />
            )}

            {/* Próximas clases del socio */}
            {proximas.length > 0 && (
              <Stack gap={12}>
                <Text variant="subheading">Tus próximas clases</Text>
                {proximas.map(c => (
                  <AvatarRow
                    key={c.id}
                    avatar={<Avatar name={c.disciplina} src={fotoClase(c.disciplina)} size="lg" />}
                    title={c.nombre}
                    meta={detalleClase(c)}
                    action={<Badge variant="success">Inscrito</Badge>}
                  />
                ))}
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
          title="Confirmar inscripción"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModalInscripcion(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmarInscripcion} disabled={saving}>
                {saving ? 'Inscribiendo...' : 'Confirmar inscripción'}
              </Button>
            </>
          }
        >
          {/* Feedback inline (reemplaza alert) */}
          {feedbackModal && (
            <Alert variant={feedbackModal.tipo === 'error' ? 'error' : 'success'}>{feedbackModal.msg}</Alert>
          )}

          <Text variant="subheading">{claseSeleccionada.nombre}</Text>

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
          </Stack>

          <Text variant="small">
            Lugares disponibles: <strong>{claseSeleccionada.cupos.disponibles} de {claseSeleccionada.cupos.total}</strong>
          </Text>
        </Modal>
      )}

      {/* ===== MODAL: CONFIRMACIÓN EXITOSA ===== */}
      {showModalConfirmacion && (
        <ConfirmDialog
          isOpen
          hideCancel
          icon={<Check size={24} />}
          title="¡Inscripción exitosa!"
          message={claseSeleccionada ? `${claseSeleccionada.nombre} · ${claseSeleccionada.dias} ${claseSeleccionada.horario} · ${claseSeleccionada.salon}` : undefined}
          confirmLabel="Listo"
          onConfirm={() => setShowModalConfirmacion(false)}
          onCancel={() => setShowModalConfirmacion(false)}
        />
      )}

      {/* ===== MODAL: BAJA ===== */}
      {showModalBaja && claseABaja && (
        <ConfirmDialog
          isOpen
          destructive
          icon={<XCircle size={24} />}
          title="Cancelar inscripción"
          message={`¿Estás seguro de que deseas cancelar tu inscripción a ${claseABaja.nombre}? Liberarás tu lugar para otro socio.`}
          confirmLabel="Sí, cancelar"
          cancelLabel="Mantener inscripción"
          onConfirm={handleConfirmarBaja}
          onCancel={() => setShowModalBaja(false)}
        />
      )}

      {/* ===== HOJA: FILTROS ===== */}
      {showFiltros && (
        <Modal
          isOpen
          variant="sheet"
          onClose={() => setShowFiltros(false)}
          closeOnOverlayClick
          title="Filtros"
          footer={
            <>
              <Button onClick={handleAplicarFiltros}>
                Aplicar filtros{tmpFilterCount > 0 ? ` (${tmpFilterCount})` : ''}
              </Button>
              <Button variant="secondary" onClick={handleLimpiarTmp}>Limpiar</Button>
            </>
          }
        >
          <Stack gap={8}>
            <Text variant="overline" muted>Deporte</Text>
            <Stack direction="row" gap={8} wrap>
              <Chip
                selected={filtrosTmp.disciplinas.length === 0}
                onClick={() => setFiltrosTmp(prev => ({ ...prev, disciplinas: [] }))}
              >
                Todos
              </Chip>
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
