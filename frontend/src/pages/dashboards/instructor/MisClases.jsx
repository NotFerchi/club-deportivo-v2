import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Calendar, Loader2, ClipboardList, Dumbbell, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';

const DIAS_NOMBRE = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_CORTO  = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const COLORES_DISCIPLINA = {
  'Natación':               { bg: '#e0f2fe', text: '#0369a1', borde: '#38bdf8', grad: 'linear-gradient(135deg, #0369a1, #0ea5e9)' },
  'Tenis':                  { bg: '#dcfce7', text: '#15803d', borde: '#4ade80', grad: 'linear-gradient(135deg, #15803d, #22c55e)' },
  'Pádel':                  { bg: '#fef3c7', text: '#b45309', borde: '#fbbf24', grad: 'linear-gradient(135deg, #b45309, #f59e0b)' },
  'Yoga':                   { bg: '#ede9fe', text: '#6d28d9', borde: '#a78bfa', grad: 'linear-gradient(135deg, #6d28d9, #8b5cf6)' },
  'Pilates':                { bg: '#fce7f3', text: '#9d174d', borde: '#f472b6', grad: 'linear-gradient(135deg, #9d174d, #ec4899)' },
  'Spinning':               { bg: '#fee2e2', text: '#b91c1c', borde: '#f87171', grad: 'linear-gradient(135deg, #b91c1c, #ef4444)' },
  'Zumba':                  { bg: '#fef9c3', text: '#854d0e', borde: '#fde047', grad: 'linear-gradient(135deg, #854d0e, #eab308)' },
  'Baile':                  { bg: '#f0fdf4', text: '#166534', borde: '#86efac', grad: 'linear-gradient(135deg, #166534, #4ade80)' },
  'Aerobics':               { bg: '#fff7ed', text: '#c2410c', borde: '#fb923c', grad: 'linear-gradient(135deg, #c2410c, #f97316)' },
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
  const js = hoy.getDay();
  const diaHoy = js === 0 ? 7 : js;
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
  const [clases, setClases]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrodia, setFiltroDia] = useState('todos');

  useEffect(() => {
    const fetchClases = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/instructor/mis-clases`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        const _js = new Date().getDay();
        const diaHoy = _js === 0 ? 7 : _js;
        const ordenadas = [...data].sort((a, b) => {
          let diffA = a.dia_semana - diaHoy; if (diffA < 0) diffA += 7;
          let diffB = b.dia_semana - diaHoy; if (diffB < 0) diffB += 7;
          if (diffA !== diffB) return diffA - diffB;
          return a.hora_inicio.localeCompare(b.hora_inicio);
        });
        setClases(ordenadas);
      } catch (err) { console.error('Error:', err); }
      finally { setLoading(false); }
    };
    fetchClases();
  }, []);

  const _jsDay = new Date().getDay();
  const diaHoy       = _jsDay === 0 ? 7 : _jsDay;
  const clasesHoy    = clases.filter(c => c.dia_semana === diaHoy).length;
  const totalAlumnos = clases.reduce((acc, c) => acc + (parseInt(c.cupo_actual) || 0), 0);
  const totalCupo    = clases.reduce((acc, c) => acc + (parseInt(c.cupo_maximo) || 0), 0);
  const ocupacion    = totalCupo > 0 ? Math.round((totalAlumnos / totalCupo) * 100) : 0;

  const diasConClases = [...new Set(clases.map(c => c.dia_semana))].sort((a, b) => {
    let da = a - diaHoy; if (da < 0) da += 7;
    let db = b - diaHoy; if (db < 0) db += 7;
    return da - db;
  });

  const filtradas = filtrodia === 'todos'
    ? clases
    : clases.filter(c => c.dia_semana === parseInt(filtrodia));

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <Loader2 size={28} color="#cbd5e1" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: '13px' }}>Cargando tus clases...</span>
    </div>
  );

  return (
    <div>
      {/* ── Banner hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        borderRadius: '18px', padding: '1.5rem 2rem',
        marginBottom: '1.25rem', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '1rem',
        boxShadow: '0 4px 20px rgba(37,99,235,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dumbbell size={24} color="white" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.3px' }}>Mis Clases Asignadas</h4>
            <p style={{ margin: '3px 0 0', opacity: 0.7, fontSize: '12px' }}>{clases.length} sesiones semanales programadas</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {[
            { valor: clasesHoy,    label: 'Hoy',      sub: 'sesiones' },
            { valor: totalAlumnos, label: 'Alumnos',  sub: 'inscritos' },
            { valor: `${ocupacion}%`, label: 'Ocupación', sub: 'promedio' },
          ].map(({ valor, label, sub }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1 }}>{valor}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.85, marginTop: '2px' }}>{label}</div>
              <div style={{ fontSize: '10px', opacity: 0.55 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filtro por día ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
        <button onClick={() => setFiltroDia('todos')} style={{
          padding: '0.45rem 1.1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', transition: 'all 0.2s',
          background: filtrodia === 'todos' ? '#1e293b' : '#f1f5f9',
          color: filtrodia === 'todos' ? 'white' : '#64748b',
          boxShadow: filtrodia === 'todos' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
        }}>
          Todos · {clases.length}
        </button>
        {diasConClases.map(d => {
          const { diff } = getProximaFecha(d);
          const esHoy    = diff === 0;
          const activo   = filtrodia === String(d);
          return (
            <button key={d} onClick={() => setFiltroDia(String(d))} style={{
              padding: '0.45rem 1.1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', transition: 'all 0.2s',
              background: activo ? '#1e293b' : esHoy ? '#dcfce7' : '#f1f5f9',
              color: activo ? 'white' : esHoy ? '#15803d' : '#64748b',
              boxShadow: activo ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              display: 'flex', alignItems: 'center', gap: '5px'
            }}>
              {esHoy && <span style={{ width: 7, height: 7, borderRadius: '50%', background: activo ? 'white' : '#16a34a', display: 'inline-block' }} />}
              {DIAS_CORTO[d]} · {clases.filter(c => c.dia_semana === d).length}
            </button>
          );
        })}
      </div>

      {/* ── Grid de clases ── */}
      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <ClipboardList size={24} color="#94a3b8" />
          </div>
          <p style={{ color: '#475569', margin: 0, fontWeight: 700, fontSize: '14px' }}>Sin clases para este día</p>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0' }}>Prueba seleccionando otro día</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filtradas.map((clase) => {
            const color = getColor(clase.disciplina);
            const cupoActual = parseInt(clase.cupo_actual) || 0;
            const cupoMax    = parseInt(clase.cupo_maximo) || 1;
            const pct        = Math.min(100, Math.round((cupoActual / cupoMax) * 100));
            const barColor   = pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#10b981';
            const { diff, texto } = getProximaFecha(clase.dia_semana);
            const esHoy      = diff === 0;
            const lleno      = pct >= 100;

            return (
              <div key={clase.sesion_id} style={{
                background: 'white', borderRadius: '18px',
                border: `1.5px solid ${esHoy ? color.borde : '#e2e8f0'}`,
                overflow: 'hidden',
                boxShadow: esHoy ? `0 6px 20px ${color.borde}50` : '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.25s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 28px rgba(0,0,0,0.12)`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = esHoy ? `0 6px 20px ${color.borde}50` : '0 2px 8px rgba(0,0,0,0.06)'; }}
              >
                {/* Header gradiente */}
                <div style={{ background: color.grad, padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
                  {/* Círculo decorativo */}
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                  <div style={{ position: 'absolute', top: 10, right: 30, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '15px', color: 'white', letterSpacing: '-0.3px' }}>{clase.disciplina}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} /> {formatHora(clase.hora_inicio)} – {formatHora(clase.hora_fin)}
                      </div>
                    </div>
                    <span style={{
                      background: esHoy ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)',
                      backdropFilter: 'blur(4px)',
                      color: 'white', fontSize: '10px', fontWeight: 800,
                      padding: '4px 10px', borderRadius: '20px',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      {esHoy && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />}
                      {esHoy ? 'Hoy' : DIAS_NOMBRE[clase.dia_semana]}
                    </span>
                  </div>
                </div>

                {/* Cuerpo */}
                <div style={{ padding: '1rem 1.25rem' }}>

                  {/* Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MapPin size={12} color="#94a3b8" />
                      </div>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{clase.espacio}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#3b82f6' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Calendar size={12} color="#3b82f6" />
                      </div>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {esHoy ? `Hoy, ${texto}` : diff === 1 ? `Mañana, ${texto}` : texto}
                      </span>
                    </div>
                  </div>

                  {/* Cupo */}
                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={11} color="#94a3b8" /> Ocupación
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {lleno && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 7px', borderRadius: '20px' }}>Lleno</span>
                        )}
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
                          {cupoActual}/{cupoMax}
                        </span>
                      </div>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '7px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: barColor,
                        borderRadius: '6px', transition: 'width 0.5s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>{pct}% ocupado</div>
                  </div>

                  {/* Badge hoy */}
                  {esHoy && (
                    <div style={{ marginTop: '0.75rem', padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={13} color="#16a34a" />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d' }}>Clase programada para hoy</span>
                    </div>
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

export default MisClases;