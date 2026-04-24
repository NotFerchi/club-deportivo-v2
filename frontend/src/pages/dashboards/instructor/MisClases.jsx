import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Calendar } from 'lucide-react';

const DIAS_NOMBRE = ['', 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const COLORES = {
  'Natacion Avanzada':   { bg: '#e0f2fe', text: '#0369a1', borde: '#38bdf8' },
  'Tenis Intermedio':    { bg: '#dcfce7', text: '#15803d', borde: '#4ade80' },
  'Padel Principiantes': { bg: '#fef3c7', text: '#b45309', borde: '#fbbf24' },
  'Yoga Matutino':       { bg: '#ede9fe', text: '#6d28d9', borde: '#a78bfa' },
};

function getColor(disciplina) {
  return COLORES[disciplina] || { bg: '#f1f5f9', text: '#475569', borde: '#94a3b8' };
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
    texto: fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
  };
}

function formatHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function getPorcentajeCupo(actual, maximo) {
  if (!maximo) return 0;
  return Math.min(100, Math.round((parseInt(actual) / parseInt(maximo)) * 100));
}

function MisClases() {
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);

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

        // Ordenar: primero las de hoy, luego por días siguientes
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

  if (loading) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
      Cargando tus clases...
    </div>
  );

  return (
    <div>
      <h4 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
        Mis Clases Asignadas
      </h4>

      {clases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
          <p style={{ color: '#64748b', margin: 0 }}>No tienes clases asignadas</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {clases.map((clase) => {
            const color = getColor(clase.disciplina);
            const pct = getPorcentajeCupo(clase.cupo_actual, clase.cupo_maximo);
            const { diff, texto } = getProximaFecha(clase.dia_semana);
            const esHoy = diff === 0;
            const barColor = pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#10b981';

            return (
              <div key={clase.sesion_id} style={{
                background: 'white', borderRadius: '14px',
                border: `1px solid ${esHoy ? color.borde : '#e2e8f0'}`,
                borderTop: `4px solid ${color.borde}`,
                padding: '1.25rem',
                boxShadow: esHoy ? `0 2px 12px ${color.borde}40` : '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span style={{
                    background: color.bg, color: color.text,
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '3px 10px', borderRadius: '20px'
                  }}>
                    {clase.disciplina}
                  </span>
                  <span style={{
                    background: esHoy ? '#10b981' : '#f1f5f9',
                    color: esHoy ? 'white' : '#475569',
                    fontSize: '0.65rem', fontWeight: 700,
                    padding: '3px 8px', borderRadius: '20px'
                  }}>
                    {esHoy ? '🟢 Hoy' : DIAS_NOMBRE[clase.dia_semana]}
                  </span>
                </div>

                {/* Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569' }}>
                    <Clock size={13} color="#94a3b8" />
                    <span>{formatHora(clase.hora_inicio)} – {formatHora(clase.hora_fin)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569' }}>
                    <MapPin size={13} color="#94a3b8" />
                    <span>{clase.espacio}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b' }}>
                    <Calendar size={13} color="#94a3b8" />
                    <span style={{ textTransform: 'capitalize' }}>
                      {esHoy ? `Hoy, ${texto}` : texto}
                    </span>
                  </div>
                </div>

                {/* Barra cupo */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={11} /> Cupo
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                      {clase.cupo_actual || 0}/{clase.cupo_maximo}
                    </span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: barColor, borderRadius: '4px',
                      transition: 'width 0.4s ease'
                    }} />
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