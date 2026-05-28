import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Baby, Calendar, Users, BarChart3, Trophy, LogOut, Camera, ShieldAlert, Search, Loader2} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import '../../../css/instructor.css';
import SancionesPanel from '../../components/SancionesPanel';

import AgendaDia from './instructor/AgendaDia';
import MisClases from './instructor/MisClases';
import MetricasInstructor from './instructor/MetricasInstructor';
import MonitoreoLudoteca from './instructor/MonitoreoLudoteca';
import TournamentBracket from '../../components/TournamentBracket';
import { API_BASE_URL } from '../../services/api';

function VistaSancionesInstructor() {
  const [sanciones, setSanciones]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroGravedad, setFiltroGravedad] = useState('todos');

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res   = await fetch(`${API_BASE_URL}/sanciones`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setSanciones(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
      } catch { setSanciones([]); }
      finally { setLoading(false); }
    };
    fetch_();
  }, []);

  const estadoBadge = (e) => {
    const s = e?.toLowerCase();
    if (s === 'activa' || s === 'activo') return { bg: '#fee2e2', color: '#dc2626' };
    if (s === 'levantada' || s === 'resuelta') return { bg: '#dcfce7', color: '#15803d' };
    return { bg: '#f1f5f9', color: '#64748b' };
  };

  const gravedadBadge = (g) => {
    if (g === 'Grave')    return { bg: '#fee2e2', color: '#dc2626' };
    if (g === 'Moderada') return { bg: '#fef3c7', color: '#b45309' };
    if (g === 'Leve')     return { bg: '#f0fdf4', color: '#15803d' };
    return { bg: '#f1f5f9', color: '#64748b' };
  };

  const filtradas = sanciones.filter(s => {
    const texto = `${s.nombre_socio || ''} ${s.numero_socio || ''} ${s.motivo || ''}`.toLowerCase();
    const okBusqueda  = texto.includes(busqueda.toLowerCase());
    const okEstado    = filtroEstado    === 'todos' || s.estado?.toLowerCase() === filtroEstado;
    const okGravedad  = filtroGravedad  === 'todos' || s.gravedad === filtroGravedad;
    return okBusqueda && okEstado && okGravedad;
  });

  const activas   = sanciones.filter(s => ['activa','activo'].includes(s.estado?.toLowerCase())).length;
  const resueltas = sanciones.filter(s => ['levantada','resuelta'].includes(s.estado?.toLowerCase())).length;

  const inputStyle = { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', outline: 'none', background: 'white' };

  return (
    <div>
      {/* Header hero */}
      <div style={{ background: activas > 0 ? 'linear-gradient(135deg,#7f1d1d,#dc2626)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)', borderRadius: '18px', padding: '1.25rem 1.75rem', marginBottom: '1.25rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color="white" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Sanciones del Club</h4>
            <p style={{ margin: '3px 0 0', opacity: 0.7, fontSize: '12px' }}>Consulta y seguimiento de sanciones a socios</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {[
            { valor: sanciones.length, label: 'Total' },
            { valor: activas,          label: 'Activas' },
            { valor: resueltas,        label: 'Resueltas' },
          ].map(({ valor, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{valor}</div>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input type="text" placeholder="Buscar socio o motivo..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: '30px', boxSizing: 'border-box' }} />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={inputStyle}>
          <option value="todos">Todos los estados</option>
          <option value="activa">Activa</option>
          <option value="levantada">Levantada</option>
          <option value="resuelta">Resuelta</option>
        </select>
        <select value={filtroGravedad} onChange={e => setFiltroGravedad(e.target.value)} style={inputStyle}>
          <option value="todos">Toda gravedad</option>
          <option value="Leve">Leve</option>
          <option value="Moderada">Moderada</option>
          <option value="Grave">Grave</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <Loader2 size={28} color="#cbd5e1" style={{ animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <span style={{ fontSize: '13px' }}>Cargando sanciones...</span>
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <ShieldAlert size={26} color="#94a3b8" />
          </div>
          <p style={{ color: '#475569', margin: 0, fontWeight: 700, fontSize: '14px' }}>
            {busqueda || filtroEstado !== 'todos' || filtroGravedad !== 'todos' ? 'Sin resultados para esa búsqueda' : 'No hay sanciones registradas'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtradas.map((s, i) => {
            const eb = estadoBadge(s.estado);
            const gb = gravedadBadge(s.gravedad);
            return (
              <div key={s.sancion_id || i} style={{ background: 'white', borderRadius: '14px', border: '1.5px solid #e2e8f0', padding: '1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>{s.nombre_socio || 'Socio'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{s.motivo || 'Sin descripción'}</div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '11px', color: '#94a3b8', flexWrap: 'wrap' }}>
                    {s.origen   && <span>Origen: <strong style={{ color: '#64748b' }}>{s.origen}</strong></span>}
                    {(s.fecha_inicio || s.fecha) && <span>Fecha: <strong style={{ color: '#64748b' }}>{new Date(s.fecha_inicio || s.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                  {s.gravedad && <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: gb.bg, color: gb.color }}>{s.gravedad}</span>}
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: eb.bg, color: eb.color }}>{s.estado}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardInstructor() {
  const { toast } = useNotification();
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

  const iniciales = (n) => n ? n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() : '?';

  const tabs = [
    { key: 'agenda',    label: 'Agenda',    icon: <Calendar size={18} /> },
    { key: 'clases',    label: 'Mis Clases', icon: <Users size={18} /> },
    { key: 'metricas',  label: 'Métricas',  icon: <BarChart3 size={18} /> },
    { key: 'ludoteca',  label: 'Ludoteca',  icon: <Baby size={18} /> },
    { key: 'torneos',   label: 'Torneos',   icon: <Trophy size={18} /> },
    { key: 'sanciones', label: 'Sanciones', icon: <ShieldAlert size={18} /> },
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
          {activeTab === 'sanciones' && <VistaSancionesInstructor />}
          {activeTab === 'torneos'  && (
            <TournamentBracket
              title="Torneos y brackets"
              subtitle="Consulta los torneos activos y sus encuentros por ronda."
              readOnly={true}
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
