import React, { useEffect, useState } from 'react';
import { Trophy, ChevronDown, ChevronUp, Calendar, Users, Medal, Loader2, Save } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import { API_BASE_URL } from '../../../services/api';

const RONDAS = { 1: 'Cuartos de Final', 2: 'Semifinales', 3: 'Final' };

const COLORES_TORNEO = [
  { grad: 'linear-gradient(135deg, #0369a1, #0ea5e9)', borde: '#38bdf8', bg: '#e0f2fe' },
  { grad: 'linear-gradient(135deg, #b45309, #f59e0b)', borde: '#fbbf24', bg: '#fef3c7' },
  { grad: 'linear-gradient(135deg, #15803d, #22c55e)', borde: '#4ade80', bg: '#dcfce7' },
  { grad: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', borde: '#a78bfa', bg: '#ede9fe' },
];

// Convierte string a Date sin corrimiento de zona horaria.
// new Date("2024-01-15") parsea como UTC → en México muestra el día anterior.
// Con "T00:00:00" (sin Z) JS lo interpreta como hora LOCAL.
function parseLocalDate(str) {
  if (!str) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(`${str}T00:00:00`) : new Date(str);
}

function formatFecha(f) {
  if (!f) return '';
  const d = parseLocalDate(f);
  return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function formatHora(ts) {
  if (!ts) return '';
  const d = parseLocalDate(ts);
  // Si es timestamp completo de BD (tiene T o Z), usar México City para no depender del TZ del navegador
  const opts = { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' };
  return d ? d.toLocaleTimeString('es-MX', opts) : '';
}

function getEstado(inicio, fin) {
  const hoy = new Date();
  if (hoy < parseLocalDate(inicio)) return { label: 'Próximo',    color: '#3b82f6', bg: '#eff6ff' };
  if (hoy > parseLocalDate(fin))   return { label: 'Finalizado', color: '#64748b', bg: '#f1f5f9' };
  return                                   { label: 'En curso',  color: '#10b981', bg: '#f0fdf4' };
}

function EncuentroRow({ encuentro, onResultadoGuardado }) {
  const yaFinalizado = encuentro.estado === 'finalizado';

  const [marcador1, setMarcador1] = useState(yaFinalizado ? String(encuentro.marcador_1 ?? '') : '');
  const [marcador2, setMarcador2] = useState(yaFinalizado ? String(encuentro.marcador_2 ?? '') : '');
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState(null);
  const [finalizado, setFinalizado] = useState(yaFinalizado);
  const [marcadoresFinales, setMarcadoresFinales] = useState(
    yaFinalizado ? { m1: encuentro.marcador_1, m2: encuentro.marcador_2, ganador_id: encuentro.ganador_id } : null
  );

  const ambosListos = encuentro.participante_1 !== 'Por definir' &&
                      encuentro.participante_2 !== 'Por definir';

  const ganadorNombre = () => {
    if (!marcadoresFinales) return null;
    return marcadoresFinales.m1 > marcadoresFinales.m2
      ? encuentro.participante_1
      : encuentro.participante_2;
  };

  const guardarResultado = async () => {
    setError(null);
    const m1 = parseInt(marcador1, 10);
    const m2 = parseInt(marcador2, 10);

    if (!Number.isFinite(m1) || !Number.isFinite(m2) || m1 < 0 || m2 < 0) {
      setError('Ingresa marcadores válidos (números enteros ≥ 0)');
      return;
    }
    if (m1 === m2) {
      setError('No se permiten empates. Ajusta el marcador.');
      return;
    }

    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/encuentros/${encuentro.encuentro_id}/resultado`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ marcador_1: m1, marcador_2: m2 })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al guardar resultado');
        return;
      }
      setFinalizado(true);
      setMarcadoresFinales({ m1, m2, ganador_id: data.ganador_id });
      if (onResultadoGuardado) onResultadoGuardado();
    } catch (err) {
      setError('Error de conexión con el servidor');
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const inputStyle = (disabled) => ({
    width: '52px', textAlign: 'center', fontSize: '15px', fontWeight: 800,
    padding: '6px 4px', borderRadius: '8px',
    border: `2px solid ${disabled ? '#e2e8f0' : '#3b82f6'}`,
    background: disabled ? '#f8fafc' : 'white',
    color: disabled ? '#64748b' : '#1e293b',
    outline: 'none'
  });

  const ganador = ganadorNombre();

  return (
    <div style={{
      background: finalizado ? '#f0fdf4' : 'white',
      border: `1px solid ${finalizado ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: '12px', padding: '0.9rem 1rem',
      marginBottom: '0.5rem', transition: 'all 0.2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{
          fontWeight: ganador === encuentro.participante_1 ? 800 : 600,
          color: ganador === encuentro.participante_1 ? '#15803d' : '#1e293b',
          fontSize: '13px', flex: '1 1 120px',
          display: 'flex', alignItems: 'center', gap: '4px'
        }}>
          {ganador === encuentro.participante_1 && <span>🏆</span>}
          {encuentro.participante_1 || 'Por definir'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="number" min="0"
            value={marcador1}
            onChange={e => setMarcador1(e.target.value)}
            disabled={finalizado || !ambosListos}
            style={inputStyle(finalizado || !ambosListos)}
            placeholder="0"
          />
          <span style={{ fontWeight: 800, color: '#94a3b8', fontSize: '13px',
            background: '#f1f5f9', padding: '4px 8px', borderRadius: '8px' }}>VS</span>
          <input
            type="number" min="0"
            value={marcador2}
            onChange={e => setMarcador2(e.target.value)}
            disabled={finalizado || !ambosListos}
            style={inputStyle(finalizado || !ambosListos)}
            placeholder="0"
          />
        </div>

        <span style={{
          fontWeight: ganador === encuentro.participante_2 ? 800 : 600,
          color: ganador === encuentro.participante_2 ? '#15803d' : '#1e293b',
          fontSize: '13px', flex: '1 1 120px', textAlign: 'right',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px'
        }}>
          {encuentro.participante_2 || 'Por definir'}
          {ganador === encuentro.participante_2 && <span>🏆</span>}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          {error && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>⚠ {error}</span>}
          {!error && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              background: finalizado ? '#dcfce7' : !ambosListos ? '#f1f5f9' : '#fef3c7',
              color: finalizado ? '#15803d' : !ambosListos ? '#94a3b8' : '#b45309'
            }}>
              {finalizado ? '✓ Finalizado' : !ambosListos ? 'Por definir' : 'Pendiente'}
            </span>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '3px' }}>
            {encuentro.hora_programada && (
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>🕐 {formatHora(encuentro.hora_programada)}</span>
            )}
            {encuentro.cancha_asignada && (
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>📍 {encuentro.cancha_asignada}</span>
            )}
          </div>
        </div>

        {!finalizado && ambosListos && (
          <button onClick={guardarResultado} disabled={cargando} style={{
            background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '6px 16px', fontSize: '12px', fontWeight: 700,
            cursor: cargando ? 'not-allowed' : 'pointer',
            boxShadow: cargando ? 'none' : '0 2px 8px rgba(37,99,235,0.4)',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            {cargando ? <><Loader2 size={13} className="icon-spin" /> Guardando...</> : <><Save size={13} /> Guardar resultado</>}
          </button>
        )}
      </div>
    </div>
  );
}

function TorneoCard({ torneo, index, onTorneoActualizado }) {
  const { showConfirm } = useNotification();
  const [expandido, setExpandido] = useState(false);
  const [encuentros, setEncuentros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [yaCargo, setYaCargo] = useState(false);
  const [accionCargando, setAccionCargando] = useState(false);
  const [mensajeAccion, setMensajeAccion] = useState(null);
  const color = COLORES_TORNEO[index % COLORES_TORNEO.length];
  const estado = getEstado(torneo.fecha_inicio, torneo.fecha_fin);

  const cargar = async () => {
    if (yaCargo) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/torneos/${torneo.torneo_id}/bracket`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const todos = Array.isArray(data)
        ? data.flatMap(r => r.encuentros.map(e => ({ ...e, ronda: r.ronda })))
        : [];
      setEncuentros(todos);
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

  useEffect(() => {
    if (!yaCargo && expandido) cargar();
  }, [yaCargo]);

  // ── Cerrar inscripciones ──
  const cerrarInscripciones = async () => {
    if (!await showConfirm('¿Cerrar inscripciones y generar el bracket?')) return;
    setAccionCargando(true);
    setMensajeAccion(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/torneos/${torneo.torneo_id}/cerrar-inscripciones`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setMensajeAccion({ tipo: 'error', texto: data.error || 'Error al cerrar inscripciones' });
        return;
      }
      setMensajeAccion({ tipo: 'ok', texto: '✅ Inscripciones cerradas. Ya puedes confirmar el bracket.' });
      if (onTorneoActualizado) onTorneoActualizado();
    } catch {
      setMensajeAccion({ tipo: 'error', texto: 'Error de conexión' });
    } finally {
      setAccionCargando(false);
    }
  };

  // ── Confirmar bracket ──
  const confirmarBracket = async () => {
    if (!await showConfirm('¿Confirmar el bracket y poner el torneo En_curso?')) return;
    setAccionCargando(true);
    setMensajeAccion(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/torneos/${torneo.torneo_id}/confirmar-bracket`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setMensajeAccion({ tipo: 'error', texto: data.error || 'Error al confirmar bracket' });
        return;
      }
      setMensajeAccion({ tipo: 'ok', texto: '✅ Bracket confirmado. ¡El torneo está En_curso!' });
      setYaCargo(false);
      if (onTorneoActualizado) onTorneoActualizado();
    } catch {
      setMensajeAccion({ tipo: 'error', texto: 'Error de conexión' });
    } finally {
      setAccionCargando(false);
    }
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
      background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
      overflow: 'hidden', marginBottom: '1rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'box-shadow 0.2s'
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'}
    >
      {/* Header */}
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
            }}>{estado.label}</span>
            {expandido ? <ChevronUp size={18} color="rgba(255,255,255,0.8)" /> : <ChevronDown size={18} color="rgba(255,255,255,0.8)" />}
          </div>
        </div>

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

      {/* Cuerpo expandido */}
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
              <Loader2 size={28} className="icon-spin" style={{ marginBottom: '0.5rem', color: '#94a3b8' }} />
              <div>Cargando encuentros...</div>
            </div>
          ) : encuentros.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <Trophy size={32} color="#94a3b8" />
              <p style={{ color: '#64748b', margin: '0.5rem 0 0', fontSize: '13px' }}>No hay encuentros registrados</p>
            </div>
          ) : (
            Object.keys(porRonda).sort((a, b) => a - b).map(ronda => (
              <div key={ronda} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }} />
                  <span style={{
                    fontSize: '11px', fontWeight: 800, color: 'white',
                    background: color.grad, padding: '4px 14px', borderRadius: '20px', whiteSpace: 'nowrap'
                  }}>
                    🏆 {RONDAS[ronda] || `Ronda ${ronda}`}
                  </span>
                  <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }} />
                </div>
                {porRonda[ronda].map(e => (
                  <EncuentroRow
                    key={e.encuentro_id}
                    encuentro={e}
                    onResultadoGuardado={() => setYaCargo(false)}
                  />
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

  const fetchTorneos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/instructor/torneos`, {
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

  useEffect(() => { fetchTorneos(); }, []);

  const enCurso  = torneos.filter(t => getEstado(t.fecha_inicio, t.fecha_fin).label === 'En curso').length;
  const proximos = torneos.filter(t => getEstado(t.fecha_inicio, t.fecha_fin).label === 'Próximo').length;

  if (loading) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <Loader2 size={36} className="icon-spin" style={{ marginBottom: '0.5rem', color: '#94a3b8' }} />
      <div>Cargando torneos...</div>
    </div>
  );

  return (
    <div>
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
          <TorneoCard
            key={torneo.torneo_id}
            torneo={torneo}
            index={i}
            onTorneoActualizado={fetchTorneos}
          />
        ))
      )}
    </div>
  );
}

export default GestionTorneos;