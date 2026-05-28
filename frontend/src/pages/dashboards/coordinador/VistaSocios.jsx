import React, { useEffect, useState } from 'react';
import { Search, Users, UserCheck, UserX, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';

function iniciales(nombre, email) {
  if (nombre && nombre.trim()) {
    return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }
  if (email) return email.substring(0, 2).toUpperCase();
  return 'SC';
}

const COLORES = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#14b8a6'];

function VistaSocios() {
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    const fetchSocios = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/recepcion/socios`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setSocios(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSocios();
  }, []);

  const nombreCompleto = (s) => `${s.nombres || ''} ${s.apellido_paterno || ''}`.trim() || 'Sin nombre';

  const activos   = socios.filter(s => s.activo);
  const inactivos = socios.filter(s => !s.activo);

  const filtrados = socios
    .filter(s => filtro === 'todos' ? true : filtro === 'activos' ? s.activo : !s.activo)
    .filter(s =>
      nombreCompleto(s).toLowerCase().includes(busqueda.toLowerCase()) ||
      s.numero_socio?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.email?.toLowerCase().includes(busqueda.toLowerCase())
    );

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <Loader2 size={36} className="icon-spin" style={{ marginBottom: '0.5rem', color: '#94a3b8' }} />
      <div>Cargando socios...</div>
    </div>
  );

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Socios', valor: socios.length, color: '#3b82f6', icono: <Users size={18} color="#3b82f6" />, key: 'todos' },
          { label: 'Activos', valor: activos.length, color: '#10b981', icono: <UserCheck size={18} color="#10b981" />, key: 'activos' },
          { label: 'Inactivos', valor: inactivos.length, color: '#ef4444', icono: <UserX size={18} color="#ef4444" />, key: 'inactivos' },
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
          type="text" placeholder="Buscar por nombre, número de socio o correo..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}
        />
      </div>

      {/* Tabla desktop */}
      <div className="socios-tabla" style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Directorio de Socios</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Socio', 'Número', 'Tipo', 'Modalidad', 'Estado'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                No se encontraron socios
              </td></tr>
            ) : filtrados.map((socio, idx) => {
              const color = COLORES[idx % COLORES.length];
              const nombre = nombreCompleto(socio);
              return (
                <tr key={socio.socio_id} style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '0.9rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '12px', flexShrink: 0, overflow: 'hidden' }}>
                        {socio.foto_perfil
                          ? <img src={socio.foto_perfil} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : iniciales(nombre, socio.email)
                        }
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{nombre}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{socio.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.9rem 1.25rem' }}>
                    <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>
                      {socio.numero_socio}
                    </span>
                  </td>
                  <td style={{ padding: '0.9rem 1.25rem' }}>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>
                      {socio.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '0.9rem 1.25rem', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{socio.modalidad}</td>
                  <td style={{ padding: '0.9rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: socio.activo ? '#10b981' : '#ef4444' }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: socio.activo ? '#15803d' : '#b91c1c' }}>
                        {socio.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tarjetas móvil */}
      <div className="socios-cards" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
        {filtrados.map((socio, idx) => {
          const color = COLORES[idx % COLORES.length];
          const nombre = nombreCompleto(socio);
          return (
            <div key={socio.socio_id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '13px' }}>
                  {iniciales(nombre, socio.email)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{nombre}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{socio.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: socio.activo ? '#10b981' : '#ef4444' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: socio.activo ? '#15803d' : '#b91c1c' }}>
                    {socio.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>{socio.numero_socio}</span>
                <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>{socio.tipo}</span>
                <span style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '20px' }}>{socio.modalidad}</span>
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No se encontraron socios</div>
        )}
      </div>
    </div>
  );
}

export default VistaSocios;