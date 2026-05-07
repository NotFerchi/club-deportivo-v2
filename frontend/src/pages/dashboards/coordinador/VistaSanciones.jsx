import React, { useEffect, useState } from 'react';
import { ShieldAlert, Search, ShieldCheck, ShieldX, Shield } from 'lucide-react';

function VistaSanciones() {
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => {
    const fetchSanciones = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/sanciones', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setSanciones(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSanciones();
  }, []);

  const formatFecha = (f) => {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const activas   = sanciones.filter(s => s.estado === 'Activa');
  const resueltas = sanciones.filter(s => s.estado === 'Resuelta');

  const filtradas = sanciones
    .filter(s => filtro === 'todas' ? true : s.estado?.toLowerCase() === filtro.toLowerCase())
    .filter(s =>
      s.socio_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.motivo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.origen?.toLowerCase().includes(busqueda.toLowerCase())
    );

  const getOrigenColor = (origen) => {
    if (origen === 'Reservaciones') return { bg: '#ede9fe', color: '#6d28d9' };
    if (origen === 'Administración') return { bg: '#fee2e2', color: '#b91c1c' };
    return { bg: '#f1f5f9', color: '#64748b' };
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      Cargando sanciones...
    </div>
  );

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', valor: sanciones.length, color: '#3b82f6', icono: <Shield size={18} />, key: 'todas' },
          { label: 'Activas', valor: activas.length, color: '#ef4444', icono: <ShieldX size={18} />, key: 'Activa' },
          { label: 'Resueltas', valor: resueltas.length, color: '#10b981', icono: <ShieldCheck size={18} />, key: 'Resuelta' },
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
          type="text" placeholder="Buscar por socio, motivo u origen..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}
        />
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <ShieldCheck size={48} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>
            {busqueda ? 'No se encontraron resultados' : '¡Sin sanciones registradas! 🎉'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtradas.map(s => {
            const activa = s.estado === 'Activa';
            const origenColor = getOrigenColor(s.origen);
            return (
              <div key={s.sancion_id} style={{
                background: 'white', borderRadius: '14px',
                border: `1px solid ${activa ? '#fecaca' : '#e2e8f0'}`,
                borderLeft: `4px solid ${activa ? '#ef4444' : '#10b981'}`,
                padding: '1rem 1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {/* Info socio */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: activa ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #10b981, #059669)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 800, fontSize: '14px'
                    }}>
                      {s.socio_nombre?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{s.socio_nombre}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.numero_socio}</div>
                    </div>
                  </div>

                  {/* Estado */}
                  <span style={{
                    background: activa ? '#fee2e2' : '#dcfce7',
                    color: activa ? '#b91c1c' : '#15803d',
                    fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
                    display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0
                  }}>
                    {activa ? <ShieldX size={12} /> : <ShieldCheck size={12} />}
                    {s.estado}
                  </span>
                </div>

                {/* Motivo */}
                <div style={{ margin: '0.85rem 0 0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo: </span>
                    {s.motivo}
                  </p>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ background: origenColor.bg, color: origenColor.color, fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px' }}>
                    {s.origen || 'Sin origen'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    📅 Registrada: {formatFecha(s.fecha)}
                  </span>
                  {s.fecha_resolucion && (
                    <span style={{ fontSize: '11px', color: '#10b981' }}>
                      ✅ Resuelta: {formatFecha(s.fecha_resolucion)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VistaSanciones;
