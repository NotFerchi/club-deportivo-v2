import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Baby, Calendar, Users, BarChart3, Trophy, LogOut, Camera } from 'lucide-react';
import '../../../css/instructor.css';

import AgendaDia from './instructor/AgendaDia';
import MisClases from './instructor/MisClases';
import MetricasInstructor from './instructor/MetricasInstructor';
import MonitoreoLudoteca from './instructor/MonitoreoLudoteca';
import TournamentBracket from '../../components/TournamentBracket';

function DashboardInstructor() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('agenda');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fotoInputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (!token) { navigate('/login'); return; }
    if (usuario.rol !== 'instructor' && usuario.rol !== 'recepcion') { navigate('/login'); return; }
    setUserName(usuario.nombres || 'Instructor');
    setUserEmail(usuario.email || '');
    setFotoPerfil(usuario.foto_perfil || null);
    document.title = 'Dashboard Deportivo | Club Social';
  }, [navigate]);

  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen debe ser menor a 5MB'); return; }
    setSubiendoFoto(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('foto', file);
      const res = await fetch('http://localhost:3000/api/usuarios/me/foto', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al subir foto'); return; }
      setFotoPerfil(data.foto_perfil);
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      localStorage.setItem('usuario', JSON.stringify({ ...usuario, foto_perfil: data.foto_perfil }));
    } catch { alert('Error de conexión'); }
    finally { setSubiendoFoto(false); e.target.value = ''; }
  };

  const iniciales = (n) => n ? n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() : '?';

  const tabs = [
    { key: 'agenda',   label: 'Agenda',   icon: <Calendar size={18} /> },
    { key: 'clases',   label: 'Mis Clases', icon: <Users size={18} /> },
    { key: 'metricas', label: 'Métricas', icon: <BarChart3 size={18} /> },
    { key: 'ludoteca', label: 'Ludoteca', icon: <Baby size={18} /> },
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
          {/* Perfil con foto */}
          <div className="inst-profile-section">
            <div
              className="inst-sidebar-avatar"
              onClick={() => fotoInputRef.current?.click()}
              title="Cambiar foto de perfil"
            >
              {fotoPerfil
                ? <img src={fotoPerfil} alt="Foto perfil" className="inst-avatar-img" />
                : <span className="inst-avatar-initials">{iniciales(userName)}</span>
              }
              <div className="inst-avatar-overlay">
                {subiendoFoto
                  ? <span className="inst-avatar-spinner" />
                  : <Camera size={14} />
                }
              </div>
            </div>
            <div className="inst-profile-info">
              <span className="inst-profile-name">{userName}</span>
              <span className="inst-profile-email">{userEmail}</span>
            </div>
          </div>
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
            <div
              className="inst-mobile-avatar"
              onClick={() => fotoInputRef.current?.click()}
              title="Cambiar foto de perfil"
            >
              {fotoPerfil
                ? <img src={fotoPerfil} alt="Foto perfil" className="inst-avatar-img" />
                : iniciales(userName)
              }
            </div>
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
          {activeTab === 'ludoteca' && <MonitoreoLudoteca />}
          {activeTab === 'torneos'  && (
            <TournamentBracket
              title="Torneos y brackets"
              subtitle="Consulta los torneos activos y sus encuentros por ronda."
            />
          )}
        </main>
      </div>

      {/* Input oculto para subir foto */}
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFotoChange}
      />
    </div>
  );
}

export default DashboardInstructor;
