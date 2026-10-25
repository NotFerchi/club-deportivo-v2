import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Baby,
  CheckCircle,
  Clock,
  LogOut,
  RefreshCw,
  Users
} from 'lucide-react';
import { apiRequest, unwrapList } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { Alert, Avatar, Badge, Button, Card, ProgressBar, Stack, StatCard, Text } from '../../../components/ui';

const TICK_MS = 1000;
const POLL_MS = 10000;
const WARNING_MS = 90 * 60 * 1000;
const LIMIT_MS = 120 * 60 * 1000;

// semáforo → variante de Badge del kit
const BADGE_SEMAFORO = { verde: 'success', amarillo: 'warning', rojo: 'danger' };

function getElapsedMs(nino, now, lastSyncMs) {
  const segundosBase = Number(nino.segundos_transcurridos);

  if (Number.isFinite(segundosBase)) {
    const extraMs = Math.max(0, now - lastSyncMs);
    return Math.max(0, segundosBase * 1000 + extraMs);
  }

  const entradaMs = new Date(nino.hora_entrada).getTime();

  if (!Number.isFinite(entradaMs)) {
    console.warn('hora_entrada inválida:', nino.hora_entrada);
    return 0;
  }

  return Math.max(0, now - entradaMs);
}

function getSemaforo(elapsedMs) {
  if (elapsedMs > LIMIT_MS) {
    return {
      key: 'rojo',
      label: 'Excedido',
      icon: <AlertCircle size={15} />
    };
  }

  if (elapsedMs >= WARNING_MS) {
    return {
      key: 'amarillo',
      label: 'Por vencer',
      icon: <Clock size={15} />
    };
  }

  return {
    key: 'verde',
    label: 'En tiempo',
    icon: <CheckCircle size={15} />
  };
}

function formatDuracion(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const MX_TZ = 'America/Mexico_City';

function formatHora(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: MX_TZ });
}

function formatSync(value) {
  if (!value) return 'Sin sincronizar';
  return value.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: MX_TZ });
}

function getNombrePadre(nino) {
  return (
    nino.nombre_padre ||
    nino.tutor_nombre ||
    [nino.nombres, nino.apellido_paterno].filter(Boolean).join(' ').trim() ||
    'Padre no disponible'
  );
}

function LudotecaCard({ nino, now, lastSyncMs, saliendo, onSalida }) {
  const elapsedMs = getElapsedMs(nino, now, lastSyncMs);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const semaforo = getSemaforo(elapsedMs);

  return (
    <Card
      title={nino.nombre_hijo}
      action={
        <Badge variant={BADGE_SEMAFORO[semaforo.key]}>
          {semaforo.icon}
          {semaforo.label}
        </Badge>
      }
    >
      <Stack gap={12}>
        <Stack direction="row" gap={8} align="center">
          <Avatar name={nino.nombre_hijo} size="sm" />
          <Text variant="small" muted>{getNombrePadre(nino)}</Text>
        </Stack>

        <ProgressBar value={elapsedMinutes} max={LIMIT_MS / 60000} label="Minutos" />

        <Stack direction="row" gap={16} justify="between" wrap>
          <Stack gap={0}>
            <Text variant="caption" muted>Entrada</Text>
            <Text variant="small">{formatHora(nino.hora_entrada_local || nino.hora_entrada)}</Text>
          </Stack>

          <Stack gap={0}>
            <Text variant="caption" muted>Transcurrido</Text>
            <Text variant="small">{formatDuracion(elapsedMs)}</Text>
          </Stack>
        </Stack>

        <Button
          disabled={saliendo}
          onClick={() => onSalida(nino.registro_id)}
        >
          <LogOut size={16} />
          {saliendo ? 'Registrando...' : 'Dar salida'}
        </Button>
      </Stack>
    </Card>
  );
}

function MonitoreoLudoteca() {
  const { showConfirm, toast: globalToast } = useNotification();
  const [ninos, setNinos] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [lastSyncMs, setLastSyncMs] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [salidasEnCurso, setSalidasEnCurso] = useState({});

  const fetchActivos = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const payload = await apiRequest('/ludoteca/activos');
      const syncDate = new Date();

      setNinos(unwrapList(payload, ['data']));
      setLastSync(syncDate);
      setLastSyncMs(syncDate.getTime());
      setError('');
    } catch (fetchError) {
      setError(fetchError.message || 'Error al cargar ludoteca');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivos();

    const pollId = setInterval(() => {
      fetchActivos({ silent: true });
    }, POLL_MS);

    return () => clearInterval(pollId);
  }, [fetchActivos]);

  useEffect(() => {
    const tickId = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);

    return () => clearInterval(tickId);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const toastId = setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => clearTimeout(toastId);
  }, [toast]);

  const stats = useMemo(() => {
    return ninos.reduce(
      (acc, nino) => {
        const elapsedMs = getElapsedMs(nino, now, lastSyncMs);
        const semaforo = getSemaforo(elapsedMs);

        acc[semaforo.key] += 1;

        return acc;
      },
      { verde: 0, amarillo: 0, rojo: 0 }
    );
  }, [ninos, now, lastSyncMs]);

  const handleSalida = async (registroId) => {
    if (!await showConfirm('¿Dar salida a este niño?', { confirmLabel: 'Dar salida' })) return;

    setSalidasEnCurso((prev) => ({
      ...prev,
      [registroId]: true
    }));

    try {
      const response = await apiRequest(`/ludoteca/salida/${registroId}`, {
        method: 'PATCH'
      });

      setNinos((prev) => prev.filter((nino) => nino.registro_id !== registroId));

      if (response?.sancion_generada) {
        setToast({
          type: 'warning',
          message: '⚠ Sanción generada por exceso de tiempo'
        });
      } else {
        setToast({
          type: 'success',
          message: 'Salida registrada correctamente'
        });
      }
    } catch (salidaError) {
      globalToast(salidaError.message || 'Error al registrar salida', 'error');
    } finally {
      setSalidasEnCurso((prev) => {
        const next = { ...prev };
        delete next[registroId];
        return next;
      });
    }
  };

  if (loading) {
    return <Text muted>Cargando ludoteca...</Text>;
  }

  return (
    <Stack gap={24}>
      {toast && <Alert variant={toast.type}>{toast.message}</Alert>}

      <Stack direction="row" gap={16} align="center" justify="between" wrap>
        <Stack gap={4}>
          <Text variant="heading">Monitoreo de Ludoteca</Text>
          <Text variant="small" muted>
            {ninos.length} activos · Última sincronización {formatSync(lastSync)}
          </Text>
        </Stack>

        <Button
          variant="secondary"
          onClick={() => fetchActivos()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </Stack>

      <Stack direction="row" gap={16} grow minChild={150}>
        <StatCard label="En ludoteca" value={ninos.length} tone="neutral" icon={<Users size={20} />} />
        <StatCard label="Verde" value={stats.verde} tone="success" icon={<CheckCircle size={20} />} />
        <StatCard label="Amarillo" value={stats.amarillo} tone="warning" icon={<Clock size={20} />} />
        <StatCard label="Rojo" value={stats.rojo} tone="danger" icon={<AlertCircle size={20} />} />
      </Stack>

      {error && <Alert variant="error">{error}</Alert>}

      {ninos.length === 0 ? (
        <Stack gap={4} align="center" padding={32}>
          <Baby size={34} />
          <Text variant="subheading">No hay niños en ludoteca</Text>
          <Text variant="small" muted>Los ingresos activos aparecerán aquí.</Text>
        </Stack>
      ) : (
        <Stack direction="row" gap={16} grow minChild={260}>
          {ninos.map((nino) => (
            <LudotecaCard
              key={nino.registro_id}
              nino={nino}
              now={now}
              lastSyncMs={lastSyncMs}
              saliendo={Boolean(salidasEnCurso[nino.registro_id])}
              onSalida={handleSalida}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default MonitoreoLudoteca;
