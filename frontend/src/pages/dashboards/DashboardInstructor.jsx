import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, Users, BarChart3, Trophy, LogOut } from 'lucide-react';
import '../../../css/instructor.css';

import AgendaDia from './instructor/AgendaDia';
import MisClases from './instructor/MisClases';
import MetricasInstructor from './instructor/MetricasInstructor';
import GestionTorneos from './instructor/GestionTorneos';

function DashboardInstructor() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('agenda');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (!token) { navigate('/login'); return; }
    if (usuario.rol !== 'instructor' && usuario.rol !== 'recepcion') { navigate('/login'); return; }
    setUserName(usuario.nombres || 'Instructor');
    setUserEmail(usuario.email || '');
    document.title = 'Dashboard Deportivo | Club Social';
  }, [navigate]);

  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const iniciales = (n) => n ? n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() : '?';

  const tabs = [
    { key: 'agenda',   label: 'Agenda',   icon: <Calendar size={18} /> },
    { key: 'clases',   label: 'Mis Clases', icon: <Users size={18} /> },
    { key: 'metricas', label: 'Métricas', icon: <BarChart3 size={18} /> },
    { key: 'torneos',  label: 'Torneos',  icon: <Trophy size={18} /> },
  ];

  return (
    <div className="inst-root">

      {/* ── SIDEBAR DESKTOP ── */}
      <aside className="inst-sidebar">
        <div className="inst-brand">
          <div className="inst-brand-mark" />
          <span>Club Social</span>
        </div>
        <nav className="inst-nav">
          <span className="inst-nav-label">DEPORTIVO</span>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`inst-nav-link ${activeTab === t.key ? 'active' : ''}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
        <div className="inst-sidebar-footer">
          <button onClick={handleLogout} className="inst-nav-link logout">
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="inst-main-wrapper">

        {/* Header desktop */}
        <header className="inst-header-desktop">
          <div>
            <h2>Dashboard Deportivo</h2>
            <p>Bienvenido, {userName}</p>
          </div>
          <Link to="/" className="inst-back-link">Volver al inicio</Link>
        </header>

        {/* Header móvil */}
        <header className="inst-header-mobile">
          <span className="inst-mobile-title">Club Social y Deportivo</span>
          <div className="inst-mobile-user">
            <div className="inst-mobile-userinfo">
              <span className="inst-mobile-username">{userName}</span>
            </div>
            <div className="inst-mobile-avatar">{iniciales(userName)}</div>
            <button onClick={handleLogout} className="inst-mobile-logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Tabs móvil */}
        <div className="inst-tabs-mobile">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`inst-tab-btn ${activeTab === t.key ? 'active' : ''}`}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Contenido */}
        <main className="inst-main-content">
          {activeTab === 'agenda'   && <AgendaDia />}
          {activeTab === 'clases'   && <MisClases />}
          {activeTab === 'metricas' && <MetricasInstructor />}
          {activeTab === 'torneos'  && <GestionTorneos />}
        </main>
      </div>
    </div>
  );
}

export default DashboardInstructor;