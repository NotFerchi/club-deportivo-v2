import React, { useEffect, useState } from 'react';
import { UserCheck, Clock, Users, LogIn, LogOut } from 'lucide-react';

function VistaVisitas() {
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('activas');

  useEffect(() => {
    const fetchVisitas = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/recepcion/visitas', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setVisitas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchVisitas();
  }, []);

  const activas    = visitas.filter(v => v.vigente);
  const finalizadas = visitas.filter(v => !v.vigente);
  const mostrar    = filtro === 'activas' ? activas : finalizadas;

  const formatHora = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
  };

  const duracion = (entrada, salida) => {
    if (!entrada || !salida) return null;
    const mins = Math.round((new Date(salida) - new Date(entrada)) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins/60)}h ${mins%60}m`;
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      Cargando visitas...
    </div>
  );

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'En instalaciones', valor: activas.length, color: '#10b981', icono: <UserCheck size={18} color="#10b981" />, key: 'activas' },
          { label: 'Finalizadas hoy', valor: finalizadas.length, color: '#64748b', icono: <Users size={18} color="#64748b" />, key: 'finalizadas' },
          { label: 'Total del día', valor: visitas.length, color: '#3b82f6', icono: <LogIn size={18} color="#3b82f6" />, key: null },
        ].map((k, i) => (
          <div key={i} onClick={() => k.key && setFiltro(k.key)} style={{
            background: filtro === k.key ? k.color : 'white',
            borderRadius: '12px', padding: '1rem 1.25rem',
            border: `1px solid ${filtro === k.key ? k.color : '#e2e8f0'}`,
            cursor: k.key ? 'pointer' : 'default', transition: 'all 0.2s',
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

      {/* Lista */}
      {mostrar.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
            {filtro === 'activas' ? '🚪' : '✅'}
          </div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>
            {filtro === 'activas' ? 'No hay visitas activas en este momento' : 'No hay visitas finalizadas hoy'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mostrar.map(v => (
            <div key={v.visita_id} style={{
              background: 'white', borderRadius: '14px',
              border: `1px solid ${v.vigente ? '#bbf7d0' : '#e2e8f0'}`,
              borderLeft: `4px solid ${v.vigente ? '#10b981' : '#94a3b8'}`,
              padding: '1rem 1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem'
            }}>
              {/* Info visitante */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: v.vigente ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #94a3b8, #64748b)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: '14px'
                }}>
                  {v.nombre_completo?.charAt(0).toUpperCase() || 'V'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{v.nombre_completo}</div>
                  {v.identificacion_tipo && (
                    <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: 600, padding: '1px 8px', borderRadius: '20px' }}>
                      {v.identificacion_tipo}
                    </span>
                  )}
                </div>
              </div>

              {/* Horarios */}
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                    <LogIn size={13} color="#10b981" /> {formatHora(v.hora_entrada)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>Entrada</div>
                </div>
                {v.hora_salida && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                      <LogOut size={13} color="#64748b" /> {formatHora(v.hora_salida)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Salida</div>
                  </div>
                )}
                {duracion(v.hora_entrada, v.hora_salida) && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                      <Clock size={13} color="#f59e0b" /> {duracion(v.hora_entrada, v.hora_salida)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>Duración</div>
                  </div>
                )}
              </div>

              {/* Estado */}
              <span style={{
                background: v.vigente ? '#f0fdf4' : '#f1f5f9',
                color: v.vigente ? '#15803d' : '#64748b',
                fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.vigente ? '#10b981' : '#94a3b8' }} />
                {v.vigente ? 'En instalaciones' : 'Finalizada'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VistaVisitas;