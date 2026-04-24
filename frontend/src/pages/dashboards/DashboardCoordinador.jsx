import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Calendar, Dumbbell, BarChart3, LogOut, Home } from 'lucide-react';
import '../../../css/Dashboard.css';

// Importar componentes de las pestañas
import GestionInstructores from './coordinador/GestionInstructores';
import GestionHorarios from './coordinador/GestionHorarios';
import GestionDisciplinas from './coordinador/GestionDisciplinas';
import ReportesAsistencia from './coordinador/ReportesAsistencia';

function DashboardCoordinador() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('instructores');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Verificar rol (coordinador o admin pueden ver)
    if (usuario.rol !== 'coordinador' && usuario.rol !== 'admin') {
      navigate('/login');
      return;
    }
    
    setUserName(usuario.nombres || 'Coordinador');
    document.title = 'Coordinación Deportiva | Club Social';
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
          <span className="nav-section-label">COORDINACIÓN</span>
          
          <button onClick={() => setActiveTab('instructores')} className={getNavClass('instructores')}>
            <Users className="nav-icon" /> Instructores
          </button>
          
          <button onClick={() => setActiveTab('horarios')} className={getNavClass('horarios')}>
            <Calendar className="nav-icon" /> Horarios
          </button>
          
          <button onClick={() => setActiveTab('disciplinas')} className={getNavClass('disciplinas')}>
            <Dumbbell className="nav-icon" /> Disciplinas
          </button>
          
          <button onClick={() => setActiveTab('reportes')} className={getNavClass('reportes')}>
            <BarChart3 className="nav-icon" /> Reportes
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <Link to="/" className="nav-link" style={{ color: '#94a3b8' }}>
            <Home className="nav-icon" /> Inicio
          </Link>
          <button onClick={handleLogout} className="nav-link" style={{ color: '#ef4444' }}>
            <LogOut className="nav-icon" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>Panel de Coordinación Deportiva</h2>
            <p>Bienvenido, {userName}</p>
          </div>
          <Link to="/" className="back-link">Volver al inicio</Link>
        </header>

        {activeTab === 'instructores' && <GestionInstructores />}
        {activeTab === 'horarios' && <GestionHorarios />}
        {activeTab === 'disciplinas' && <GestionDisciplinas />}
        {activeTab === 'reportes' && <ReportesAsistencia />}
      </main>
    </div>
  );
}

export default DashboardCoordinador;