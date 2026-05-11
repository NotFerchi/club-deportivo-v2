import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FileText,
  LayoutDashboard,
  LogOut,
  Puzzle,
  Settings,
  ShieldAlert,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Users
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
import Sanciones from './admin/Sanciones';
import GestionUsuarios from './admin/GestionUsuarios';
import ConfiguracionEspacios from './admin/ConfiguracionEspacios';
import AuditoriaLogs from './admin/AuditoriaLogs';
import TournamentBracket from '../../components/TournamentBracket';

const HORAS_OPERACION = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00'
];

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

const ADMIN_ITEMS = [
  { id: 'usuarios', label: 'Gestión de Usuarios', icon: UserPlus },
  { id: 'espacios', label: 'Configuración de espacios', icon: Settings },
  { id: 'logs', label: 'Auditoría', icon: FileText }
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
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().split('T')[0];
}

function getDefaultRange(viewType) {
  const option = OCCUPANCY_VIEW_OPTIONS.find(item => item.value === viewType) || OCCUPANCY_VIEW_OPTIONS[0];
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - option.days + 1);
  return {
    startDate: toLocalDateInput(start),
    endDate: toLocalDateInput(end)
  };
}

function getEstadoBadgeClass(estado) {
  const normalized = normalizeEstadoReserva(estado);
  if (normalized === 'confirmada') return 'confirmada';
  if (normalized === 'cancelada' || normalized === 'no-show' || normalized === 'sancionada') return 'badge-danger';
  return 'pendiente';
}

function AreaChart({ data }) {
  if (!data.length) {
    return <p style={{ textAlign: 'center', padding: '2rem' }}>Sin datos de ocupación</p>;
  }

  const width = 680;
  const height = 260;
  const padding = 34;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const points = data.map((item, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - (item.ocupacion / 100) * chartHeight;
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="area-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="area-chart" role="img" aria-label="Ocupación por hora">
        <defs>
          <linearGradient id="ocupacionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map(value => {
          const y = padding + chartHeight - (value / 100) * chartHeight;
          return (
            <g key={value}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x="8" y={y + 4} fontSize="11" fill="#64748b">{value}%</text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#ocupacionGradient)" />
        <path d={linePath} fill="none" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(point => (
          <g key={point.hora}>
            <circle cx={point.x} cy={point.y} r="5" fill="#ffffff" stroke="#0284c7" strokeWidth="3" />
            <text x={point.x} y={height - 9} textAnchor="middle" fontSize="11" fill="#64748b">{point.hora}</text>
            <text x={point.x} y={point.y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">
              {point.ocupacion}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SociosCompositionChart({ accionistas, rentistas, total }) {
  const accionistasPorc = total > 0 ? (accionistas / total) * 100 : 0;
  const rentistasPorc = total > 0 ? (rentistas / total) * 100 : 0;

  return (
    <div className="grafico-pastel">
      <div className="donut-chart">
        <svg viewBox="0 0 100 100" width="150" height="150">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="15" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="15"
            strokeDasharray={`${accionistasPorc * 2.513} ${(100 - accionistasPorc) * 2.513}`}
            strokeDashoffset="0"
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="45" textAnchor="middle" fontSize="10" fill="#1f2937" fontWeight="bold">Acc</text>
          <text x="50" y="58" textAnchor="middle" fontSize="12" fill="#3b82f6" fontWeight="bold">
            {Math.round(accionistasPorc)}%
          </text>
        </svg>
        <svg viewBox="0 0 100 100" width="150" height="150">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="15" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#10b981"
            strokeWidth="15"
            strokeDasharray={`${rentistasPorc * 2.513} ${(100 - rentistasPorc) * 2.513}`}
            strokeDashoffset="0"
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="45" textAnchor="middle" fontSize="10" fill="#1f2937" fontWeight="bold">Ren</text>
          <text x="50" y="58" textAnchor="middle" fontSize="12" fill="#10b981" fontWeight="bold">
            {Math.round(rentistasPorc)}%
          </text>
        </svg>
      </div>
      <div className="leyenda">
        <div><span className="color-box" style={{ background: '#3b82f6' }} /> Accionistas ({accionistas})</div>
        <div><span className="color-box" style={{ background: '#10b981' }} /> Rentistas ({rentistas})</div>
      </div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('admin');
  const [kpis, setKpis] = useState({
    totalSocios: 0,
    accionistas: 0,
    rentistas: 0,
    reservasHoy: 0,
    sancionesActivas: 0,
    visitasHoy: 0,
    ludotecaActivos: 0,
    ocupacionPromedio: 0,
    noShowsMes: 0
  });
  const [reservasRecientes, setReservasRecientes] = useState([]);
  const [reservasDashboard, setReservasDashboard] = useState([]);
  const [activeSpacesCount, setActiveSpacesCount] = useState(1);
  const [occupancyView, setOccupancyView] = useState('semana');
  const [occupancyRange, setOccupancyRange] = useState(getDefaultRange('semana'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSesion = localStorage.getItem('usuario');

    if (!token || !usuarioSesion) {
      navigate('/login');
      return;
    }

    const usuario = JSON.parse(usuarioSesion);
    if (!['gerente', 'admin'].includes(usuario.rol)) {
      navigate('/login');
      return;
    }

    setUserName(usuario.nombres || 'Administrador');
    setUserRole(usuario.rol);
    fetchDashboardData();
  }, [navigate]);

  useEffect(() => {
    document.title = 'Dashboard Ejecutivo | Club Social y Deportivo';
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [sociosResult, reservasResult, sancionesResult, visitasResult, ludotecaResult, espaciosResult] = await Promise.allSettled([
        adminApi.getSocios(),
        adminApi.getReservas(),
        adminApi.getSanciones(),
        adminApi.getVisitasActivas(),
        adminApi.getLudotecaActivos(),
        adminApi.getEspacios()
      ]);

      const sociosLista = sociosResult.status === 'fulfilled' ? sociosResult.value : [];
      const reservasLista = reservasResult.status === 'fulfilled' ? reservasResult.value : [];
      const sancionesLista = sancionesResult.status === 'fulfilled' ? sancionesResult.value : [];
      const visitasLista = visitasResult.status === 'fulfilled' ? visitasResult.value : [];
      const ludotecaLista = ludotecaResult.status === 'fulfilled' ? ludotecaResult.value : [];
      const espaciosLista = espaciosResult.status === 'fulfilled' ? espaciosResult.value : [];
      const hoy = new Date().toISOString().split('T')[0];
      const mesActual = hoy.slice(0, 7);
      const sociosActivos = sociosLista.filter(socio => isActive(socio.activo));
      const reservasNoCanceladas = reservasLista.filter(reserva => normalizeEstadoReserva(reserva.estado) !== 'cancelada');
      const ocupacionData = HORAS_OPERACION.map(hora => {
        const reservasEnHora = reservasNoCanceladas.filter(reserva =>
          getDateOnly(reserva.fecha) === hoy &&
          reserva.hora_inicio?.startsWith(hora.slice(0, 2))
        );
        return {
          hora,
          ocupacion: Math.min(Math.floor((reservasEnHora.length / 5) * 100), 100)
        };
      });
      const ocupacionPromedio = ocupacionData.length
        ? Math.floor(ocupacionData.reduce((sum, item) => sum + item.ocupacion, 0) / ocupacionData.length)
        : 0;

      setReservasDashboard(reservasLista);
      setActiveSpacesCount(Math.max(espaciosLista.filter(espacio => isActive(espacio.activo)).length, 1));
      setReservasRecientes(reservasLista.slice(0, 3));
      setKpis({
        totalSocios: sociosActivos.length,
        accionistas: sociosActivos.filter(socio => getTipoSocio(socio) === 'accionista').length,
        rentistas: sociosActivos.filter(socio => getTipoSocio(socio) === 'rentista').length,
        reservasHoy: reservasNoCanceladas.filter(reserva => getDateOnly(reserva.fecha) === hoy).length,
        sancionesActivas: sancionesLista.filter(sancion => {
          const estado = String(sancion.estado || '').toLowerCase();
          return sancion.activa === true || estado === 'activa' || estado === 'activo';
        }).length,
        visitasHoy: visitasLista.length,
        ludotecaActivos: ludotecaLista.length,
        ocupacionPromedio,
        noShowsMes: reservasLista.filter(reserva =>
          getDateOnly(reserva.fecha).slice(0, 7) === mesActual &&
          (normalizeEstadoReserva(reserva.estado) === 'no-show' || reserva.no_show === true)
        ).length
      });
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
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

  const getNavClass = (tab) => `nav-link ${activeTab === tab ? 'active' : ''}`;
  const isManager = userRole === 'gerente';
  const visibleAdminItems = ADMIN_ITEMS.filter(item => userRole === 'admin' || item.id !== 'usuarios');
  const mobileItems = [...NAV_ITEMS, ...visibleAdminItems];
  const dashboardTitle = isManager ? 'Panel Gerencial' : 'Dashboard Ejecutivo';

  if (loading) {
    return (
      <div className="dashboard-root">
        <div className="chart-box" style={{ textAlign: 'center', padding: '2rem' }}>
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
          <span>Club Social</span>
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
          {visibleAdminItems.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={getNavClass(item.id)}>
                <Icon className="nav-icon" /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="nav-link" style={{ color: '#ef4444' }}>
            <LogOut className="nav-icon" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="admin-mobile-top">
          <div>
            <strong>Club Social</strong>
            <span>{dashboardTitle}</span>
          </div>
          <select value={activeTab} onChange={event => setActiveTab(event.target.value)}>
            {mobileItems.map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </header>

        <header className="page-header">
          <div>
            <h2>{dashboardTitle}</h2>
            {userName && <p>Sesión activa: {userName}</p>}
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        {activeTab === 'dashboard' && (
          <>
            <section className="top-kpi-grid">
              <div className="kpi-card">
                <Users className="kpi-icon" />
                <div><h3>{kpis.totalSocios}</h3><p>Total Socios</p></div>
              </div>
              <div className="kpi-card">
                <UserCheck className="kpi-icon green" />
                <div><h3>{kpis.accionistas}</h3><p>Accionistas</p></div>
              </div>
              <div className="kpi-card">
                <UserPlus className="kpi-icon blue" />
                <div><h3>{kpis.rentistas}</h3><p>Rentistas</p></div>
              </div>
              <div className="kpi-card">
                <CalendarDays className="kpi-icon amber" />
                <div><h3>{kpis.reservasHoy}</h3><p>Reservas Hoy</p></div>
              </div>
              <div className="kpi-card">
                <ShieldAlert className="kpi-icon red" />
                <div><h3>{kpis.sancionesActivas}</h3><p>Sanciones Activas</p></div>
              </div>
            </section>

            <section className="charts-row">
              <div className="chart-box">
                <h4 className="chart-title-row"><TrendingUp size={18} /> Ocupación por Hora</h4>
                <p>Uso de espacios en el rango seleccionado</p>
                <div className="occupancy-controls">
                  <select value={occupancyView} onChange={event => handleOccupancyViewChange(event.target.value)}>
                    {OCCUPANCY_VIEW_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={occupancyRange.startDate}
                    onChange={event => setOccupancyRange(prev => ({ ...prev, startDate: event.target.value }))}
                  />
                  <input
                    type="date"
                    value={occupancyRange.endDate}
                    onChange={event => setOccupancyRange(prev => ({ ...prev, endDate: event.target.value }))}
                  />
                </div>
                <OccupancyByHourChart
                  reservas={reservasDashboard}
                  startDate={occupancyRange.startDate}
                  endDate={occupancyRange.endDate}
                  activeSpaces={activeSpacesCount}
                />
              </div>
              <div className="chart-box">
                <h4 className="chart-title-row"><Users size={18} /> Composición de Socios</h4>
                <p>Accionistas vs Rentistas</p>
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
                <div className="summary-grid">
                  <div className="mini-card"><User className="mini-icon" /><div><p>{kpis.visitasHoy}</p><p>Visitas hoy</p></div></div>
                  <div className="mini-card"><Puzzle className="mini-icon" /><div><p>{kpis.ludotecaActivos}</p><p>Ludoteca activos</p></div></div>
                  <div className="mini-card"><TrendingUp className="mini-icon" /><div><p>{kpis.ocupacionPromedio}%</p><p>Ocupación prom.</p></div></div>
                  <div className="mini-card"><AlertTriangle className="mini-icon" /><div><p>{kpis.noShowsMes}</p><p>No-shows mes</p></div></div>
                </div>
              </div>
              <div className="chart-box">
                <h4 className="chart-title-row"><CalendarDays size={18} /> Reservas Recientes</h4>
                {reservasRecientes.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay reservas recientes</p>
                ) : (
                  <ul className="reservation-list">
                    {reservasRecientes.map((reserva, index) => (
                      <li key={reserva.reserva_id || index} className="res-item">
                        <div>
                          <p className="reservation-name">{reserva.espacio_nombre || `Reserva #${reserva.reserva_id}`}</p>
                          <p className="reservation-detail">
                            {reserva.socio_nombre || 'Socio'} - {reserva.hora_inicio?.slice(0, 5) || '--:--'} a {reserva.hora_fin?.slice(0, 5) || '--:--'}
                          </p>
                        </div>
                        <span className={`badge ${getEstadoBadgeClass(reserva.estado)}`}>
                          {estadoReservaLabel(reserva.estado)}
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
            title="Torneos y brackets"
            subtitle="Consulta el estado de los torneos y sus cruces por ronda."
            readOnly={isManager}
          />
        )}
        {activeTab === 'ludoteca' && <Ludoteca />}
        {activeTab === 'sanciones' && <Sanciones />}
        {activeTab === 'usuarios' && userRole === 'admin' && <GestionUsuarios />}
        {activeTab === 'espacios' && <ConfiguracionEspacios readOnly={isManager} />}
        {activeTab === 'logs' && <AuditoriaLogs />}
      </main>
    </div>
  );
}

export default Dashboard;
