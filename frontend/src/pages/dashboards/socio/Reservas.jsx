import React, { useState, useEffect, useCallback, useRef } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  Clock, CheckCircle, CalendarDays, RotateCcw, XCircle, ArrowRight,
  Activity, CircleDot, Waves, Target, LayoutGrid, Dumbbell, Sun, Sunset, Moon
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import {
  ActionBar, Alert, Badge, Button, Card, Chip, ChipRow, EmptyState, ImageHero, LoadingState,
  Modal, SelectTile, Stack, StepSection, Tabs, Text
} from '../../../components/ui'
import fotoPadel from '../../../assets/img/deporte-padel.webp'
import fotoTenis from '../../../assets/img/deporte-tenis.webp'
import fotoFutbol from '../../../assets/img/deporte-futbol.webp'
import fotoNatacion from '../../../assets/img/deporte-natacion.webp'
import fotoFitness from '../../../assets/img/deporte-fitness.webp'
import fotoSquash from '../../../assets/img/deporte-squash.webp'

const DISCIPLINA_ICONO = {
  'Tenis':      Activity,
  'Pádel':      Activity,
  'Fútbol':     CircleDot,
  'Voleibol':   CircleDot,
  'Natación':   Waves,
  'Básquetbol': CircleDot,
  'Squash':     Target,
  'Frontón':    Activity,
  'Multiusos':  LayoutGrid,
  'Fitness':    Dumbbell,
}
const ICONO_DEFAULT = LayoutGrid

// Fotos locales por disciplina; las que no tienen foto muestran su ícono sobre navy
const DISCIPLINA_FOTO = {
  'Pádel':    fotoPadel,
  'Tenis':    fotoTenis,
  'Fútbol':   fotoFutbol,
  'Natación': fotoNatacion,
  'Fitness':  fotoFitness,
  'Squash':   fotoSquash,
}

// Grupos de horarios (hora de inicio): mañana < 13, tarde 13–18, noche ≥ 19
const FRANJAS = [
  { id: 'manana', label: 'Mañana', Icono: Sun,    incluye: (h) => h < 13 },
  { id: 'tarde',  label: 'Tarde',  Icono: Sunset, incluye: (h) => h >= 13 && h < 19 },
  { id: 'noche',  label: 'Noche',  Icono: Moon,   incluye: (h) => h >= 19 },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Hora actual (0-23) en Ciudad de México, sin depender de la zona del navegador
function horaActualMexico() {
  const hora = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Mexico_City',
  }).format(new Date())
  return Number(hora)
}

function todayLabel() {
  return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })
}

// "mar, 10 nov" para el encabezado
function todayShortLabel() {
  return new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })
}

function slotLabel(hora) {
  const [h] = hora.split(':')
  const fin = `${String(Number(h) + 1).padStart(2,'0')}:00`
  return `${hora} – ${fin}`
}

function horaFinDe(horaInicio, duracion) {
  return `${String(Number(horaInicio.split(':')[0]) + duracion).padStart(2,'0')}:00`
}

// Ícono + texto secundario en una línea
function Dato({ icon, children }) {
  return (
    <Stack direction="row" gap={8} align="center">
      {icon}
      <Text variant="small" muted as="span">{children}</Text>
    </Stack>
  )
}

// Fila de la hoja de confirmación: ícono, etiqueta y valor
function Detalle({ icon, label, children }) {
  return (
    <Stack direction="row" gap={12} align="center">
      {icon}
      <Stack gap={0}>
        <Text variant="overline" muted as="span">{label}</Text>
        <Text variant="small" as="span">{children}</Text>
      </Stack>
    </Stack>
  )
}

export default function Reservas() {
  const usuario  = JSON.parse(localStorage.getItem('usuario') || '{}')
  const socioId  = usuario?.socio_id

  const [espacios,        setEspacios]        = useState([])
  const [disciplinas,     setDisciplinas]     = useState([])
  const [selectedDisc,    setSelectedDisc]    = useState(null)
  const [selectedEspacio, setSelectedEspacio] = useState(null)
  const [slots,           setSlots]           = useState([])
  const [loadingSlots,    setLoadingSlots]    = useState(false)
  const [cerradoHoy,      setCerradoHoy]      = useState(false)
  const [selectedSlot,    setSelectedSlot]    = useState(null)
  const [duracion,        setDuracion]        = useState(1)
  const [misReservas,     setMisReservas]     = useState([])
  const [misInscripciones, setMisInscripciones] = useState([])   // clases inscritas hoy
  const [modal,           setModal]           = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [feedback,        setFeedback]        = useState(null)
  const [reservaHecha,    setReservaHecha]    = useState(null)  // resumen para el estado de éxito de la hoja
  const slotsRef = useRef(null)

  // getDia: Lun=1, Mar=2 … Sáb=6, Dom=7
  const _jsDay = new Date().getDay()
  const hoyDiaSemana = _jsDay === 0 ? 7 : _jsDay
  const hoyEsLunes   = hoyDiaSemana === 1
  const HORARIO_HOY  = hoyDiaSemana === 1 ? null
    : hoyDiaSemana === 7 ? '7:00 am – 7:30 pm'
    : '6:00 am – 10:30 pm'

  useEffect(() => {
    if (selectedEspacio && slotsRef.current) {
      slotsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedEspacio])

  useEffect(() => {
    apiRequest('/espacios/todos')
      .then(data => {
        const lista = (Array.isArray(data) ? data : []).filter(e => e.activo !== false)
        setEspacios(lista)
        const seen = new Set()
        const discs = []
        for (const e of lista) {
          const disc = e.disciplina   // viene del JOIN con disciplinas
          if (disc && !seen.has(e.disciplina_id)) {
            seen.add(e.disciplina_id)
            discs.push({ id: e.disciplina_id, nombre: disc })
          }
        }
        // Fallback: sin disciplinas asignadas, mostrar todos bajo "General"
        if (discs.length === 0 && lista.length > 0) {
          setEspacios(lista.map(e => ({ ...e, disciplina: 'General', disciplina_id: 0 })))
          setDisciplinas([{ id: 0, nombre: 'General' }])
        } else {
          setDisciplinas(discs)
        }
      })
      .catch(err => console.error('[Reservas] Error cargando espacios:', err))

    fetchMisReservas()
    fetchMisInscripciones()
  }, [])

  const fetchMisReservas = () => {
    if (!socioId) return
    apiRequest('/reservas')
      .then(data => {
        const hoy = todayISO()
        const lista = Array.isArray(data) ? data : []
        // slice(0,10) normaliza 'YYYY-MM-DD' y 'YYYY-MM-DDTHH:mm:ssZ'
        setMisReservas(lista.filter(r =>
          String(r.fecha).slice(0, 10) === hoy &&
          Number(r.socio_id) === Number(socioId) &&
          r.estado !== 'cancelada'
        ))
      })
      .catch(() => {})
  }

  // Carga clases inscritas del socio (para validar solapamiento al reservar)
  const fetchMisInscripciones = () => {
    if (!socioId) return
    apiRequest(`/inscripciones/mis-inscripciones?socioId=${socioId}`)
      .then(data => setMisInscripciones(Array.isArray(data) ? data : []))
      .catch(() => setMisInscripciones([]))
  }

  const fetchDisponibilidad = useCallback(async (espacioId) => {
    setLoadingSlots(true)
    setSlots([])
    setSelectedSlot(null)
    setCerradoHoy(false)
    try {
      const data = await apiRequest(`/reservas/disponibilidad?espacio_id=${espacioId}`)
      if (data.cerrado) {
        setCerradoHoy(true)
        setSlots([])
      } else {
        setSlots(data.slots || [])
      }
    } catch {
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  const handleSelectDisc = (disc) => {
    setSelectedDisc(disc)
    setSelectedEspacio(null)
    setSlots([])
    setSelectedSlot(null)
  }

  const handleSelectEspacio = (esp) => {
    setSelectedEspacio(esp)
    setSelectedSlot(null)
    setDuracion(1)
    fetchDisponibilidad(esp.espacio_id)
  }

  const handleSelectSlot = (slot) => {
    if (!slot.libre) return
    if (duracion === 2) {
      const idx = slots.findIndex(s => s.hora === slot.hora)
      const next = slots[idx + 1]
      if (!next || !next.libre) return
    }
    setSelectedSlot(slot.hora === selectedSlot ? null : slot.hora)
  }

  const handleDuracionChange = (d) => {
    setDuracion(d)
    if (d === 2 && selectedSlot) {
      const idx = slots.findIndex(s => s.hora === selectedSlot)
      const next = slots[idx + 1]
      if (!next || !next.libre) setSelectedSlot(null)
    }
  }

  const slotValido = (slot) => {
    const horaActual = horaActualMexico()
    const horaSlot = parseInt(slot.hora.split(':')[0])
    if (horaSlot <= horaActual) return false
    if (!slot.libre) return false
    if (duracion === 2) {
      const idx = slots.findIndex(s => s.hora === slot.hora)
      const next = slots[idx + 1]
      return Boolean(next?.libre)
    }
    return true
  }

  const abrirHoja = () => {
    setFeedback(null)
    setModal(true)
  }

  // Al cerrar después de reservar se limpia la selección (antes pasaba al confirmar)
  const cerrarHoja = () => {
    if (saving) return
    setModal(false)
    if (reservaHecha) {
      setReservaHecha(null)
      setSelectedSlot(null)
      setSelectedEspacio(null)
      setSelectedDisc(null)
      setSlots([])
    }
  }

  const handleConfirmar = async () => {
    if (!socioId) { setFeedback({ tipo: 'error', msg: 'Debes iniciar sesión nuevamente' }); return }

    const [h] = selectedSlot.split(':')
    const horaInicioNum = Number(h)
    const horaFinNum    = horaInicioNum + duracion
    const horaFin       = `${String(horaFinNum).padStart(2,'0')}:00`

    // Validar solapamiento con reservas activas del mismo día
    const solapamiento = misReservas.some(r => {
      const rInicio = Number(String(r.hora_inicio).slice(0, 2))
      const rFin    = Number(String(r.hora_fin).slice(0, 2))
      return horaInicioNum < rFin && horaFinNum > rInicio
    })
    if (solapamiento) {
      // El error se muestra dentro de la hoja, que sigue abierta para cambiar el horario
      setFeedback({ tipo: 'error', msg: 'Ya tienes una reserva activa en ese horario. Elige un horario diferente.' })
      return
    }

    // Validar solapamiento con clases inscritas en el día de hoy
    // sesiones_programadas.dia_semana: Lun=1 … Sáb=6, Dom=7
    // JS getDay(): Dom=0, Lun=1 … Sáb=6 → convertir: jsDay===0 ? 7 : jsDay
    const jsDay = new Date().getDay()
    const diaSemanaHoy = jsDay === 0 ? 7 : jsDay
    const solapamientoClase = misInscripciones.some(i => {
      if (Number(i.dia_semana) !== diaSemanaHoy) return false
      const iInicio = Number(String(i.hora_inicio).slice(0, 2))
      const iFin    = Number(String(i.hora_fin).slice(0, 2))
      return horaInicioNum < iFin && horaFinNum > iInicio
    })
    if (solapamientoClase) {
      setFeedback({ tipo: 'error', msg: 'Tienes una clase inscrita en ese horario. Cancela tu inscripción antes de reservar.' })
      return
    }

    setSaving(true)
    try {
      await apiRequest('/reservas', {
        method: 'POST',
        body: JSON.stringify({
          espacio_id: selectedEspacio.espacio_id,
          socio_id: socioId,
          fecha: todayISO(),
          hora_inicio: selectedSlot,
          hora_fin: horaFin,
        })
      })
      setFeedback(null)
      setReservaHecha({ espacio: selectedEspacio.nombre, inicio: selectedSlot, fin: horaFin })
      fetchMisReservas()
    } catch (err) {
      setFeedback({ tipo: 'error', msg: err.message || 'Error al crear la reserva' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelar = async (reservaId) => {
    try {
      await apiRequest(`/reservas/${reservaId}/cancelar`, { method: 'PUT' })
      fetchMisReservas()
      fetchDisponibilidad(selectedEspacio?.espacio_id || 0)
    } catch (err) {
      setFeedback({ tipo: 'error', msg: err.message || 'Error al cancelar' })
    }
  }

  const espaciosFiltrados = selectedDisc
    ? espacios.filter(e => e.disciplina_id === selectedDisc.id)
    : []

  const canReserve = selectedEspacio && selectedSlot
  const horaFinSeleccion = selectedSlot ? horaFinDe(selectedSlot, duracion) : null
  const fotoDisc = selectedDisc ? DISCIPLINA_FOTO[selectedDisc.nombre] : undefined
  const horaActual = horaActualMexico()

  return (
    <SocioLayout activeTab="reservas" title="Club Social | Reserva de Canchas">
      <Stack gap={24}>

        {/* ENCABEZADO CON FOTO */}
        <ImageHero
          image={fotoDisc}
          eyebrow={`Reservar · Hoy, ${todayShortLabel()}`}
          title={selectedDisc?.nombre || 'Reserva de canchas'}
        >
          <Clock size={14} aria-hidden="true" />
          {HORARIO_HOY ? `${HORARIO_HOY} · Máx. 2 h por reserva` : 'Cerrado hoy'}
        </ImageHero>

        {/* BANNER LUNES CERRADO */}
        {hoyEsLunes && (
          <Alert variant="info">
            El club está <strong>cerrado los Lunes</strong>. Puedes reservar de martes a sábado (6:00–22:00) y domingos (7:00–19:00).
          </Alert>
        )}

        {/* FEEDBACK (errores fuera de la hoja, p. ej. al cancelar) */}
        {feedback && !modal && (
          <Alert variant={feedback.tipo === 'exito' ? 'success' : 'error'}>{feedback.msg}</Alert>
        )}

        {/* MIS RESERVAS HOY */}
        {misReservas.length > 0 && (
          <Card
            title="Mis reservas de hoy"
            icon={<CheckCircle size={18} />}
            action={<Badge variant="ice">{misReservas.length} reserva{misReservas.length > 1 ? 's' : ''}</Badge>}
          >
            <Stack gap={12}>
              {misReservas.map(r => (
                <Stack key={r.reserva_id} direction="row" gap={12} align="center" justify="between">
                  <Stack gap={0}>
                    <Text variant="small">{r.espacio_nombre}</Text>
                    <Dato icon={<Clock size={12} />}>{String(r.hora_inicio).slice(0,5)} – {String(r.hora_fin).slice(0,5)}</Dato>
                  </Stack>
                  <Button variant="error" onClick={() => handleCancelar(r.reserva_id)}>
                    <XCircle size={14} /> Cancelar
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Card>
        )}

        {/* PASO 1: DEPORTE */}
        <StepSection
          step={1}
          title="¿Qué quieres jugar?"
          aside={disciplinas.length > 0 && `${disciplinas.length} deporte${disciplinas.length > 1 ? 's' : ''}`}
        >
          <ChipRow ariaLabel="Deportes">
            {disciplinas.map(d => {
              const Icono = DISCIPLINA_ICONO[d.nombre] || ICONO_DEFAULT
              const canchas = espacios.filter(e => e.disciplina_id === d.id).length
              return (
                <SelectTile
                  key={d.id}
                  media
                  image={DISCIPLINA_FOTO[d.nombre]}
                  icon={<Icono size={28} />}
                  title={d.nombre}
                  meta={`${canchas} cancha${canchas === 1 ? '' : 's'}`}
                  selected={selectedDisc?.id === d.id}
                  onClick={() => handleSelectDisc(d)}
                />
              )
            })}
          </ChipRow>
        </StepSection>

        {/* PASO 2: CANCHA */}
        {selectedDisc && (
          <StepSection step={2} title="Elige tu cancha">
            {espaciosFiltrados.length === 0 ? (
              <Text variant="small" muted>No hay canchas disponibles para esta disciplina.</Text>
            ) : (
              <Stack columns={2} gap={12}>
                {espaciosFiltrados.map(esp => (
                  <SelectTile
                    key={esp.espacio_id}
                    title={esp.nombre}
                    badge={esp.capacidad_maxima ? <Badge variant="ice">Cap. {esp.capacidad_maxima}</Badge> : undefined}
                    selected={selectedEspacio?.espacio_id === esp.espacio_id}
                    onClick={() => handleSelectEspacio(esp)}
                  />
                ))}
              </Stack>
            )}
          </StepSection>
        )}

        {/* PASO 3: HORARIO */}
        {selectedEspacio && (
          <StepSection
            ref={slotsRef}
            step={3}
            title="¿A qué hora?"
            aside={
              <Button variant="secondary" onClick={() => fetchDisponibilidad(selectedEspacio.espacio_id)}>
                <RotateCcw size={14} /> Actualizar
              </Button>
            }
          >
            <Tabs
              ariaLabel="Duración de la reserva"
              fullWidth
              tabs={[{ value: 1, label: '1 h' }, { value: 2, label: '2 h' }]}
              value={duracion}
              onChange={handleDuracionChange}
            />

            {loadingSlots ? (
              <LoadingState rows={2} label="Cargando disponibilidad…" />
            ) : cerradoHoy ? (
              <Alert variant="info">El club está cerrado hoy. No hay horarios disponibles.</Alert>
            ) : (
              FRANJAS.map(({ id, label, Icono, incluye }) => {
                const enFranja = slots.filter(s => incluye(parseInt(s.hora.split(':')[0])))
                if (enFranja.length === 0) return null
                return (
                  <Stack key={id} gap={8}>
                    <Stack direction="row" gap={8} align="center">
                      <Icono size={14} aria-hidden="true" />
                      <Text variant="overline" muted as="h3">{label}</Text>
                    </Stack>
                    <Stack columns={3} gap={8}>
                      {enFranja.map(slot => {
                        const isSelected = selectedSlot === slot.hora
                        const isExt = duracion === 2 && selectedSlot && (() => {
                          const idx = slots.findIndex(s => s.hora === selectedSlot)
                          return slots[idx + 1]?.hora === slot.hora
                        })()
                        const isPast = parseInt(slot.hora.split(':')[0]) <= horaActual
                        const valid = slotValido(slot)
                        const estadoTexto = isPast ? 'pasado'
                          : !slot.libre ? (slot.motivo === 'sesion' ? 'clase programada' : 'reservado')
                          : isExt ? 'segunda hora de tu reserva'
                          : null

                        return (
                          <Chip
                            key={slot.hora}
                            selected={Boolean(isSelected || isExt)}
                            onClick={() => handleSelectSlot(slot)}
                            disabled={!valid && !isSelected}
                            aria-label={`${slotLabel(slot.hora)}${estadoTexto ? `, ${estadoTexto}` : ''}`}
                            title={isPast ? 'Horario pasado' : !slot.libre ? (slot.motivo === 'sesion' ? 'Clase programada' : 'Ya reservado') : ''}
                          >
                            {String(slot.hora).slice(0, 5)}
                          </Chip>
                        )
                      })}
                    </Stack>
                  </Stack>
                )
              })
            )}

            {HORARIO_HOY && (
              <Alert variant="info">
                Hoy el club abre de <strong>{HORARIO_HOY}</strong>. Puedes reservar 1 o 2 horas seguidas; las horas que ya pasaron no se pueden elegir.
              </Alert>
            )}
          </StepSection>
        )}

        {/* RESUMEN FIJO + RESERVAR */}
        {canReserve && (
          <ActionBar
            ariaLabel="Resumen de la reserva"
            title={`${selectedDisc.nombre} · ${selectedEspacio.nombre}`}
            meta={`${selectedSlot} – ${horaFinSeleccion} · ${duracion} h (hoy)`}
            action={<Button onClick={abrirHoja}>Reservar <ArrowRight size={16} /></Button>}
          />
        )}
      </Stack>

      {/* HOJA DE CONFIRMACIÓN Y ÉXITO */}
      <Modal
        isOpen={modal}
        onClose={cerrarHoja}
        title={reservaHecha ? 'Reserva confirmada' : 'Confirmar reserva'}
        variant="sheet"
        hideHeader
        closeOnOverlayClick
        footer={!reservaHecha && (
          <>
            <Button onClick={handleConfirmar} disabled={saving}>
              {saving ? 'Procesando…' : <>Confirmar reserva <ArrowRight size={16} /></>}
            </Button>
            <Button variant="secondary" onClick={cerrarHoja} disabled={saving}>Cambiar</Button>
          </>
        )}
      >
        {reservaHecha ? (
          <EmptyState
            icon={<CheckCircle size={24} />}
            title="¡Listo, nos vemos en la cancha!"
            message={`Reservaste ${reservaHecha.espacio} hoy de ${reservaHecha.inicio} a ${reservaHecha.fin}. La verás en "Mis reservas de hoy".`}
            action={<Button onClick={cerrarHoja}>Listo</Button>}
          />
        ) : selectedEspacio && selectedSlot && (
          <>
            <ImageHero
              size="sm"
              image={fotoDisc}
              eyebrow="Cancha seleccionada"
              title={`${selectedDisc?.nombre} · ${selectedEspacio.nombre}`}
            />
            <Card>
              <Stack gap={16}>
                <Detalle icon={<CalendarDays size={18} aria-hidden="true" />} label="Fecha">Hoy, {todayLabel()}</Detalle>
                <Detalle icon={<Clock size={18} aria-hidden="true" />} label="Horario y duración">
                  {selectedSlot} – {horaFinSeleccion} ({duracion} h)
                </Detalle>
                <Detalle icon={<Activity size={18} aria-hidden="true" />} label="Disciplina">{selectedDisc?.nombre}</Detalle>
              </Stack>
            </Card>
            {feedback?.tipo === 'error' && <Alert variant="error">{feedback.msg}</Alert>}
          </>
        )}
      </Modal>

    </SocioLayout>
  )
}
