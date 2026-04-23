import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  Puzzle,
  Dumbbell,
  ShieldAlert,
  UserCheck,
  UserPlus,
  CalendarDays,
  User,
  TrendingUp,
  AlertTriangle,
  Settings,
  FileText,
  LogOut
} from 'lucide-react';
import '../../../css/Dashboard.css';

// Importar componentes
import GestionSocios from './admin/GestionSocios';
import RecepcionVisitas from './admin/RecepcionVisitas';
import Reservas from './admin/Reservas';
import Disciplinas from './admin/Disciplinas';
import Ludoteca from './admin/Ludoteca';
import Sanciones from './admin/Sanciones';
import GestionUsuarios from './admin/GestionUsuarios';
import ConfiguracionEspacios from './admin/ConfiguracionEspacios';
import AuditoriaLogs from './admin/AuditoriaLogs';

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('');
  
  // Estados para los KPIs
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
    fetchDashboardData();
  }, [navigate]);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    
    try {
      // Obtener socios
      const sociosRes = await fetch('http://localhost:3000/api/socios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const socios = await sociosRes.json();
      
      const sociosActivos = Array.isArray(socios) ? socios.filter(s => s.activo === true || s.activo === 'true') : [];
      const accionistas = sociosActivos.filter(s => s.tipo === 'Accionista');
      const rentistas = sociosActivos.filter(s => s.tipo === 'Rentista');
      
      setKpis({
        totalSocios: sociosActivos.length,
        accionistas: accionistas.length,
        rentistas: rentistas.length,
        reservasHoy: 0,
        sancionesActivas: 0,
        visitasHoy: 0,
        ludotecaActivos: 0,
        ocupacionPromedio: 65,
        noShowsMes: 8
      });
      
      setReservasRecientes([]);
      
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Dashboard Ejecutivo | Club Social y Deportivo';
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/');
  };

  const getNavClass = (tab) => `nav-link ${activeTab === tab ? 'active' : ''}`;

  if (loading) {
    return (
      <div className="dashboard-root">
        <div className="chart-box" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" />
          <span>Club Social</span>
        </div>

        <nav>
          <span className="nav-section-label">NAVEGACIÓN</span>
          
          <button onClick={() => setActiveTab('dashboard')} className={getNavClass('dashboard')}>
            <LayoutDashboard className="nav-icon" /> Dashboard
          </button>
          
          <button onClick={() => setActiveTab('socios')} className={getNavClass('socios')}>
            <Users className="nav-icon" /> Socios
          </button>
          
          <button onClick={() => setActiveTab('recepcion')} className={getNavClass('recepcion')}>
            <ClipboardList className="nav-icon" /> Recepción y Visitas
          </button>
          
          <button onClick={() => setActiveTab('reservas')} className={getNavClass('reservas')}>
            <Calendar className="nav-icon" /> Reservas
          </button>
          
          <button onClick={() => setActiveTab('ludoteca')} className={getNavClass('ludoteca')}>
            <Puzzle className="nav-icon" /> Ludoteca
          </button>
          
          <button onClick={() => setActiveTab('disciplinas')} className={getNavClass('disciplinas')}>
            <Dumbbell className="nav-icon" /> Disciplinas
          </button>
          
          <button onClick={() => setActiveTab('sanciones')} className={getNavClass('sanciones')}>
            <ShieldAlert className="nav-icon" /> Sanciones
          </button>

          {/* Administración */}
          <span className="nav-section-label" style={{ marginTop: '1rem' }}>ADMINISTRACIÓN</span>
          
          <button onClick={() => setActiveTab('usuarios')} className={getNavClass('usuarios')}>
            <UserPlus className="nav-icon" /> Gestión de Usuarios
          </button>
          
          <button onClick={() => setActiveTab('espacios')} className={getNavClass('espacios')}>
            <Settings className="nav-icon" /> Configuración de espacios
          </button>
          
          <button onClick={() => setActiveTab('logs')} className={getNavClass('logs')}>
            <FileText className="nav-icon" /> Auditoría
          </button>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <button onClick={handleLogout} className="nav-link" style={{ color: '#ef4444' }}>
            <LogOut className="nav-icon" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>Dashboard Ejecutivo</h2>
            <p>Bienvenido, {userName} - {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        {/* Dashboard Principal */}
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
                <h4>Ocupación por Hora</h4>
                <p>Porcentaje de uso de instalaciones hoy: {kpis.ocupacionPromedio}%</p>
                <div className="placeholder-visual">📊 Gráfico de Ocupación (Próximamente)</div>
              </div>
              <div className="chart-box">
                <h4>Composición de Socios</h4>
                <p>Accionistas vs Rentistas</p>
                <div className="placeholder-visual">🥧 Accionistas: {kpis.accionistas} | Rentistas: {kpis.rentistas}</div>
              </div>
            </section>

            <section className="bottom-row">
              <div className="chart-box">
                <h4>Resumen del Día</h4>
                <div className="summary-grid">
                  <div className="mini-card"><User className="mini-icon" /><div><p>{kpis.visitasHoy}</p><p>Visitas hoy</p></div></div>
                  <div className="mini-card"><Puzzle className="mini-icon" /><div><p>{kpis.ludotecaActivos}</p><p>Ludoteca activos</p></div></div>
                  <div className="mini-card"><TrendingUp className="mini-icon" /><div><p>{kpis.ocupacionPromedio}%</p><p>Ocupación prom.</p></div></div>
                  <div className="mini-card"><AlertTriangle className="mini-icon" /><div><p>{kpis.noShowsMes}</p><p>No-Shows mes</p></div></div>
                </div>
              </div>
              <div className="chart-box">
                <h4>Reservas Recientes</h4>
                {reservasRecientes.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '1rem' }}>No hay reservas recientes</p>
                ) : (
                  <ul className="reservation-list">
                    {reservasRecientes.map((reserva, idx) => (
                      <li key={idx} className="res-item">
                        <div>
                          <p className="reservation-name">Reserva #{reserva.reserva_id}</p>
                          <p className="reservation-detail">Espacio - Hora</p>
                        </div>
                        <span className="badge confirmada">Confirmada</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
        
        {activeTab === 'socios' && <GestionSocios />}
        {activeTab === 'recepcion' && <RecepcionVisitas />}
        {activeTab === 'reservas' && <Reservas />}
        {activeTab === 'disciplinas' && <Disciplinas />}
        {activeTab === 'ludoteca' && <Ludoteca />}
        {activeTab === 'sanciones' && <Sanciones />}
        {activeTab === 'usuarios' && <GestionUsuarios />}
        {activeTab === 'espacios' && <ConfiguracionEspacios />}
        {activeTab === 'logs' && <AuditoriaLogs />}
      </main>
    </div>
  );
}

export default Dashboard;