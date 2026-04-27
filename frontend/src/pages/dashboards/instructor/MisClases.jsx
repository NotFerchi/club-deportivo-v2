import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Calendar, ChevronRight } from 'lucide-react';

const DIAS_NOMBRE = ['', 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTO  = ['', 'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const COLORES_DISCIPLINA = {
  'Natación':              { bg: '#e0f2fe', text: '#0369a1', borde: '#38bdf8', grad: 'linear-gradient(135deg, #0369a1, #0ea5e9)' },
  'Tenis':                 { bg: '#dcfce7', text: '#15803d', borde: '#4ade80', grad: 'linear-gradient(135deg, #15803d, #22c55e)' },
  'Pádel':                 { bg: '#fef3c7', text: '#b45309', borde: '#fbbf24', grad: 'linear-gradient(135deg, #b45309, #f59e0b)' },
  'Yoga':                  { bg: '#ede9fe', text: '#6d28d9', borde: '#a78bfa', grad: 'linear-gradient(135deg, #6d28d9, #8b5cf6)' },
  'Pilates':               { bg: '#fce7f3', text: '#9d174d', borde: '#f472b6', grad: 'linear-gradient(135deg, #9d174d, #ec4899)' },
  'Spinning':              { bg: '#fee2e2', text: '#b91c1c', borde: '#f87171', grad: 'linear-gradient(135deg, #b91c1c, #ef4444)' },
  'Zumba':                 { bg: '#fef9c3', text: '#854d0e', borde: '#fde047', grad: 'linear-gradient(135deg, #854d0e, #eab308)' },
  'Baile':                 { bg: '#f0fdf4', text: '#166534', borde: '#86efac', grad: 'linear-gradient(135deg, #166534, #4ade80)' },
  'Aerobics':              { bg: '#fff7ed', text: '#c2410c', borde: '#fb923c', grad: 'linear-gradient(135deg, #c2410c, #f97316)' },
  'Entrenamiento Funcional':{ bg: '#f1f5f9', text: '#334155', borde: '#94a3b8', grad: 'linear-gradient(135deg, #334155, #64748b)' },
};

function getColor(disciplina) {
  return COLORES_DISCIPLINA[disciplina] || { bg: '#f1f5f9', text: '#475569', borde: '#94a3b8', grad: 'linear-gradient(135deg, #475569, #94a3b8)' };
}

function formatHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function getProximaFecha(diaSemana) {
  const hoy = new Date();
  const diaHoy = hoy.getDay() + 1;
  let diff = diaSemana - diaHoy;
  if (diff < 0) diff += 7;
  const fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() + diff);
  return {
    diff,
    texto: fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }),
    fechaCompleta: fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  };
}

function MisClases() {
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrodia, setFiltroDia] = useState('todos');

  useEffect(() => {
    const fetchClases = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/instructor/mis-clases', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();

        const diaHoy = new Date().getDay() + 1;
        const ordenadas = [...data].sort((a, b) => {
          let diffA = a.dia_semana - diaHoy;
          let diffB = b.dia_semana - diaHoy;
          if (diffA < 0) diffA += 7;
          if (diffB < 0) diffB += 7;
          if (diffA !== diffB) return diffA - diffB;
          return a.hora_inicio.localeCompare(b.hora_inicio);
        });

        setClases(ordenadas);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClases();
  }, []);

  const diasConClases = [...new Set(clases.map(c => c.dia_semana))].sort((a, b) => {
    const diaHoy = new Date().getDay() + 1;
    let da = a - diaHoy; if (da < 0) da += 7;
    let db = b - diaHoy; if (db < 0) db += 7;
    return da - db;
  });

  const filtradas = filtrodia === 'todos'
    ? clases
    : clases.filter(c => c.dia_semana === parseInt(filtrodia));

  const totalAlumnos = clases.reduce((acc, c) => acc + (parseInt(c.cupo_actual) || 0), 0);
  const diaHoy = new Date().getDay() + 1;
  const clasesHoy = clases.filter(c => c.dia_semana === diaHoy).length;

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      Cargando tus clases...
    </div>
  );

  return (
    <div>
      {/* Banner resumen */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        borderRadius: '16px', padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Mis Clases Asignadas</h4>
          <p style={{ margin: '3px 0 0', opacity: 0.75, fontSize: '12px' }}>{clases.length} sesiones semanales programadas</p>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{clasesHoy}</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Hoy</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{totalAlumnos}</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Alumnos</div>
          </div>
        </div>
      </div>

      {/* Filtro por día */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
        <button onClick={() => setFiltroDia('todos')} style={{
          padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
          fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', transition: 'all 0.2s',
          background: filtrodia === 'todos' ? '#1e293b' : '#f1f5f9',
          color: filtrodia === 'todos' ? 'white' : '#64748b'
        }}>
          Todos ({clases.length})
        </button>
        {diasConClases.map(d => {
          const { diff } = getProximaFecha(d);
          const esHoy = diff === 0;
          return (
            <button key={d} onClick={() => setFiltroDia(String(d))} style={{
              padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', transition: 'all 0.2s',
              background: filtrodia === String(d) ? '#1e293b' : esHoy ? '#dcfce7' : '#f1f5f9',
              color: filtrodia === String(d) ? 'white' : esHoy ? '#15803d' : '#64748b'
            }}>
              {esHoy ? '🟢 ' : ''}{DIAS_CORTO[d]} ({clases.filter(c => c.dia_semana === d).length})
            </button>
          );
        })}
      </div>

      {/* Grid clases */}
      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>No hay clases asignadas</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
          {filtradas.map((clase) => {
            const color = getColor(clase.disciplina);
            const pct = Math.min(100, Math.round(((parseInt(clase.cupo_actual)||0) / (parseInt(clase.cupo_maximo)||1)) * 100));
            const barColor = pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#10b981';
            const { diff, texto, fechaCompleta } = getProximaFecha(clase.dia_semana);
            const esHoy = diff === 0;

            return (
              <div key={clase.sesion_id} style={{
                background: 'white', borderRadius: '16px',
                border: `1px solid ${esHoy ? color.borde : '#e2e8f0'}`,
                overflow: 'hidden',
                boxShadow: esHoy ? `0 4px 16px ${color.borde}40` : '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.1)`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = esHoy ? `0 4px 16px ${color.borde}40` : '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Header con gradiente */}
                <div style={{ background: color.grad, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: 'white' }}>{clase.disciplina}</span>
                  <span style={{
                    background: esHoy ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
                    color: 'white', fontSize: '10px', fontWeight: 700,
                    padding: '3px 8px', borderRadius: '20px'
                  }}>
                    {esHoy ? '🟢 Hoy' : DIAS_NOMBRE[clase.dia_semana]}
                  </span>
                </div>

                {/* Cuerpo */}
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                      <Clock size={13} color="#94a3b8" />
                      <span>{formatHora(clase.hora_inicio)} – {formatHora(clase.hora_fin)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                      <MapPin size={13} color="#94a3b8" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clase.espacio}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#3b82f6', fontWeight: 600 }}>
                      <Calendar size={13} color="#3b82f6" />
                      <span style={{ textTransform: 'capitalize' }}>
                        {esHoy ? `Hoy, ${texto}` : texto}
                      </span>
                    </div>
                  </div>

                  {/* Barra cupo */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={11} /> Cupo
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                        {clase.cupo_actual || 0}/{clase.cupo_maximo}
                      </span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', background: barColor,
                        borderRadius: '6px', transition: 'width 0.4s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px', textAlign: 'right' }}>{pct}% ocupado</div>
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

export default MisClases;