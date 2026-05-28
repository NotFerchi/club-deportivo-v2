import React, { useState, useEffect, useRef, useMemo } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  Baby, Users, Clock, QrCode,
  CheckCircle, Plus, Search,
  Info, AlertCircle as AlertIcon, LogOut, Timer
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import { useNotification } from '../../../context/NotificationContext'
import '../../../../css/socio/Ludoteca.css'

const LIMITE_MINUTOS = 120
const ALERTA_MINUTOS = 90
const CRITICO_MINUTOS = 110

function Ludoteca() {
  const { toast } = useNotification()
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
  const numeroSocio = usuario?.numero_socio || usuario?.socio_id || '—'

  const [vista, setVista] = useState('activos')
  const [registros, setRegistros] = useState([])
  const [aforoActual, setAforoActual] = useState(0)
  const [aforoMaximo, setAforoMaximo] = useState(15)
  const [loading, setLoading] = useState(true)
  const [showModalQR, setShowModalQR] = useState(false)
  const [showModalRegistrar, setShowModalRegistrar] = useState(false)

  // Form states
  const [formNombre, setFormNombre] = useState('')
  const [formFechaNac, setFormFechaNac] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState(null)

  // Salida loading per registro
  const [salidaLoading, setSalidaLoading] = useState({})

  // Live ticker — re-renders every second so countdowns update
  const lastFetchTimeRef = useRef(Date.now())
  const [, tick] = useState(0)

  useEffect(() => {
    fetchData()
    const serverRefresh = setInterval(fetchData, 60000)
    const localTick = setInterval(() => tick(t => t + 1), 1000)
    return () => { clearInterval(serverRefresh); clearInterval(localTick) }
  }, [])

  const fetchData = async () => {
    try {
      const [regsResult, aforoResult] = await Promise.allSettled([
        apiRequest('/ludoteca/mis-registros'),
        apiRequest('/ludoteca/aforo')
      ])
      if (regsResult.status === 'fulfilled') {
        setRegistros(Array.isArray(regsResult.value) ? regsResult.value : [])
      }
      if (aforoResult.status === 'fulfilled' && aforoResult.value) {
        setAforoActual(aforoResult.value.activos || 0)
        setAforoMaximo(aforoResult.value.maximo || 15)
      }
      lastFetchTimeRef.current = Date.now()
    } finally {
      setLoading(false)
    }
  }

  // ── Computed ──
  const registrosActivos = registros.filter(r => r.estado === 'activo')
  const historial = registros.filter(r => r.estado === 'finalizado')

  // Children known from past registros (deduplicated)
  const hijosConocidos = useMemo(() => {
    const map = {}
    registros.forEach(r => {
      if (!map[r.nombre_hijo]) map[r.nombre_hijo] = r.fecha_nacimiento
    })
    return Object.entries(map).map(([nombre, fecha_nacimiento]) => ({ nombre, fecha_nacimiento }))
  }, [registros])

  // Live elapsed minutes = server minutes at fetch + seconds elapsed since fetch
  const getLiveMinutos = (registro) => {
    const serverMins = parseInt(registro.minutos_transcurridos) || 0
    const elapsedMs = Date.now() - lastFetchTimeRef.current
    return serverMins + Math.floor(elapsedMs / 60000)
  }

  const tieneAlertaActiva = registrosActivos.some(r => getLiveMinutos(r) >= ALERTA_MINUTOS)

  // ── Aforo helpers ──
  const getAforoPorcentaje = () => Math.min(Math.round((aforoActual / aforoMaximo) * 100), 100)
  const getAforoColor = () => {
    const p = getAforoPorcentaje()
    if (p >= 90) return 'rojo'
    if (p >= 70) return 'naranja'
    return 'verde'
  }

  // ── Format helpers ──
  const formatTiempo = (minutos) => {
    const m = Math.max(parseInt(minutos) || 0, 0)
    const h = Math.floor(m / 60)
    const mins = m % 60
    return h > 0 ? `${h}h ${mins < 10 ? '0' : ''}${mins}m` : `${mins}m`
  }

  const formatHora = (ts) => {
    if (!ts) return ''
    // La hora ya viene como string México (TO_CHAR sin Z), extraer HH:MM directo
    // para evitar que new Date() aplique conversión de zona horaria (UTC ≠ México)
    const match = String(ts).match(/T(\d{2}):(\d{2})/)
    if (match) {
      const h = parseInt(match[1], 10)
      const m = match[2]
      const suffix = h >= 12 ? 'p. m.' : 'a. m.'
      const h12   = h === 0 ? 12 : h > 12 ? h - 12 : h
      return `${h12}:${m} ${suffix}`
    }
    // Fallback: si viene solo "HH:MM"
    return String(ts).slice(0, 5)
  }

  const formatFechaCorta = (ts) => {
    if (!ts) return ''
    const match = String(ts).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return ts
  }

  const getColorMinutos = (mins) => {
    if (mins >= CRITICO_MINUTOS) return '#dc2626'
    if (mins >= ALERTA_MINUTOS) return '#d97706'
    return '#16a34a'
  }

  const getBgMinutos = (mins) => {
    if (mins >= CRITICO_MINUTOS) return '#fee2e2'
    if (mins >= ALERTA_MINUTOS) return '#fef3c7'
    return '#dcfce7'
  }

  // ── Date limits for the form (3–7 years) ──
  const today = new Date()
  const maxFechaNac = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate()).toISOString().split('T')[0]
  const minFechaNac = new Date(today.getFullYear() - 7, today.getMonth(), today.getDate()).toISOString().split('T')[0]

  // ── Handlers ──
  const abrirFormulario = (hijo = null) => {
    setFormNombre(hijo?.nombre || '')
    setFormFechaNac(hijo?.fecha_nacimiento ? hijo.fecha_nacimiento.split('T')[0] : '')
    setFormError(null)
    setShowModalRegistrar(true)
  }

  const handleRegistrarEntrada = async (e) => {
    e.preventDefault()
    if (!formNombre.trim()) { setFormError('El nombre es requerido'); return }
    if (!formFechaNac) { setFormError('La fecha de nacimiento es requerida'); return }
    setFormLoading(true)
    setFormError(null)
    try {
      await apiRequest('/ludoteca/socio/entrada', {
        method: 'POST',
        body: JSON.stringify({ nombre_hijo: formNombre.trim(), fecha_nacimiento: formFechaNac })
      })
      setShowModalRegistrar(false)
      setVista('activos')
      await fetchData()
    } catch (err) {
      setFormError(err.message || 'Error al registrar entrada')
    } finally {
      setFormLoading(false)
    }
  }

  const handleRegistrarSalida = async (registroId) => {
    setSalidaLoading(prev => ({ ...prev, [registroId]: true }))
    try {
      const res = await apiRequest(`/ludoteca/socio/salida/${registroId}`, { method: 'PATCH' })
      await fetchData()
      if (res.sancion_generada) {
        toast('Se generó una sanción por exceder el límite de 2 horas. Revisa tu estado de cuenta.', 'warning')
      }
    } catch (err) {
      toast(err.message || 'Error al registrar salida', 'error')
    } finally {
      setSalidaLoading(prev => ({ ...prev, [registroId]: false }))
    }
  }

  return (
    <SocioLayout activeTab="ludoteca" title="Club Social | Ludoteca">

      {/* BANNER DE ALERTA — visible en cualquier pestaña */}
      {tieneAlertaActiva && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1.25rem', borderRadius: '12px', marginBottom: '1rem',
          background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e'
        }}>
          <AlertIcon size={22} style={{ flexShrink: 0, color: '#d97706' }} />
          <div>
            <strong>¡Atención!</strong> Uno o más niños están por alcanzar el límite de 2 horas.
            Recógelos en la ludoteca y registra su salida para evitar una sanción.
          </div>
        </div>
      )}

      {/* HEADER */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Ludoteca</h2>
          <p className="rs-subtitle">Cuida de tus hijos mientras disfrutas del club</p>
        </div>
        <div className="rs-status-tags">
        </div>
      </section>

      {/* AFORO */}
      <div className="aforo-card">
        <div className="aforo-info">
          <h3>Aforo Actual</h3>
          <div className="aforo-numeros">
            <span className={`aforo-actual ${getAforoColor()}`}>{aforoActual}</span>
            <span className="aforo-separador">/</span>
            <span className="aforo-maximo">{aforoMaximo}</span>
          </div>
          <div className="aforo-barra">
            <div className={`aforo-fill ${getAforoColor()}`} style={{ width: `${getAforoPorcentaje()}%` }} />
          </div>
          <p className="aforo-mensaje">
            {getAforoColor() === 'verde' && 'Hay lugares disponibles'}
            {getAforoColor() === 'naranja' && 'Aforo casi lleno'}
            {getAforoColor() === 'rojo' && 'Aforo lleno, intenta más tarde'}
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="clases-tabs-container">
        <button
          className={`clases-tab-btn ${vista === 'activos' ? 'active' : ''}`}
          onClick={() => setVista('activos')}
        >
          <Baby size={18} />
          Activos
          {registrosActivos.length > 0 && (
            <span style={{
              marginLeft: '0.35rem', background: tieneAlertaActiva ? '#ef4444' : '#22c55e',
              color: 'white', borderRadius: '50%', width: 20, height: 20,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700
            }}>{registrosActivos.length}</span>
          )}
        </button>
        <button
          className={`clases-tab-btn ${vista === 'historial' ? 'active' : ''}`}
          onClick={() => setVista('historial')}
        >
          <Clock size={18} /> Historial
        </button>
        <button
          className={`clases-tab-btn ${vista === 'info' ? 'active' : ''}`}
          onClick={() => setVista('info')}
        >
          <Info size={18} /> Cómo funciona
        </button>
      </div>

      {/* ─── VISTA: ACTIVOS ─── */}
      {vista === 'activos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, color: 'var(--ds-navy)' }}>Niños en ludoteca ahora</h3>
            <button
              onClick={() => abrirFormulario()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 1.25rem', background: 'var(--ds-navy)',
                border: 'none', borderRadius: '10px', color: 'white',
                fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem'
              }}
            >
              <Plus size={18} /> Registrar entrada
            </button>
          </div>

          {loading ? (
            <div className="loading-state">Cargando...</div>
          ) : registrosActivos.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem' }}>
              <Baby size={48} />
              <h3>Sin niños activos</h3>
              <p>Registra la entrada de tu hijo para empezar a contar su tiempo de estancia.</p>
              <button
                onClick={() => abrirFormulario()}
                style={{
                  marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.5rem', background: 'var(--ds-navy)',
                  border: 'none', borderRadius: '10px', color: 'white',
                  fontWeight: 700, cursor: 'pointer'
                }}
              >
                <Plus size={18} /> Registrar primera entrada
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {registrosActivos.map(r => {
                const mins = getLiveMinutos(r)
                const restantes = Math.max(LIMITE_MINUTOS - mins, 0)
                const pct = Math.min((mins / LIMITE_MINUTOS) * 100, 100)
                const colorPrincipal = getColorMinutos(mins)
                const bgPrincipal = getBgMinutos(mins)
                const esCritico = mins >= CRITICO_MINUTOS
                const esAdvertencia = mins >= ALERTA_MINUTOS && !esCritico

                return (
                  <div key={r.registro_id} style={{
                    background: 'white', borderRadius: '16px', padding: '1.5rem',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                    border: `1px solid ${esCritico ? '#fca5a5' : esAdvertencia ? '#fde68a' : '#e2e8f0'}`
                  }}>
                    {/* Fila superior */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0f172a, #2563eb)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Baby size={22} color="white" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{r.nombre_hijo}</div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            Entrada: {formatHora(r.hora_entrada)}
                          </div>
                        </div>
                      </div>
                      {/* Tiempo transcurrido badge */}
                      <div style={{
                        padding: '0.4rem 1rem', borderRadius: '20px',
                        background: bgPrincipal, color: colorPrincipal,
                        fontWeight: 800, fontSize: '1rem',
                        display: 'flex', alignItems: 'center', gap: '0.4rem'
                      }}>
                        <Timer size={16} />
                        {formatTiempo(mins)}
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div style={{ marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>
                        <span>Tiempo transcurrido</span>
                        <span style={{ color: colorPrincipal, fontWeight: 700 }}>
                          {mins >= LIMITE_MINUTOS ? '¡Tiempo superado!' : `Quedan ${formatTiempo(restantes)}`}
                        </span>
                      </div>
                      <div style={{ height: 10, background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '5px',
                          width: `${pct}%`,
                          background: colorPrincipal,
                          transition: 'width 1s linear'
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        <span>0 min</span>
                        <span style={{ color: '#d97706' }}>90 min</span>
                        <span style={{ color: '#dc2626' }}>120 min</span>
                      </div>
                    </div>

                    {/* Alerta */}
                    {(esAdvertencia || esCritico) && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 0.875rem', borderRadius: '8px', marginBottom: '1rem',
                        background: esCritico ? '#fee2e2' : '#fef3c7',
                        color: esCritico ? '#991b1b' : '#92400e',
                        fontSize: '0.85rem', fontWeight: 600
                      }}>
                        <AlertIcon size={16} />
                        {esCritico
                          ? '¡Tiempo límite superado! Recoge a tu hijo para evitar una sanción.'
                          : `Quedan menos de ${formatTiempo(restantes)} — recuerda recoger a tu hijo.`}
                      </div>
                    )}

                    {/* Botón salida */}
                    <button
                      onClick={() => handleRegistrarSalida(r.registro_id)}
                      disabled={salidaLoading[r.registro_id]}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', padding: '0.75rem',
                        background: esCritico ? '#dc2626' : 'var(--ds-navy)',
                        border: 'none', borderRadius: '10px', color: 'white',
                        fontWeight: 700, cursor: salidaLoading[r.registro_id] ? 'not-allowed' : 'pointer',
                        opacity: salidaLoading[r.registro_id] ? 0.7 : 1,
                        fontSize: '0.95rem'
                      }}
                    >
                      <LogOut size={18} />
                      {salidaLoading[r.registro_id] ? 'Procesando...' : 'Registrar salida'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── VISTA: HISTORIAL ─── */}
      {vista === 'historial' && (
        <div className="historial-view">
          <h3>Historial de visitas</h3>

          {loading ? (
            <div className="loading-state">Cargando...</div>
          ) : historial.length === 0 ? (
            <div className="empty-state">
              <Search size={48} />
              <h3>Sin historial</h3>
              <p>Las visitas completadas aparecerán aquí</p>
            </div>
          ) : (
            <div className="historial-list">
              {historial.map(r => {
                // Extraer fecha directamente del string "YYYY-MM-DDTHH:MM:SS" (ya es hora México)
                const fechaMatch = r.hora_entrada ? String(r.hora_entrada).match(/^(\d{4})-(\d{2})-(\d{2})/) : null
                const _dia = fechaMatch ? fechaMatch[3] : '—'
                const _mes = fechaMatch
                  ? new Date(Number(fechaMatch[1]), Number(fechaMatch[2]) - 1, 1)
                      .toLocaleString('es-MX', { month: 'short' })
                  : ''
                return (
                  <div key={r.registro_id} className="historial-item">
                    <div className="historial-fecha">
                      <span className="dia">{_dia}</span>
                      <span className="mes">{_mes}</span>
                    </div>
                    <div className="historial-detalles">
                      <h4>{r.nombre_hijo}</h4>
                      <p>
                        <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />
                        {formatHora(r.hora_entrada)}
                        {r.hora_salida ? ` → ${formatHora(r.hora_salida)}` : ''}
                        {r.minutos_transcurridos ? ` · ${formatTiempo(r.minutos_transcurridos)}` : ''}
                      </p>
                    </div>
                    <span className="historial-status completado">
                      <CheckCircle size={15} /> Completado
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── VISTA: CÓMO FUNCIONA ─── */}
      {vista === 'info' && (
        <div className="reservar-view">
          <div className="reservar-info-card">
            <Info size={24} />
            <div>
              <h4>Cómo funciona la ludoteca</h4>
              <p>Registra la entrada de tu hijo desde esta app. El sistema empezará a contar las 2 horas de estancia y te notificará cuando esté por terminar.</p>
            </div>
          </div>
          <div className="instrucciones-card">
            <h4>Pasos:</h4>
            <ol>
              <li>Ve a la pestaña <strong>Activos</strong> y pulsa <em>Registrar entrada</em></li>
              <li>Ingresa el nombre y fecha de nacimiento de tu hijo (3–7 años)</li>
              <li>Deja a tu hijo en la ludoteca con el personal</li>
              <li>El contador se actualizará en tiempo real</li>
              <li>Al recogerlo, pulsa <em>Registrar salida</em> desde la app o en recepción</li>
              <li>Superar las 2 horas genera una sanción automática</li>
            </ol>
          </div>
        </div>
      )}

      {/* ─── MODAL: REGISTRAR ENTRADA ─── */}
      {showModalRegistrar && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <header className="modal-header">
              <h3>Registrar entrada a ludoteca</h3>
              <button className="close-btn" onClick={() => setShowModalRegistrar(false)}>&times;</button>
            </header>
            <div className="modal-body">
              {/* Acceso rápido — hijos anteriores */}
              {hijosConocidos.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.6rem', fontWeight: 600 }}>
                    Hijos registrados anteriormente:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {hijosConocidos.map(h => (
                      <button
                        key={h.nombre}
                        onClick={() => abrirFormulario(h)}
                        style={{
                          padding: '0.4rem 1rem', background: '#f1f5f9',
                          border: '1px solid #e2e8f0', borderRadius: '20px',
                          color: '#0f172a', fontWeight: 600, cursor: 'pointer',
                          fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem'
                        }}
                      >
                        <Baby size={14} /> {h.nombre}
                      </button>
                    ))}
                  </div>
                  <div style={{ borderBottom: '1px solid #e2e8f0', margin: '1rem 0' }} />
                </div>
              )}

              <form onSubmit={handleRegistrarEntrada} className="form-agregar-hijo">
                <div className="form-group">
                  <label>Nombre completo del niño</label>
                  <input
                    type="text"
                    placeholder="Ej: Sofía García"
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de nacimiento <span style={{ fontWeight: 400, color: '#64748b' }}>(entre 3 y 7 años)</span></label>
                  <input
                    type="date"
                    value={formFechaNac}
                    min={minFechaNac}
                    max={maxFechaNac}
                    onChange={e => setFormFechaNac(e.target.value)}
                    required
                  />
                </div>

                {formError && (
                  <div style={{
                    padding: '0.75rem 1rem', background: '#fee2e2', borderRadius: '10px',
                    color: '#991b1b', fontWeight: 600, fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'
                  }}>
                    <AlertIcon size={17} /> {formError}
                  </div>
                )}

                <div style={{
                  padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '10px',
                  color: '#1e40af', fontSize: '0.82rem', marginBottom: '0.5rem'
                }}>
                  Al confirmar, el contador de 2 horas comenzará. Recibirás una alerta cuando el tiempo esté por agotarse.
                </div>

                <div className="modal-footer" style={{ padding: '0.5rem 0 0', border: 'none' }}>
                  <button type="submit" className="modal-btn confirm" disabled={formLoading}>
                    {formLoading ? 'Registrando...' : '✓ Confirmar entrada'}
                  </button>
                  <button type="button" className="modal-btn cancel" onClick={() => setShowModalRegistrar(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: QR ─── */}
      {showModalQR && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-qr">
            <header className="modal-header">
              <h3>Mi Código QR</h3>
              <button className="close-btn" onClick={() => setShowModalQR(false)}>&times;</button>
            </header>
            <div className="modal-body text-center">
              <div className="qr-display"><QrCode size={200} /></div>
              <p className="qr-instruccion">Presenta este código en recepción si necesitas apoyo del personal</p>
              <div className="qr-codigo"><strong>Código: </strong>{numeroSocio}</div>
            </div>
          </div>
        </div>
      )}

    </SocioLayout>
  )
}

export default Ludoteca
