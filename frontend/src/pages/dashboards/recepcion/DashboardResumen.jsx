import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Baby,
  Calendar,
  DoorOpen,
  IdCard,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Users
} from 'lucide-react';
import { adminApi } from '../../../services/api';

const AUTO_REFRESH_MS = 30000;

function percent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function KpiButton({ icon: Icon, value, label, tone = '', onClick }) {
  return (
    <button className="kpi-card kpi-action reception-kpi-card" onClick={onClick}>
      <Icon className={`kpi-icon ${tone}`} />
      <div>
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
    </button>
  );
}

function DashboardResumen({ onNavigate }) {
  const [kpis, setKpis] = useState({
    ingresosHoy: 0,
    visitasActivas: 0,
    visitasInvitadosActivas: 0,
    pasesDiaActivos: 0,
    ninosLudoteca: 0,
    capacidadLudoteca: 15,
    sancionesActivas: 0,
    sociosDentro: 0,
    accionistasDentro: 0,
    rentistasDentro: 0,
    reservasHoy: 0,
    reservasActivasHoy: 0,
    reservasCanceladasHoy: 0,
    noShowsHoy: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loadError, setLoadError] = useState('');

  const fetchKpis = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await adminApi.getRecepcionDashboard();
      setKpis((current) => ({ ...current, ...data }));
      setLastUpdate(new Date());
      setLoadError('');
    } catch (error) {
      console.error('Error cargando KPIs de recepción:', error);
      setLoadError(error.message || 'No se pudieron cargar las estadísticas de recepción.');
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchKpis({ silent: true });
    }, AUTO_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchKpis({ silent: true });
      }
    };

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchKpis]);

  const ocupacionSocios = useMemo(() => {
    const total = kpis.sociosDentro || 0;
    return {
      accionistas: percent(kpis.accionistasDentro, total),
      rentistas: percent(kpis.rentistasDentro, total)
    };
  }, [kpis]);

  const ludotecaPercent = percent(kpis.ninosLudoteca, kpis.capacidadLudoteca);
  const totalPersonasDentro = kpis.sociosDentro + kpis.visitasActivas + kpis.ninosLudoteca;

  if (loading) {
    return (
      <div className="chart-box">
        <p className="empty-message">Cargando estadísticas de recepción...</p>
      </div>
    );
  }

  return (
    <div className="reception-dashboard">
      <section className="reception-hero">
        <div>
          <span className="reception-eyebrow">Operación en tiempo real</span>
          <h3>Recepción del club</h3>
          <p>
            Resumen para decidir rápido: personas dentro, visitas activas, reservas del día
            y alertas que requieren atención.
          </p>
          <p className="reception-panel-note" style={{ marginTop: 10 }}>
            {lastUpdate
              ? `Última actualización: ${lastUpdate.toLocaleTimeString('es-MX')}. Refresco automático cada ${AUTO_REFRESH_MS / 1000} segundos.`
              : 'Esperando primera actualización.'}
          </p>
          {loadError && (
            <p className="reception-error-text">{loadError}</p>
          )}
        </div>
        <button className="btn-outline" onClick={() => fetchKpis({ silent: true })} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'icon-spin' : ''} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </section>

      <div className="top-kpi-grid reception-kpi-grid">
        <KpiButton
          icon={DoorOpen}
          value={totalPersonasDentro}
          label="Personas dentro ahora"
          tone="blue"
          onClick={() => onNavigate?.('visitas')}
        />
        <KpiButton
          icon={Users}
          value={kpis.sociosDentro}
          label="Socios dentro"
          onClick={() => onNavigate?.('socios')}
        />
        <KpiButton
          icon={UserPlus}
          value={kpis.visitasActivas}
          label="Visitantes activos"
          tone="green"
          onClick={() => onNavigate?.('visitas')}
        />
        <KpiButton
          icon={Baby}
          value={kpis.ninosLudoteca}
          label="Niños en ludoteca"
          tone="amber"
          onClick={() => onNavigate?.('ludoteca')}
        />
        <KpiButton
          icon={AlertTriangle}
          value={kpis.sancionesActivas}
          label="Sanciones activas"
          tone="red"
          onClick={() => onNavigate?.('sanciones')}
        />
      </div>

      <div className="reception-dashboard-grid">
        <section className="chart-box reception-panel">
          <div className="reception-panel-header">
            <div>
              <h4><Users size={18} /> Socios dentro</h4>
              <p>Distribución por tipo de socio con registros del día.</p>
            </div>
            <strong>{kpis.sociosDentro}</strong>
          </div>

          <div className="reception-meter">
            <div className="reception-meter-bar">
              <span style={{ width: `${ocupacionSocios.accionistas}%` }} />
              <span style={{ width: `${ocupacionSocios.rentistas}%` }} />
            </div>
            <div className="reception-meter-legend">
              <span><i className="legend-dot accionista" /> Accionistas: {kpis.accionistasDentro}</span>
              <span><i className="legend-dot rentista" /> Rentistas: {kpis.rentistasDentro}</span>
            </div>
          </div>
        </section>

        <section className="chart-box reception-panel">
          <div className="reception-panel-header">
            <div>
              <h4><Baby size={18} /> Ludoteca</h4>
              <p>Capacidad operativa actual.</p>
            </div>
            <strong>{ludotecaPercent}%</strong>
          </div>
          <div className="reception-capacity">
            <span style={{ width: `${ludotecaPercent}%` }} />
          </div>
          <p className="reception-panel-note">{kpis.ninosLudoteca} de {kpis.capacidadLudoteca} lugares ocupados.</p>
        </section>

        <section className="chart-box reception-panel">
          <div className="reception-panel-header">
            <div>
              <h4><Calendar size={18} /> Reservas de hoy</h4>
              <p>Seguimiento de espacios y asistencia esperada.</p>
            </div>
            <strong>{kpis.reservasHoy}</strong>
          </div>
          <div className="reception-mini-stats">
            <button onClick={() => onNavigate?.('reservas')}><span>{kpis.reservasActivasHoy}</span> Activas</button>
            <button onClick={() => onNavigate?.('reservas')}><span>{kpis.reservasCanceladasHoy}</span> Canceladas</button>
            <button onClick={() => onNavigate?.('sanciones')}><span>{kpis.noShowsHoy}</span> No-show</button>
          </div>
        </section>

        <section className="chart-box reception-panel">
          <div className="reception-panel-header">
            <div>
              <h4><IdCard size={18} /> Pases activos</h4>
              <p>Separación entre visitas por socio y pases de un día.</p>
            </div>
            <strong>{kpis.visitasActivas}</strong>
          </div>
          <div className="reception-mini-stats">
            <button onClick={() => onNavigate?.('visitas')}><span>{kpis.visitasInvitadosActivas}</span> Visitas</button>
            <button onClick={() => onNavigate?.('visitas')}><span>{kpis.pasesDiaActivos}</span> Pases día</button>
          </div>
        </section>
      </div>

      <section className="chart-box reception-actions-panel">
        <div className="reception-panel-header">
          <div>
            <h4><Calendar size={18} /> Accesos rápidos</h4>
            <p>{lastUpdate ? `Actualizado ${lastUpdate.toLocaleTimeString('es-MX')}` : 'Listo para operar'}</p>
          </div>
        </div>
        <div className="recepcion-quick-actions">
          <button className="btn-outline" onClick={() => onNavigate?.('visitas')}><UserPlus size={16} /> Registrar visitas</button>
          <button className="btn-outline" onClick={() => onNavigate?.('reservas')}><Calendar size={16} /> Revisar reservas</button>
          <button className="btn-outline" onClick={() => onNavigate?.('ludoteca')}><Baby size={16} /> Control ludoteca</button>
          <button className="btn-outline" onClick={() => onNavigate?.('socios')}><Users size={16} /> Ver socios</button>
          <button className="btn-outline" onClick={() => onNavigate?.('sanciones')}><ShieldAlert size={16} /> Ver sanciones</button>
        </div>
      </section>
    </div>
  );
}

export default DashboardResumen;
