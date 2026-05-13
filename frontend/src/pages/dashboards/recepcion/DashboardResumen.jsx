import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Baby,
  Calendar,
  ClipboardCheck,
  DoorOpen,
  IdCard,
  LogIn,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Users
} from 'lucide-react';
import { getAuthToken } from '../../../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchKpis = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/recepcion/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('No se pudieron cargar las metricas');

      const data = await res.json();
      setKpis((current) => ({ ...current, ...data }));
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error cargando KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, []);

  const ocupacionSocios = useMemo(() => {
    const total = kpis.sociosDentro || 0;
    return {
      accionistas: percent(kpis.accionistasDentro, total),
      rentistas: percent(kpis.rentistasDentro, total)
    };
  }, [kpis]);

  const ludotecaPercent = percent(kpis.ninosLudoteca, kpis.capacidadLudoteca);
  const totalPersonasDentro = kpis.sociosDentro + kpis.visitasActivas + kpis.ninosLudoteca;

  if (loading) return <div className="chart-box"><p className="empty-message">Cargando...</p></div>;

  return (
    <div className="reception-dashboard">
      <section className="reception-hero">
        <div>
          <span className="reception-eyebrow">Operacion en tiempo real</span>
          <h3>Recepcion del club</h3>
          <p>Resumen para decidir rapido: personas dentro, visitas activas, reservas del dia y alertas que requieren atencion.</p>
        </div>
        <button className="btn-outline" onClick={fetchKpis}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </section>

      <div className="top-kpi-grid reception-kpi-grid">
        <KpiButton icon={DoorOpen} value={totalPersonasDentro} label="Personas dentro" tone="blue" onClick={() => onNavigate?.('checkin')} />
        <KpiButton icon={Users} value={kpis.sociosDentro} label="Socios registrados hoy" onClick={() => onNavigate?.('checkin')} />
        <KpiButton icon={UserPlus} value={kpis.visitasActivas} label="Visitantes activos" tone="green" onClick={() => onNavigate?.('visitas')} />
        <KpiButton icon={Baby} value={kpis.ninosLudoteca} label="Ninos en ludoteca" tone="amber" onClick={() => onNavigate?.('ludoteca')} />
        <KpiButton icon={AlertTriangle} value={kpis.sancionesActivas} label="Sanciones activas" tone="red" onClick={() => onNavigate?.('sanciones')} />
      </div>

      <div className="reception-dashboard-grid">
        <section className="chart-box reception-panel">
          <div className="reception-panel-header">
            <div>
              <h4><Users size={18} /> Socios dentro</h4>
              <p>Distribucion por tipo de socio con registros del dia.</p>
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
              <p>Separacion entre visitas por socio y pases de dia.</p>
            </div>
            <strong>{kpis.visitasActivas}</strong>
          </div>
          <div className="reception-mini-stats">
            <button onClick={() => onNavigate?.('visitas')}><span>{kpis.visitasInvitadosActivas}</span> Visitas</button>
            <button onClick={() => onNavigate?.('visitas')}><span>{kpis.pasesDiaActivos}</span> Pases dia</button>
          </div>
        </section>
      </div>

      <section className="chart-box reception-actions-panel">
        <div className="reception-panel-header">
          <div>
            <h4><ClipboardCheck size={18} /> Accesos rapidos</h4>
            <p>{lastUpdate ? `Actualizado ${lastUpdate.toLocaleTimeString()}` : 'Listo para operar'}</p>
          </div>
        </div>
        <div className="recepcion-quick-actions">
          <button className="btn-outline" onClick={() => onNavigate?.('visitas')}><UserPlus size={16} /> Registrar visitas</button>
          <button className="btn-outline" onClick={() => onNavigate?.('reservas')}><Calendar size={16} /> Revisar reservas</button>
          <button className="btn-outline" onClick={() => onNavigate?.('ludoteca')}><Baby size={16} /> Control ludoteca</button>
          <button className="btn-outline" onClick={() => onNavigate?.('checkin')}><LogIn size={16} /> Pase de lista</button>
          <button className="btn-outline" onClick={() => onNavigate?.('sanciones')}><ShieldAlert size={16} /> Ver sanciones</button>
        </div>
      </section>
    </div>
  );
}

export default DashboardResumen;
