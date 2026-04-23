import React, { useEffect, useState } from 'react';
import { Trophy, ChevronDown, ChevronUp, Users, Calendar } from 'lucide-react';

const RONDAS = { 1: 'Cuartos de Final', 2: 'Semifinales', 3: 'Final' };

const COLORES = [
  { bg: '#e0f2fe', text: '#0369a1', borde: '#38bdf8' },
  { bg: '#fef3c7', text: '#b45309', borde: '#fbbf24' },
  { bg: '#dcfce7', text: '#15803d', borde: '#4ade80' },
];

function formatFecha(f) {
  if (!f) return '';
  return new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
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
    background: ganador === nombre ? '#10b981' : pendiente ? '#f8fafc' : '#f1f5f9',
    color: ganador === nombre ? 'white' : '#1e293b',
    border: `1px solid ${ganador === nombre ? '#10b981' : '#e2e8f0'}`,
    borderRadius: '8px', padding: '5px 14px',
    fontWeight: 600, fontSize: '0.82rem',
    cursor: pendiente ? 'pointer' : 'default',
    transition: 'all 0.2s', whiteSpace: 'nowrap'
  });

  return (
    <div style={{
      background: ganador ? '#f0fdf4' : 'white',
      border: `1px solid ${ganador ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '0.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
          <button onClick={() => registrar(encuentro.participante_1)}
            disabled={!!ganador || cargando || encuentro.participante_1 === 'Por definir'}
            style={btnStyle(encuentro.participante_1)}>
            {ganador === encuentro.participante_1 && '🏆 '}{encuentro.participante_1}
          </button>
          <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.8rem' }}>vs</span>
          <button onClick={() => registrar(encuentro.participante_2)}
            disabled={!!ganador || cargando || encuentro.participante_2 === 'Por definir'}
            style={btnStyle(encuentro.participante_2)}>
            {ganador === encuentro.participante_2 && '🏆 '}{encuentro.participante_2}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span style={{
            background: ganador ? '#dcfce7' : encuentro.participante_1 === 'Por definir' ? '#f1f5f9' : '#fef3c7',
            color: ganador ? '#15803d' : encuentro.participante_1 === 'Por definir' ? '#94a3b8' : '#b45309',
            fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '20px'
          }}>
            {ganador ? '✓ Finalizado' : encuentro.participante_1 === 'Por definir' ? 'Por definir' : 'Pendiente'}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {encuentro.hora_programada && (
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>🕐 {formatHora(encuentro.hora_programada)}</span>
            )}
            {encuentro.cancha_asignada && (
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>📍 {encuentro.cancha_asignada}</span>
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
  const color = COLORES[index % COLORES.length];
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

  return (
    <div style={{
      background: 'white', borderRadius: '14px',
      borderTop: `4px solid ${color.borde}`,
      border: `1px solid #e2e8f0`,
      overflow: 'hidden', marginBottom: '1rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
    }}>
      <div onClick={handleToggle} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 1.25rem', cursor: 'pointer',
        background: expandido ? '#f8fafc' : 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Trophy size={20} color={color.text} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{torneo.nombre}</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span>🏅 {torneo.disciplina}</span>
              <span>📅 {formatFecha(torneo.fecha_inicio)} – {formatFecha(torneo.fecha_fin)}</span>
              <span>👥 {torneo.total_participantes} participantes</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            background: estado.bg, color: estado.color,
            fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px'
          }}>
            {estado.label}
          </span>
          {expandido ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </div>
      </div>

      {expandido && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '1rem 1.25rem' }}>
          {/* Progreso */}
          {total > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Progreso del torneo</span>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>{completados}/{total} partidos</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                <div style={{
                  width: `${total > 0 ? (completados / total) * 100 : 0}%`,
                  height: '100%', background: '#10b981', borderRadius: '4px', transition: 'width 0.4s'
                }} />
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>Cargando encuentros...</div>
          ) : encuentros.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>No hay encuentros registrados.</div>
          ) : (
            Object.keys(porRonda).sort((a, b) => a - b).map(ronda => (
              <div key={ronda} style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, color: '#64748b',
                    whiteSpace: 'nowrap', padding: '0 0.5rem'
                  }}>
                    🏆 {RONDAS[ronda] || `Ronda ${ronda}`}
                  </span>
                  <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
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

  if (loading) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
      Cargando torneos...
    </div>
  );

  return (
    <div>
      <h4 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
        Gestión de Torneos
      </h4>
      {torneos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
          <Trophy size={40} color="#94a3b8" />
          <p style={{ color: '#64748b', margin: '0.5rem 0 0' }}>No hay torneos registrados.</p>
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