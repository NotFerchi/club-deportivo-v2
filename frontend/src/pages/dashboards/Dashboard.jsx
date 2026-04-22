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

// Importar componentes de las nuevas pestañas
import GestionUsuarios from './admin/GestionUsuarios';
import ConfiguracionEspacios from './admin/ConfiguracionEspacios';
import AuditoriaLogs from './admin/AuditoriaLogs';
import ReporteSanciones from './admin/ReporteSanciones';

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('');

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
  }, [navigate]);

  useEffect(() => {
    document.title = 'Dashboard Ejecutivo | Club Social y Deportivo';
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/');
  };

  const getNavClass = (tab) => `nav-link ${activeTab === tab ? 'active' : ''}`;

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

          {/* Nuevas opciones para Admin/Gerente */}
          <span className="nav-section-label" style={{ marginTop: '1rem' }}>ADMINISTRACIÓN</span>
          
          <button onClick={() => setActiveTab('usuarios')} className={getNavClass('usuarios')}>
            <UserPlus className="nav-icon" /> Gestión de Usuarios
          </button>
          
          <button onClick={() => setActiveTab('espacios')} className={getNavClass('espacios')}>
            <Settings className="nav-icon" /> Configuración
          </button>
          
          <button onClick={() => setActiveTab('logs')} className={getNavClass('logs')}>
            <FileText className="nav-icon" /> Auditoría
          </button>
          
          <button onClick={() => setActiveTab('reporte-sanciones')} className={getNavClass('reporte-sanciones')}>
            <AlertTriangle className="nav-icon" /> Reporte Sanciones
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
            <p>Vista general del club - {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        {/* Dashboard Principal (KPIs y gráficas) */}
        {activeTab === 'dashboard' && (
          <>
            <section className="top-kpi-grid">
              <div className="kpi-card"><Users className="kpi-icon" /><div><h3>1,247</h3><p>Total Socios</p></div></div>
              <div className="kpi-card"><UserCheck className="kpi-icon green" /><div><h3>834</h3><p>Accionistas</p></div></div>
              <div className="kpi-card"><UserPlus className="kpi-icon blue" /><div><h3>413</h3><p>Rentistas</p></div></div>
              <div className="kpi-card"><CalendarDays className="kpi-icon amber" /><div><h3>86</h3><p>Reservas Hoy</p></div></div>
              <div className="kpi-card"><ShieldAlert className="kpi-icon red" /><div><h3>14</h3><p>Sanciones Activas</p></div></div>
            </section>

            <section className="charts-row">
              <div className="chart-box">
                <h4>Ocupación por Hora</h4>
                <p>Porcentaje de uso de instalaciones hoy</p>
                <div className="placeholder-visual">📊 Gráfico de Líneas (Próximamente)</div>
              </div>
              <div className="chart-box">
                <h4>Composición de Socios</h4>
                <p>Accionistas vs Rentistas</p>
                <div className="placeholder-visual">🥧 Gráfico Donut (Próximamente)</div>
              </div>
            </section>

            <section className="bottom-row">
              <div className="chart-box">
                <h4>Resumen del Día</h4>
                <div className="summary-grid">
                  <div className="mini-card"><User className="mini-icon" /><div><p>23</p><p>Visitas hoy</p></div></div>
                  <div className="mini-card"><Puzzle className="mini-icon" /><div><p>8</p><p>Ludoteca activos</p></div></div>
                  <div className="mini-card"><TrendingUp className="mini-icon" /><div><p>71%</p><p>Ocupación prom.</p></div></div>
                  <div className="mini-card"><AlertTriangle className="mini-icon" /><div><p>14</p><p>No-Shows mes</p></div></div>
                </div>
              </div>
              <div className="chart-box">
                <h4>Reservas Recientes</h4>
                <ul className="reservation-list">
                  <li className="res-item"><div><p className="reservation-name">Carlos Mendoza R.</p><p className="reservation-detail">Cancha Tenis 1 - 08:00 a 09:30</p></div><span className="badge confirmada">Confirmada</span></li>
                  <li className="res-item"><div><p className="reservation-name">Ana Patricia Reyes F.</p><p className="reservation-detail">Cancha Pádel 1 - 10:00 a 11:00</p></div><span className="badge pendiente">Pendiente</span></li>
                  <li className="res-item"><div><p className="reservation-name">Jorge Vargas L.</p><p className="reservation-detail">Alberca Olímpica - 07:00 a 08:00</p></div><span className="badge confirmada">Confirmada</span></li>
                </ul>
              </div>
            </section>
          </>
        )}

        {/* Socios - Pendiente de implementar */}
        {activeTab === 'socios' && (
          <div className="chart-box">
            <h4>Gestión de Socios</h4>
            <p className="empty-message">Próximamente: Módulo completo de gestión de socios</p>
          </div>
        )}

        {/* Recepción y Visitas - Pendiente de implementar */}
        {activeTab === 'recepcion' && (
          <div className="chart-box">
            <h4>Recepción y Visitas</h4>
            <p className="empty-message">Próximamente: Control de visitas y pases de un día</p>
          </div>
        )}

        {/* Reservas - Pendiente de implementar */}
        {activeTab === 'reservas' && (
          <div className="chart-box">
            <h4>Central de Reservas</h4>
            <p className="empty-message">Próximamente: Mapa de canchas y disponibilidad</p>
          </div>
        )}

        {/* Ludoteca - Pendiente de implementar */}
        {activeTab === 'ludoteca' && (
          <div className="chart-box">
            <h4>Control de Ludoteca</h4>
            <p className="empty-message">Próximamente: Registro de entrada/salida de niños</p>
          </div>
        )}

        {/* Disciplinas - Pendiente de implementar */}
        {activeTab === 'disciplinas' && (
          <div className="chart-box">
            <h4>Disciplinas Deportivas</h4>
            <p className="empty-message">Próximamente: Configuración de disciplinas y horarios</p>
          </div>
        )}

        {/* Sanciones - Pendiente de implementar */}
        {activeTab === 'sanciones' && (
          <div className="chart-box">
            <h4>Gestión de Sanciones</h4>
            <p className="empty-message">Próximamente: Listado de socios sancionados</p>
          </div>
        )}

        {/* Gestión de Usuarios (Empleados) */}
        {activeTab === 'usuarios' && <GestionUsuarios />}

        {/* Configuración de Espacios */}
        {activeTab === 'espacios' && <ConfiguracionEspacios />}

        {/* Auditoría de Logs */}
        {activeTab === 'logs' && <AuditoriaLogs />}

        {/* Reporte de Sanciones */}
        {activeTab === 'reporte-sanciones' && <ReporteSanciones />}
      </main>
    </div>
  );
}

export default Dashboard;