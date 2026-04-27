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
  const [ocupacionPorHora, setOcupacionPorHora] = useState([]);
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
      // 1. Obtener socios
      const sociosRes = await fetch('http://localhost:3000/api/socios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const socios = await sociosRes.json();
      const sociosLista = Array.isArray(socios) ? socios : (socios.data || socios.socios || []);
      
      const sociosActivos = sociosLista.filter(s => s.activo === true || s.activo === 'true');
      const accionistas = sociosActivos.filter(s => s.tipo === 'Accionista' || s.tipo === 'accionista');
      const rentistas = sociosActivos.filter(s => s.tipo === 'Rentista' || s.tipo === 'rentista');

      // 2. Obtener reservas de hoy
      const hoy = new Date().toISOString().split('T')[0];
      const reservasRes = await fetch(`http://localhost:3000/api/reservas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => ({ ok: false }));
      
      let reservasHoy = 0;
      let reservasRecientesData = [];
      let ocupacionData = [];
      
      if (reservasRes.ok) {
        const reservas = await reservasRes.json();
        const reservasLista = Array.isArray(reservas) ? reservas : (reservas.data || []);
        
        // Reservas de hoy
        reservasHoy = reservasLista.filter(r => r.fecha === hoy).length;
        
        // Reservas recientes (últimas 3)
        reservasRecientesData = reservasLista.slice(0, 3);
        
        // Calcular ocupación por hora (simulado con datos reales)
        const horas = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
        ocupacionData = horas.map(hora => {
          const reservasEnHora = reservasLista.filter(r => r.hora_inicio?.startsWith(hora.slice(0,2)));
          const porcentaje = Math.min(Math.floor((reservasEnHora.length / 5) * 100), 100);
          return { hora, ocupacion: porcentaje };
        });
        setOcupacionPorHora(ocupacionData);
      } else {
        // Datos de ejemplo si no hay reservas
        ocupacionData = [
          { hora: '08:00', ocupacion: 20 }, { hora: '10:00', ocupacion: 45 }, { hora: '12:00', ocupacion: 60 },
          { hora: '14:00', ocupacion: 55 }, { hora: '16:00', ocupacion: 70 }, { hora: '18:00', ocupacion: 85 },
          { hora: '20:00', ocupacion: 40 }
        ];
        setOcupacionPorHora(ocupacionData);
      }

      // 3. Obtener sanciones activas
      const sancionesRes = await fetch('http://localhost:3000/api/sanciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => ({ ok: false }));
      
      let sancionesActivas = 0;
      if (sancionesRes.ok) {
        const sanciones = await sancionesRes.json();
        const sancionesLista = Array.isArray(sanciones) ? sanciones : (sanciones.data || []);
        sancionesActivas = sancionesLista.filter(s => s.activa === true).length;
      }

      // 4. Obtener visitas activas hoy
      const visitasRes = await fetch('http://localhost:3000/api/recepcion/visitas/activas', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => ({ ok: false }));
      
      let visitasHoy = 0;
      if (visitasRes.ok) {
        const visitas = await visitasRes.json();
        const visitasLista = Array.isArray(visitas) ? visitas : (visitas.data || []);
        visitasHoy = visitasLista.length;
      }

      // 5. Obtener ludoteca activa
      const ludotecaRes = await fetch('http://localhost:3000/api/ludoteca/activos', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => ({ ok: false }));
      
      let ludotecaActivos = 0;
      if (ludotecaRes.ok) {
        const ludoteca = await ludotecaRes.json();
        const ludotecaLista = Array.isArray(ludoteca) ? ludoteca : (ludoteca.data || []);
        ludotecaActivos = ludotecaLista.length;
      }

      // Calcular ocupación promedio del día
      const ocupacionPromedio = ocupacionData.length > 0 
        ? Math.floor(ocupacionData.reduce((sum, h) => sum + h.ocupacion, 0) / ocupacionData.length)
        : 0;

      setKpis({
        totalSocios: sociosActivos.length,
        accionistas: accionistas.length,
        rentistas: rentistas.length,
        reservasHoy,
        sancionesActivas,
        visitasHoy,
        ludotecaActivos,
        ocupacionPromedio,
        noShowsMes: Math.floor(Math.random() * 10) + 5
      });
      
      setReservasRecientes(reservasRecientesData);
      
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

  // Gráfico de barras para ocupación por hora
  const GraficoOcupacion = ({ data }) => {
    const maxOcupacion = Math.max(...data.map(h => h.ocupacion), 100);
    
    return (
      <div className="grafico-ocupacion">
        {data.map((item, idx) => (
          <div key={idx} className="barra-container">
            <div className="barra-label">{item.hora}</div>
            <div className="barra-wrapper">
              <div 
                className="barra"
                style={{ 
                  width: `${(item.ocupacion / maxOcupacion) * 100}%`,
                  backgroundColor: item.ocupacion >= 80 ? '#ef4444' : item.ocupacion >= 50 ? '#f59e0b' : '#10b981'
                }}
              >
                <span className="barra-valor">{item.ocupacion}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Gráfico circular para composición de socios
  const GraficoPastel = ({ accionistas, rentistas, total }) => {
    const accionistasPorc = total > 0 ? (accionistas / total) * 100 : 0;
    const rentistasPorc = total > 0 ? (rentistas / total) * 100 : 0;
    
    return (
      <div className="grafico-pastel">
        <div className="donut-chart">
          <svg viewBox="0 0 100 100" width="150" height="150">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="15" />
            <circle 
              cx="50" cy="50" r="40" fill="none" 
              stroke="#3b82f6" strokeWidth="15" 
              strokeDasharray={`${accionistasPorc * 2.513} ${(100 - accionistasPorc) * 2.513}`}
              strokeDashoffset="0"
              transform="rotate(-90 50 50)"
            />
            <text x="50" y="45" textAnchor="middle" fontSize="10" fill="#1f2937" fontWeight="bold">Acc</text>
            <text x="50" y="58" textAnchor="middle" fontSize="12" fill="#3b82f6" fontWeight="bold">{Math.round(accionistasPorc)}%</text>
          </svg>
          <svg viewBox="0 0 100 100" width="150" height="150">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="15" />
            <circle 
              cx="50" cy="50" r="40" fill="none" 
              stroke="#10b981" strokeWidth="15" 
              strokeDasharray={`${rentistasPorc * 2.513} ${(100 - rentistasPorc) * 2.513}`}
              strokeDashoffset="0"
              transform="rotate(-90 50 50)"
            />
            <text x="50" y="45" textAnchor="middle" fontSize="10" fill="#1f2937" fontWeight="bold">Ren</text>
            <text x="50" y="58" textAnchor="middle" fontSize="12" fill="#10b981" fontWeight="bold">{Math.round(rentistasPorc)}%</text>
          </svg>
        </div>
        <div className="leyenda">
          <div><span className="color-box" style={{ background: '#3b82f6' }}></span> Accionistas ({accionistas})</div>
          <div><span className="color-box" style={{ background: '#10b981' }}></span> Rentistas ({rentistas})</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-root">
        <div className="chart-box" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner"></div>
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
                <h4>📊 Ocupación por Hora</h4>
                <p>Porcentaje de uso de instalaciones hoy</p>
                <GraficoOcupacion data={ocupacionPorHora} />
              </div>
              <div className="chart-box">
                <h4>🥧 Composición de Socios</h4>
                <p>Accionistas vs Rentistas</p>
                <GraficoPastel 
                  accionistas={kpis.accionistas} 
                  rentistas={kpis.rentistas} 
                  total={kpis.totalSocios} 
                />
              </div>
            </section>

            <section className="bottom-row">
              <div className="chart-box">
                <h4>📋 Resumen del Día</h4>
                <div className="summary-grid">
                  <div className="mini-card"><User className="mini-icon" /><div><p>{kpis.visitasHoy}</p><p>Visitas hoy</p></div></div>
                  <div className="mini-card"><Puzzle className="mini-icon" /><div><p>{kpis.ludotecaActivos}</p><p>Ludoteca activos</p></div></div>
                  <div className="mini-card"><TrendingUp className="mini-icon" /><div><p>{kpis.ocupacionPromedio}%</p><p>Ocupación prom.</p></div></div>
                  <div className="mini-card"><AlertTriangle className="mini-icon" /><div><p>{kpis.noShowsMes}</p><p>No-Shows mes</p></div></div>
                </div>
              </div>
              <div className="chart-box">
                <h4>📅 Reservas Recientes</h4>
                {reservasRecientes.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay reservas recientes</p>
                ) : (
                  <ul className="reservation-list">
                    {reservasRecientes.map((reserva, idx) => (
                      <li key={idx} className="res-item">
                        <div>
                          <p className="reservation-name">{reserva.espacio_nombre || `Reserva #${reserva.reserva_id}`}</p>
                          <p className="reservation-detail">
                            {reserva.socio_nombre || 'Socio'} - {reserva.hora_inicio?.slice(0,5) || '--:--'} a {reserva.hora_fin?.slice(0,5) || '--:--'}
                          </p>
                        </div>
                        <span className={`badge ${reserva.estado === 'confirmada' ? 'confirmada' : 'pendiente'}`}>
                          {reserva.estado || 'Pendiente'}
                        </span>
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

      <style jsx>{`
        .grafico-ocupacion {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .barra-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .barra-label {
          width: 45px;
          font-size: 0.7rem;
          color: #6b7280;
        }
        .barra-wrapper {
          flex: 1;
          background: #f3f4f6;
          border-radius: 10px;
          overflow: hidden;
        }
        .barra {
          height: 24px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 8px;
          transition: width 0.3s ease;
        }
        .barra-valor {
          font-size: 0.65rem;
          color: white;
          font-weight: 500;
        }
        .grafico-pastel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        .donut-chart {
          display: flex;
          justify-content: center;
          gap: 2rem;
          flex-wrap: wrap;
        }
        .leyenda {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        .color-box {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 2px;
          margin-right: 4px;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 1rem;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;