import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Clock, Edit2, Filter, MapPin, Plus, RotateCcw, Trophy, Users, X } from 'lucide-react';
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
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
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
  const estadoColor = {
    'Abierto': '#22c55e',
    'Inscripciones_cerradas': '#f59e0b',
    'En_curso': '#3b82f6',
    'Finalizado': '#64748b',
  }[torneo.estado] || '#94a3b8';

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
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '2px 8px',
        borderRadius: '20px', background: `${estadoColor}20`, color: estadoColor,
        whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: '4px'
      }}>
        {torneo.estado || 'Sin estado'}
      </span>
    </button>
  );
}

function MatchParticipant({ participante, winner }) {
  return (
    <div className={`tb-participant ${winner ? 'is-winner' : ''}`}>
      <span className="tb-participant-name">{getParticipantName(participante)}</span>
      {winner && <span className="tb-winner-label">Ganador</span>}
    </div>
  );
}

function MatchCard({ encuentro, onResultadoGuardado, readOnly }) {
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
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState(null);
  const [editando, setEditando]   = useState(false);

  const showScore   = finalizado && (encuentro.marcador_1 != null || encuentro.marcador_2 != null);
  const puedeEditar = finalizado && !readOnly;
  const puedeGuardar = (programado || (finalizado && editando)) && ambosListos;

  const guardar = async (esEdicion = false) => {
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
      const body = { marcador_1: m1, marcador_2: m2 };
      if (esEdicion) body.allowEdit = true;
      const res = await fetch(
        `http://localhost:3000/api/encuentros/${encuentro.encuentro_id}/resultado`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      setEditando(false);
      if (onResultadoGuardado) onResultadoGuardado();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  return (
    <article className={`tb-match-card tb-match-${estado || 'default'}`}>
      <header className="tb-match-header">
        <span>#{encuentro.encuentro_id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className={`tb-estado-badge tb-estado-${estado}`}>{estado}</span>
          {puedeEditar && !editando && (
            <button onClick={() => { setEditando(true); setMarcador1(String(encuentro.marcador_1 ?? '')); setMarcador2(String(encuentro.marcador_2 ?? '')); }}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Edit2 size={10} /> Editar
            </button>
          )}
          {editando && (
            <button onClick={() => setEditando(false)}
              style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px', color: '#dc2626' }}>
              Cancelar
            </button>
          )}
        </div>
      </header>

      <div className="tb-match-body">
        <MatchParticipant participante={participante1} winner={isWinner(encuentro, participante1)} />

        <div className="tb-versus-row">
          {(programado && ambosListos) || editando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="number" min="0" value={marcador1}
                onChange={e => setMarcador1(e.target.value)} disabled={cargando}
                style={{ width: '48px', textAlign: 'center', fontWeight: 800, fontSize: '14px', padding: '4px', borderRadius: '6px', border: '2px solid #3b82f6', outline: 'none' }}
                placeholder="0" />
              <span style={{ fontWeight: 800, color: '#94a3b8' }}>-</span>
              <input type="number" min="0" value={marcador2}
                onChange={e => setMarcador2(e.target.value)} disabled={cargando}
                style={{ width: '48px', textAlign: 'center', fontWeight: 800, fontSize: '14px', padding: '4px', borderRadius: '6px', border: '2px solid #3b82f6', outline: 'none' }}
                placeholder="0" />
            </div>
          ) : (
            <span>VS</span>
          )}
          {showScore && !editando && (
            <span className="tb-score-wrap">
              <span className="tb-score-label">Marcador</span>
              <strong className="tb-score-chip">
                {encuentro.marcador_1 ?? '-'} - {encuentro.marcador_2 ?? '-'}
              </strong>
            </span>
          )}
        </div>

        <MatchParticipant participante={participante2} winner={isWinner(encuentro, participante2)} />
      </div>

      {error && (
        <p style={{ color: '#dc2626', fontSize: '11px', margin: '4px 8px 0', fontWeight: 600 }}>⚠ {error}</p>
      )}

      {puedeGuardar && ambosListos && (
        <div style={{ padding: '8px 8px 4px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => guardar(editando)} disabled={cargando} style={{
            background: cargando ? '#94a3b8' : editando ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
            color: 'white', border: 'none', borderRadius: '6px',
            padding: '5px 14px', fontSize: '12px', fontWeight: 700,
            cursor: cargando ? 'not-allowed' : 'pointer'
          }}>
            {cargando ? '⏳' : editando ? '✏️ Actualizar' : '💾 Guardar'}
          </button>
        </div>
      )}

      <footer className="tb-match-meta">
        <span className="tb-court-chip"><MapPin size={14} />Cancha: {encuentro.cancha_asignada || 'Por asignar'}</span>
        {encuentro.hora_programada && <span><Clock size={14} />{formatTime(encuentro.hora_programada)}</span>}
      </footer>
    </article>
  );
}

function AccionesTorneo({ torneo, onActualizar, readOnly }) {
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje]   = useState(null);

  const llamar = async (endpoint) => {
    setCargando(true);
    setMensaje(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/torneos/${torneo.torneo_id}/${endpoint}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { setMensaje({ tipo: 'error', texto: data.error || 'Error' }); return; }
      setMensaje({ tipo: 'ok', texto: data.message || '✅ Listo' });
      if (onActualizar) onActualizar();
    } catch { setMensaje({ tipo: 'error', texto: 'Error de conexión' }); }
    finally { setCargando(false); }
  };

  const estadoReal = torneo.estado;
  if (readOnly && !['Abierto', 'Inscripciones_cerradas', 'En_curso'].includes(estadoReal)) return null;

  const mostrarBotones = !readOnly && ['Abierto', 'Inscripciones_cerradas', 'En_curso'].includes(estadoReal);
  if (!mostrarBotones) return null;

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '12px', fontWeight: 700, color: '#475569' }}>⚙️ Gestión del torneo</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {estadoReal === 'Abierto' && (
          <button onClick={() => { if (window.confirm('¿Cerrar inscripciones y generar el bracket?')) llamar('cerrar-inscripciones'); }}
            disabled={cargando} style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer' }}>
            {cargando ? '⏳...' : '🔒 Cerrar inscripciones'}
          </button>
        )}
        {estadoReal === 'Inscripciones_cerradas' && (
          <button onClick={() => { if (window.confirm('¿Confirmar bracket?')) llamar('confirmar-bracket'); }}
            disabled={cargando} style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer' }}>
            {cargando ? '⏳...' : '✅ Confirmar bracket'}
          </button>
        )}
        {estadoReal === 'En_curso' && (
          <button onClick={() => { if (window.confirm('¿Finalizar el torneo? Esta acción no se puede deshacer.')) llamar('finalizar'); }}
            disabled={cargando} style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer' }}>
            {cargando ? '⏳...' : '🏆 Finalizar torneo'}
          </button>
        )}
      </div>
      {mensaje && (
        <p style={{ margin: '0.75rem 0 0', fontSize: '12px', fontWeight: 600, color: mensaje.tipo === 'ok' ? '#15803d' : '#dc2626' }}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

function DetalleTorneo({ torneo }) {
  if (!torneo) return null;
  const estadoColor = {
    'Abierto': { color: '#15803d', bg: '#dcfce7' },
    'Inscripciones_cerradas': { color: '#b45309', bg: '#fef3c7' },
    'En_curso': { color: '#1d4ed8', bg: '#dbeafe' },
    'Finalizado': { color: '#475569', bg: '#f1f5f9' },
  }[torneo.estado] || { color: '#475569', bg: '#f1f5f9' };

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {torneo.nombre_disciplina || 'Disciplina'}
          </p>
          <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
            {torneo.nombre || `Torneo #${torneo.torneo_id}`}
          </h3>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: estadoColor.bg, color: estadoColor.color }}>
          {torneo.estado}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
          <Calendar size={13} /> <span><strong>Inicio:</strong> {formatDate(torneo.fecha_inicio)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
          <Calendar size={13} /> <span><strong>Fin:</strong> {formatDate(torneo.fecha_fin)}</span>
        </div>
      </div>
    </div>
  );
}

function TournamentBracket({
  title = 'Torneos y brackets',
  subtitle = 'Consulta los torneos activos y sus encuentros por ronda.',
  initialDisciplinaId = '',
  initialEstado = '',
  showFilters = true,
  readOnly = false,
  estadoOptions = DEFAULT_ESTADO_OPTIONS
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
  const [showTorneoModal, setShowTorneoModal] = useState(false);
  const [editingTorneo, setEditingTorneo] = useState(null);
  const [formTorneo, setFormTorneo] = useState({ nombre: '', disciplina_id: '', fecha_inicio: '', fecha_fin: '', estado: 'Abierto' });
  const [torneoFormErrors, setTorneoFormErrors] = useState({});
  const [savingTorneo, setSavingTorneo] = useState(false);
  const [showParticipantes, setShowParticipantes] = useState(false);
  const [participantes, setParticipantes] = useState([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);

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

  const openCreateModal = () => {
    setEditingTorneo(null);
    setFormTorneo({ nombre: '', disciplina_id: '', fecha_inicio: '', fecha_fin: '', estado: 'Abierto' });
    setTorneoFormErrors({});
    setShowTorneoModal(true);
  };

  const openEditModal = (torneo) => {
    setEditingTorneo(torneo);
    setFormTorneo({
      nombre: torneo.nombre || '',
      disciplina_id: String(torneo.disciplina_id || ''),
      fecha_inicio: torneo.fecha_inicio ? String(torneo.fecha_inicio).split('T')[0] : '',
      fecha_fin: torneo.fecha_fin ? String(torneo.fecha_fin).split('T')[0] : '',
      estado: torneo.estado || 'Abierto'
    });
    setTorneoFormErrors({});
    setShowTorneoModal(true);
  };

  const validateTorneoForm = () => {
    const errors = {};
    if (!formTorneo.nombre.trim()) errors.nombre = 'El nombre es requerido';
    if (!formTorneo.disciplina_id) errors.disciplina_id = 'La disciplina es requerida';
    if (formTorneo.fecha_inicio && formTorneo.fecha_fin && formTorneo.fecha_fin < formTorneo.fecha_inicio) {
      errors.fecha_fin = 'La fecha fin no puede ser anterior a la fecha inicio';
    }
    return errors;
  };

  const handleSaveTorneo = async (e) => {
    e.preventDefault();
    const errors = validateTorneoForm();
    if (Object.keys(errors).length > 0) { setTorneoFormErrors(errors); return; }
    setSavingTorneo(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        nombre: formTorneo.nombre.trim(),
        disciplina_id: Number(formTorneo.disciplina_id),
        fecha_inicio: formTorneo.fecha_inicio || null,
        fecha_fin: formTorneo.fecha_fin || null,
        estado: formTorneo.estado
      };
      const url = editingTorneo
        ? `http://localhost:3000/api/torneos/${editingTorneo.torneo_id}`
        : 'http://localhost:3000/api/torneos';
      const res = await fetch(url, {
        method: editingTorneo ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { setTorneoFormErrors({ general: data.error || 'Error al guardar' }); return; }
      setShowTorneoModal(false);
      await cargarTorneos();
    } catch {
      setTorneoFormErrors({ general: 'Error de conexión' });
    } finally {
      setSavingTorneo(false);
    }
  };

  const handleVerParticipantes = async (torneo) => {
    setShowParticipantes(true);
    setLoadingParticipantes(true);
    setParticipantes([]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/torneos/${torneo.torneo_id}/participantes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setParticipantes(data.participantes || data.data || []);
    } catch {
      setParticipantes([]);
    } finally {
      setLoadingParticipantes(false);
    }
  };

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

      {/* Layout: lista izquierda + detalle/bracket derecha */}
      <div className="tb-split-layout">

        {/* Panel izquierdo — lista de torneos */}
        <aside className="tb-side-list">
          <div className="tb-panel-title">
            <strong>Torneos</strong>
            <span>{torneos.length}</span>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={openCreateModal}
              style={{ width: '100%', marginBottom: 10, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Plus size={15} /> Nuevo Torneo
            </button>
          )}
          {loadingTorneos && <div className="tb-loading">Cargando...</div>}
          {torneosError && <div className="tb-error">{torneosError}</div>}
          {!loadingTorneos && !torneosError && torneos.length === 0 && (
            <EmptyState title="No hay torneos" message="Cuando existan torneos aparecerán aquí." />
          )}
          {!loadingTorneos && !torneosError && torneos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {torneos.map(t => (
                <TournamentRow key={t.torneo_id} torneo={t}
                  selected={selectedTorneo?.torneo_id === t.torneo_id}
                  onSelect={setSelectedTorneo} />
              ))}
            </div>
          )}
        </aside>

        {/* Panel derecho — detalles + bracket */}
        <div className="tb-detail-side">
          {!selectedTorneo ? (
            <div className="tb-detail-placeholder">
              <EmptyState title="Selecciona un torneo" message="Los detalles y bracket aparecerán aquí." />
            </div>
          ) : (
            <>
              {/* Detalle del torneo */}
              <DetalleTorneo torneo={selectedTorneo} />

              {/* Botones de gestión */}
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedTorneo)}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#1e3a5f' }}
                  >
                    <Edit2 size={13} /> Editar torneo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerParticipantes(selectedTorneo)}
                    style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#1d4ed8' }}
                  >
                    <Users size={13} /> Inscritos ({selectedTorneo.total_participantes ?? 0})
                  </button>
                </div>
              )}

              {/* Acciones */}
              <AccionesTorneo torneo={selectedTorneo} onActualizar={handleTorneoActualizado} readOnly={readOnly} />

              {/* Bracket */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                {loadingBracket && <div className="tb-loading">Cargando bracket...</div>}
                {bracketError && <div className="tb-error">{bracketError}</div>}
                {!loadingBracket && !bracketError && !hasBracket && (
                  <EmptyState title="Sin bracket" message="Cierra las inscripciones para generar el bracket." />
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
              </div>
            </>
          )}
        </div>
      </div>
      {/* Modal crear/editar torneo */}
      {showTorneoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                {editingTorneo ? 'Editar Torneo' : 'Nuevo Torneo'}
              </h3>
              <button onClick={() => setShowTorneoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={22} /></button>
            </div>
            <form onSubmit={handleSaveTorneo}>
              <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {torneoFormErrors.general && (
                  <p style={{ margin: 0, color: '#dc2626', fontWeight: 600, fontSize: 13 }}>{torneoFormErrors.general}</p>
                )}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>Nombre <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={formTorneo.nombre} onChange={e => setFormTorneo(p => ({ ...p, nombre: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${torneoFormErrors.nombre ? '#ef4444' : '#cbd5e1'}`, fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="Ej: Copa Verano 2025" />
                  {torneoFormErrors.nombre && <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: 12 }}>{torneoFormErrors.nombre}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>Disciplina <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={formTorneo.disciplina_id} onChange={e => setFormTorneo(p => ({ ...p, disciplina_id: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${torneoFormErrors.disciplina_id ? '#ef4444' : '#cbd5e1'}`, fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="">Seleccionar disciplina</option>
                    {disciplinas.map(d => <option key={d.disciplina_id} value={d.disciplina_id}>{d.nombre}</option>)}
                  </select>
                  {torneoFormErrors.disciplina_id && <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: 12 }}>{torneoFormErrors.disciplina_id}</p>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>Fecha inicio</label>
                    <input type="date" value={formTorneo.fecha_inicio} onChange={e => setFormTorneo(p => ({ ...p, fecha_inicio: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>Fecha fin</label>
                    <input type="date" value={formTorneo.fecha_fin} onChange={e => setFormTorneo(p => ({ ...p, fecha_fin: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${torneoFormErrors.fecha_fin ? '#ef4444' : '#cbd5e1'}`, fontSize: 14, boxSizing: 'border-box' }} />
                    {torneoFormErrors.fecha_fin && <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: 12 }}>{torneoFormErrors.fecha_fin}</p>}
                  </div>
                </div>
                {editingTorneo && (
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>Estado</label>
                    <select value={formTorneo.estado} onChange={e => setFormTorneo(p => ({ ...p, estado: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}>
                      {DEFAULT_ESTADO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" onClick={() => setShowTorneoModal(false)} disabled={savingTorneo}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingTorneo}
                  style={{ background: savingTorneo ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#3b82f6)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: savingTorneo ? 'not-allowed' : 'pointer' }}>
                  {savingTorneo ? 'Guardando...' : editingTorneo ? 'Actualizar' : 'Crear Torneo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ver participantes */}
      {showParticipantes && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                  Inscritos — {selectedTorneo?.nombre}
                </h3>
                {!loadingParticipantes && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: participantes.length >= 4 ? '#15803d' : '#b45309', fontWeight: 700 }}>
                    {participantes.length} participante{participantes.length !== 1 ? 's' : ''} —
                    {participantes.length >= 4 ? ' ✅ Se realizará (mínimo 4 alcanzado)' : ` ⚠️ Faltan ${4 - participantes.length} para realizarse`}
                  </p>
                )}
              </div>
              <button onClick={() => setShowParticipantes(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={22} /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.5rem' }}>
              {loadingParticipantes && <p style={{ color: '#64748b', textAlign: 'center' }}>Cargando...</p>}
              {!loadingParticipantes && participantes.length === 0 && (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No hay participantes inscritos aún.</p>
              )}
              {!loadingParticipantes && participantes.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>Participante</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>Tipo</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantes.map((p, i) => (
                      <tr key={p.participante_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '8px 4px', fontWeight: 600, color: '#0f172a' }}>{p.nombre_participante}</td>
                        <td style={{ padding: '8px 4px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: p.tipo_participante === 'Socio' ? '#dbeafe' : p.tipo_participante === 'Visita' ? '#dcfce7' : '#f1f5f9',
                            color: p.tipo_participante === 'Socio' ? '#1d4ed8' : p.tipo_participante === 'Visita' ? '#15803d' : '#475569' }}>
                            {p.tipo_participante}
                          </span>
                        </td>
                        <td style={{ padding: '8px 4px', color: '#64748b', fontSize: 12 }}>{p.categoria || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowParticipantes(false)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default TournamentBracket;
