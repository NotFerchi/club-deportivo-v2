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

const TICK_MS = 1000;
const POLL_MS = 10000;
const WARNING_MS = 90 * 60 * 1000;
const LIMIT_MS = 120 * 60 * 1000;

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
  const progreso = Math.min(100, (elapsedMs / LIMIT_MS) * 100);
  const semaforo = getSemaforo(elapsedMs);

  return (
    <article className={`ludo-monitor-card ${semaforo.key}`}>
      <div className="ludo-monitor-progress">
        <span style={{ width: `${progreso}%` }} />
      </div>

      <div className="ludo-monitor-card-body">
        <div className="ludo-monitor-card-head">
          <div className="ludo-monitor-avatar" aria-hidden="true">
            {(nino.nombre_hijo || '?').trim().charAt(0).toUpperCase()}
          </div>

          <div className="ludo-monitor-name-wrap">
            <h5>{nino.nombre_hijo}</h5>
            <p>{getNombrePadre(nino)}</p>
          </div>

          <span className="ludo-monitor-status">
            {semaforo.icon}
            {semaforo.label}
          </span>
        </div>

        <div className="ludo-monitor-time-row">
          <div>
            <span>Entrada</span>
            <strong>{formatHora(nino.hora_entrada_local || nino.hora_entrada)}</strong>
          </div>

          <div>
            <span>Transcurrido</span>
            <strong>{formatDuracion(elapsedMs)}</strong>
          </div>

          <div>
            <span>Minutos</span>
            <strong>{elapsedMinutes}/120</strong>
          </div>
        </div>

        <button
          type="button"
          className="ludo-monitor-exit"
          disabled={saliendo}
          onClick={() => onSalida(nino.registro_id)}
        >
          <LogOut size={16} />
          {saliendo ? 'Registrando...' : 'Dar salida'}
        </button>
      </div>
    </article>
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
    return (
      <div className="chart-box ludo-monitor-loading">
        <Clock size={22} />
        <span>Cargando ludoteca...</span>
      </div>
    );
  }

  return (
    <section className="chart-box ludo-monitor">
      {toast && (
        <div className={`ludo-monitor-toast ${toast.type}`}>
          {toast.type === 'warning' ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle size={18} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="ludo-monitor-header">
        <div>
          <h4>Monitoreo de Ludoteca</h4>
          <p>
            {ninos.length} activos · Última sincronización {formatSync(lastSync)}
          </p>
        </div>

        <button
          type="button"
          className="ludo-monitor-refresh"
          onClick={() => fetchActivos()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div className="ludo-monitor-kpis">
        <div className="ludo-monitor-kpi total">
          <Users size={18} />
          <strong>{ninos.length}</strong>
          <span>En ludoteca</span>
        </div>

        <div className="ludo-monitor-kpi verde">
          <CheckCircle size={18} />
          <strong>{stats.verde}</strong>
          <span>Verde</span>
        </div>

        <div className="ludo-monitor-kpi amarillo">
          <Clock size={18} />
          <strong>{stats.amarillo}</strong>
          <span>Amarillo</span>
        </div>

        <div className="ludo-monitor-kpi rojo">
          <AlertCircle size={18} />
          <strong>{stats.rojo}</strong>
          <span>Rojo</span>
        </div>
      </div>

      {error && (
        <div className="ludo-monitor-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {ninos.length === 0 ? (
        <div className="ludo-monitor-empty">
          <Baby size={34} />
          <strong>No hay niños en ludoteca</strong>
          <span>Los ingresos activos aparecerán aquí.</span>
        </div>
      ) : (
        <div className="ludo-monitor-grid">
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
        </div>
      )}
    </section>
  );
}

export default MonitoreoLudoteca;
