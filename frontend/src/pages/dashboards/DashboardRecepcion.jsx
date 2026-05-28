import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, Baby, LogOut, UserPlus, ShieldAlert
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import '../../../css/recepcion.css';  // Asegúrate de que esta ruta sea correcta

// Importar componentes de las pestañas
import DashboardResumen from './recepcion/DashboardResumen';
import GestionSocios from './admin/GestionSocios';
import CentralReservas from './recepcion/CentralReservas';
import ControlLudoteca from './recepcion/ControlLudoteca';
import GestionVisitas from './recepcion/GestionVisitas';
import Sanciones from '../../components/SancionesPanel';
import { getAuthToken, API_BASE_URL } from '../../services/api';

function DashboardRecepcion() {
  const { toast } = useNotification();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fotoInputRef = useRef(null);

  useEffect(() => {
    const token = getAuthToken();
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (!token || usuario.rol !== 'recepcion') {
      if (!token) {
        localStorage.removeItem('usuario');
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
      }
      navigate('/login');
      return;
    }
    localStorage.setItem('token', token);
    setUserName(usuario.nombres || 'Recepción');
    setFotoPerfil(usuario.foto_perfil || null);
    document.title = 'Recepción | Club Social';
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('La imagen debe ser menor a 5MB', 'warning'); return; }
    setSubiendoFoto(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('foto', file);
      const res = await fetch(`${API_BASE_URL}/usuarios/me/foto`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Error al subir foto', 'error'); return; }
      setFotoPerfil(data.foto_perfil);
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      localStorage.setItem('usuario', JSON.stringify({ ...usuario, foto_perfil: data.foto_perfil }));
    } catch { toast('Error de conexión', 'error'); }
    finally { setSubiendoFoto(false); e.target.value = ''; }
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
          <button onClick={() => setActiveTab('sanciones')} className={getNavClass('sanciones')}>
            <ShieldAlert className="nav-icon" /> Sanciones
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid #1e293b' }}>
          {/* Perfil */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', marginBottom: '0.5rem' }}>
            <div
              onClick={() => fotoInputRef.current?.click()}
              title="Cambiar foto de perfil"
              style={{
                position: 'relative', width: 40, height: 40, borderRadius: '50%',
                flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
                border: '2px solid #334155',
              }}
            >
              {fotoPerfil
                ? <img src={fotoPerfil} alt="Foto perfil" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 13 }}>{userName.charAt(0).toUpperCase() || 'R'}</div>
              }
              {subiendoFoto && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'inst-spin 0.7s linear infinite', display: 'block' }} />
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Recepción</div>
            </div>
          </div>
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
        {activeTab === 'sanciones' && <Sanciones />}
      </main>

      {/* Input oculto foto */}
      <input ref={fotoInputRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleFotoChange} />
    </div>
  );
}

export default DashboardRecepcion;
