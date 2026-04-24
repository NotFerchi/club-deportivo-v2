import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, Users, BarChart3, Trophy, LogOut, Home } from 'lucide-react';
import '../../../css/instructor.css';

// Componentes de las pestañas (los crearemos después)
import AgendaDia from './instructor/AgendaDia';
import MisClases from './instructor/MisClases';
import MetricasInstructor from './instructor/MetricasInstructor';
import GestionTorneos from './instructor/GestionTorneos';

function DashboardInstructor() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('agenda');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Verificar rol (instructor o recepcion pueden ver)
    if (usuario.rol !== 'instructor' && usuario.rol !== 'recepcion') {
      navigate('/login');
      return;
    }
    
    setUserName(usuario.nombres || 'Instructor');
    document.title = 'Dashboard Deportivo | Club Social';
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
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
          <span className="nav-section-label">DEPORTIVO</span>
          <button onClick={() => setActiveTab('agenda')} className={getNavClass('agenda')}>
            <Calendar className="nav-icon" /> Agenda del Día
          </button>
          <button onClick={() => setActiveTab('clases')} className={getNavClass('clases')}>
            <Users className="nav-icon" /> Mis Clases
          </button>
          <button onClick={() => setActiveTab('metricas')} className={getNavClass('metricas')}>
            <BarChart3 className="nav-icon" /> Métricas
          </button>
          <button onClick={() => setActiveTab('torneos')} className={getNavClass('torneos')}>
            <Trophy className="nav-icon" /> Torneos
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <button onClick={handleLogout} className="nav-link" style={{ color: '#ef4444' }}>
            <LogOut className="nav-icon" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>Dashboard Deportivo</h2>
            <p>Bienvenido, {userName}</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        {activeTab === 'agenda' && <AgendaDia />}
        {activeTab === 'clases' && <MisClases />}
        {activeTab === 'metricas' && <MetricasInstructor />}
        {activeTab === 'torneos' && <GestionTorneos />}
      </main>
    </div>
  );
}

export default DashboardInstructor;