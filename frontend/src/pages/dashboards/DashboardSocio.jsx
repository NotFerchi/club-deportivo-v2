import React, { useState, useEffect } from 'react'
import SocioLayout from '../../components/SocioLayout'
import { CheckCircle, AlertTriangle, Trophy, Clock, Baby, CalendarDays, ShieldAlert, Camera, Loader2 } from 'lucide-react'
import { apiRequest, API_BASE_URL } from '../../services/api'
import { useNotification } from '../../context/NotificationContext'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function DashboardSocio() {
  const { toast } = useNotification()
  const usuario   = JSON.parse(localStorage.getItem('usuario') || '{}')
  const socioId   = usuario?.socio_id
  const fullName  = [usuario?.nombres, usuario?.apellido_paterno].filter(Boolean).join(' ') || usuario?.email?.split('@')[0] || 'Socio'
  const initials  = [usuario?.nombres, usuario?.apellido_paterno].filter(Boolean).map(s => s[0].toUpperCase()).join('') || '?'

  const [reservasHoy,  setReservasHoy]  = useState([])
  const [sanciones,    setSanciones]    = useState([])
  const [torneos,      setTorneos]      = useState([])
  const [ludoteca,     setLudoteca]     = useState([])
  const [aforo,        setAforo]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [fotoPerfil,   setFotoPerfil]   = useState(usuario?.foto_perfil || null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  useEffect(() => {
    if (!socioId) { setLoading(false); return }

    const hoy = todayISO()

    Promise.allSettled([
      apiRequest('/reservas'),
      apiRequest(`/sanciones/socio/${socioId}`),
      apiRequest('/torneos/mis-participaciones'),
      apiRequest('/ludoteca/mis-registros'),
      apiRequest('/ludoteca/aforo'),
    ]).then(([resReservas, resSanciones, resTorneos, resLudoteca, resAforo]) => {
      if (resReservas.status === 'fulfilled') {
        const todas = Array.isArray(resReservas.value) ? resReservas.value : []
        // String(r.fecha).slice(0,10) normaliza tanto 'YYYY-MM-DD' como 'YYYY-MM-DDTHH:mm:ssZ'
        setReservasHoy(todas.filter(r =>
          String(r.fecha).slice(0, 10) === hoy &&
          Number(r.socio_id) === Number(socioId) &&
          r.estado !== 'cancelada'
        ))
      }
      if (resSanciones.status === 'fulfilled') {
        setSanciones(Array.isArray(resSanciones.value) ? resSanciones.value : [])
      }
      if (resTorneos.status === 'fulfilled') {
        setTorneos(Array.isArray(resTorneos.value) ? resTorneos.value : [])
      }
      if (resLudoteca.status === 'fulfilled') {
        setLudoteca(Array.isArray(resLudoteca.value) ? resLudoteca.value : [])
      }
      if (resAforo.status === 'fulfilled') {
        setAforo(resAforo.value)
      }
      setLoading(false)
    })
  }, [socioId])

  const handleFotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('La imagen debe ser menor a 5MB', 'warning'); return }

    setSubiendoFoto(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('foto', file)
      const res = await fetch(`${API_BASE_URL}/usuarios/me/foto`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Error al subir foto', 'error'); return }
      setFotoPerfil(data.foto_perfil)
      const usuarioActualizado = { ...usuario, foto_perfil: data.foto_perfil }
      localStorage.setItem('usuario', JSON.stringify(usuarioActualizado))
    } catch { toast('Error de conexión', 'error') }
    finally { setSubiendoFoto(false) }
  }

  const sancionesActivas = sanciones.filter(s =>
    String(s.estado).toLowerCase() === 'activa' ||
    String(s.estado).toLowerCase() === 'activo'
  )
  const niosActivos    = ludoteca.filter(r => r.estado === 'activo')
  const torneosActivos = torneos.filter(t => t.estado !== 'Finalizado')

  const estadoCuenta = sancionesActivas.some(s =>
    ['grave','moderada'].includes(String(s.gravedad).toLowerCase())
  ) ? 'sancionado' : sancionesActivas.length > 0 ? 'advertencia' : 'activo'

  const fechaLabel = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City'
  })

  const kpis = [
    { icon: <CalendarDays size={20} />, valor: loading ? '…' : reservasHoy.length,     label: 'Reservas hoy',      color: '#1e40af', bg: '#dbeafe' },
    { icon: <Trophy size={20} />,       valor: loading ? '…' : torneosActivos.length,   label: 'Torneos activos',   color: '#15803d', bg: '#dcfce7' },
    { icon: <Baby size={20} />,         valor: loading ? '…' : niosActivos.length,      label: 'Niños en ludoteca', color: '#c2410c', bg: '#ffedd5' },
    { icon: <ShieldAlert size={20} />,  valor: loading ? '…' : sancionesActivas.length, label: 'Sanciones activas',
      color: sancionesActivas.length > 0 ? '#991b1b' : '#166534',
      bg:    sancionesActivas.length > 0 ? '#fee2e2' : '#dcfce7' },
  ]

  return (
    <SocioLayout activeTab="inicio" title="Club Social y Deportivo | Inicio">

      {/* HERO */}
      <section className="ds-welcome-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>

        {/* Avatar con foto */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => document.getElementById('input-foto-perfil').click()}
            title="Cambiar foto de perfil"
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0f2146 0%, #1e6091 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px',
              boxShadow: '0 4px 14px rgba(15,33,70,0.25)',
              overflow: 'hidden', cursor: 'pointer'
            }}
          >
            {fotoPerfil
              ? <img src={fotoPerfil} alt="Foto de perfil"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>

          {/* Spinner subiendo */}
          {subiendoFoto && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Loader2
                size={20}
                color="white"
                style={{ animation: 'spin 0.8s linear infinite' }}
              />
            </div>
          )}

          {/* Botón cámara */}
          <div
            onClick={() => document.getElementById('input-foto-perfil').click()}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 20, height: 20, borderRadius: '50%',
              background: '#2563eb', border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Camera size={11} color="white" />
          </div>

          <input
            id="input-foto-perfil"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFotoChange}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div className="ds-welcome-info" style={{ marginBottom: 8 }}>
            <h2 className="ds-title-serif" style={{ marginBottom: 2 }}>Buen día, {fullName}</h2>
            <p className="ds-subtitle" style={{ textTransform: 'capitalize', margin: 0 }}>{fechaLabel}</p>
          </div>
          <div className="ds-status-tags">
            <span
              className={`tag-active ${estadoCuenta !== 'activo' ? 'tag-warn' : ''}`}
              style={
                estadoCuenta === 'sancionado' ? { background: '#fee2e2', color: '#991b1b' }
                : estadoCuenta === 'advertencia' ? { background: '#fef3c7', color: '#92400e' }
                : {}
              }
            >
              <CheckCircle size={14} />
              {estadoCuenta === 'activo' ? 'Al corriente' : estadoCuenta === 'advertencia' ? 'Advertencia' : 'Sancionado'}
            </span>
            {usuario.numero_socio && (
              <span className="tag-category">Socio #{usuario.numero_socio}</span>
            )}
          </div>
        </div>
      </section>

      {/* BANNER SANCIÓN */}
      {sancionesActivas.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1.25rem', borderRadius: '12px', marginBottom: '1rem',
          background: '#fee2e2', color: '#991b1b', fontWeight: 600, fontSize: '0.875rem'
        }}>
          <AlertTriangle size={18} />
          Tienes {sancionesActivas.length} sanción{sancionesActivas.length > 1 ? 'es' : ''} activa{sancionesActivas.length > 1 ? 's' : ''}.
          Revisa la pestaña de Sanciones para más información.
        </div>
      )}

      {/* KPIs */}
      <div className="ds-grid-kpi">
        {kpis.map((k, i) => (
          <div key={i} className="ds-card-stat">
            <div className="stat-icon" style={{ background: k.bg, color: k.color }}>
              {k.icon}
            </div>
            <div className="stat-data">
              <span className="stat-number"
                style={k.valor > 0 && k.label.includes('Sanción') ? { color: '#dc2626' } : {}}>
                {k.valor}
              </span>
              <span className="stat-label">{k.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* DOS COLUMNAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>

        {/* RESERVAS HOY */}
        <section className="ds-section-card">
          <header className="section-header">
            <CalendarDays size={18} />
            <h3>Reservas de hoy</h3>
          </header>
          <div className="ds-list">
            {loading ? (
              <div className="ds-list-item"><div className="item-info"><h4>Cargando…</h4></div></div>
            ) : reservasHoy.length === 0 ? (
              <div className="ds-list-item">
                <div className="item-info">
                  <h4>Sin reservas hoy</h4>
                  <p>Ve a Reservas para apartar una cancha</p>
                </div>
              </div>
            ) : (
              reservasHoy.map(r => (
                <div key={r.reserva_id} className="ds-list-item">
                  <div className="item-info">
                    <h4>{r.espacio_nombre || `Espacio #${r.espacio_id}`}</h4>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {String(r.hora_inicio).slice(0,5)} – {String(r.hora_fin).slice(0,5)}
                    </p>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                    background: '#dcfce7', color: '#166534'
                  }}>Confirmada</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* TORNEOS */}
        <section className="ds-section-card">
          <header className="section-header">
            <Trophy size={18} />
            <h3>Mis torneos</h3>
          </header>
          <div className="ds-list">
            {loading ? (
              <div className="ds-list-item"><div className="item-info"><h4>Cargando…</h4></div></div>
            ) : torneos.length === 0 ? (
              <div className="ds-list-item">
                <div className="item-info">
                  <h4>Sin participaciones</h4>
                  <p>Inscríbete en Torneos para ver tus competencias</p>
                </div>
              </div>
            ) : (
              torneos.slice(0, 4).map(t => {
                const estadoColor = t.estado === 'Finalizado'
                  ? { bg: '#f1f5f9', color: '#64748b' }
                  : t.estado === 'En_curso'
                  ? { bg: '#dbeafe', color: '#1e40af' }
                  : { bg: '#dcfce7', color: '#15803d' }
                return (
                  <div key={t.participante_id} className="ds-list-item">
                    <div className="item-info">
                      <h4>{t.nombre}</h4>
                      <p>{t.nombre_disciplina}{t.categoria ? ` · ${t.categoria}` : ''}</p>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                      background: estadoColor.bg, color: estadoColor.color
                    }}>
                      {t.estado === 'En_curso' ? 'En curso' : t.estado === 'Finalizado' ? 'Finalizado' : 'Inscrito'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* LUDOTECA */}
        {(niosActivos.length > 0 || aforo) && (
          <section className="ds-section-card">
            <header className="section-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Baby size={18} />
                <h3>Ludoteca</h3>
              </div>
              {aforo && (
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                  Aforo: {aforo.activos}/{aforo.maximo}
                </span>
              )}
            </header>
            <div className="ds-list">
              {niosActivos.length === 0 ? (
                <div className="ds-list-item">
                  <div className="item-info"><h4>Sin niños activos</h4></div>
                </div>
              ) : (
                niosActivos.map(r => (
                  <div key={r.registro_id} className="ds-list-item">
                    <div className="item-info">
                      <h4>{r.nombre_hijo}</h4>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {r.minutos_transcurridos} min transcurridos
                      </p>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                      background: Number(r.minutos_transcurridos) >= 110 ? '#fee2e2' : '#dcfce7',
                      color:      Number(r.minutos_transcurridos) >= 110 ? '#991b1b' : '#166534'
                    }}>
                      {Number(r.minutos_transcurridos) >= 110
                        ? <><AlertTriangle size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Casi 2h</>
                        : 'Activo'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* SANCIONES */}
        {sancionesActivas.length > 0 && (
          <section className="ds-section-card">
            <header className="section-header">
              <ShieldAlert size={18} style={{ color: '#dc2626' }} />
              <h3>Sanciones activas</h3>
            </header>
            <div className="ds-list">
              {sancionesActivas.map(s => (
                <div key={s.sancion_id} className="ds-list-item">
                  <div className="item-info">
                    <h4>{s.motivo || 'Sin descripción'}</h4>
                    <p>{s.origen}{s.fecha_inicio ? ` · desde ${String(s.fecha_inicio).slice(0,10)}` : ''}</p>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                    background: String(s.gravedad).toLowerCase() === 'grave' ? '#fee2e2'
                      : String(s.gravedad).toLowerCase() === 'moderada' ? '#fef3c7' : '#fef9c3',
                    color: String(s.gravedad).toLowerCase() === 'grave' ? '#991b1b'
                      : String(s.gravedad).toLowerCase() === 'moderada' ? '#92400e' : '#713f12'
                  }}>
                    {s.gravedad || 'Leve'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

    </SocioLayout>
  )
}