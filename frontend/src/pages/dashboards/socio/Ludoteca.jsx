import React, { useState, useEffect, useRef, useMemo } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  Baby, Clock, QrCode,
  CheckCircle, Plus,
  Info, LogOut, Timer
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import { useNotification } from '../../../context/NotificationContext'
import { Alert, Badge, Button, Card, Chip, Input, Modal, ProgressBar, Stack, Table, Text } from '../../../components/ui'

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

  // minutos → variante de Badge/Alert del kit
  const getVarianteMinutos = (mins) => {
    if (mins >= CRITICO_MINUTOS) return 'danger'
    if (mins >= ALERTA_MINUTOS) return 'warning'
    return 'success'
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

  const columnasHistorial = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (r) => {
        // Extraer fecha directamente del string "YYYY-MM-DDTHH:MM:SS" (ya es hora México)
        const fechaMatch = r.hora_entrada ? String(r.hora_entrada).match(/^(\d{4})-(\d{2})-(\d{2})/) : null
        const _dia = fechaMatch ? fechaMatch[3] : '—'
        const _mes = fechaMatch
          ? new Date(Number(fechaMatch[1]), Number(fechaMatch[2]) - 1, 1)
              .toLocaleString('es-MX', { month: 'short' })
          : ''
        return `${_dia} ${_mes}`
      },
    },
    { key: 'nombre_hijo', header: 'Niño' },
    { key: 'hora_entrada', header: 'Entrada', render: (r) => formatHora(r.hora_entrada) },
    { key: 'hora_salida', header: 'Salida', render: (r) => (r.hora_salida ? formatHora(r.hora_salida) : '—') },
    { key: 'minutos_transcurridos', header: 'Duración', render: (r) => (r.minutos_transcurridos ? formatTiempo(r.minutos_transcurridos) : '—') },
    { key: 'estado', header: 'Estado', render: () => <Badge variant="success"><CheckCircle size={14} /> Completado</Badge> },
  ]

  return (
    <SocioLayout activeTab="ludoteca" title="Club Social | Ludoteca">
      <Stack gap={24}>

        {/* BANNER DE ALERTA — visible en cualquier pestaña */}
        {tieneAlertaActiva && (
          <Alert variant="warning" title="¡Atención!">
            Uno o más niños están por alcanzar el límite de 2 horas.
            Recógelos en la ludoteca y registra su salida para evitar una sanción.
          </Alert>
        )}

        {/* HEADER */}
        <Stack gap={4}>
          <Text variant="heading">Ludoteca</Text>
          <Text variant="small" muted>Cuida de tus hijos mientras disfrutas del club</Text>
        </Stack>

        {/* AFORO */}
        <Card title="Aforo Actual">
          <Stack gap={8}>
            <ProgressBar value={aforoActual} max={aforoMaximo} label="Niños en ludoteca" />
            <Text variant="small" muted>
              {getAforoColor() === 'verde' && 'Hay lugares disponibles'}
              {getAforoColor() === 'naranja' && 'Aforo casi lleno'}
              {getAforoColor() === 'rojo' && 'Aforo lleno, intenta más tarde'}
            </Text>
          </Stack>
        </Card>

        {/* TABS */}
        <Stack direction="row" gap={8} wrap role="tablist">
          <Button
            role="tab"
            aria-selected={vista === 'activos'}
            variant={vista === 'activos' ? 'primary' : 'secondary'}
            onClick={() => setVista('activos')}
          >
            <Baby size={18} />
            Activos
            {registrosActivos.length > 0 && (
              <Badge variant={tieneAlertaActiva ? 'danger' : 'success'}>{registrosActivos.length}</Badge>
            )}
          </Button>
          <Button
            role="tab"
            aria-selected={vista === 'historial'}
            variant={vista === 'historial' ? 'primary' : 'secondary'}
            onClick={() => setVista('historial')}
          >
            <Clock size={18} /> Historial
          </Button>
          <Button
            role="tab"
            aria-selected={vista === 'info'}
            variant={vista === 'info' ? 'primary' : 'secondary'}
            onClick={() => setVista('info')}
          >
            <Info size={18} /> Cómo funciona
          </Button>
        </Stack>

        {/* ─── VISTA: ACTIVOS ─── */}
        {vista === 'activos' && (
          <Stack gap={16}>
            <Stack direction="row" gap={12} align="center" justify="between" wrap>
              <Text variant="subheading">Niños en ludoteca ahora</Text>
              <Button onClick={() => abrirFormulario()}>
                <Plus size={18} /> Registrar entrada
              </Button>
            </Stack>

            {loading ? (
              <Text muted>Cargando...</Text>
            ) : registrosActivos.length === 0 ? (
              <Stack gap={8} align="center" padding={32}>
                <Baby size={48} />
                <Text variant="subheading">Sin niños activos</Text>
                <Text variant="small" muted>Registra la entrada de tu hijo para empezar a contar su tiempo de estancia.</Text>
                <Button onClick={() => abrirFormulario()}>
                  <Plus size={18} /> Registrar primera entrada
                </Button>
              </Stack>
            ) : (
              registrosActivos.map(r => {
                const mins = getLiveMinutos(r)
                const restantes = Math.max(LIMITE_MINUTOS - mins, 0)
                const variante = getVarianteMinutos(mins)
                const esCritico = mins >= CRITICO_MINUTOS
                const esAdvertencia = mins >= ALERTA_MINUTOS && !esCritico

                return (
                  <Card
                    key={r.registro_id}
                    title={r.nombre_hijo}
                    icon={<Baby size={18} />}
                    action={
                      <Badge variant={variante}>
                        <Timer size={14} />
                        {formatTiempo(mins)}
                      </Badge>
                    }
                  >
                    <Stack gap={12}>
                      <Text variant="small" muted>Entrada: {formatHora(r.hora_entrada)}</Text>

                      {/* Barra de progreso */}
                      <ProgressBar value={mins} max={LIMITE_MINUTOS} label="Tiempo transcurrido (min)" />
                      <Stack direction="row" gap={8} justify="between" wrap>
                        <Text variant="small">
                          {mins >= LIMITE_MINUTOS ? '¡Tiempo superado!' : `Quedan ${formatTiempo(restantes)}`}
                        </Text>
                        <Text variant="caption" muted>Aviso a los 90 min · límite 120 min</Text>
                      </Stack>

                      {/* Alerta */}
                      {(esAdvertencia || esCritico) && (
                        <Alert variant={esCritico ? 'error' : 'warning'}>
                          {esCritico
                            ? '¡Tiempo límite superado! Recoge a tu hijo para evitar una sanción.'
                            : `Quedan menos de ${formatTiempo(restantes)} — recuerda recoger a tu hijo.`}
                        </Alert>
                      )}

                      {/* Botón salida */}
                      <Button
                        variant={esCritico ? 'error' : 'primary'}
                        onClick={() => handleRegistrarSalida(r.registro_id)}
                        disabled={salidaLoading[r.registro_id]}
                      >
                        <LogOut size={18} />
                        {salidaLoading[r.registro_id] ? 'Procesando...' : 'Registrar salida'}
                      </Button>
                    </Stack>
                  </Card>
                )
              })
            )}
          </Stack>
        )}

        {/* ─── VISTA: HISTORIAL ─── */}
        {vista === 'historial' && (
          <Stack gap={16}>
            <Text variant="subheading">Historial de visitas</Text>
            {loading ? (
              <Text muted>Cargando...</Text>
            ) : (
              <Table
                columns={columnasHistorial}
                data={historial}
                getRowKey={(r) => r.registro_id}
                minWidth={560}
                emptyTitle="Sin historial"
                emptyMessage="Las visitas completadas aparecerán aquí"
              />
            )}
          </Stack>
        )}

        {/* ─── VISTA: CÓMO FUNCIONA ─── */}
        {vista === 'info' && (
          <Stack gap={16}>
            <Alert variant="info" title="Cómo funciona la ludoteca">
              Registra la entrada de tu hijo desde esta app. El sistema empezará a contar las 2 horas de estancia y te notificará cuando esté por terminar.
            </Alert>
            <Card title="Pasos:">
              <ol>
                <li>Ve a la pestaña <strong>Activos</strong> y pulsa <em>Registrar entrada</em></li>
                <li>Ingresa el nombre y fecha de nacimiento de tu hijo (3–7 años)</li>
                <li>Deja a tu hijo en la ludoteca con el personal</li>
                <li>El contador se actualizará en tiempo real</li>
                <li>Al recogerlo, pulsa <em>Registrar salida</em> desde la app o en recepción</li>
                <li>Superar las 2 horas genera una sanción automática</li>
              </ol>
            </Card>
          </Stack>
        )}
      </Stack>

      {/* ─── MODAL: REGISTRAR ENTRADA ─── */}
      {showModalRegistrar && (
        <Modal
          isOpen
          onClose={() => setShowModalRegistrar(false)}
          title="Registrar entrada a ludoteca"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModalRegistrar(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="form-entrada-ludoteca" disabled={formLoading}>
                {formLoading ? 'Registrando...' : '✓ Confirmar entrada'}
              </Button>
            </>
          }
        >
          {/* Acceso rápido — hijos anteriores */}
          {hijosConocidos.length > 0 && (
            <Stack gap={8}>
              <Text variant="small" muted>Hijos registrados anteriormente:</Text>
              <Stack direction="row" gap={8} wrap>
                {hijosConocidos.map(h => (
                  <Chip key={h.nombre} selected={formNombre === h.nombre} onClick={() => abrirFormulario(h)}>
                    <Baby size={14} /> {h.nombre}
                  </Chip>
                ))}
              </Stack>
            </Stack>
          )}

          <Stack as="form" id="form-entrada-ludoteca" gap={16} onSubmit={handleRegistrarEntrada}>
            <Input
              label="Nombre completo del niño"
              type="text"
              placeholder="Ej: Sofía García"
              value={formNombre}
              onChange={e => setFormNombre(e.target.value)}
              required
            />
            <Input
              label="Fecha de nacimiento"
              helperText="Entre 3 y 7 años"
              type="date"
              value={formFechaNac}
              min={minFechaNac}
              max={maxFechaNac}
              onChange={e => setFormFechaNac(e.target.value)}
              required
            />

            {formError && <Alert variant="error">{formError}</Alert>}

            <Alert variant="info">
              Al confirmar, el contador de 2 horas comenzará. Recibirás una alerta cuando el tiempo esté por agotarse.
            </Alert>
          </Stack>
        </Modal>
      )}

      {/* ─── MODAL: QR ─── */}
      {showModalQR && (
        <Modal isOpen onClose={() => setShowModalQR(false)} title="Mi Código QR">
          <Stack gap={12} align="center">
            <QrCode size={200} />
            <Text variant="small" muted>Presenta este código en recepción si necesitas apoyo del personal</Text>
            <Text variant="small"><strong>Código: </strong>{numeroSocio}</Text>
          </Stack>
        </Modal>
      )}

    </SocioLayout>
  )
}

export default Ludoteca
