import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import {
  AlertTriangle, CheckCircle, Shield,
  Calendar, Clock, FileText,
  AlertCircle as AlertIcon, Ban
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import { Alert, Badge, Button, Card, Modal, Stack, StatCard, Text } from '../../../components/ui'

// color de estatus → variante de Badge del kit
const BADGE_ESTATUS = { verde: 'success', naranja: 'warning', rojo: 'danger' }

// Ícono + texto secundario en una línea
function Dato({ icon, children }) {
  return (
    <Stack direction="row" gap={8} align="center">
      {icon}
      <Text variant="small" muted as="span">{children}</Text>
    </Stack>
  )
}

function Sanciones() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
  const socioId = usuario?.socio_id

  const [sanciones, setSanciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [estadoCuenta, setEstadoCuenta] = useState('limpio')
  const [showModalDetalle, setShowModalDetalle] = useState(false)
  const [sancionSeleccionada, setSancionSeleccionada] = useState(null)

  useEffect(() => {
    if (!socioId) { setLoading(false); return }
    fetchSanciones()
  }, [socioId])

  const fetchSanciones = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest(`/sanciones/socio/${socioId}`)
      const lista = Array.isArray(data) ? data : []
      setSanciones(lista)
      // Usar el campo booleano `activa` calculado en backend (considera estado + fecha_fin)
      const activas = lista.filter(s => s.activa === true)
      if (activas.some(s => s.gravedad === 'Grave' || s.gravedad === 'Moderada')) {
        setEstadoCuenta('sancionado')
      } else if (activas.length > 0) {
        setEstadoCuenta('advertencia')
      } else {
        setEstadoCuenta('limpio')
      }
    } catch (err) {
      setError('No se pudo cargar el historial de sanciones')
    } finally {
      setLoading(false)
    }
  }

  const getEstatusColor = () => {
    if (estadoCuenta === 'sancionado') return 'rojo'
    if (estadoCuenta === 'advertencia') return 'naranja'
    return 'verde'
  }

  const getEstatusLabel = () => {
    if (estadoCuenta === 'sancionado') return 'Sancionado'
    if (estadoCuenta === 'advertencia') return 'Con Advertencia'
    return 'Cuenta Limpia'
  }

  // gravedad → variante de Badge del kit
  const getGravedadColor = (gravedad) => {
    if (gravedad === 'Grave') return 'danger'
    if (gravedad === 'Moderada') return 'warning'
    return 'info'
  }

  // Usa el campo booleano `activa` del backend; fallback: compara estado para compatibilidad
  const getNormalizedEstado = (sancion) => {
    if (typeof sancion.activa === 'boolean') return sancion.activa ? 'activa' : 'cumplida'
    const e = (sancion.estado || '').toLowerCase()
    return ['resuelta', 'inactivo', 'inactiva', 'resuelto'].includes(e) ? 'cumplida' : 'activa'
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '—'
    const match = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return fecha
  }

  const handleVerDetalle = (sancion) => {
    setSancionSeleccionada(sancion)
    setShowModalDetalle(true)
  }

  const estatusColor = getEstatusColor()
  const sancionesActivas = sanciones.filter(s => s.activa === true).length
  const sancionesResueltas = sanciones.filter(s => s.activa !== true).length

  return (
    <SocioLayout activeTab="sanciones" title="Club Social | Estado de Cuenta">
      <Stack gap={24}>

        {/* HEADER */}
        <Stack direction="row" gap={16} align="start" justify="between" wrap>
          <Stack gap={4}>
            <Text variant="heading">Estado de Cuenta</Text>
            <Text variant="small" muted>Historial de sanciones y cumplimiento de reglas</Text>
          </Stack>
          <Badge variant={BADGE_ESTATUS[estatusColor]}>
            {estatusColor === 'verde' && <CheckCircle size={16} />}
            {estatusColor === 'naranja' && <AlertTriangle size={16} />}
            {estatusColor === 'rojo' && <Ban size={16} />}
            {getEstatusLabel()}
          </Badge>
        </Stack>

        {/* ESTADÍSTICAS */}
        <Stack direction="row" gap={16} grow minChild={160}>
          <StatCard label="Sanciones Activas" value={sancionesActivas} tone={sancionesActivas > 0 ? 'danger' : 'neutral'} icon={<Shield size={20} />} />
          <StatCard label="Total Historial" value={sanciones.length} tone="neutral" icon={<AlertTriangle size={20} />} />
          <StatCard label="Resueltas" value={sancionesResueltas} tone="success" icon={<CheckCircle size={20} />} />
        </Stack>

        {/* LEYENDA */}
        <Card title="Gravedad de Sanciones">
          <Stack direction="row" gap={24} wrap>
            <Stack direction="row" gap={8} align="center">
              <Badge variant="info">Leve</Badge>
              <Text variant="small" muted as="span">Advertencia (1 día)</Text>
            </Stack>
            <Stack direction="row" gap={8} align="center">
              <Badge variant="warning">Moderada</Badge>
              <Text variant="small" muted as="span">Suspensión temporal (7 días)</Text>
            </Stack>
            <Stack direction="row" gap={8} align="center">
              <Badge variant="danger">Grave</Badge>
              <Text variant="small" muted as="span">Suspensión prolongada (30 días)</Text>
            </Stack>
          </Stack>
        </Card>

        {/* LISTADO */}
        <Stack gap={16}>
          <Text variant="subheading">Historial de Sanciones</Text>

          {loading ? (
            <Text muted>Cargando...</Text>
          ) : error ? (
            <Alert variant="error" title="Error al cargar">{error}</Alert>
          ) : sanciones.length === 0 ? (
            <Stack gap={4} align="center" padding={32}>
              <CheckCircle size={48} />
              <Text variant="subheading">¡Excelente!</Text>
              <Text variant="small" muted>No tienes sanciones registradas</Text>
            </Stack>
          ) : (
            <Stack direction="row" gap={16} grow minChild={280}>
              {sanciones.map(sancion => {
                const estadoNorm = getNormalizedEstado(sancion)
                return (
                  <Card
                    key={sancion.sancion_id}
                    title={sancion.origen || 'Sanción'}
                    action={
                      <Badge variant={getGravedadColor(sancion.gravedad)}>
                        {sancion.gravedad || 'Leve'}
                      </Badge>
                    }
                  >
                    <Stack gap={12}>
                      <Stack direction="row">
                        <Badge variant={estadoNorm === 'activa' ? 'danger' : 'success'}>
                          {estadoNorm === 'activa' ? <AlertIcon size={14} /> : <CheckCircle size={14} />}
                          {estadoNorm === 'activa' ? 'Activa' : 'Resuelta'}
                        </Badge>
                      </Stack>

                      <Text variant="small">{sancion.motivo}</Text>

                      <Dato icon={<Calendar size={14} />}>{formatFecha(sancion.fecha_inicio || sancion.fecha)}</Dato>
                      {sancion.fecha_fin && (
                        <Dato icon={<Clock size={14} />}>Hasta: {formatFecha(sancion.fecha_fin)}</Dato>
                      )}

                      <Button variant="secondary" onClick={() => handleVerDetalle(sancion)}>
                        <FileText size={16} /> Ver Detalle
                      </Button>
                    </Stack>
                  </Card>
                )
              })}
            </Stack>
          )}
        </Stack>
      </Stack>

      {/* MODAL DETALLE */}
      {showModalDetalle && sancionSeleccionada && (
        <Modal
          isOpen
          onClose={() => setShowModalDetalle(false)}
          title="Detalle de Sanción"
          footer={<Button onClick={() => setShowModalDetalle(false)}>Cerrar</Button>}
        >
          <Stack direction="row" gap={8} wrap>
            <Badge variant={getGravedadColor(sancionSeleccionada.gravedad)}>
              {sancionSeleccionada.gravedad || 'Leve'}
            </Badge>
            <Badge variant={getNormalizedEstado(sancionSeleccionada) === 'activa' ? 'danger' : 'success'}>
              {getNormalizedEstado(sancionSeleccionada) === 'activa' ? 'Activa' : 'Resuelta'}
            </Badge>
          </Stack>

          <Stack gap={4}>
            <Text variant="subheading">{sancionSeleccionada.origen || 'Sanción'}</Text>
            <Text variant="small" muted>{sancionSeleccionada.motivo}</Text>
          </Stack>

          <Stack gap={8}>
            <Dato icon={<Calendar size={16} />}>
              <strong>Fecha de Inicio:</strong> {formatFecha(sancionSeleccionada.fecha_inicio || sancionSeleccionada.fecha)}
            </Dato>
            {sancionSeleccionada.fecha_fin && (
              <Dato icon={<Clock size={16} />}>
                <strong>Fecha de Fin:</strong> {formatFecha(sancionSeleccionada.fecha_fin)}
              </Dato>
            )}
          </Stack>

          <Alert variant="info" title="Motivo de la Sanción">{sancionSeleccionada.motivo}</Alert>

          {getNormalizedEstado(sancionSeleccionada) === 'activa' && (
            <Alert variant="warning" title="Sanción Vigente">
              Esta sanción está activa. Acude a recepción para más información sobre cómo resolverla.
            </Alert>
          )}
        </Modal>
      )}

    </SocioLayout>
  )
}

export default Sanciones
