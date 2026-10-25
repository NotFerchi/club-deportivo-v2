import React, { useState, useEffect } from 'react'
import SocioLayout from '../../components/SocioLayout'
import { CheckCircle, AlertTriangle, Trophy, Clock, Baby, CalendarDays, ShieldAlert, Camera } from 'lucide-react'
import { apiRequest, API_BASE_URL } from '../../services/api'
import { useNotification } from '../../context/NotificationContext'
import { Alert, Avatar, Badge, Button, Card, Stack, StatCard, Text } from '../../components/ui'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Fila de las listas del inicio: título, detalle y una etiqueta a la derecha
function Fila({ titulo, detalle, children }) {
  return (
    <Stack direction="row" gap={12} align="center" justify="between">
      <Stack gap={0}>
        <Text variant="small">{titulo}</Text>
        {detalle && <Text variant="caption" muted>{detalle}</Text>}
      </Stack>
      {children}
    </Stack>
  )
}

export default function DashboardSocio() {
  const { toast } = useNotification()
  const usuario   = JSON.parse(localStorage.getItem('usuario') || '{}')
  const socioId   = usuario?.socio_id
  const fullName  = [usuario?.nombres, usuario?.apellido_paterno].filter(Boolean).join(' ') || usuario?.email?.split('@')[0] || 'Socio'

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
    { icon: <CalendarDays size={20} />, valor: loading ? '…' : reservasHoy.length,     label: 'Reservas hoy',      tone: 'primary' },
    { icon: <Trophy size={20} />,       valor: loading ? '…' : torneosActivos.length,   label: 'Torneos activos',   tone: 'success' },
    { icon: <Baby size={20} />,         valor: loading ? '…' : niosActivos.length,      label: 'Niños en ludoteca', tone: 'warning' },
    { icon: <ShieldAlert size={20} />,  valor: loading ? '…' : sancionesActivas.length, label: 'Sanciones activas',
      tone: sancionesActivas.length > 0 ? 'danger' : 'success' },
  ]

  return (
    <SocioLayout activeTab="inicio" title="Club Social y Deportivo | Inicio">
      <Stack gap={24}>

        {/* HERO */}
        <Stack direction="row" gap={16} align="center" wrap>

          {/* Avatar con foto */}
          <Stack gap={8} align="center">
            <Avatar name={fullName} src={fotoPerfil} size="lg" />
            <Button
              variant="secondary"
              onClick={() => document.getElementById('input-foto-perfil').click()}
              disabled={subiendoFoto}
              title="Cambiar foto de perfil"
            >
              <Camera size={14} />
              {subiendoFoto ? 'Subiendo...' : 'Cambiar foto'}
            </Button>
            <input
              id="input-foto-perfil"
              type="file"
              accept="image/*"
              hidden
              onChange={handleFotoChange}
            />
          </Stack>

          {/* Info */}
          <Stack gap={8}>
            <Stack gap={4}>
              <Text variant="heading">Buen día, {fullName}</Text>
              <Text variant="small" muted>{fechaLabel}</Text>
            </Stack>
            <Stack direction="row" gap={8} wrap>
              <Badge variant={estadoCuenta === 'sancionado' ? 'danger' : estadoCuenta === 'advertencia' ? 'warning' : 'success'}>
                <CheckCircle size={14} />
                {estadoCuenta === 'activo' ? 'Al corriente' : estadoCuenta === 'advertencia' ? 'Advertencia' : 'Sancionado'}
              </Badge>
              {usuario.numero_socio && (
                <Badge>Socio #{usuario.numero_socio}</Badge>
              )}
            </Stack>
          </Stack>
        </Stack>

        {/* BANNER SANCIÓN */}
        {sancionesActivas.length > 0 && (
          <Alert variant="error">
            Tienes {sancionesActivas.length} sanción{sancionesActivas.length > 1 ? 'es' : ''} activa{sancionesActivas.length > 1 ? 's' : ''}.
            Revisa la pestaña de Sanciones para más información.
          </Alert>
        )}

        {/* KPIs */}
        <Stack direction="row" gap={16} grow minChild={160}>
          {kpis.map((k, i) => (
            <StatCard key={i} label={k.label} value={k.valor} tone={k.tone} icon={k.icon} />
          ))}
        </Stack>

        {/* RESERVAS HOY */}
        <Card title="Reservas de hoy" icon={<CalendarDays size={18} />}>
          <Stack gap={12}>
            {loading ? (
              <Text variant="small" muted>Cargando…</Text>
            ) : reservasHoy.length === 0 ? (
              <Fila titulo="Sin reservas hoy" detalle="Ve a Reservas para apartar una cancha" />
            ) : (
              reservasHoy.map(r => (
                <Fila
                  key={r.reserva_id}
                  titulo={r.espacio_nombre || `Espacio #${r.espacio_id}`}
                  detalle={<><Clock size={12} /> {String(r.hora_inicio).slice(0,5)} – {String(r.hora_fin).slice(0,5)}</>}
                >
                  <Badge variant="success">Confirmada</Badge>
                </Fila>
              ))
            )}
          </Stack>
        </Card>

        {/* TORNEOS */}
        <Card title="Mis torneos" icon={<Trophy size={18} />}>
          <Stack gap={12}>
            {loading ? (
              <Text variant="small" muted>Cargando…</Text>
            ) : torneos.length === 0 ? (
              <Fila titulo="Sin participaciones" detalle="Inscríbete en Torneos para ver tus competencias" />
            ) : (
              torneos.slice(0, 4).map(t => {
                const estadoVariante = t.estado === 'Finalizado'
                  ? 'neutral'
                  : t.estado === 'En_curso'
                  ? 'info'
                  : 'success'
                return (
                  <Fila
                    key={t.participante_id}
                    titulo={t.nombre}
                    detalle={`${t.nombre_disciplina}${t.categoria ? ` · ${t.categoria}` : ''}`}
                  >
                    <Badge variant={estadoVariante}>
                      {t.estado === 'En_curso' ? 'En curso' : t.estado === 'Finalizado' ? 'Finalizado' : 'Inscrito'}
                    </Badge>
                  </Fila>
                )
              })
            )}
          </Stack>
        </Card>

        {/* LUDOTECA */}
        {(niosActivos.length > 0 || aforo) && (
          <Card
            title="Ludoteca"
            icon={<Baby size={18} />}
            action={aforo && <Text variant="caption" muted>Aforo: {aforo.activos}/{aforo.maximo}</Text>}
          >
            <Stack gap={12}>
              {niosActivos.length === 0 ? (
                <Fila titulo="Sin niños activos" />
              ) : (
                niosActivos.map(r => (
                  <Fila
                    key={r.registro_id}
                    titulo={r.nombre_hijo}
                    detalle={<><Clock size={12} /> {r.minutos_transcurridos} min transcurridos</>}
                  >
                    <Badge variant={Number(r.minutos_transcurridos) >= 110 ? 'danger' : 'success'}>
                      {Number(r.minutos_transcurridos) >= 110
                        ? <><AlertTriangle size={11} /> Casi 2h</>
                        : 'Activo'}
                    </Badge>
                  </Fila>
                ))
              )}
            </Stack>
          </Card>
        )}

        {/* SANCIONES */}
        {sancionesActivas.length > 0 && (
          <Card title="Sanciones activas" icon={<ShieldAlert size={18} />}>
            <Stack gap={12}>
              {sancionesActivas.map(s => (
                <Fila
                  key={s.sancion_id}
                  titulo={s.motivo || 'Sin descripción'}
                  detalle={`${s.origen}${s.fecha_inicio ? ` · desde ${String(s.fecha_inicio).slice(0,10)}` : ''}`}
                >
                  <Badge variant={String(s.gravedad).toLowerCase() === 'grave' ? 'danger'
                    : String(s.gravedad).toLowerCase() === 'moderada' ? 'warning' : 'info'}>
                    {s.gravedad || 'Leve'}
                  </Badge>
                </Fila>
              ))}
            </Stack>
          </Card>
        )}

      </Stack>
    </SocioLayout>
  )
}
