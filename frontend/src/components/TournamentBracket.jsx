import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Filter, MapPin, RotateCcw, Trophy } from 'lucide-react';
import { apiRequest, unwrapList } from '../services/api';
import '../../css/TournamentBracket.css';

const DEFAULT_ESTADO_OPTIONS = [
  { value: 'Abierto', label: 'Abierto' },
  { value: 'Inscripciones_cerradas', label: 'Inscripciones cerradas' },
  { value: 'En_curso', label: 'En curso' },
  { value: 'Finalizado', label: 'Finalizado' }
];

const ESTADOS_ENCUENTRO = {
  pendiente: 'pendiente',
  programado: 'programado',
  finalizado: 'finalizado'
};

function normalizeEstado(estado) {
  return String(estado || '').trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return '';
  const stringValue = String(value);
  const timeOnlyMatch = stringValue.match(/^(\d{2}):(\d{2})/);
  if (timeOnlyMatch && !stringValue.includes('T')) return `${timeOnlyMatch[1]}:${timeOnlyMatch[2]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return stringValue;
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function buildTorneosPath(filters) {
  const params = new URLSearchParams();
  if (filters.disciplina_id) params.set('disciplina_id', filters.disciplina_id);
  if (filters.estado) params.set('estado', filters.estado);
  const queryString = params.toString();
  return `/torneos${queryString ? `?${queryString}` : ''}`;
}

function getErrorMessage(error, fallback) {
  if (error?.name === 'AbortError') return '';
  return error?.message || fallback;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getParticipantName(participante) {
  if (!participante) return 'Por definir';
  return (
    participante.nombre ||
    participante.nombre_completo ||
    participante.nombre_socio ||
    participante.socio_nombre ||
    participante.usuario_nombre ||
    participante.persona_nombre ||
    participante.socio?.nombre ||
    participante.socio?.nombre_completo ||
    participante.usuario?.nombre ||
    participante.persona?.nombre ||
    participante.miembro?.nombre ||
    'Por definir'
  );
}

function isWinner(encuentro, participante) {
  if (normalizeEstado(encuentro.estado) !== ESTADOS_ENCUENTRO.finalizado) return false;
  if (encuentro.ganador_id && participante?.participante_id) {
    return String(encuentro.ganador_id) === String(participante.participante_id);
  }
  return Boolean(encuentro.ganador_nombre) &&
    normalizeText(encuentro.ganador_nombre) === normalizeText(getParticipantName(participante));
}

function EmptyState({ title, message }) {
  return (
    <div className="tb-empty-state">
      <Trophy size={34} />
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}

function TournamentRow({ torneo, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`tb-tournament-row ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(torneo)}
    >
      <span className="tb-tournament-main">
        <strong>{torneo.nombre || `Torneo #${torneo.torneo_id}`}</strong>
        <span>{torneo.nombre_disciplina || 'Disciplina sin nombre'}</span>
      </span>
      <span className="tb-tournament-date"><Calendar size={15} />{formatDate(torneo.fecha_inicio)}</span>
      <span className="tb-tournament-date"><Calendar size={15} />{formatDate(torneo.fecha_fin)}</span>
      <span className="tb-tournament-status">{torneo.estado || 'Sin estado'}</span>
    </button>
  );
}

function MatchCard({ encuentro, onResultadoGuardado, readOnly = false }) {
  const participante1 = encuentro.participante_1 || { participante_id: null, nombre: 'Por definir' };
  const participante2 = encuentro.participante_2 || { participante_id: null, nombre: 'Por definir' };
  const estado = normalizeEstado(encuentro.estado);
  const finalizado = estado === ESTADOS_ENCUENTRO.finalizado;
  const programado  = estado === ESTADOS_ENCUENTRO.programado;
  const ambosListos =
    getParticipantName(participante1) !== 'Por definir' &&
    getParticipantName(participante2) !== 'Por definir';

  const [marcador1, setMarcador1] = useState(finalizado ? String(encuentro.marcador_1 ?? '') : '');
  const [marcador2, setMarcador2] = useState(finalizado ? String(encuentro.marcador_2 ?? '') : '');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const showScore = finalizado && (encuentro.marcador_1 != null || encuentro.marcador_2 != null);
  const ganador1 = isWinner(encuentro, participante1);
  const ganador2 = isWinner(encuentro, participante2);

  const estadoStyles = {
    finalizado: { bg: '#f0fdf4', border: '#86efac', badge: '#16a34a', badgeBg: '#dcfce7' },
    programado:  { bg: '#eff6ff', border: '#93c5fd', badge: '#2563eb', badgeBg: '#dbeafe' },
    pendiente:   { bg: '#fafafa', border: '#e2e8f0', badge: '#64748b', badgeBg: '#f1f5f9' },
  };
  const s = estadoStyles[estado] || estadoStyles.pendiente;

  const guardar = async () => {
    setError(null);
    const m1 = parseInt(marcador1, 10);
    const m2 = parseInt(marcador2, 10);
    if (!Number.isFinite(m1) || !Number.isFinite(m2) || m1 < 0 || m2 < 0) {
      setError('Ingresa marcadores válidos (≥ 0)');
      return;
    }
    if (m1 === m2) { setError('No se permiten empates'); return; }
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/api/encuentros/${encuentro.encuentro_id}/resultado`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ marcador_1: m1, marcador_2: m2 })
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      if (onResultadoGuardado) onResultadoGuardado();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  const avatar = (nombre, esGanador) => (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
      background: esGanador ? '#16a34a' : '#e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: 800,
      color: esGanador ? 'white' : '#94a3b8',
    }}>
      {nombre[0]?.toUpperCase() || '?'}
    </div>
  );

  return (
    <article style={{
      background: s.bg,
      border: `1.5px solid ${s.border}`,
      borderRadius: '14px',
      overflow: 'hidden',
      marginBottom: '10px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 12px',
        borderBottom: `1px solid ${s.border}`,
        background: 'rgba(255,255,255,0.7)'
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>
          # {encuentro.encuentro_id}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700,
          color: s.badge, background: s.badgeBg,
          padding: '2px 10px', borderRadius: '20px',
          textTransform: 'uppercase', letterSpacing: '0.4px'
        }}>
          {estado}
        </span>
      </div>

      {/* Participante 1 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 5px', gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {avatar(getParticipantName(participante1), ganador1)}
          <span style={{
            fontSize: '13px', fontWeight: ganador1 ? 800 : 600,
            color: ganador1 ? '#15803d' : '#1e293b',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {getParticipantName(participante1)}
          </span>
          {ganador1 && (
            <span style={{
              fontSize: '9px', fontWeight: 700, color: '#16a34a',
              background: '#dcfce7', padding: '2px 7px', borderRadius: '20px',
              whiteSpace: 'nowrap', flexShrink: 0
            }}>🏆 Ganador</span>
          )}
        </div>
        {showScore && (
          <span style={{
            fontSize: '20px', fontWeight: 900,
            color: ganador1 ? '#16a34a' : '#cbd5e1',
            minWidth: '28px', textAlign: 'center', flexShrink: 0
          }}>
            {encuentro.marcador_1 ?? '-'}
          </span>
        )}
        {!readOnly && programado && ambosListos && (
          <input type="number" min="0" value={marcador1}
            onChange={e => setMarcador1(e.target.value)} disabled={cargando}
            style={{
              width: '46px', textAlign: 'center', fontSize: '16px', fontWeight: 800,
              padding: '4px 2px', borderRadius: '8px',
              border: '2px solid #2563eb', outline: 'none',
              color: '#1e293b', background: 'white', flexShrink: 0
            }}
            placeholder="0"
          />
        )}
      </div>

      {/* Separador VS */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 12px', gap: '8px' }}>
        <div style={{ flex: 1, height: '1px', background: s.border }} />
        <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>VS</span>
        <div style={{ flex: 1, height: '1px', background: s.border }} />
      </div>

      {/* Participante 2 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px 10px', gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {avatar(getParticipantName(participante2), ganador2)}
          <span style={{
            fontSize: '13px', fontWeight: ganador2 ? 800 : 600,
            color: ganador2 ? '#15803d' : '#1e293b',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {getParticipantName(participante2)}
          </span>
          {ganador2 && (
            <span style={{
              fontSize: '9px', fontWeight: 700, color: '#16a34a',
              background: '#dcfce7', padding: '2px 7px', borderRadius: '20px',
              whiteSpace: 'nowrap', flexShrink: 0
            }}>🏆 Ganador</span>
          )}
        </div>
        {showScore && (
          <span style={{
            fontSize: '20px', fontWeight: 900,
            color: ganador2 ? '#16a34a' : '#cbd5e1',
            minWidth: '28px', textAlign: 'center', flexShrink: 0
          }}>
            {encuentro.marcador_2 ?? '-'}
          </span>
        )}
        {!readOnly && programado && ambosListos && (
          <input type="number" min="0" value={marcador2}
            onChange={e => setMarcador2(e.target.value)} disabled={cargando}
            style={{
              width: '46px', textAlign: 'center', fontSize: '16px', fontWeight: 800,
              padding: '4px 2px', borderRadius: '8px',
              border: '2px solid #2563eb', outline: 'none',
              color: '#1e293b', background: 'white', flexShrink: 0
            }}
            placeholder="0"
          />
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 12px 8px',
        borderTop: `1px solid ${s.border}`,
        background: 'rgba(255,255,255,0.6)',
        gap: '8px'
      }}>
        <span style={{
          fontSize: '10px', color: '#94a3b8',
          display: 'flex', alignItems: 'center', gap: '4px'
        }}>
          <MapPin size={11} />
          {encuentro.cancha_asignada || 'Por asignar'}
          {encuentro.hora_programada && (
            <span style={{ marginLeft: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={11} />{formatTime(encuentro.hora_programada)}
            </span>
          )}
        </span>

        {error && (
          <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>⚠ {error}</span>
        )}

        {!readOnly && programado && ambosListos && (
          <button onClick={guardar} disabled={cargando} style={{
            background: cargando ? '#94a3b8' : '#2563eb',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '5px 14px', fontSize: '11px', fontWeight: 700,
            cursor: cargando ? 'not-allowed' : 'pointer',
            boxShadow: cargando ? 'none' : '0 2px 6px rgba(37,99,235,0.3)',
            whiteSpace: 'nowrap', flexShrink: 0
          }}>
            {cargando ? '⏳' : '💾 Guardar'}
          </button>
        )}
      </div>
    </article>
  );
}

function AccionesTorneo({ torneo, onActualizar, readOnly = false }) {
  if (readOnly) return null;
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const llamar = async (endpoint) => {
    setCargando(true);
    setMensaje(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/torneos/${torneo.torneo_id}/${endpoint}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error || 'Error al ejecutar acción' });
        return;
      }
      setMensaje({ tipo: 'ok', texto: data.message || '✅ Listo' });
      if (onActualizar) onActualizar();
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' });
    } finally {
      setCargando(false);
    }
  };

  const estadoReal = torneo.estado;
  if (!['Abierto', 'Inscripciones_cerradas'].includes(estadoReal)) return null;

  return (
    <div style={{
      background: '#f8fafc', border: '1px solid #e2e8f0',
      borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem'
    }}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '12px', fontWeight: 700, color: '#475569' }}>
        ⚙️ Gestión del torneo
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {estadoReal === 'Abierto' && (
          <button
            onClick={() => { if (window.confirm('¿Cerrar inscripciones y generar el bracket?')) llamar('cerrar-inscripciones'); }}
            disabled={cargando}
            style={{
              background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white', border: 'none', borderRadius: '8px',
              padding: '7px 16px', fontSize: '12px', fontWeight: 700,
              cursor: cargando ? 'not-allowed' : 'pointer'
            }}>
            {cargando ? '⏳...' : '🔒 Cerrar inscripciones'}
          </button>
        )}
        {estadoReal === 'Inscripciones_cerradas' && (
          <button
            onClick={() => { if (window.confirm('¿Confirmar bracket y poner el torneo En_curso?')) llamar('confirmar-bracket'); }}
            disabled={cargando}
            style={{
              background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white', border: 'none', borderRadius: '8px',
              padding: '7px 16px', fontSize: '12px', fontWeight: 700,
              cursor: cargando ? 'not-allowed' : 'pointer'
            }}>
            {cargando ? '⏳...' : '✅ Confirmar bracket'}
          </button>
        )}
      </div>
      {mensaje && (
        <p style={{
          margin: '0.75rem 0 0', fontSize: '12px', fontWeight: 600,
          color: mensaje.tipo === 'ok' ? '#15803d' : '#dc2626'
        }}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

function TournamentBracket({
  title = 'Torneos y brackets',
  subtitle = 'Consulta los torneos activos y sus encuentros por ronda.',
  initialDisciplinaId = '',
  initialEstado = '',
  showFilters = true,
  estadoOptions = DEFAULT_ESTADO_OPTIONS,
  readOnly = false
}) {
  const [filters, setFilters] = useState({ disciplina_id: initialDisciplinaId, estado: initialEstado });
  const [appliedFilters, setAppliedFilters] = useState({ disciplina_id: initialDisciplinaId, estado: initialEstado });
  const [torneos, setTorneos] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState(null);
  const [bracket, setBracket] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [loadingTorneos, setLoadingTorneos] = useState(false);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [torneosError, setTorneosError] = useState('');
  const [bracketError, setBracketError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function loadDisciplinas() {
      try {
        const payload = await apiRequest('/disciplinas', { signal: controller.signal });
        setDisciplinas(unwrapList(payload, ['data', 'disciplinas']));
      } catch (error) {
        if (error?.name !== 'AbortError') setDisciplinas([]);
      }
    }
    loadDisciplinas();
    return () => controller.abort();
  }, []);

  const cargarTorneos = async (signal) => {
    setLoadingTorneos(true);
    setTorneosError('');
    try {
      const payload = await apiRequest(buildTorneosPath(appliedFilters), { signal });
      const nextTorneos = unwrapList(payload, ['data', 'torneos']);
      setTorneos(nextTorneos);
      setSelectedTorneo(current => {
        if (!current) return null;
        return nextTorneos.find(t => String(t.torneo_id) === String(current.torneo_id)) || null;
      });
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudieron cargar los torneos');
      if (message) { setTorneos([]); setSelectedTorneo(null); setTorneosError(message); }
    } finally {
      setLoadingTorneos(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    cargarTorneos(controller.signal);
    return () => controller.abort();
  }, [appliedFilters]);

  useEffect(() => {
    if (!selectedTorneo?.torneo_id) { setBracket([]); setBracketError(''); return; }
    const controller = new AbortController();
    async function loadBracket() {
      setLoadingBracket(true);
      setBracketError('');
      try {
        const payload = await apiRequest(`/torneos/${selectedTorneo.torneo_id}/bracket`, { signal: controller.signal });
        setBracket(unwrapList(payload, ['data', 'bracket']));
      } catch (error) {
        const message = getErrorMessage(error, 'No se pudo cargar el bracket');
        if (message) { setBracket([]); setBracketError(message); }
      } finally {
        setLoadingBracket(false);
      }
    }
    loadBracket();
    return () => controller.abort();
  }, [selectedTorneo]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setAppliedFilters({ disciplina_id: filters.disciplina_id.trim(), estado: filters.estado });
  };

  const handleClearFilters = () => {
    const empty = { disciplina_id: '', estado: '' };
    setFilters(empty);
    setAppliedFilters(empty);
  };

  const handleTorneoActualizado = () => {
    cargarTorneos();
    setSelectedTorneo(prev => prev ? { ...prev } : null);
  };

  const hasBracket = bracket.some(r => Array.isArray(r.encuentros) && r.encuentros.length > 0);

  return (
    <section className="tb-shell">
      <header className="tb-header">
        <div>
          <span className="tb-eyebrow"><Trophy size={16} />Dashboard deportivo</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>

      {showFilters && (
        <form className="tb-filters" onSubmit={handleFilterSubmit}>
          <label>
            <span>Disciplina</span>
            {disciplinas.length > 0 ? (
              <select value={filters.disciplina_id}
                onChange={e => setFilters(c => ({ ...c, disciplina_id: e.target.value }))}>
                <option value="">Todas</option>
                {disciplinas.map(d => (
                  <option key={d.disciplina_id} value={d.disciplina_id}>{d.nombre}</option>
                ))}
              </select>
            ) : (
              <input type="number" min="1" value={filters.disciplina_id}
                onChange={e => setFilters(c => ({ ...c, disciplina_id: e.target.value }))}
                placeholder="ID de disciplina" />
            )}
          </label>
          <label>
            <span>Estado</span>
            <select value={filters.estado}
              onChange={e => setFilters(c => ({ ...c, estado: e.target.value }))}>
              <option value="">Todos</option>
              {estadoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <div className="tb-filter-actions">
            <button type="submit" className="tb-primary-button"><Filter size={16} />Aplicar</button>
            <button type="button" className="tb-secondary-button" onClick={handleClearFilters}>
              <RotateCcw size={16} />Limpiar
            </button>
          </div>
        </form>
      )}

      <div className="tb-layout">
        <aside className="tb-tournament-panel">
          <div className="tb-panel-title">
            <strong>Torneos</strong>
            <span>{torneos.length}</span>
          </div>
          <div className="tb-list-head">
            <span>Torneo</span><span>Inicio</span><span>Fin</span><span>Estado</span>
          </div>
          {loadingTorneos && <div className="tb-loading">Cargando torneos...</div>}
          {torneosError && <div className="tb-error">{torneosError}</div>}
          {!loadingTorneos && !torneosError && torneos.length === 0 && (
            <EmptyState title="No hay torneos" message="Cuando existan torneos aparecerán aquí." />
          )}
          {!loadingTorneos && !torneosError && torneos.length > 0 && (
            <div className="tb-tournament-list">
              {torneos.map(t => (
                <TournamentRow key={t.torneo_id} torneo={t}
                  selected={selectedTorneo?.torneo_id === t.torneo_id}
                  onSelect={setSelectedTorneo} />
              ))}
            </div>
          )}
        </aside>

        <div className="tb-bracket-panel">
          {!selectedTorneo && (
            <EmptyState title="Selecciona un torneo" message="El bracket se cargará al elegir un torneo." />
          )}

          {selectedTorneo && (
            <>
              <div className="tb-selected-header">
                <div>
                  <span>{selectedTorneo.nombre_disciplina || 'Disciplina'}</span>
                  <h3>{selectedTorneo.nombre || `Torneo #${selectedTorneo.torneo_id}`}</h3>
                </div>
                <span className="tb-tournament-status">{selectedTorneo.estado || 'Sin estado'}</span>
              </div>

              <AccionesTorneo torneo={selectedTorneo} onActualizar={handleTorneoActualizado} readOnly={readOnly} />

              {loadingBracket && <div className="tb-loading">Cargando bracket...</div>}
              {bracketError && <div className="tb-error">{bracketError}</div>}

              {!loadingBracket && !bracketError && !hasBracket && (
                <EmptyState title="Este torneo no tiene bracket"
                  message="Cierra las inscripciones para generar el bracket." />
              )}

              {!loadingBracket && !bracketError && hasBracket && (
                <div className="tb-rounds">
                  {bracket.slice().sort((a, b) => Number(a.ronda) - Number(b.ronda)).map(ronda => (
                    <section key={ronda.ronda} className="tb-round-column">
                      <header className="tb-round-title">
                        <span>Ronda</span>
                        <strong>{ronda.ronda}</strong>
                      </header>
                      <div className="tb-round-matches">
                        {(ronda.encuentros || []).map(encuentro => (
                          <MatchCard
                            key={encuentro.encuentro_id}
                            encuentro={encuentro}
                            onResultadoGuardado={() => setSelectedTorneo(prev => ({ ...prev }))}
                            readOnly={readOnly}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default TournamentBracket;