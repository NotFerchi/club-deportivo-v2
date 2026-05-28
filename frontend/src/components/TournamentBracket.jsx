import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle, Clock, Edit2, Filter, Lock, Loader2, MapPin, Plus, RotateCcw, Save, Trash2, Trophy, UserPlus, Users, X } from 'lucide-react';
import { apiRequest, unwrapList, API_BASE_URL } from '../services/api';
import { useNotification } from '../context/NotificationContext';
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
  const puedeGuardar = !readOnly && (programado || (finalizado && editando)) && ambosListos;

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
        `${API_BASE_URL}/encuentros/${encuentro.encuentro_id}/resultado`,
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
          {!readOnly && ((programado && ambosListos) || editando) ? (
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
            cursor: cargando ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px'
          }}>
            {cargando
              ? <><Loader2 size={13} className="icon-spin" /> Guardando...</>
              : editando
                ? <><Edit2 size={13} /> Actualizar</>
                : <><Save size={13} /> Guardar</>}
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
  const { showConfirm } = useNotification();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje]   = useState(null);

  const llamar = async (endpoint) => {
    setCargando(true);
    setMensaje(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/torneos/${torneo.torneo_id}/${endpoint}`, {
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
  if (readOnly) return null;

  const mostrarBotones = !readOnly && !['Cancelado', 'Finalizado'].includes(estadoReal);
  if (!mostrarBotones) return null;

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '12px', fontWeight: 700, color: '#475569' }}>⚙️ Gestión del torneo</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {estadoReal === 'Abierto' && (
          <button onClick={async () => { if (await showConfirm('¿Cerrar inscripciones y generar el bracket?', { confirmLabel: 'Cerrar inscripciones' })) llamar('cerrar-inscripciones'); }}
            disabled={cargando} style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {cargando ? <><Loader2 size={13} className="icon-spin" /> Cerrando...</> : <><Lock size={13} /> Cerrar inscripciones</>}
          </button>
        )}
        {estadoReal === 'Inscripciones_cerradas' && (
          <button onClick={async () => { if (await showConfirm('¿Confirmar bracket?', { confirmLabel: 'Confirmar' })) llamar('confirmar-bracket'); }}
            disabled={cargando} style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {cargando ? <><Loader2 size={13} className="icon-spin" /> Confirmando...</> : <><CheckCircle size={13} /> Confirmar bracket</>}
          </button>
        )}
        {estadoReal === 'En_curso' && (
          <button onClick={async () => { if (await showConfirm('¿Finalizar el torneo? Esta acción no se puede deshacer.', { danger: true, confirmLabel: 'Finalizar' })) llamar('finalizar'); }}
            disabled={cargando} style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {cargando ? <><Loader2 size={13} className="icon-spin" /> Finalizando...</> : <><Trophy size={13} /> Finalizar torneo</>}
          </button>
        )}
        <button onClick={() => { if (window.confirm('¿Cancelar el torneo? Esta acción no se puede deshacer.')) llamar('cancelar'); }}
          disabled={cargando} style={{ background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <X size={13} /> Cancelar torneo
        </button>
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

// ─── InscribirModal ───────────────────────────────────────────────────────────
function InscribirModal({ torneo, socios, categorias, onClose, onInscribir }) {
  const esEquipos = torneo?.tipo_torneo === 'Equipos';
  const [tipo, setTipo] = useState(esEquipos ? 'externo' : 'socio');
  const [socioId, setSocioId] = useState('');
  const [nombreExterno, setNombreExterno] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {};
    if (categoriaId) payload.categoria_id = Number(categoriaId);
    if (esEquipos || tipo === 'externo') {
      if (!nombreExterno.trim()) { setError(esEquipos ? 'Ingresa el nombre del equipo' : 'Ingresa el nombre'); return; }
      payload.nombre_externo = nombreExterno.trim();
    } else {
      if (!socioId) { setError('Selecciona un socio'); return; }
      payload.socio_id = Number(socioId);
    }
    setCargando(true);
    try {
      await apiRequest(`/torneos/${torneo.torneo_id}/inscribir`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      onInscribir();
    } catch (err) {
      setError(err.message || 'Error al inscribir');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Inscribir participante</h3>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b' }}>{torneo.nombre} · <strong>{torneo.tipo_torneo || 'Individual'}</strong></p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <p style={{ margin: 0, color: '#dc2626', fontWeight: 600, fontSize: 12 }}>⚠ {error}</p>}
            {!esEquipos && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#374151' }}>Tipo de participante</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: 'socio', l: 'Socio del club' }, { v: 'externo', l: 'Externo' }].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setTipo(opt.v)} style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12,
                      border: `2px solid ${tipo === opt.v ? '#3b82f6' : '#e2e8f0'}`,
                      background: tipo === opt.v ? '#eff6ff' : 'white',
                      color: tipo === opt.v ? '#1d4ed8' : '#475569',
                      fontWeight: tipo === opt.v ? 700 : 400, cursor: 'pointer'
                    }}>{opt.l}</button>
                  ))}
                </div>
              </div>
            )}
            {(esEquipos || tipo === 'externo') ? (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                  {esEquipos ? 'Nombre del equipo' : 'Nombre del participante'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input value={nombreExterno} onChange={e => setNombreExterno(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                  placeholder={esEquipos ? 'Ej. Águilas FC' : 'Ej. Juan Pérez'} />
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                  Socio <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select value={socioId} onChange={e => setSocioId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">Seleccionar socio</option>
                  {socios.map(s => (
                    <option key={s.socio_id} value={s.socio_id}>
                      {[s.nombres, s.apellido_paterno, s.apellido_materno].filter(Boolean).join(' ')}
                      {s.numero_socio ? ` — ${s.numero_socio}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {categorias.length > 0 && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>Categoría</label>
                <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <button type="button" onClick={onClose} disabled={cargando}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button type="submit" disabled={cargando}
              style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#3b82f6)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              {cargando ? <><Loader2 size={13} /> Inscribiendo...</> : <><UserPlus size={13} /> Inscribir</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── MatchEditPanel ───────────────────────────────────────────────────────────
function MatchEditPanel({ encuentro, onClose, onSaved, readOnly, espacios = [] }) {
  const est  = normalizeEstado(encuentro.estado);
  const done = est === 'finalizado';
  const p1   = encuentro.participante_1 || {};
  const p2   = encuentro.participante_2 || {};
  const w1   = isWinner(encuentro, p1);
  const w2   = isWinner(encuentro, p2);

  const [editMode, setEditMode] = useState(false);
  const [m1,       setM1]       = useState(String(encuentro.marcador_1 ?? ''));
  const [m2,       setM2]       = useState(String(encuentro.marcador_2 ?? ''));
  const [cancha,   setCancha]   = useState(encuentro.cancha_asignada || '');
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    setM1(String(encuentro.marcador_1 ?? ''));
    setM2(String(encuentro.marcador_2 ?? ''));
    setCancha(encuentro.cancha_asignada || '');
    setEditMode(false);
    setError('');
  }, [encuentro.encuentro_id, encuentro.estado, encuentro.marcador_1, encuentro.marcador_2, encuentro.cancha_asignada]);

  const showInputs    = !readOnly && (est === 'programado' || editMode);
  const ambosListos   = getParticipantName(p1) !== 'Por definir' && getParticipantName(p2) !== 'Por definir';
  const canSaveResult = showInputs && ambosListos;
  const canchaChanged = cancha.trim() !== (encuentro.cancha_asignada || '').trim();

  const guardarResultado = async () => {
    setError('');
    const n1 = parseInt(m1, 10);
    const n2 = parseInt(m2, 10);
    if (!Number.isFinite(n1) || !Number.isFinite(n2) || n1 < 0 || n2 < 0) {
      setError('Marcadores inválidos (enteros ≥ 0)'); return;
    }
    if (n1 === n2) { setError('No se permiten empates'); return; }
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const body = { marcador_1: n1, marcador_2: n2 };
      if (editMode) body.allowEdit = true;
      if (cancha.trim()) body.cancha_asignada = cancha.trim();
      const res = await fetch(`${API_BASE_URL}/encuentros/${encuentro.encuentro_id}/resultado`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      setEditMode(false);
      if (onSaved) onSaved();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  const guardarCancha = async () => {
    if (!cancha.trim()) return;
    setCargando(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/encuentros/${encuentro.encuentro_id}/cancha`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancha_asignada: cancha.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error'); return; }
      if (onSaved) onSaved();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  const inputSt = { width: 52, textAlign: 'center', fontSize: 15, fontWeight: 800, padding: '6px 4px', borderRadius: 8, border: '2px solid #3b82f6', outline: 'none' };

  return (
    <div style={{ marginTop: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Encuentro #{encuentro.encuentro_id}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: done ? '#dcfce7' : est === 'programado' ? '#dbeafe' : '#f1f5f9',
            color: done ? '#15803d' : est === 'programado' ? '#1d4ed8' : '#64748b' }}>
            {done ? 'Finalizado' : est === 'programado' ? 'Programado' : 'Pendiente'}
          </span>
          {encuentro.hora_programada && (
            <span style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} />{formatTime(encuentro.hora_programada)}
            </span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
          <X size={16} />
        </button>
      </div>

      {/* Participants + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
        <span style={{ flex: '1 1 90px', fontWeight: w1 ? 800 : 600, color: w1 ? '#15803d' : '#1e293b', fontSize: 13 }}>
          {w1 && '🏆 '}{getParticipantName(p1)}
        </span>
        {showInputs ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" min="0" value={m1} onChange={e => setM1(e.target.value)} disabled={cargando} style={inputSt} placeholder="0" />
            <span style={{ fontWeight: 800, color: '#94a3b8', fontSize: 13 }}>—</span>
            <input type="number" min="0" value={m2} onChange={e => setM2(e.target.value)} disabled={cargando} style={inputSt} placeholder="0" />
          </div>
        ) : (
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b', background: done ? '#f0fdf4' : '#f1f5f9', padding: '5px 16px', borderRadius: 8, border: `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}` }}>
            {done ? `${encuentro.marcador_1 ?? '-'} — ${encuentro.marcador_2 ?? '-'}` : 'VS'}
          </div>
        )}
        <span style={{ flex: '1 1 90px', textAlign: 'right', fontWeight: w2 ? 800 : 600, color: w2 ? '#15803d' : '#1e293b', fontSize: 13 }}>
          {getParticipantName(p2)}{w2 && ' 🏆'}
        </span>
      </div>

      {/* Cancha */}
      {!readOnly ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
          <MapPin size={14} color="#64748b" style={{ flexShrink: 0 }} />
          {espacios.length > 0 ? (
            <select value={cancha} onChange={e => setCancha(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, outline: 'none', background: 'white' }}>
              <option value="">Sin asignar</option>
              {espacios.map(e => (
                <option key={e.espacio_id} value={e.nombre}>{e.nombre}</option>
              ))}
            </select>
          ) : (
            <input value={cancha} onChange={e => setCancha(e.target.value)}
              placeholder="Asignar espacio"
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, outline: 'none', background: 'white' }} />
          )}
        </div>
      ) : encuentro.cancha_asignada ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem', fontSize: 12, color: '#64748b' }}>
          <MapPin size={13} /> {encuentro.cancha_asignada}
        </div>
      ) : null}

      {error && <p style={{ color: '#dc2626', fontSize: 11, fontWeight: 600, margin: '0 0 8px' }}>⚠ {error}</p>}

      {/* Buttons */}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {done && !editMode && (
            <button onClick={() => { setEditMode(true); setM1(String(encuentro.marcador_1 ?? '')); setM2(String(encuentro.marcador_2 ?? '')); }}
              style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fbbf24', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Edit2 size={11} /> Editar resultado
            </button>
          )}
          {editMode && (
            <button onClick={() => setEditMode(false)}
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
          )}
          {canSaveResult && (
            <button onClick={guardarResultado} disabled={cargando}
              style={{ background: cargando ? '#94a3b8' : editMode ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'linear-gradient(135deg,#2563eb,#3b82f6)', color: 'white', border: 'none', borderRadius: 8, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              {cargando ? <><Loader2 size={11} /> Guardando...</> : <><Save size={11} /> {editMode ? 'Actualizar resultado' : 'Guardar resultado'}</>}
            </button>
          )}
          {canchaChanged && cancha.trim() && !showInputs && (
            <button onClick={guardarCancha} disabled={cargando}
              style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} /> Guardar cancha
            </button>
          )}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Visual SVG Bracket ──────────────────────────────────────────────────────
const BV = { W: 148, PH: 26, SH: 18, CGAP: 48, LH: 24, PAD: 12, VG: 22 };
BV.MH = BV.PH * 2 + BV.SH;
BV.UH = BV.MH + BV.VG;
BV.CS = BV.W + BV.CGAP;

function BracketVisual({ bracket, onMatchClick, selectedId }) {
  const rounds = bracket.slice().sort((a, b) => Number(a.ronda) - Number(b.ronda));
  if (!rounds.length) return null;
  const n1 = rounds[0].encuentros.length;
  if (!n1) return null;

  const { W, PH, SH, CGAP, LH, PAD, VG, MH, UH, CS } = BV;
  const numR = rounds.length;
  const WW = 140;
  const svgW = PAD + numR * CS + WW + PAD;
  const svgH = LH + PAD + n1 * UH + PAD;

  const cy = (ri, ei) => {
    const sp = UH * Math.pow(2, ri);
    return LH + PAD + sp * ei + sp / 2;
  };

  const lastRound = rounds[numR - 1];
  const finalMatch = lastRound?.encuentros?.[0];
  let champion = null;
  if (finalMatch && normalizeEstado(finalMatch.estado) === 'finalizado') {
    if (finalMatch.ganador_nombre) {
      champion = finalMatch.ganador_nombre;
    } else {
      const p = isWinner(finalMatch, finalMatch.participante_1)
        ? finalMatch.participante_1
        : isWinner(finalMatch, finalMatch.participante_2)
        ? finalMatch.participante_2
        : null;
      if (p) champion = getParticipantName(p);
    }
  }

  const trunc = (s, max = 15) => {
    const t = String(s || 'Por definir');
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  };

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', padding: '4px 0' }}>
      <svg width={svgW} height={svgH} style={{ display: 'block', fontFamily: 'system-ui,sans-serif' }}>
        <defs>
          {rounds.map((r, ri) =>
            (r.encuentros || []).map((_, ei) => {
              const x = PAD + ri * CS;
              const y = cy(ri, ei) - MH / 2;
              return (
                <clipPath key={`clip-${ri}-${ei}`} id={`bc-${ri}-${ei}`}>
                  <rect x={x} y={y} width={W} height={MH} rx={7} />
                </clipPath>
              );
            })
          )}
          <linearGradient id="champGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Round labels */}
        {rounds.map((r, ri) => (
          <text key={`lbl-${ri}`}
            x={PAD + ri * CS + W / 2} y={LH - 5}
            textAnchor="middle" fontSize={9} fontWeight={700} fill="#475569">
            {ri === numR - 1 ? 'FINAL' : `RONDA ${r.ronda}`}
          </text>
        ))}

        {/* Connector lines */}
        {rounds.slice(0, -1).map((r, ri) =>
          (r.encuentros || []).map((_, ei) => {
            const nei = Math.floor(ei / 2);
            const x1 = PAD + ri * CS + W;
            const y1 = cy(ri, ei);
            const x2 = PAD + (ri + 1) * CS;
            const y2 = cy(ri + 1, nei);
            const mx = (x1 + x2) / 2;
            return (
              <path key={`ln-${ri}-${ei}`} d={`M${x1} ${y1}H${mx}V${y2}H${x2}`}
                fill="none" stroke="#cbd5e1" strokeWidth={1.5} />
            );
          })
        )}

        {/* Winner arrow */}
        {(() => {
          const x1 = PAD + (numR - 1) * CS + W;
          const y1 = cy(numR - 1, 0);
          const x2 = PAD + numR * CS + 8;
          return <line x1={x1} y1={y1} x2={x2} y2={y1}
            stroke={champion ? '#f59e0b' : '#e2e8f0'} strokeWidth={2}
            strokeDasharray={champion ? '' : '4 3'} />;
        })()}

        {/* Match boxes */}
        {rounds.map((r, ri) =>
          (r.encuentros || []).map((enc, ei) => {
            const bx = PAD + ri * CS;
            const by = cy(ri, ei) - MH / 2;
            const p1 = enc.participante_1 || {};
            const p2 = enc.participante_2 || {};
            const est = normalizeEstado(enc.estado);
            const done = est === 'finalizado';
            const w1 = done && isWinner(enc, p1);
            const w2 = done && isWinner(enc, p2);
            const p1n = trunc(getParticipantName(p1));
            const p2n = trunc(getParticipantName(p2));

            const isSelected = enc.encuentro_id === selectedId;
            return (
              <g key={`m-${r.ronda}-${ei}`}
                onClick={() => onMatchClick && onMatchClick(enc)}
                style={{ cursor: onMatchClick ? 'pointer' : 'default' }}>
                {/* Selection glow */}
                {isSelected && (
                  <rect x={bx - 3} y={by - 3} width={W + 6} height={MH + 6} rx={10}
                    fill="#eff6ff" stroke="#2563eb" strokeWidth={1.5} opacity={0.6} />
                )}
                {/* Border box */}
                <rect x={bx} y={by} width={W} height={MH} rx={7}
                  fill="white"
                  stroke={isSelected ? '#2563eb' : done ? '#10b981' : est === 'programado' ? '#3b82f6' : '#e2e8f0'}
                  strokeWidth={isSelected ? 2.5 : done ? 1.5 : 1} />
                {/* Clipped backgrounds */}
                <g clipPath={`url(#bc-${ri}-${ei})`}>
                  <rect x={bx} y={by} width={W} height={PH} fill={w1 ? '#dcfce7' : '#f8fafc'} />
                  <rect x={bx} y={by + PH} width={W} height={SH} fill={done ? '#f0fdf4' : '#f8fafc'} />
                  <rect x={bx} y={by + PH + SH} width={W} height={PH} fill={w2 ? '#dcfce7' : 'white'} />
                  <line x1={bx} y1={by + PH} x2={bx + W} y2={by + PH} stroke="#e2e8f0" strokeWidth={0.8} />
                  <line x1={bx} y1={by + PH + SH} x2={bx + W} y2={by + PH + SH} stroke="#e2e8f0" strokeWidth={0.8} />
                </g>
                {/* P1 name */}
                <text x={bx + 7} y={by + PH / 2 + 4} fontSize={10}
                  fill={w1 ? '#15803d' : p1n === 'Por definir' ? '#94a3b8' : '#1e293b'}
                  fontWeight={w1 ? 700 : 500}>
                  {p1n}
                </text>
                {done && enc.marcador_1 != null && (
                  <text x={bx + W - 6} y={by + PH / 2 + 4} textAnchor="end"
                    fontSize={10} fontWeight={800} fill={w1 ? '#15803d' : '#64748b'}>
                    {enc.marcador_1}
                  </text>
                )}
                {/* Center label */}
                <text x={bx + W / 2} y={by + PH + SH / 2 + 4} textAnchor="middle"
                  fontSize={8} fontWeight={700} fill={done ? '#16a34a' : '#94a3b8'}>
                  {done
                    ? `${enc.marcador_1 ?? '-'} — ${enc.marcador_2 ?? '-'}`
                    : est === 'programado' ? 'vs' : '···'}
                </text>
                {/* P2 name */}
                <text x={bx + 7} y={by + PH + SH + PH / 2 + 4} fontSize={10}
                  fill={w2 ? '#15803d' : p2n === 'Por definir' ? '#94a3b8' : '#1e293b'}
                  fontWeight={w2 ? 700 : 500}>
                  {p2n}
                </text>
                {done && enc.marcador_2 != null && (
                  <text x={bx + W - 6} y={by + PH + SH + PH / 2 + 4} textAnchor="end"
                    fontSize={10} fontWeight={800} fill={w2 ? '#15803d' : '#64748b'}>
                    {enc.marcador_2}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* Champion box */}
        {(() => {
          const bw = WW - 18;
          const bh = 46;
          const cx_ = PAD + numR * CS + 8;
          const cy_ = cy(numR - 1, 0);
          return (
            <g>
              <rect x={cx_} y={cy_ - bh / 2} width={bw} height={bh} rx={9}
                fill={champion ? 'url(#champGrad)' : '#f8fafc'}
                stroke={champion ? '#f59e0b' : '#e2e8f0'}
                strokeWidth={champion ? 2 : 1.5}
                strokeDasharray={champion ? '' : '5 3'} />
              <text x={cx_ + bw / 2} y={cy_ - 6} textAnchor="middle"
                fontSize={8} fontWeight={800} fill={champion ? '#92400e' : '#94a3b8'}>
                {champion ? 'CAMPEON' : 'POR DEFINIR'}
              </text>
              <text x={cx_ + bw / 2} y={cy_ + 11} textAnchor="middle"
                fontSize={11} fontWeight={800} fill={champion ? '#78350f' : '#94a3b8'}>
                {champion ? trunc(champion, 13) : '?'}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function TournamentBracket({
  title = 'Torneos y brackets',
  subtitle = 'Consulta los torneos activos y sus encuentros por ronda.',
  initialDisciplinaId = '',
  initialEstado = '',
  showFilters = true,
  readOnly = false,
  estadoOptions = DEFAULT_ESTADO_OPTIONS
}) {
  const { toast, showConfirm } = useNotification();
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
  const [formTorneo, setFormTorneo] = useState({ nombre: '', disciplina_id: '', fecha_inicio: '', fecha_fin: '', estado: 'Abierto', categoria_id: '', tipo_torneo: 'Individual' });
  const [socios, setSocios] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [showInscribirModal, setShowInscribirModal] = useState(false);
  const [torneoFormErrors, setTorneoFormErrors] = useState({});
  const [savingTorneo, setSavingTorneo] = useState(false);
  const [showParticipantes, setShowParticipantes] = useState(false);
  const [participantes, setParticipantes] = useState([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [desinscribiendoId, setDesinscribiendoId] = useState(null);
  const [torneoParticipantesActual, setTorneoParticipantesActual] = useState(null);
  const [selectedEncuentroId, setSelectedEncuentroId] = useState(null);

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

  useEffect(() => {
    async function loadCategorias() {
      try {
        const payload = await apiRequest('/torneos/categorias');
        setCategorias(Array.isArray(payload) ? payload : []);
      } catch {
        setCategorias([]);
      }
    }
    loadCategorias();
  }, []);

  useEffect(() => {
    if (readOnly) return;
    async function loadSocios() {
      try {
        const payload = await apiRequest('/socios');
        const list = unwrapList(payload, ['data', 'socios']);
        setSocios(list.filter(s => s.activo !== false && s.activo !== 'false'));
      } catch {
        setSocios([]);
      }
    }
    loadSocios();
  }, [readOnly]);

  useEffect(() => {
    async function loadEspacios() {
      try {
        const payload = await apiRequest('/espacios/todos');
        const list = unwrapList(payload, ['data', 'espacios']);
        setEspacios(list.filter(e => e.estado === 'Activo'));
      } catch {
        setEspacios([]);
      }
    }
    loadEspacios();
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
    setFormTorneo({ nombre: '', disciplina_id: '', fecha_inicio: '', fecha_fin: '', estado: 'Abierto', categoria_id: '', tipo_torneo: 'Individual' });
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
      estado: torneo.estado || 'Abierto',
      categoria_id: torneo.categoria_id ? String(torneo.categoria_id) : '',
      tipo_torneo: torneo.tipo_torneo || 'Individual'
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
        estado: formTorneo.estado,
        categoria_id: formTorneo.categoria_id ? Number(formTorneo.categoria_id) : null,
        tipo_torneo: formTorneo.tipo_torneo || 'Individual'
      };
      const url = editingTorneo
        ? `${API_BASE_URL}/torneos/${editingTorneo.torneo_id}`
        : `${API_BASE_URL}/torneos`;
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

  const cargarParticipantes = async (torneo) => {
    setLoadingParticipantes(true);
    setParticipantes([]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/torneos/${torneo.torneo_id}/participantes`, {
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

  const handleVerParticipantes = async (torneo) => {
    setTorneoParticipantesActual(torneo);
    setShowParticipantes(true);
    await cargarParticipantes(torneo);
  };

  const handleDesinscribir = async (participante) => {
    if (!torneoParticipantesActual) return;
    if (!await showConfirm(`¿Desinscribir a "${participante.nombre_participante}" del torneo?`, { danger: true, confirmLabel: 'Desinscribir' })) return;
    setDesinscribiendoId(participante.participante_id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/torneos/${torneoParticipantesActual.torneo_id}/participantes/${participante.participante_id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Error al desinscribir', 'error');
        return;
      }
      await cargarParticipantes(torneoParticipantesActual);
      await cargarTorneos();
    } catch {
      toast('Error de conexión', 'error');
    } finally {
      setDesinscribiendoId(null);
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

  const selectedEncuentro = useMemo(() => {
    if (!selectedEncuentroId) return null;
    for (const ronda of bracket) {
      const found = (ronda.encuentros || []).find(e => e.encuentro_id === selectedEncuentroId);
      if (found) return found;
    }
    return null;
  }, [bracket, selectedEncuentroId]);

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
                {hasBracket && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                      Bracket del torneo
                      {!readOnly && <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>— haz clic en un encuentro para editarlo</span>}
                    </span>
                    {selectedEncuentroId && (
                      <button onClick={() => setSelectedEncuentroId(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                        <X size={12} /> Cerrar
                      </button>
                    )}
                  </div>
                )}
                {loadingBracket && <div className="tb-loading">Cargando bracket...</div>}
                {bracketError && <div className="tb-error">{bracketError}</div>}
                {!loadingBracket && !bracketError && !hasBracket && (
                  <EmptyState title="Sin bracket" message="Cierra las inscripciones para generar el bracket." />
                )}
                {!loadingBracket && !bracketError && hasBracket && (
                  <>
                    <BracketVisual
                      bracket={bracket}
                      onMatchClick={enc => setSelectedEncuentroId(
                        enc.encuentro_id === selectedEncuentroId ? null : enc.encuentro_id
                      )}
                      selectedId={selectedEncuentroId}
                    />
                    {selectedEncuentro && (
                      <MatchEditPanel
                        key={selectedEncuentro.encuentro_id}
                        encuentro={selectedEncuentro}
                        onClose={() => setSelectedEncuentroId(null)}
                        onSaved={() => setSelectedTorneo(prev => ({ ...prev }))}
                        readOnly={readOnly}
                        espacios={espacios}
                      />
                    )}
                  </>
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
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#374151' }}>Modalidad</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: 'Individual', l: 'Individual' }, { v: 'Equipos', l: 'Equipos' }].map(opt => (
                      <button key={opt.v} type="button" onClick={() => setFormTorneo(p => ({ ...p, tipo_torneo: opt.v }))} style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12,
                        border: `2px solid ${formTorneo.tipo_torneo === opt.v ? '#3b82f6' : '#e2e8f0'}`,
                        background: formTorneo.tipo_torneo === opt.v ? '#eff6ff' : 'white',
                        color: formTorneo.tipo_torneo === opt.v ? '#1d4ed8' : '#475569',
                        fontWeight: formTorneo.tipo_torneo === opt.v ? 700 : 400, cursor: 'pointer'
                      }}>{opt.l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                    Categoría del torneo
                  </label>
                  <select value={formTorneo.categoria_id} onChange={e => setFormTorneo(p => ({ ...p, categoria_id: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="">Sin categoría</option>
                    {categorias.map(c => <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>)}
                  </select>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                    Define la categoría para todos los participantes de este torneo.
                  </p>
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
                      {!readOnly && torneoParticipantesActual?.estado === 'Abierto' && (
                        <th style={{ textAlign: 'center', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>Acción</th>
                      )}
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
                        {!readOnly && torneoParticipantesActual?.estado === 'Abierto' && (
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDesinscribir(p)}
                              disabled={desinscribiendoId === p.participante_id}
                              title="Desinscribir participante"
                              style={{
                                background: desinscribiendoId === p.participante_id ? '#f1f5f9' : '#fee2e2',
                                border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                                color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 11, fontWeight: 700
                              }}>
                              {desinscribiendoId === p.participante_id
                                ? <Loader2 size={12} className="icon-spin" />
                                : <><Trash2 size={12} /> Quitar</>
                              }
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {!readOnly && torneoParticipantesActual?.estado === 'Abierto' && (
                  <button onClick={() => setShowInscribirModal(true)}
                    style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <UserPlus size={14} /> Inscribir
                  </button>
                )}
              </div>
              <button onClick={() => setShowParticipantes(false)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal inscribir participante */}
      {showInscribirModal && torneoParticipantesActual && (
        <InscribirModal
          torneo={torneoParticipantesActual}
          socios={socios}
          categorias={categorias}
          onClose={() => setShowInscribirModal(false)}
          onInscribir={async () => {
            setShowInscribirModal(false);
            await cargarParticipantes(torneoParticipantesActual);
            await cargarTorneos();
          }}
        />
      )}
    </section>
  );
}

export default TournamentBracket;
