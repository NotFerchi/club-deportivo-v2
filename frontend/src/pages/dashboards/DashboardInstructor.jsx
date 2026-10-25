import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Baby, Calendar, Users, BarChart3, Trophy, LogOut, Camera, ShieldAlert } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { Badge, Input, Select, Stack, StatCard, Table, Text } from '../../components/ui';
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
    if (s === 'activa' || s === 'activo') return 'danger';
    if (s === 'levantada' || s === 'resuelta') return 'success';
    return 'neutral';
  };

  const gravedadBadge = (g) => {
    if (g === 'Grave')    return 'danger';
    if (g === 'Moderada') return 'warning';
    if (g === 'Leve')     return 'success';
    return 'neutral';
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

  const columnas = [
    { key: 'nombre_socio', header: 'Socio', render: (s) => s.nombre_socio || 'Socio' },
    { key: 'motivo', header: 'Motivo', render: (s) => s.motivo || 'Sin descripción' },
    { key: 'origen', header: 'Origen', render: (s) => s.origen || '—' },
    {
      key: 'fecha',
      header: 'Fecha',
      render: (s) => (s.fecha_inicio || s.fecha)
        ? new Date(s.fecha_inicio || s.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—',
    },
    { key: 'gravedad', header: 'Gravedad', render: (s) => s.gravedad && <Badge variant={gravedadBadge(s.gravedad)}>{s.gravedad}</Badge> },
    { key: 'estado', header: 'Estado', render: (s) => <Badge variant={estadoBadge(s.estado)}>{s.estado}</Badge> },
  ];

  return (
    <Stack gap={24}>
      {/* Encabezado */}
      <Stack gap={4}>
        <Text variant="heading">Sanciones del Club</Text>
        <Text variant="small" muted>Consulta y seguimiento de sanciones a socios</Text>
      </Stack>

      <Stack direction="row" gap={16} grow minChild={150}>
        <StatCard label="Total" value={sanciones.length} tone="neutral" icon={<ShieldAlert size={20} />} />
        <StatCard label="Activas" value={activas} tone={activas > 0 ? 'danger' : 'neutral'} />
        <StatCard label="Resueltas" value={resueltas} tone="success" />
      </Stack>

      {/* Filtros */}
      <Stack direction="row" gap={12} grow minChild={180}>
        <Input type="text" label="Buscar" placeholder="Buscar socio o motivo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <Select
          label="Estado"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          options={[
            { value: 'todos', label: 'Todos los estados' },
            { value: 'activa', label: 'Activa' },
            { value: 'levantada', label: 'Levantada' },
            { value: 'resuelta', label: 'Resuelta' },
          ]}
        />
        <Select
          label="Gravedad"
          value={filtroGravedad}
          onChange={e => setFiltroGravedad(e.target.value)}
          options={[
            { value: 'todos', label: 'Toda gravedad' },
            { value: 'Leve', label: 'Leve' },
            { value: 'Moderada', label: 'Moderada' },
            { value: 'Grave', label: 'Grave' },
          ]}
        />
      </Stack>

      {/* Lista */}
      {loading ? (
        <Text muted>Cargando sanciones...</Text>
      ) : (
        <Table
          columns={columnas}
          data={filtradas}
          getRowKey={(s, i) => s.sancion_id || i}
          minWidth={720}
          emptyTitle="Sin sanciones"
          emptyMessage={busqueda || filtroEstado !== 'todos' || filtroGravedad !== 'todos' ? 'Sin resultados para esa búsqueda' : 'No hay sanciones registradas'}
        />
      )}
    </Stack>
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
