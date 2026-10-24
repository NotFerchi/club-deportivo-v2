import React, { useEffect, useState } from 'react';
import { MapPin, Clock, Calendar, CheckCircle, XCircle, AlertCircle, CalendarX } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';

function VistaReservas() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => {
    const fetchReservas = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/recepcion/reservas?fecha=${fecha}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setReservas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReservas();
  }, [fecha]);

  const formatHora = (t) => {
    if (!t) return '—';
    const [hh, mm] = t.split(':');
    const h = parseInt(hh);
    return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const formatFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const confirmadas = reservas.filter(r => r.estado === 'Confirmada');
  const canceladas  = reservas.filter(r => r.estado === 'Cancelada');
  const noShow      = reservas.filter(r => r.estado === 'No-Show');

  const filtradas = reservas.filter(r =>
    filtro === 'todas' ? true : r.estado === filtro
  );

  const getBadge = (estado) => {
    const map = {
      'Confirmada': { bg: '#dcfce7', color: '#15803d', icono: <CheckCircle size={13} /> },
      'Cancelada':  { bg: '#fee2e2', color: '#b91c1c', icono: <XCircle size={13} /> },
      'No-Show':    { bg: '#fef3c7', color: '#b45309', icono: <AlertCircle size={13} /> },
    };
    return map[estado] || { bg: '#f1f5f9', color: '#64748b', icono: null };
  };

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', valor: reservas.length, color: '#3b82f6', key: 'todas' },
          { label: 'Confirmadas', valor: confirmadas.length, color: '#10b981', key: 'Confirmada' },
          { label: 'No-Show', valor: noShow.length, color: '#f59e0b', key: 'No-Show' },
          { label: 'Canceladas', valor: canceladas.length, color: '#ef4444', key: 'Cancelada' },
        ].map(k => (
          <div key={k.key} onClick={() => setFiltro(k.key)} style={{
            background: filtro === k.key ? k.color : 'white',
            borderRadius: '12px', padding: '1rem 1.25rem',
            border: `1px solid ${filtro === k.key ? k.color : '#e2e8f0'}`,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: filtro === k.key ? `0 4px 12px ${k.color}40` : '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: filtro === k.key ? 'white' : k.color }}>{k.valor}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: filtro === k.key ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Header con fecha */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>
            Reservas del {formatFecha(fecha)}
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            {filtradas.length} reserva{filtradas.length !== 1 ? 's' : ''} {filtro !== 'todas' ? `· ${filtro}` : ''}
          </p>
        </div>
        <input
          type="date" value={fecha}
          onChange={e => setFecha(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando reservas...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <CalendarX size={48} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>No hay reservas para el {formatFecha(fecha)}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtradas.map(r => {
            const badge = getBadge(r.estado);
            return (
              <div key={r.reserva_id} style={{
                background: 'white', borderRadius: '14px',
                border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${badge.color}`,
                padding: '1rem 1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem'
              }}>
                {/* Socio */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, #3b82f6, #1d4ed8)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: '13px'
                  }}>
                    {r.socio_nombre?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{r.socio_nombre || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      <MapPin size={11} color="#94a3b8" /> {r.espacio_nombre || '—'}
                    </div>
                  </div>
                </div>

                {/* Horario */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px' }}>
                  <Clock size={13} color="#94a3b8" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    {formatHora(r.hora_inicio)} – {formatHora(r.hora_fin)}
                  </span>
                </div>

                {/* Estado */}
                <span style={{
                  background: badge.bg, color: badge.color,
                  fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px',
                  display: 'flex', alignItems: 'center', gap: '5px'
                }}>
                  {badge.icono} {r.estado}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VistaReservas;