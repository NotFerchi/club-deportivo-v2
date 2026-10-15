import React, { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';
import { Table, Input } from '../../../components/ui';

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
      <Input
        placeholder="Buscar por nombre, número de socio o correo..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />

      {/* Tabla desktop */}
      <div className="socios-tabla" style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Directorio de Socios</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>
        </div>
        <Table
          columns={[
            {
              key: 'socio', header: 'Socio',
              render: (s, idx) => {
                const color = COLORES[idx % COLORES.length];
                const nombre = nombreCompleto(s);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '12px', overflow: 'hidden' }}>
                      {s.foto_perfil ? <img src={s.foto_perfil} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciales(nombre, s.email)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{nombre}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.email}</div>
                    </div>
                  </div>
                );
              },
            },
            { key: 'numero_socio', header: 'Número' },
            { key: 'tipo', header: 'Tipo' },
            { key: 'modalidad', header: 'Modalidad' },
            {
              key: 'estado', header: 'Estado',
              render: (s) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.activo ? '#10b981' : '#ef4444' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: s.activo ? '#15803d' : '#b91c1c' }}>
                    {s.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ),
            },
          ]}
          data={filtrados}
          getRowKey={(s) => s.socio_id}
          emptyMessage="No se encontraron socios"
        />
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