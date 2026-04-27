import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Search, Filter } from 'lucide-react';

const DIAS = ['', 'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const COLORES_DISCIPLINA = {
  'Natación':              { bg: '#e0f2fe', text: '#0369a1', borde: '#38bdf8' },
  'Tenis':                 { bg: '#dcfce7', text: '#15803d', borde: '#4ade80' },
  'Pádel':                 { bg: '#fef3c7', text: '#b45309', borde: '#fbbf24' },
  'Yoga':                  { bg: '#ede9fe', text: '#6d28d9', borde: '#a78bfa' },
  'Pilates':               { bg: '#fce7f3', text: '#9d174d', borde: '#f472b6' },
  'Spinning':              { bg: '#fee2e2', text: '#b91c1c', borde: '#f87171' },
  'Zumba':                 { bg: '#fef9c3', text: '#854d0e', borde: '#fde047' },
  'Baile':                 { bg: '#f0fdf4', text: '#166534', borde: '#86efac' },
  'Aerobics':              { bg: '#fff7ed', text: '#c2410c', borde: '#fb923c' },
  'Entrenamiento Funcional':{ bg: '#f1f5f9', text: '#334155', borde: '#94a3b8' },
};

function getColor(disciplina) {
  return COLORES_DISCIPLINA[disciplina] || { bg: '#f1f5f9', text: '#475569', borde: '#94a3b8' };
}

function formatHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function getBadge(pct) {
  if (pct >= 100) return { label: 'Lleno',      color: '#b91c1c', bg: '#fee2e2' };
  if (pct >= 80)  return { label: 'Casi lleno', color: '#b45309', bg: '#fef3c7' };
  if (pct >= 50)  return { label: 'Medio',      color: '#0369a1', bg: '#e0f2fe' };
  return                  { label: 'Disponible', color: '#15803d', bg: '#dcfce7' };
}

function getLunes() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = dia === 0 ? 1 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toISOString().split('T')[0];
}

function GestionDisciplinas() {
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    if (hoy.getDay() === 0) return getLunes();
    return hoy.toISOString().split('T')[0];
  });
  const [filtroCupo, setFiltroCupo] = useState('todas');

  useEffect(() => {
    const fetchSesiones = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:3000/api/instructor/clases-general?fecha=${fecha}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setSesiones(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSesiones();
  }, [fecha]);

  const formatFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const filtradas = sesiones
    .filter(s => {
      const pct = Math.min(100, Math.round((parseInt(s.cupo_actual)||0) / (parseInt(s.cupo_maximo)||1) * 100));
      if (filtroCupo === 'disponible') return pct < 80;
      if (filtroCupo === 'lleno') return pct >= 100;
      return true;
    })
    .filter(s =>
      s.disciplina?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.instructor?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.espacio?.toLowerCase().includes(busqueda.toLowerCase())
    );

  const llenas = sesiones.filter(s => parseInt(s.cupo_actual) >= parseInt(s.cupo_maximo)).length;
  const disponibles = sesiones.filter(s => parseInt(s.cupo_actual) < parseInt(s.cupo_maximo)).length;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total sesiones', valor: sesiones.length, color: '#3b82f6', key: 'todas' },
          { label: 'Disponibles', valor: disponibles, color: '#10b981', key: 'disponible' },
          { label: 'Llenas', valor: llenas, color: '#ef4444', key: 'lleno' },
        ].map(k => (
          <div key={k.key} onClick={() => setFiltroCupo(k.key)} style={{
            background: filtroCupo === k.key ? k.color : 'white',
            borderRadius: '12px', padding: '1rem 1.25rem',
            border: `1px solid ${filtroCupo === k.key ? k.color : '#e2e8f0'}`,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: filtroCupo === k.key ? `0 4px 12px ${k.color}40` : '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: filtroCupo === k.key ? 'white' : k.color }}>{k.valor}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: filtroCupo === k.key ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barra búsqueda y fecha */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text" placeholder="Buscar disciplina, instructor o espacio..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}
          />
        </div>
        <input
          type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', cursor: 'pointer', background: 'white' }}
        />
      </div>

      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 1.25rem' }}>
        {loading ? 'Cargando...' : `${filtradas.length} sesiones para el ${formatFecha(fecha)}`}
      </p>

      {/* Grid tarjetas */}
      {!loading && filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>No hay clases para el {formatFecha(fecha)}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {filtradas.map(s => {
            const cupoActual = parseInt(s.cupo_actual) || 0;
            const cupoMax = parseInt(s.cupo_maximo) || 1;
            const pct = Math.min(100, Math.round((cupoActual / cupoMax) * 100));
            const badge = getBadge(pct);
            const color = getColor(s.disciplina);

            return (
              <div key={s.sesion_id} style={{
                background: 'white', borderRadius: '14px',
                border: `1px solid #e2e8f0`,
                borderTop: `4px solid ${color.borde}`,
                padding: '1.25rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span style={{ background: color.bg, color: color.text, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>
                    {s.disciplina}
                  </span>
                  <span style={{ background: badge.bg, color: badge.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px' }}>
                    {badge.label}
                  </span>
                </div>

                {/* Instructor */}
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: color.text, flexShrink: 0 }}>
                    {s.instructor !== 'Sin instructor' ? s.instructor?.charAt(0)?.toUpperCase() : '—'}
                  </div>
                  <span style={{ fontWeight: 500 }}>{s.instructor || 'Sin instructor'}</span>
                </div>

                {/* Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                    <Clock size={12} color="#94a3b8" />
                    <span>{formatHora(s.hora_inicio)} – {formatHora(s.hora_fin)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                    <MapPin size={12} color="#94a3b8" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.espacio}</span>
                  </div>
                </div>

                {/* Barra cupo */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={11} /> Cupo
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>{cupoActual}/{cupoMax}</span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: '6px',
                      background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : color.borde,
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>{pct}% ocupado</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GestionDisciplinas;