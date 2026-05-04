import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, Calendar,
  Puzzle, Dumbbell, ShieldAlert, Trophy, LogOut, Menu, X
} from 'lucide-react';
import '../../../css/Dashboard.css';
import TournamentBracket from '../../components/TournamentBracket';

import DashboardResumen    from './coordinador/DashboardResumen';
import VistaSocios         from './coordinador/VistaSocios';
import VistaVisitas        from './coordinador/VistaVisitas';
import VistaReservas       from './coordinador/VistaReservas';
import VistaSanciones      from './coordinador/VistaSanciones';
import GestionInstructores from './coordinador/GestionInstructores';
import GestionDisciplinas  from './coordinador/GestionDisciplinas';

const TABS = [
  { key: 'dashboard',   label: 'Dashboard',         icon: LayoutDashboard },
  { key: 'socios',      label: 'Socios',             icon: Users },
  { key: 'recepcion',   label: 'Recepción',          icon: ClipboardList },
  { key: 'reservas',    label: 'Reservas',           icon: Calendar },
  { key: 'ludoteca',    label: 'Ludoteca',           icon: Puzzle },
  { key: 'disciplinas', label: 'Disciplinas',        icon: Dumbbell },
  { key: 'torneos',     label: 'Torneos',            icon: Trophy },
  { key: 'sanciones',   label: 'Sanciones',          icon: ShieldAlert },
];

const TITULOS = {
  dashboard:   { h: 'Dashboard General',             p: 'Resumen del estado actual del club' },
  socios:      { h: 'Socios',                        p: 'Directorio general de socios' },
  recepcion:   { h: 'Recepción y Visitas',           p: 'Visitas activas en instalaciones' },
  reservas:    { h: 'Reservas',                      p: 'Reservaciones de espacios del día' },
  ludoteca:    { h: 'Ludoteca',                      p: 'Control de ludoteca' },
  disciplinas: { h: 'Disciplinas e Instructores',    p: 'Programación de sesiones y cupos' },
  torneos:     { h: 'Torneos',                       p: 'Visualizacion de brackets y rondas' },
  sanciones:   { h: 'Sanciones',                    p: 'Sanciones aplicadas a socios' },
};

function DashboardCoordinador() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [disciplinaTab, setDisciplinaTab] = useState('disciplinas');
  const [userName, setUserName] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (!token) { navigate('/login'); return; }
    if (!['coordinador', 'admin', 'recepcion'].includes(usuario.rol)) {
      navigate('/login'); return;
    }
    setUserName(usuario.nombres || 'Coordinador');
    document.title = 'Coordinación Deportiva | Club Social';
  }, [navigate]);

  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const cambiarTab = (tab) => {
    setActiveTab(tab);
    setMenuAbierto(false);
  };

  const nav = (tab) => `nav-link ${activeTab === tab ? 'active' : ''}`;
  const titulo = TITULOS[activeTab] || TITULOS.dashboard;

  const iniciales = (n) => n ? n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() : '?';

  const renderContenido = () => {
    if (activeTab === 'dashboard')  return <DashboardResumen onNavigate={cambiarTab} />;
    if (activeTab === 'socios')     return <VistaSocios />;
    if (activeTab === 'recepcion')  return <VistaVisitas />;
    if (activeTab === 'reservas')   return <VistaReservas />;
    if (activeTab === 'sanciones')  return <VistaSanciones />;
    if (activeTab === 'torneos')    return (
      <TournamentBracket
        title="Torneos y brackets"
        subtitle="Supervisa los torneos del club y sus encuentros por ronda."
      />
    );
    if (activeTab === 'ludoteca')   return (
      <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
        <div style={{ fontSize: '3rem' }}>🧸</div>
        <p style={{ color: '#64748b', margin: '0.5rem 0 0', fontWeight: 600 }}>Ludoteca — En desarrollo</p>
      </div>
    );
    if (activeTab === 'disciplinas') return (
      <>
        {/* Sub-tabs disciplinas */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
            {['disciplinas', 'instructores'].map(t => (
              <button key={t} onClick={() => setDisciplinaTab(t)} style={{
                padding: '0.4rem 1rem', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '13px', borderRadius: '6px',
                background: disciplinaTab === t ? 'white' : 'transparent',
                color: disciplinaTab === t ? '#1e293b' : '#64748b',
                boxShadow: disciplinaTab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {disciplinaTab === 'disciplinas' && (
            <button style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0.45rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
              + Nueva Sesión
            </button>
          )}
        </div>
        {disciplinaTab === 'disciplinas' ? <GestionDisciplinas /> : <GestionInstructores />}
      </>
    );
  };

  return (
    <div className="dashboard-root">

      {/* ── SIDEBAR DESKTOP ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" />
          <span>Club Social</span>
        </div>
        <nav>
          <span className="nav-section-label">NAVEGACIÓN</span>
          {TABS.map(t => (
            <button key={t.key} onClick={() => cambiarTab(t.key)} className={nav(t.key)}>
              <t.icon className="nav-icon" /> {t.label}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <div style={{ padding: '0.5rem 1rem', fontSize: '12px', color: '#94a3b8' }}>{userName}</div>
          <button onClick={handleLogout} className="nav-link" style={{ color: '#ef4444' }}>
            <LogOut className="nav-icon" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ── WRAPPER PRINCIPAL ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header desktop */}
        <header className="page-header" style={{ 
  padding: '1.5rem 2rem 1rem',
  background: 'white',
  borderBottom: '1px solid #e2e8f0',
  flexShrink: 0
}}>
  <div>
    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>{titulo.h}</h2>
    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>{titulo.p}</p>
  </div>
</header>

        {/* Header móvil */}
        <header style={{
          display: 'none', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem', background: 'white', borderBottom: '1px solid #e2e8f0',
          flexShrink: 0
        }} className="coord-header-mobile">
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>Club Social y Deportivo</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '11px'
            }}>{iniciales(userName)}</div>
            <button onClick={() => setMenuAbierto(!menuAbierto)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              {menuAbierto ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </header>

        {/* Menú móvil desplegable */}
        {menuAbierto && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)'
          }} onClick={() => setMenuAbierto(false)}>
            <div style={{
              position: 'absolute', top: 0, right: 0, width: '75%', maxWidth: '280px',
              height: '100%', background: '#0f172a', padding: '1.5rem 0',
              display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid #1e293b' }}>
                <div style={{ fontWeight: 800, color: 'white', fontSize: '15px' }}>Club Social</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{userName}</div>
              </div>
              <nav style={{ flex: 1, padding: '1rem 0' }}>
                {TABS.map(t => (
                  <button key={t.key} onClick={() => cambiarTab(t.key)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '0.75rem 1.5rem', color: activeTab === t.key ? 'white' : '#94a3b8',
                    background: activeTab === t.key ? '#1e293b' : 'none',
                    border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                    fontSize: '13px', fontWeight: 600,
                    borderRight: activeTab === t.key ? '3px solid #06b6d4' : 'none'
                  }}>
                    <t.icon size={16} /> {t.label}
                  </button>
                ))}
              </nav>
              <button onClick={handleLogout} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '0.75rem 1.5rem', color: '#ef4444',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, borderTop: '1px solid #1e293b'
              }}>
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          </div>
        )}

        {/* Tabs móvil bottom */}
        <div style={{ display: 'none', borderBottom: '1px solid #e2e8f0', background: 'white', flexShrink: 0, overflowX: 'auto' }} className="coord-tabs-mobile">
          {TABS.map(t => (
            <button key={t.key} onClick={() => cambiarTab(t.key)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              padding: '0.5rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap',
              color: activeTab === t.key ? '#1e293b' : '#94a3b8',
              borderBottom: activeTab === t.key ? '2px solid #06b6d4' : '2px solid transparent',
            }}>
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }} className="coord-main">
          {renderContenido()}
        </main>
      </div>
    </div>
  );
}

export default DashboardCoordinador;
