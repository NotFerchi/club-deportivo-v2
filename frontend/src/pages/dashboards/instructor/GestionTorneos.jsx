import React, { useEffect, useState } from 'react';
import { Trophy, ChevronDown, ChevronUp, Calendar, Users, Medal } from 'lucide-react';

const RONDAS = { 1: 'Cuartos de Final', 2: 'Semifinales', 3: 'Final' };

const COLORES_TORNEO = [
  { grad: 'linear-gradient(135deg, #0369a1, #0ea5e9)', borde: '#38bdf8', bg: '#e0f2fe' },
  { grad: 'linear-gradient(135deg, #b45309, #f59e0b)', borde: '#fbbf24', bg: '#fef3c7' },
  { grad: 'linear-gradient(135deg, #15803d, #22c55e)', borde: '#4ade80', bg: '#dcfce7' },
  { grad: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', borde: '#a78bfa', bg: '#ede9fe' },
];

function formatFecha(f) {
  if (!f) return '';
  return new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatHora(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function getEstado(inicio, fin) {
  const hoy = new Date();
  if (hoy < new Date(inicio)) return { label: 'Próximo',    color: '#3b82f6', bg: '#eff6ff' };
  if (hoy > new Date(fin))   return { label: 'Finalizado', color: '#64748b', bg: '#f1f5f9' };
  return                             { label: 'En curso',  color: '#10b981', bg: '#f0fdf4' };
}

function EncuentroRow({ encuentro }) {
  const [ganador, setGanador] = useState(encuentro.ganador || null);
  const [cargando, setCargando] = useState(false);
  const pendiente = !ganador && encuentro.participante_1 !== 'Por definir';

  const registrar = async (nombre) => {
    if (cargando || ganador) return;
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/instructor/torneos/encuentro/${encuentro.encuentro_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ganador: nombre })
      });
      setGanador(nombre);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const btnStyle = (nombre) => ({
    background: ganador === nombre
      ? 'linear-gradient(135deg, #10b981, #059669)'
      : pendiente ? '#f8fafc' : '#f1f5f9',
    color: ganador === nombre ? 'white' : '#1e293b',
    border: `1px solid ${ganador === nombre ? '#10b981' : '#e2e8f0'}`,
    borderRadius: '10px', padding: '6px 14px',
    fontWeight: 700, fontSize: '12px',
    cursor: pendiente ? 'pointer' : 'default',
    transition: 'all 0.2s', whiteSpace: 'nowrap',
    boxShadow: ganador === nombre ? '0 2px 8px rgba(16,185,129,0.4)' : 'none'
  });

  return (
    <div style={{
      background: ganador ? '#f0fdf4' : 'white',
      border: `1px solid ${ganador ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: '12px', padding: '0.85rem 1rem',
      marginBottom: '0.5rem', transition: 'all 0.2s'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Jugadores */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, flexWrap: 'wrap' }}>
          <button onClick={() => registrar(encuentro.participante_1)}
            disabled={!!ganador || cargando || encuentro.participante_1 === 'Por definir'}
            style={btnStyle(encuentro.participante_1)}>
            {ganador === encuentro.participante_1 && '🏆 '}{encuentro.participante_1}
          </button>
          <span style={{
            fontWeight: 800, color: '#94a3b8', fontSize: '13px',
            background: '#f8fafc', padding: '4px 10px', borderRadius: '20px'
          }}>VS</span>
          <button onClick={() => registrar(encuentro.participante_2)}
            disabled={!!ganador || cargando || encuentro.participante_2 === 'Por definir'}
            style={btnStyle(encuentro.participante_2)}>
            {ganador === encuentro.participante_2 && '🏆 '}{encuentro.participante_2}
          </button>
        </div>

        {/* Estado + info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span style={{
            background: ganador ? '#dcfce7' : encuentro.participante_1 === 'Por definir' ? '#f1f5f9' : '#fef3c7',
            color: ganador ? '#15803d' : encuentro.participante_1 === 'Por definir' ? '#94a3b8' : '#b45309',
            fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px'
          }}>
            {ganador ? '✓ Finalizado' : encuentro.participante_1 === 'Por definir' ? 'Por definir' : 'Pendiente'}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {encuentro.hora_programada && (
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>🕐 {formatHora(encuentro.hora_programada)}</span>
            )}
            {encuentro.cancha_asignada && (
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>📍 {encuentro.cancha_asignada}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TorneoCard({ torneo, index }) {
  const [expandido, setExpandido] = useState(false);
  const [encuentros, setEncuentros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [yaCargo, setYaCargo] = useState(false);
  const color = COLORES_TORNEO[index % COLORES_TORNEO.length];
  const estado = getEstado(torneo.fecha_inicio, torneo.fecha_fin);

  const cargar = async () => {
    if (yaCargo) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/instructor/torneos/${torneo.torneo_id}/encuentros`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEncuentros(data);
      setYaCargo(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const nuevo = !expandido;
    setExpandido(nuevo);
    if (nuevo) cargar();
  };

  const porRonda = encuentros.reduce((acc, e) => {
    if (!acc[e.ronda]) acc[e.ronda] = [];
    acc[e.ronda].push(e);
    return acc;
  }, {});

  const completados = encuentros.filter(e => e.ganador).length;
  const total = encuentros.length;
  const progreso = total > 0 ? Math.round((completados / total) * 100) : 0;

  return (
    <div style={{
      background: 'white', borderRadius: '16px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden', marginBottom: '1rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.2s'
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'}
    >
      {/* Header con gradiente */}
      <div style={{ background: color.grad, padding: '1.25rem 1.5rem', cursor: 'pointer' }} onClick={handleToggle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Trophy size={22} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'white' }}>{torneo.nombre}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginTop: '2px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span>🏅 {torneo.disciplina}</span>
                <span>👥 {torneo.total_participantes} participantes</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              background: estado.bg, color: estado.color,
              fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px'
            }}>
              {estado.label}
            </span>
            {expandido ? <ChevronUp size={18} color="rgba(255,255,255,0.8)" /> : <ChevronDown size={18} color="rgba(255,255,255,0.8)" />}
          </div>
        </div>

        {/* Fechas y progreso */}
        <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={12} /> {formatFecha(torneo.fecha_inicio)} – {formatFecha(torneo.fecha_fin)}
          </span>
          {total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 80, background: 'rgba(255,255,255,0.2)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progreso}%`, height: '100%', background: 'white', borderRadius: '4px', transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{completados}/{total}</span>
            </div>
          )}
        </div>
      </div>

      {/* Encuentros */}
      {expandido && (
        <div style={{ padding: '1.25rem' }}>
          {/* Info progreso */}
          {total > 0 && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Medal size={14} color="#10b981" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>{completados} partidos finalizados</span>
              </div>
              <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '0.6rem 1rem' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>{total - completados} pendientes</span>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
              Cargando encuentros...
            </div>
          ) : encuentros.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <Trophy size={32} color="#94a3b8" />
              <p style={{ color: '#64748b', margin: '0.5rem 0 0', fontSize: '13px' }}>No hay encuentros registrados</p>
            </div>
          ) : (
            Object.keys(porRonda).sort((a, b) => a - b).map(ronda => (
              <div key={ronda} style={{ marginBottom: '1.5rem' }}>
                {/* Separador de ronda */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }} />
                  <span style={{
                    fontSize: '11px', fontWeight: 800, color: 'white',
                    background: color.grad,
                    padding: '4px 14px', borderRadius: '20px', whiteSpace: 'nowrap'
                  }}>
                    🏆 {RONDAS[ronda] || `Ronda ${ronda}`}
                  </span>
                  <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }} />
                </div>
                {porRonda[ronda].map(e => (
                  <EncuentroRow key={e.encuentro_id} encuentro={e} />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function GestionTorneos() {
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTorneos = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/instructor/torneos', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setTorneos(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTorneos();
  }, []);

  const enCurso  = torneos.filter(t => getEstado(t.fecha_inicio, t.fecha_fin).label === 'En curso').length;
  const proximos = torneos.filter(t => getEstado(t.fecha_inicio, t.fecha_fin).label === 'Próximo').length;

  if (loading) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      Cargando torneos...
    </div>
  );

  return (
    <div>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        borderRadius: '16px', padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Gestión de Torneos</h4>
          <p style={{ margin: '3px 0 0', opacity: 0.75, fontSize: '12px' }}>{torneos.length} torneos registrados</p>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{enCurso}</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>En curso</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{proximos}</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Próximos</div>
          </div>
        </div>
      </div>

      {torneos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
          <Trophy size={48} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>No hay torneos registrados</p>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0' }}>Los torneos aparecerán aquí cuando sean creados</p>
        </div>
      ) : (
        torneos.map((torneo, i) => (
          <TorneoCard key={torneo.torneo_id} torneo={torneo} index={i} />
        ))
      )}
    </div>
  );
}

export default GestionTorneos;