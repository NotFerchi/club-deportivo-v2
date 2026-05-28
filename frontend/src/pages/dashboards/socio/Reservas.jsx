import React, { useState, useEffect, useCallback, useRef } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  MapPin, Clock, CheckCircle, AlertCircle, Zap, CalendarDays, RotateCcw, XCircle,
  Activity, CircleDot, Waves, Target, LayoutGrid, Dumbbell, Ban
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import '../../../../css/socio/Reservas.css'

const DISCIPLINA_META = {
  'Tenis':      { Icon: Activity,    color: '#1e40af', bg: '#dbeafe' },
  'Pádel':      { Icon: Activity,    color: '#0f766e', bg: '#ccfbf1' },
  'Fútbol':     { Icon: CircleDot,   color: '#15803d', bg: '#dcfce7' },
  'Voleibol':   { Icon: CircleDot,   color: '#7c3aed', bg: '#ede9fe' },
  'Natación':   { Icon: Waves,       color: '#0369a1', bg: '#e0f2fe' },
  'Básquetbol': { Icon: CircleDot,   color: '#c2410c', bg: '#ffedd5' },
  'Squash':     { Icon: Target,      color: '#b45309', bg: '#fef3c7' },
  'Frontón':    { Icon: Activity,    color: '#6d28d9', bg: '#ede9fe' },
  'Multiusos':  { Icon: LayoutGrid,  color: '#475569', bg: '#f1f5f9' },
  'Fitness':    { Icon: Dumbbell,    color: '#be185d', bg: '#fce7f3' },
}
const META_DEFAULT = { Icon: LayoutGrid, color: '#475569', bg: '#f1f5f9' }

const ESPACIO_IMG = 'https://i.pinimg.com/1200x/ef/f3/ee/eff3ee2f0b1a53227187312402baf20b.jpg'

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

      {/* HEADER */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Reserva de Canchas</h2>
          <p className="rs-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
            <CalendarDays size={14} /> Hoy, {todayLabel()} · máx. 2 horas
          </p>
          {HORARIO_HOY && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              <Clock size={12} /> Horario de hoy: <strong>{HORARIO_HOY}</strong>
            </p>
          )}
        </div>
        {misReservas.length > 0 && (
          <div className="rs-status-tags">
            <span className="tag-category">{misReservas.length} reserva{misReservas.length > 1 ? 's' : ''} hoy</span>
          </div>
        )}
      </section>

      {/* BANNER LUNES CERRADO */}
      {hoyEsLunes && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem', borderRadius: '12px', marginBottom: '1rem',
          background: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: '0.9rem',
          border: '1px solid #e2e8f0'
        }}>
          <Ban size={18} style={{ flexShrink: 0 }} />
          <span>El club está <strong>cerrado los Lunes</strong>. Puedes reservar de martes a sábado (6:00–22:00) y domingos (7:00–19:00).</span>
        </div>
      )}

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1.25rem', borderRadius: '12px', marginBottom: '1rem',
          background: feedback.tipo === 'exito' ? '#dcfce7' : '#fee2e2',
          color: feedback.tipo === 'exito' ? '#166534' : '#991b1b', fontWeight: 600
        }}>
          {feedback.tipo === 'exito' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
          {feedback.msg}
        </div>
      )}

      {/* MIS RESERVAS HOY */}
      {misReservas.length > 0 && (
        <section className="rs-section" style={{ marginBottom: '1.5rem' }}>
          <header className="section-header">
            <CheckCircle size={18} style={{ color: '#16a34a' }} />
            <h3>Mis reservas de hoy</h3>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {misReservas.map(r => (
              <div key={r.reserva_id} style={{
                background: 'white', borderRadius: '12px', padding: '0.875rem 1rem',
                border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f2146' }}>{r.espacio_nombre}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    <Clock size={12}/> {String(r.hora_inicio).slice(0,5)} – {String(r.hora_fin).slice(0,5)}
                  </span>
                </div>
                <button onClick={() => handleCancelar(r.reserva_id)} style={{
                  background: 'none', border: '1px solid #fca5a5', borderRadius: '8px',
                  padding: '0.3rem 0.7rem', color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                }}>
                  <XCircle size={14} style={{ verticalAlign: 'middle', marginRight: '3px' }}/>Cancelar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PASO 1: DEPORTE */}
      <section className="rs-section">
        <header className="section-header">
          <span style={{ background: '#0f2146', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>1</span>
          <h3>¿Qué quieres jugar hoy?</h3>
        </header>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.5rem' }}>
          {disciplinas.map(d => {
            const m = DISCIPLINA_META[d.nombre] || META_DEFAULT
            const selected = selectedDisc?.id === d.id
            return (
              <button key={d.id} onClick={() => handleSelectDisc(d)} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem', borderRadius: '20px', border: '2px solid',
                borderColor: selected ? m.color : '#e2e8f0',
                background: selected ? m.bg : 'white',
                color: selected ? m.color : '#475569',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                transition: 'all 0.18s'
              }}>
                <m.Icon size={16} />
                {d.nombre}
              </button>
            )
          })}
        </div>
      </section>

      {/* PASO 2: CANCHA */}
      {selectedDisc && (
        <section className="rs-section">
          <header className="section-header">
            <span style={{ background: '#0f2146', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>2</span>
            <h3>Elige tu cancha · {selectedDisc.nombre}</h3>
          </header>
          {espaciosFiltrados.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No hay canchas disponibles para esta disciplina.</p>
          ) : (
            <div className="rs-espacios-grid" style={{ marginBottom: '1.5rem' }}>
              {espaciosFiltrados.map(esp => {
                const m = DISCIPLINA_META[esp.disciplina] || META_DEFAULT
                const sel = selectedEspacio?.espacio_id === esp.espacio_id
                return (
                  <div key={esp.espacio_id}
                    className={`rs-espacio-card ${sel ? 'active' : ''}`}
                    onClick={() => handleSelectEspacio(esp)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="espacio-img" style={{ padding: 0, height: 80, overflow: 'hidden', position: 'relative' }}>
                      <img src={ESPACIO_IMG} alt={esp.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'cover',
                          filter: sel ? 'brightness(0.85)' : 'none', transition: 'filter 0.2s' }} />
                      {sel && (
                        <div style={{ position: 'absolute', top: 6, right: 6, background: m.color,
                          borderRadius: '50%', width: 20, height: 20, display: 'flex',
                          alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle size={13} color="white" />
                        </div>
                      )}
                    </div>
                    <div className="espacio-info">
                      <h4>{esp.nombre}</h4>
                      {esp.capacidad_maxima && <p>Cap. {esp.capacidad_maxima}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* PASO 3: HORARIO */}
      {selectedEspacio && (
        <section ref={slotsRef} className="rs-section">
          <header className="section-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#0f2146', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>3</span>
              <h3 style={{ margin: 0 }}>Elige tu horario · {selectedEspacio.nombre}</h3>
            </div>
            <button onClick={() => fetchDisponibilidad(selectedEspacio.espacio_id)} style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #e2e8f0',
              borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', color: '#64748b', cursor: 'pointer'
            }}>
              <RotateCcw size={12}/> Actualizar
            </button>
          </header>

          {/* DURACIÓN */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Duración:</span>
            {[1, 2].map(d => (
              <button key={d} onClick={() => handleDuracionChange(d)} style={{
                padding: '0.35rem 1rem', borderRadius: '20px', border: '2px solid',
                borderColor: duracion === d ? '#0f2146' : '#e2e8f0',
                background: duracion === d ? '#0f2146' : 'white',
                color: duracion === d ? 'white' : '#475569',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
              }}>
                {d} hora{d > 1 ? 's' : ''}
              </button>
            ))}
          </div>

          {/* LEYENDA */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { color: '#dcfce7', border: '#86efac', text: 'Libre' },
              { color: '#fee2e2', border: '#fca5a5', text: 'Reservado' },
              { color: '#dbeafe', border: '#93c5fd', text: 'Clase/Sesión' },
            ].map(l => (
              <div key={l.text} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.73rem', color: '#475569' }}>
                <div style={{ width: 12, height: 12, borderRadius: '3px', background: l.color, border: `1px solid ${l.border}` }}/>
                {l.text}
              </div>
            ))}
          </div>

          {/* SLOTS */}
          {loadingSlots ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando disponibilidad...</div>
          ) : cerradoHoy ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '2rem', color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>
              <Ban size={20} style={{ flexShrink: 0 }} />
              El club está cerrado hoy. No hay horarios disponibles.
            </div>
          ) : (
            <div className="rs-slots-grid" style={{ gap: '0.5rem', marginBottom: '1.5rem' }}>
              {slots.map(slot => {
                const isSelected = selectedSlot === slot.hora
                const isExt = duracion === 2 && selectedSlot && (() => {
                  const idx = slots.findIndex(s => s.hora === selectedSlot)
                  return slots[idx + 1]?.hora === slot.hora
                })()
                const isPast = parseInt(slot.hora.split(':')[0]) <= new Date().getHours()
                const valid = slotValido(slot)

                let bg = '#dcfce7', border = '#86efac', color = '#166534'
                if (!slot.libre) {
                  if (slot.motivo === 'sesion') { bg = '#dbeafe'; border = '#93c5fd'; color = '#1e40af' }
                  else { bg = '#fee2e2'; border = '#fca5a5'; color = '#991b1b' }
                }
                if (isPast) { bg = '#f1f5f9'; border = '#e2e8f0'; color = '#94a3b8' }
                if (isSelected || isExt) { bg = '#0f2146'; border = '#0f2146'; color = 'white' }
                if (!isPast && slot.libre && !valid && !isSelected) { bg = '#f8fafc'; border = '#e2e8f0'; color = '#cbd5e1' }

                return (
                  <button key={slot.hora}
                    onClick={() => handleSelectSlot(slot)}
                    disabled={!valid && !isSelected}
                    style={{
                      padding: '0.65rem 0.5rem', borderRadius: '10px',
                      border: `2px solid ${border}`, background: bg, color,
                      fontWeight: 700, fontSize: '0.78rem', cursor: valid || isSelected ? 'pointer' : 'default',
                      transition: 'all 0.15s', textAlign: 'center'
                    }}
                    title={isPast ? 'Horario pasado' : !slot.libre ? (slot.motivo === 'sesion' ? 'Clase programada' : 'Ya reservado') : ''}
                  >
                    {slotLabel(slot.hora)}
                    {isExt && <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px' }}>+1h</div>}
                  </button>
                )
              })}
            </div>
          )}

          {/* BOTÓN RESERVAR */}
          {canReserve && (
            <div className="rs-final-action">
              <button className="rs-book-btn" onClick={() => setModal(true)}>
                <Zap size={20} fill="currentColor"/>
                <span>
                  Reservar {selectedSlot} – {String(Number(selectedSlot.split(':')[0]) + duracion).padStart(2,'0')}:00
                </span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* MODAL CONFIRMACIÓN */}
      {modal && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <button className="close-btn" onClick={() => setModal(false)}>&times;</button>
            <div className="modal-header"><h3>Confirmar Reserva</h3></div>
            <div className="modal-body">
              <p><MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Cancha: <strong>{selectedEspacio?.nombre}</strong></p>
              <p><CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Fecha: <strong>Hoy, {todayLabel()}</strong></p>
              <p><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Horario: <strong>{selectedSlot} – {String(Number(selectedSlot.split(':')[0]) + duracion).padStart(2,'0')}:00</strong> ({duracion}h)</p>
            </div>
            <footer className="modal-footer">
              <button className="modal-btn confirm" onClick={handleConfirmar} disabled={saving}>
                {saving ? 'Procesando...' : 'Confirmar'}
              </button>
              <button className="modal-btn cancel" onClick={() => setModal(false)}>Cancelar</button>
            </footer>
          </div>
        </div>
      )}

    </SocioLayout>
  )
}
