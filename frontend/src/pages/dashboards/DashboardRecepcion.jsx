import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Calendar, Baby, ClipboardCheck, LogOut, UserPlus, ShieldAlert
} from 'lucide-react';
import '../../../css/recepcion.css';  // Asegúrate de que esta ruta sea correcta

// Importar componentes de las pestañas
import DashboardResumen from './recepcion/DashboardResumen';
import GestionSocios from './recepcion/GestionSocios';
import CentralReservas from './recepcion/CentralReservas';
import ControlLudoteca from './recepcion/ControlLudoteca';
import PaseLista from './recepcion/PaseLista';
import GestionVisitas from './recepcion/GestionVisitas';
import Sanciones from './recepcion/Sanciones';

function DashboardRecepcion() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (!token || usuario.rol !== 'recepcion') {
      navigate('/login');
    }
    document.title = 'Recepción | Club Social';
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const getNavClass = (tab) => `nav-link ${activeTab === tab ? 'active' : ''}`;

  return (
    <div className="dashboard-root">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" />
          <span>Club Social</span>
        </div>
        <nav>
          <span className="nav-section-label">RECEPCIÓN</span>
          <button onClick={() => setActiveTab('dashboard')} className={getNavClass('dashboard')}>
            <LayoutDashboard className="nav-icon" /> Dashboard
          </button>
          <button onClick={() => setActiveTab('visitas')} className={getNavClass('visitas')}>
            <UserPlus className="nav-icon" /> Recepción y Visitas
          </button>
          <button onClick={() => setActiveTab('socios')} className={getNavClass('socios')}>
            <Users className="nav-icon" /> Gestión de Socios
          </button>
          <button onClick={() => setActiveTab('reservas')} className={getNavClass('reservas')}>
            <Calendar className="nav-icon" /> Central de Reservas
          </button>
          <button onClick={() => setActiveTab('ludoteca')} className={getNavClass('ludoteca')}>
            <Baby className="nav-icon" /> Ludoteca
          </button>
          <button onClick={() => setActiveTab('checkin')} className={getNavClass('checkin')}>
            <ClipboardCheck className="nav-icon" /> Pase de Lista
          </button>
          <button onClick={() => setActiveTab('sanciones')} className={getNavClass('sanciones')}>
            <ShieldAlert className="nav-icon" /> Sanciones
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <button onClick={handleLogout} className="nav-link" style={{ color: '#ef4444' }}>
            <LogOut className="nav-icon" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>Módulo de Recepción</h2>
            <p>Control de accesos, socios y actividades del club</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        {activeTab === 'dashboard' && <DashboardResumen onNavigate={setActiveTab} />}
        {activeTab === 'visitas' && <GestionVisitas />}
        {activeTab === 'socios' && <GestionSocios />}
        {activeTab === 'reservas' && <CentralReservas />}
        {activeTab === 'ludoteca' && <ControlLudoteca />}
        {activeTab === 'checkin' && <PaseLista />}
        {activeTab === 'sanciones' && <Sanciones />}
      </main>
    </div>
  );
}

export default DashboardRecepcion;
