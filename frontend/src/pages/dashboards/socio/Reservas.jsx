import React, { useState, useEffect, useCallback, useRef } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  MapPin, Clock, CheckCircle, Zap, CalendarDays, RotateCcw, XCircle,
  Activity, CircleDot, Waves, Target, LayoutGrid, Dumbbell
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import { Alert, Badge, Button, Card, Chip, Modal, Stack, Text } from '../../../components/ui'

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

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function todayLabel() {
  return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })
}

function slotLabel(hora) {
  const [h] = hora.split(':')
  const fin = `${String(Number(h) + 1).padStart(2,'0')}:00`
  return `${hora} – ${fin}`
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
    const horaActual = new Date().getHours()
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
      setFeedback({ tipo: 'error', msg: 'Ya tienes una reserva activa en ese horario. Elige un horario diferente.' })
      setModal(false)
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
      setModal(false)
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
      setModal(false)
      setSelectedSlot(null)
      setSelectedEspacio(null)
      setSelectedDisc(null)
      setSlots([])
      setFeedback({ tipo: 'exito', msg: `Reserva confirmada: ${selectedEspacio.nombre} ${selectedSlot} – ${horaFin}` })
      fetchMisReservas()
      setTimeout(() => setFeedback(null), 5000)
    } catch (err) {
      setFeedback({ tipo: 'error', msg: err.message || 'Error al crear la reserva' })
      setModal(false)
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

  return (
    <SocioLayout activeTab="reservas" title="Club Social | Reserva de Canchas">
      <Stack gap={24}>

        {/* HEADER */}
        <Stack direction="row" gap={16} align="start" justify="between" wrap>
          <Stack gap={4}>
            <Text variant="heading">Reserva de Canchas</Text>
            <Dato icon={<CalendarDays size={14} />}>Hoy, {todayLabel()} · máx. 2 horas</Dato>
            {HORARIO_HOY && (
              <Dato icon={<Clock size={14} />}>Horario de hoy: <strong>{HORARIO_HOY}</strong></Dato>
            )}
          </Stack>
          {misReservas.length > 0 && (
            <Badge variant="info">{misReservas.length} reserva{misReservas.length > 1 ? 's' : ''} hoy</Badge>
          )}
        </Stack>

        {/* BANNER LUNES CERRADO */}
        {hoyEsLunes && (
          <Alert variant="info">
            El club está <strong>cerrado los Lunes</strong>. Puedes reservar de martes a sábado (6:00–22:00) y domingos (7:00–19:00).
          </Alert>
        )}

        {/* FEEDBACK BANNER */}
        {feedback && (
          <Alert variant={feedback.tipo === 'exito' ? 'success' : 'error'}>{feedback.msg}</Alert>
        )}

        {/* MIS RESERVAS HOY */}
        {misReservas.length > 0 && (
          <Card title="Mis reservas de hoy" icon={<CheckCircle size={18} />}>
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
        <Card title="1 · ¿Qué quieres jugar hoy?">
          <Stack direction="row" gap={8} wrap>
            {disciplinas.map(d => {
              const Icono = DISCIPLINA_ICONO[d.nombre] || ICONO_DEFAULT
              return (
                <Chip key={d.id} selected={selectedDisc?.id === d.id} onClick={() => handleSelectDisc(d)}>
                  <Icono size={16} />
                  {d.nombre}
                </Chip>
              )
            })}
          </Stack>
        </Card>

        {/* PASO 2: CANCHA */}
        {selectedDisc && (
          <Card title={`2 · Elige tu cancha · ${selectedDisc.nombre}`}>
            {espaciosFiltrados.length === 0 ? (
              <Text variant="small" muted>No hay canchas disponibles para esta disciplina.</Text>
            ) : (
              <Stack direction="row" gap={8} wrap>
                {espaciosFiltrados.map(esp => (
                  <Chip
                    key={esp.espacio_id}
                    selected={selectedEspacio?.espacio_id === esp.espacio_id}
                    onClick={() => handleSelectEspacio(esp)}
                  >
                    <MapPin size={14} />
                    {esp.nombre}
                    {esp.capacidad_maxima ? ` · Cap. ${esp.capacidad_maxima}` : ''}
                  </Chip>
                ))}
              </Stack>
            )}
          </Card>
        )}

        {/* PASO 3: HORARIO */}
        {selectedEspacio && (
          <div ref={slotsRef}>
            <Card
              title={`3 · Elige tu horario · ${selectedEspacio.nombre}`}
              action={
                <Button variant="secondary" onClick={() => fetchDisponibilidad(selectedEspacio.espacio_id)}>
                  <RotateCcw size={14} /> Actualizar
                </Button>
              }
            >
              <Stack gap={16}>

                {/* DURACIÓN */}
                <Stack direction="row" gap={8} align="center" wrap>
                  <Text variant="small" as="span">Duración:</Text>
                  {[1, 2].map(d => (
                    <Chip key={d} selected={duracion === d} onClick={() => handleDuracionChange(d)}>
                      {d} hora{d > 1 ? 's' : ''}
                    </Chip>
                  ))}
                </Stack>

                {/* LEYENDA */}
                <Stack direction="row" gap={8} wrap>
                  <Badge variant="success">Libre</Badge>
                  <Badge variant="danger">Reservado</Badge>
                  <Badge variant="info">Clase/Sesión</Badge>
                </Stack>

                {/* SLOTS */}
                {loadingSlots ? (
                  <Text variant="small" muted>Cargando disponibilidad...</Text>
                ) : cerradoHoy ? (
                  <Alert variant="info">El club está cerrado hoy. No hay horarios disponibles.</Alert>
                ) : (
                  <Stack direction="row" gap={8} wrap>
                    {slots.map(slot => {
                      const isSelected = selectedSlot === slot.hora
                      const isExt = duracion === 2 && selectedSlot && (() => {
                        const idx = slots.findIndex(s => s.hora === selectedSlot)
                        return slots[idx + 1]?.hora === slot.hora
                      })()
                      const isPast = parseInt(slot.hora.split(':')[0]) <= new Date().getHours()
                      const valid = slotValido(slot)
                      const estadoTexto = isPast ? 'Pasado'
                        : !slot.libre ? (slot.motivo === 'sesion' ? 'Clase' : 'Reservado')
                        : null

                      return (
                        <Chip
                          key={slot.hora}
                          selected={Boolean(isSelected || isExt)}
                          onClick={() => handleSelectSlot(slot)}
                          disabled={!valid && !isSelected}
                          title={isPast ? 'Horario pasado' : !slot.libre ? (slot.motivo === 'sesion' ? 'Clase programada' : 'Ya reservado') : ''}
                        >
                          {slotLabel(slot.hora)}
                          {estadoTexto && ` · ${estadoTexto}`}
                          {isExt && ' · +1h'}
                        </Chip>
                      )
                    })}
                  </Stack>
                )}

                {/* BOTÓN RESERVAR */}
                {canReserve && (
                  <Stack direction="row" justify="end">
                    <Button onClick={() => setModal(true)}>
                      <Zap size={18} />
                      Reservar {selectedSlot} – {String(Number(selectedSlot.split(':')[0]) + duracion).padStart(2,'0')}:00
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Card>
          </div>
        )}
      </Stack>

      {/* MODAL CONFIRMACIÓN */}
      {modal && (
        <Modal
          isOpen
          onClose={() => setModal(false)}
          title="Confirmar Reserva"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
              <Button onClick={handleConfirmar} disabled={saving}>
                {saving ? 'Procesando...' : 'Confirmar'}
              </Button>
            </>
          }
        >
          <Dato icon={<MapPin size={14} />}>Cancha: <strong>{selectedEspacio?.nombre}</strong></Dato>
          <Dato icon={<CalendarDays size={14} />}>Fecha: <strong>Hoy, {todayLabel()}</strong></Dato>
          <Dato icon={<Clock size={14} />}>
            Horario: <strong>{selectedSlot} – {String(Number(selectedSlot.split(':')[0]) + duracion).padStart(2,'0')}:00</strong> ({duracion}h)
          </Dato>
        </Modal>
      )}

    </SocioLayout>
  )
}
