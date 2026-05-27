import { useState, useEffect, useRef, useCallback } from 'react'
import { apiRequest } from '../services/api'

/* ── helpers ─────────────────────────────────────────────── */
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Minutos que faltan para que llegue `horaStr` ("HH:MM" o "HH:MM:SS"). */
function minutosHasta(horaStr) {
  if (!horaStr) return null
  const [h, m] = String(horaStr).split(':').map(Number)
  const now = new Date()
  return (h * 60 + (m || 0)) - (now.getHours() * 60 + now.getMinutes())
}

/** Día de semana al estilo BD (Lun=1 … Dom=7). */
function diaSemanaHoy() {
  const js = new Date().getDay() // 0=Dom
  return js === 0 ? 7 : js
}

/* ── hook ────────────────────────────────────────────────── */
export function useNotificacionesSocio() {
  const [notificaciones, setNotificaciones] = useState([])

  // Claves ya mostradas esta sesión (para no repetir toasts)
  const mostradas = useRef(
    new Set(JSON.parse(sessionStorage.getItem('noti_keys') || '[]'))
  )

  const guardarMostrada = (key) => {
    mostradas.current.add(key)
    sessionStorage.setItem('noti_keys', JSON.stringify([...mostradas.current]))
  }

  const push = useCallback((noti) => {
    if (mostradas.current.has(noti.id)) return   // ya mostrada esta sesión
    guardarMostrada(noti.id)
    setNotificaciones(prev => {
      if (prev.some(n => n.id === noti.id)) return prev
      return [{ ...noti, leida: false, ts: Date.now() }, ...prev].slice(0, 30)
    })
  }, [])

  /* ── polling ─────────────────────────────────────────────── */
  const poll = useCallback(async () => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
    const socioId = usuario?.socio_id
    if (!socioId) return

    const hoy    = todayISO()
    const diaSem = diaSemanaHoy()

    /* 1 ── Ludoteca: alerta a los 105 min (15 min antes del límite) y a los 120 */
    try {
      const data = await apiRequest('/ludoteca/mis-registros')
      const activos = (Array.isArray(data) ? data : []).filter(r => r.estado === 'activo')
      for (const r of activos) {
        const mins = Number(r.minutos_transcurridos)
        if (mins >= 120) {
          push({
            id: `ludoteca-${r.registro_id}-limite`,
            tipo: 'ludoteca',
            titulo: '🚨 Tiempo en ludoteca agotado',
            mensaje: `${r.nombre_hijo} ya cumplió 2 horas. Por favor recógelo en la ludoteca.`,
          })
        } else if (mins >= 105) {
          push({
            id: `ludoteca-${r.registro_id}-warn`,
            tipo: 'ludoteca',
            titulo: '⚠ Ludoteca — casi 2 horas',
            mensaje: `${r.nombre_hijo} lleva ${mins} min. Le quedan aprox. ${120 - mins} minutos.`,
          })
        }
      }
    } catch { /* silencioso */ }

    /* 2 ── Reservas: aviso 30 min antes */
    try {
      const data = await apiRequest('/reservas')
      const hoyReservas = (Array.isArray(data) ? data : []).filter(r =>
        String(r.fecha).slice(0, 10) === hoy &&
        Number(r.socio_id) === Number(socioId) &&
        r.estado !== 'cancelada'
      )
      for (const r of hoyReservas) {
        const mins = minutosHasta(r.hora_inicio)
        if (mins !== null && mins >= 0 && mins <= 30) {
          push({
            id: `reserva-${r.reserva_id}`,
            tipo: 'reserva',
            titulo: '📅 Reserva próxima',
            mensaje: `Tu reserva de ${r.espacio_nombre || 'cancha'} comienza en ${mins} min (${String(r.hora_inicio).slice(0, 5)}).`,
          })
        }
      }
    } catch { /* silencioso */ }

    /* 3 ── Clases: aviso 30 min antes (día de la semana actual) */
    try {
      const data = await apiRequest(`/inscripciones/mis-inscripciones?socioId=${socioId}`)
      const clasesHoy = (Array.isArray(data) ? data : []).filter(c =>
        Number(c.dia_semana) === diaSem
      )
      for (const c of clasesHoy) {
        const mins = minutosHasta(c.hora_inicio)
        if (mins !== null && mins >= 0 && mins <= 30) {
          push({
            id: `clase-${c.sesion_id}-${hoy}`,
            tipo: 'clase',
            titulo: '🎓 Clase próxima',
            mensaje: `Tu clase de ${c.disciplina || 'disciplina'} en ${c.espacio || ''} empieza en ${mins} min (${String(c.hora_inicio).slice(0, 5)}).`,
          })
        }
      }
    } catch { /* silencioso */ }
  }, [push])

  /* polling inicial + cada 60 s */
  useEffect(() => {
    poll()
    const id = setInterval(poll, 60_000)
    return () => clearInterval(id)
  }, [poll])

  /* ── acciones ────────────────────────────────────────────── */
  const marcarLeida       = (id) => setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  const marcarTodasLeidas = ()   => setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
  const eliminar          = (id) => setNotificaciones(prev => prev.filter(n => n.id !== id))

  const noLeidas = notificaciones.filter(n => !n.leida).length

  return { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, eliminar }
}
