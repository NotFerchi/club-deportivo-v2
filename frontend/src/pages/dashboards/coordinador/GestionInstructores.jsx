import React, { useEffect, useState } from 'react';
import { Search, Users, UserCheck, UserX, Mail, Phone } from 'lucide-react';

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const COLORES_AVATAR = [
  'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #ef4444, #b91c1c)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #14b8a6, #0f766e)',
];

const COLORES_BADGE = [
  { bg: '#e0f2fe', text: '#0369a1' },
  { bg: '#dcfce7', text: '#15803d' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#ede9fe', text: '#6d28d9' },
  { bg: '#fee2e2', text: '#b91c1c' },
  { bg: '#f0fdf4', text: '#166534' },
];

function GestionInstructores() {
  const [instructores, setInstructores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    const fetchInstructores = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/instructores', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setInstructores(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInstructores();
  }, []);

  const activos   = instructores.filter(i => i.activo);
  const inactivos = instructores.filter(i => !i.activo);

  const filtrados = instructores
    .filter(i => filtro === 'todos' ? true : filtro === 'activos' ? i.activo : !i.activo)
    .filter(i =>
      i.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.especialidad?.toLowerCase().includes(busqueda.toLowerCase())
    );

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      Cargando instructores...
    </div>
  );

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', valor: instructores.length, color: '#3b82f6', icono: <Users size={18} />, key: 'todos' },
          { label: 'Activos', valor: activos.length, color: '#10b981', icono: <UserCheck size={18} />, key: 'activos' },
          { label: 'Inactivos', valor: inactivos.length, color: '#ef4444', icono: <UserX size={18} />, key: 'inactivos' },
        ].map(k => (
          <div key={k.key} onClick={() => setFiltro(k.key)} style={{
            background: filtro === k.key ? k.color : 'white',
            borderRadius: '12px', padding: '1rem 1.25rem',
            border: `1px solid ${filtro === k.key ? k.color : '#e2e8f0'}`,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: filtro === k.key ? `0 4px 12px ${k.color}40` : '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: filtro === k.key ? 'white' : k.color }}>{k.valor}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: filtro === k.key ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{k.label}</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: filtro === k.key ? 'rgba(255,255,255,0.2)' : `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.cloneElement(k.icono, { color: filtro === k.key ? 'white' : k.color })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text" placeholder="Buscar por nombre o especialidad..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}
        />
      </div>

      {/* Grid tarjetas */}
      {filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>No se encontraron instructores</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filtrados.map((inst, idx) => {
            const avatarColor = COLORES_AVATAR[idx % COLORES_AVATAR.length];
            const especialidades = inst.especialidad
              ? inst.especialidad.split(',').map(e => e.trim()).filter(Boolean)
              : [];

            return (
              <div key={inst.instructor_id} style={{
                background: 'white', borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Header con gradiente */}
                <div style={{ background: avatarColor, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 800, fontSize: '18px',
                    border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0
                  }}>
                    {iniciales(inst.nombre)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'white' }}>{inst.nombre}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>Instructor</div>
                  </div>
                  <span style={{
                    position: 'absolute', top: '1rem', right: '1rem',
                    background: inst.activo ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                    color: 'white', fontSize: '10px', fontWeight: 700,
                    padding: '3px 8px', borderRadius: '20px',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: inst.activo ? '#4ade80' : '#94a3b8' }} />
                    {inst.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Cuerpo */}
                <div style={{ padding: '1.25rem' }}>
                  {/* Especialidades */}
                  {especialidades.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Especialidades
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {especialidades.map((esp, i) => {
                          const c = COLORES_BADGE[i % COLORES_BADGE.length];
                          return (
                            <span key={i} style={{ background: c.bg, color: c.text, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>
                              {esp}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Contacto */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {inst.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                        <Mail size={13} color="#94a3b8" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.email}</span>
                      </div>
                    )}
                    {inst.telefono && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                        <Phone size={13} color="#94a3b8" />
                        <span>{inst.telefono}</span>
                      </div>
                    )}
                    {!inst.email && !inst.telefono && (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Sin información de contacto</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GestionInstructores;