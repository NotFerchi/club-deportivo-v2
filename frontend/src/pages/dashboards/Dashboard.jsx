import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FileText,
  LayoutDashboard,
  LogOut,
  Puzzle,
  RefreshCw,
  Settings,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import '../../../css/Dashboard.css';
import { adminApi } from '../../services/api';
import { estadoReservaLabel, normalizeEstadoReserva } from '../../utils/adminData';
import OccupancyByHourChart from '../../components/admin/OccupancyByHourChart';

import GestionSocios from './admin/GestionSocios';
import RecepcionVisitas from './admin/RecepcionVisitas';
import Reservas from './admin/Reservas';
import Disciplinas from './admin/Disciplinas';
import Ludoteca from './admin/Ludoteca';
import Sanciones from '../../components/SancionesPanel';
import GestionUsuarios from './admin/GestionUsuarios';
import ConfiguracionEspacios from './admin/ConfiguracionEspacios';
import AuditoriaLogs from './admin/AuditoriaLogs';
import TournamentBracket from '../../components/TournamentBracket';

const OCCUPANCY_VIEW_OPTIONS = [
  { value: 'semana', label: 'Semana', days: 7 },
  { value: 'quincena', label: 'Quincena', days: 15 },
  { value: 'mes', label: 'Mes', days: 30 }
];

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'socios', label: 'Socios', icon: Users },
  { id: 'recepcion', label: 'Recepción y Visitas', icon: ClipboardList },
  { id: 'reservas', label: 'Reservas', icon: Calendar },
  { id: 'ludoteca', label: 'Ludoteca', icon: Puzzle },
  { id: 'disciplinas', label: 'Disciplinas', icon: Dumbbell },
  { id: 'torneos', label: 'Torneos', icon: Trophy },
  { id: 'sanciones', label: 'Sanciones', icon: ShieldAlert }
];

function isActive(value) {
  return value === true || value === 'true' || value === 'Activo';
}

function getTipoSocio(socio) {
  return String(socio.tipo || socio.tipo_socio || '').toLowerCase();
}

function getDateOnly(value) {
  return String(value || '').split('T')[0];
}

function toLocalDateInput(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
}

function getDefaultRange(viewType) {
  const option = OCCUPANCY_VIEW_OPTIONS.find(o => o.value === viewType) || OCCUPANCY_VIEW_OPTIONS[0];
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - option.days + 1);
  return { startDate: toLocalDateInput(start), endDate: toLocalDateInput(end) };
}

function getEstadoBadgeClass(estado) {
  const n = normalizeEstadoReserva(estado);
  if (n === 'confirmada') return 'confirmada';
  if (n === 'cancelada' || n === 'no-show' || n === 'sancionada') return 'badge-danger';
  return 'pendiente';
}

// Donut único con dos segmentos
function SociosCompositionChart({ accionistas, rentistas, total }) {
  const acc = total > 0 ? (accionistas / total) * 100 : 0;
  const ren = total > 0 ? (rentistas / total) * 100 : 0;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const accLen = (acc / 100) * circ;
  const renLen = (ren / 100) * circ;
  const gap = 2;

  return (
    <div className="grafico-pastel">
      <div className="donut-chart">
        <svg viewBox="0 0 100 100" width="180" height="180">
          {/* Fondo */}
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="16" />
          {/* Rentistas (verde) — dibujado primero */}
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke="#10b981" strokeWidth="16"
            strokeDasharray={`${renLen - gap} ${circ - renLen + gap}`}
            strokeDashoffset={-(accLen)}
            transform="rotate(-90 50 50)"
          />
          {/* Accionistas (azul) */}
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke="#3b82f6" strokeWidth="16"
            strokeDasharray={`${accLen - gap} ${circ - accLen + gap}`}
            strokeDashoffset="0"
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="47" textAnchor="middle" fontSize="9" fill="#64748b">Total</text>
          <text x="50" y="60" textAnchor="middle" fontSize="13" fill="#1f2937" fontWeight="bold">{total}</text>
        </svg>
      </div>
      <div className="leyenda">
        <div><span className="color-box" style={{ background: '#3b82f6' }} /> Accionistas: <strong>{accionistas}</strong></div>
        <div><span className="color-box" style={{ background: '#10b981' }} /> Rentistas: <strong>{rentistas}</strong></div>
      </div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [kpis, setKpis] = useState({
    totalSocios: 0, accionistas: 0, rentistas: 0,
    reservasHoy: 0, sancionesActivas: 0,
    visitasHoy: 0, ludotecaActivos: 0, ocupacionPromedio: 0, noShowsMes: 0
  });
  const [reservasRecientes, setReservasRecientes] = useState([]);
  const [reservasDashboard, setReservasDashboard] = useState([]);
  const [espaciosDashboard, setEspaciosDashboard] = useState([]);
  const [activeSpacesCount, setActiveSpacesCount] = useState(1);
  const [occupancyView, setOccupancyView] = useState('semana');
  const [occupancyRange, setOccupancyRange] = useState(getDefaultRange('semana'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trends, setTrends] = useState({ reservas: 0, sanciones: 0, socios: 0, visitas: 0 });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!showNotifications) return;
    const close = (e) => { if (!e.target.closest('[data-notif-panel]')) setShowNotifications(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showNotifications]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSesion = localStorage.getItem('usuario');

    if (!token || !usuarioSesion) { navigate('/login'); return; }

    const usuario = JSON.parse(usuarioSesion);
    if (!['gerente', 'admin'].includes(usuario.rol)) { navigate('/login'); return; }

    setUserName(usuario.nombres || 'Administrador');
    setUserRole(usuario.rol);
    fetchDashboardData();
  }, [navigate]);

  useEffect(() => {
    document.title = 'Dashboard Ejecutivo | Club Social y Deportivo';
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [sociosRes, reservasRes, sancionesRes, visitasRes, ludotecaRes, espaciosRes] = await Promise.allSettled([
        adminApi.getSocios(),
        adminApi.getReservas(),
        adminApi.getSanciones(),
        adminApi.getVisitasActivas(),
        adminApi.getLudotecaActivos(),
        adminApi.getEspacios()
      ]);

      const socios      = sociosRes.status      === 'fulfilled' ? sociosRes.value      : [];
      const reservas    = reservasRes.status     === 'fulfilled' ? reservasRes.value    : [];
      const sanciones   = sancionesRes.status    === 'fulfilled' ? sancionesRes.value   : [];
      const visitas     = visitasRes.status      === 'fulfilled' ? visitasRes.value     : [];
      const ludoteca    = ludotecaRes.status     === 'fulfilled' ? ludotecaRes.value    : [];
      const espacios    = espaciosRes.status     === 'fulfilled' ? espaciosRes.value    : [];

      const hoy = new Date().toISOString().split('T')[0];
      const mesActual = hoy.slice(0, 7);
      const sociosActivos = socios.filter(s => isActive(s.activo));
      const reservasActivas = reservas.filter(r => normalizeEstadoReserva(r.estado) !== 'cancelada');
      const espaciosActivos = espacios.filter(e => isActive(e.activo));
      const nEspacios = Math.max(espaciosActivos.length, 1);

      // Ocupación promedio del día de hoy usando espacios reales
      const HORAS = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}`);
      const reservasHoyActivas = reservasActivas.filter(r => getDateOnly(r.fecha) === hoy);
      const ocupacionHoy = HORAS.map(h => {
        const count = reservasHoyActivas.filter(r => r.hora_inicio?.startsWith(h)).length;
        return Math.min(Math.round((count / nEspacios) * 100), 100);
      });
      const ocupacionPromedio = Math.round(ocupacionHoy.reduce((a, b) => a + b, 0) / ocupacionHoy.length);

      // Trends: compare last 7 days vs previous 7 days
      const msDay = 86400000;
      const hoyMs = Date.now();
      const reservas7  = reservasActivas.filter(r => hoyMs - new Date(getDateOnly(r.fecha)).getTime() <= 7  * msDay).length;
      const reservas14 = reservasActivas.filter(r => { const d = hoyMs - new Date(getDateOnly(r.fecha)).getTime(); return d > 7 * msDay && d <= 14 * msDay; }).length;
      const sanc7  = sanciones.filter(r => hoyMs - new Date(getDateOnly(r.fecha_inicio || r.fecha)).getTime() <= 7  * msDay).length;
      const sanc14 = sanciones.filter(r => { const d = hoyMs - new Date(getDateOnly(r.fecha_inicio || r.fecha)).getTime(); return d > 7 * msDay && d <= 14 * msDay; }).length;
      const trendPct = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
      setTrends({
        reservas: trendPct(reservas7, reservas14),
        sanciones: trendPct(sanc7, sanc14),
        socios: 0,
        visitas: 0
      });

      // Notifications: no-shows last 3 days + new active sanciones last 3 days
      const notifs = [];
      reservas.filter(r => normalizeEstadoReserva(r.estado) === 'no-show' &&
        hoyMs - new Date(getDateOnly(r.fecha)).getTime() <= 3 * msDay
      ).slice(0, 5).forEach(r => notifs.push({
        id: `ns-${r.reserva_id}`,
        type: 'noshow',
        text: `No-show: ${r.espacio_nombre || `Espacio #${r.espacio_id}`} — ${getDateOnly(r.fecha)}`
      }));
      sanciones.filter(s => {
        const st = String(s.estado || '').toLowerCase();
        return (s.activa === true || st === 'activa' || st === 'activo') &&
          hoyMs - new Date(getDateOnly(s.fecha_inicio || s.fecha)).getTime() <= 3 * msDay;
      }).slice(0, 5).forEach(s => notifs.push({
        id: `sa-${s.sancion_id}`,
        type: 'sancion',
        text: `Sanción: ${s.nombre_socio || s.socio_nombre || 'Socio'} — ${s.gravedad || 'Leve'}`
      }));
      setNotifications(notifs);

      setReservasDashboard(reservas);
      setEspaciosDashboard(espacios);
      setActiveSpacesCount(nEspacios);
      setReservasRecientes(
        [...reservas]
          .sort((a, b) => new Date(b.fecha_creacion || b.fecha || 0) - new Date(a.fecha_creacion || a.fecha || 0))
          .slice(0, 3)
      );
      setKpis({
        totalSocios: sociosActivos.length,
        accionistas: sociosActivos.filter(s => getTipoSocio(s) === 'accionista').length,
        rentistas: sociosActivos.filter(s => getTipoSocio(s) === 'rentista').length,
        reservasHoy: reservasActivas.filter(r => getDateOnly(r.fecha) === hoy).length,
        sancionesActivas: sanciones.filter(s => {
          const st = String(s.estado || '').toLowerCase();
          return s.activa === true || st === 'activa' || st === 'activo';
        }).length,
        visitasHoy: visitas.length,
        ludotecaActivos: ludoteca.length,
        ocupacionPromedio,
        noShowsMes: reservas.filter(r =>
          getDateOnly(r.fecha).slice(0, 7) === mesActual &&
          (normalizeEstadoReserva(r.estado) === 'no-show' || r.no_show === true)
        ).length
      });
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleOccupancyViewChange = (value) => {
    setOccupancyView(value);
    setOccupancyRange(getDefaultRange(value));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/');
  };

  const isManager = userRole === 'gerente';
  const dashboardTitle = isManager ? 'Panel Gerencial' : 'Dashboard Ejecutivo';
  const todayLabel = useMemo(() =>
    new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    []
  );

  // Ítems de administración según rol
  const adminItems = [
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: UserPlus, adminOnly: true },
    { id: 'espacios', label: 'Configuración de Espacios', icon: Settings, adminOnly: false },
    ...(!isManager ? [{ id: 'logs', label: 'Auditoría', icon: FileText, adminOnly: true }] : [])
  ].filter(item => !item.adminOnly || userRole === 'admin');

  const mobileItems = [...NAV_ITEMS, ...adminItems];
  const getNavClass = (tab) => `nav-link ${activeTab === tab ? 'active' : ''}`;

  if (loading) {
    return (
      <div className="dashboard-root">
        <div className="chart-box" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-root">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" />
          <span>Club Social y Deportivo</span>
        </div>

        <nav>
          <span className="nav-section-label">NAVEGACIÓN</span>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={getNavClass(item.id)}>
                <Icon className="nav-icon" /> {item.label}
              </button>
            );
          })}

          <span className="nav-section-label" style={{ marginTop: '1rem' }}>ADMINISTRACIÓN</span>
          {adminItems.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={getNavClass(item.id)}>
                <Icon className="nav-icon" /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{userName.charAt(0).toUpperCase()}</div>
            <div>
              <p className="sidebar-name">{userName}</p>
              <p className="sidebar-role">{isManager ? 'Gerente' : 'Admin'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-link" style={{ color: '#ef4444' }}>
            <LogOut className="nav-icon" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="admin-mobile-top">
          <div>
            <strong>Club Social y Deportivo</strong>
            <span>{dashboardTitle}</span>
          </div>
          <select value={activeTab} onChange={e => setActiveTab(e.target.value)}>
            {mobileItems.map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </header>

        <header className="page-header">
          <div>
            <h2>{dashboardTitle}</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Vista general del club &mdash; {todayLabel}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            {activeTab === 'dashboard' && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                title="Actualizar datos del dashboard"
              >
                <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                {refreshing ? 'Actualizando...' : 'Actualizar'}
              </button>
            )}
            <button
              data-notif-panel
              onClick={() => setShowNotifications(v => !v)}
              className="btn-outline"
              style={{ position: 'relative', padding: '6px 10px' }}
              title="Notificaciones"
            >
              <Bell size={17} />
              {notifications.length > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: '#ef4444', color: '#fff',
                  borderRadius: '50%', width: 18, height: 18,
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #fff'
                }}>{notifications.length > 9 ? '9+' : notifications.length}</span>
              )}
            </button>

            {showNotifications && (
              <div data-notif-panel style={{
                position: 'absolute', top: 44, right: 0, zIndex: 200,
                background: '#fff', border: '1px solid #e2e8f0',
                borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                width: 320, overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Alertas recientes</span>
                  <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
                </div>
                {notifications.length === 0 ? (
                  <p style={{ padding: '1.25rem 1rem', color: '#64748b', fontSize: 13, textAlign: 'center', margin: 0 }}>Sin alertas en los últimos 3 días</p>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: n.type === 'noshow' ? '#fff7ed' : '#fef2f2' }}>
                          {n.type === 'noshow'
                            ? <AlertTriangle size={14} style={{ color: '#d97706' }} />
                            : <ShieldAlert size={14} style={{ color: '#dc2626' }} />
                          }
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{n.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            <section className="top-kpi-grid">
              {[
                { Icon: Users,      iconClass: 'kpi-icon',       value: kpis.totalSocios.toLocaleString(),  label: 'Total Socios',       trend: null },
                { Icon: UserCheck,  iconClass: 'kpi-icon green',  value: kpis.accionistas.toLocaleString(), label: 'Accionistas',         trend: null },
                { Icon: UserPlus,   iconClass: 'kpi-icon blue',   value: kpis.rentistas.toLocaleString(),   label: 'Rentistas',           trend: null },
                { Icon: CalendarDays, iconClass: 'kpi-icon amber', value: kpis.reservasHoy,                 label: 'Reservas Hoy',        trend: trends.reservas },
                { Icon: ShieldAlert, iconClass: 'kpi-icon red',   value: kpis.sancionesActivas,             label: 'Sanciones Activas',   trend: trends.sanciones },
              ].map(({ Icon, iconClass, value, label, trend }) => (
                <div key={label} className="kpi-card">
                  <Icon className={iconClass} />
                  <div style={{ flex: 1 }}>
                    <h3>{value}</h3>
                    <p>{label}</p>
                  </div>
                  {trend !== null && trend !== 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                      {trend > 0
                        ? <TrendingUp size={14} style={{ color: label.includes('Sancion') ? '#dc2626' : '#16a34a' }} />
                        : <TrendingDown size={14} style={{ color: label.includes('Sancion') ? '#16a34a' : '#dc2626' }} />
                      }
                      <span style={{ fontSize: 10, fontWeight: 700, color: trend > 0 ? (label.includes('Sancion') ? '#dc2626' : '#16a34a') : (label.includes('Sancion') ? '#16a34a' : '#dc2626') }}>
                        {trend > 0 ? '+' : ''}{trend}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section className="charts-row">
              <div className="chart-box occupancy-box">
                <div className="chart-title-row">
                  <h4><TrendingUp size={18} /> Ocupación por Hora</h4>
                  <div className="occupancy-controls">
                    <select value={occupancyView} onChange={e => handleOccupancyViewChange(e.target.value)}>
                      {OCCUPANCY_VIEW_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={occupancyRange.startDate}
                      onChange={e => setOccupancyRange(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                    <input
                      type="date"
                      value={occupancyRange.endDate}
                      onChange={e => setOccupancyRange(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 1rem' }}>
                  Porcentaje de uso de instalaciones por disciplina
                </p>
                <OccupancyByHourChart
                  reservas={reservasDashboard}
                  startDate={occupancyRange.startDate}
                  endDate={occupancyRange.endDate}
                  activeSpaces={activeSpacesCount}
                  espacios={espaciosDashboard}
                />
              </div>

              <div className="chart-box">
                <h4 className="chart-title-row"><Users size={18} /> Composición de Socios</h4>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 1rem' }}>Accionistas vs Rentistas</p>
                <SociosCompositionChart
                  accionistas={kpis.accionistas}
                  rentistas={kpis.rentistas}
                  total={kpis.totalSocios}
                />
              </div>
            </section>

            <section className="bottom-row">
              <div className="chart-box">
                <h4 className="chart-title-row"><ClipboardList size={18} /> Resumen del Día</h4>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 1rem' }}>Actividad en tiempo real</p>
                <div className="summary-grid">
                  <div className="mini-card">
                    <User className="mini-icon" />
                    <div><p>{kpis.visitasHoy}</p><p>Visitas hoy</p></div>
                  </div>
                  <div className="mini-card">
                    <Puzzle className="mini-icon" />
                    <div><p>{kpis.ludotecaActivos}</p><p>Ludoteca activos</p></div>
                  </div>
                  <div className="mini-card">
                    <TrendingUp className="mini-icon" />
                    <div><p>{kpis.ocupacionPromedio}%</p><p>Ocupación prom.</p></div>
                  </div>
                  <div className="mini-card">
                    <AlertTriangle className="mini-icon" />
                    <div><p>{kpis.noShowsMes}</p><p>No-Shows mes</p></div>
                  </div>
                </div>
              </div>

              <div className="chart-box">
                <h4 className="chart-title-row"><CalendarDays size={18} /> Reservas Recientes</h4>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 1rem' }}>Últimas reservaciones registradas</p>
                {reservasRecientes.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay reservas recientes</p>
                ) : (
                  <ul className="reservation-list">
                    {reservasRecientes.map((r, i) => (
                      <li key={r.reserva_id || i} className="res-item">
                        <div>
                          <p className="reservation-name">
                            {r.socio_nombre || 'Socio'}
                          </p>
                          <p className="reservation-detail">
                            {r.espacio_nombre || `Reserva #${r.reserva_id}`} &mdash; {r.hora_inicio?.slice(0, 5) || '--:--'} a {r.hora_fin?.slice(0, 5) || '--:--'}
                          </p>
                        </div>
                        <span className={`badge ${getEstadoBadgeClass(r.estado)}`}>
                          {estadoReservaLabel(r.estado)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'socios' && <GestionSocios readOnly={isManager} />}
        {activeTab === 'recepcion' && <RecepcionVisitas />}
        {activeTab === 'reservas' && <Reservas readOnly={isManager} />}
        {activeTab === 'disciplinas' && <Disciplinas readOnly={isManager} />}
        {activeTab === 'torneos' && (
          <TournamentBracket
            title="Torneos y Brackets"
            subtitle="Consulta el estado de los torneos y sus cruces por ronda."
            readOnly={isManager}
          />
        )}
        {activeTab === 'ludoteca' && <Ludoteca />}
        {activeTab === 'sanciones' && <Sanciones />}
        {activeTab === 'usuarios' && userRole === 'admin' && <GestionUsuarios />}
        {activeTab === 'espacios' && <ConfiguracionEspacios readOnly={isManager} />}
        {activeTab === 'logs' && userRole === 'admin' && <AuditoriaLogs />}
      </main>
    </div>
  );
}

export default Dashboard;
