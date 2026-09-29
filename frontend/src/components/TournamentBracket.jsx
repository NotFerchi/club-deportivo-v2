import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Filter, Loader2, Plus, RotateCcw, Trash2, Trophy, UserPlus, Users, X } from 'lucide-react';
import { apiRequest, unwrapList, API_BASE_URL } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { DEFAULT_ESTADO_OPTIONS, buildTorneosPath, getErrorMessage } from './torneos/torneoUtils';
import EmptyState from './torneos/EmptyState';
import TournamentRow from './torneos/TournamentRow';
import AccionesTorneo from './torneos/AccionesTorneo';
import DetalleTorneo from './torneos/DetalleTorneo';
import InscribirModal from './torneos/InscribirModal';
import MatchEditPanel from './torneos/MatchEditPanel';
import BracketVisual from './torneos/BracketVisual';
import '../../css/TournamentBracket.css';

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
  const [formTorneo, setFormTorneo] = useState({
    nombre: '',
    disciplina_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'Abierto',
    categoria_id: '',
    tipo_torneo: 'Individual'
  });
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
        setSocios(list.filter((s) => s.activo !== false && s.activo !== 'false'));
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
        setEspacios(list.filter((e) => e.estado === 'Activo'));
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
      setSelectedTorneo((current) => {
        if (!current) return null;
        return nextTorneos.find((t) => String(t.torneo_id) === String(current.torneo_id)) || null;
      });
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudieron cargar los torneos');
      if (message) {
        setTorneos([]);
        setSelectedTorneo(null);
        setTorneosError(message);
      }
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
    if (!selectedTorneo?.torneo_id) {
      setBracket([]);
      setBracketError('');
      return;
    }
    const controller = new AbortController();
    async function loadBracket() {
      setLoadingBracket(true);
      setBracketError('');
      try {
        const payload = await apiRequest(`/torneos/${selectedTorneo.torneo_id}/bracket`, { signal: controller.signal });
        setBracket(unwrapList(payload, ['data', 'bracket']));
      } catch (error) {
        const message = getErrorMessage(error, 'No se pudo cargar el bracket');
        if (message) {
          setBracket([]);
          setBracketError(message);
        }
      } finally {
        setLoadingBracket(false);
      }
    }
    loadBracket();
    return () => controller.abort();
  }, [selectedTorneo]);

  const openCreateModal = () => {
    setEditingTorneo(null);
    setFormTorneo({
      nombre: '',
      disciplina_id: '',
      fecha_inicio: '',
      fecha_fin: '',
      estado: 'Abierto',
      categoria_id: '',
      tipo_torneo: 'Individual'
    });
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
    if (Object.keys(errors).length > 0) {
      setTorneoFormErrors(errors);
      return;
    }
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
      const url = editingTorneo ? `${API_BASE_URL}/torneos/${editingTorneo.torneo_id}` : `${API_BASE_URL}/torneos`;
      const res = await fetch(url, {
        method: editingTorneo ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setTorneoFormErrors({ general: data.error || 'Error al guardar' });
        return;
      }
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
    if (
      !(await showConfirm(`¿Desinscribir a "${participante.nombre_participante}" del torneo?`, {
        danger: true,
        confirmLabel: 'Desinscribir'
      }))
    )
      return;
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
    setSelectedTorneo((prev) => (prev ? { ...prev } : null));
  };

  const hasBracket = bracket.some((r) => Array.isArray(r.encuentros) && r.encuentros.length > 0);

  const selectedEncuentro = useMemo(() => {
    if (!selectedEncuentroId) return null;
    for (const ronda of bracket) {
      const found = (ronda.encuentros || []).find((e) => e.encuentro_id === selectedEncuentroId);
      if (found) return found;
    }
    return null;
  }, [bracket, selectedEncuentroId]);

  return (
    <section className="tb-shell">
      <header className="tb-header">
        <div>
          <span className="tb-eyebrow">
            <Trophy size={16} />
            Dashboard deportivo
          </span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>

      {showFilters && (
        <form className="tb-filters" onSubmit={handleFilterSubmit}>
          <label>
            <span>Disciplina</span>
            {disciplinas.length > 0 ? (
              <select
                value={filters.disciplina_id}
                onChange={(e) => setFilters((c) => ({ ...c, disciplina_id: e.target.value }))}
              >
                <option value="">Todas</option>
                {disciplinas.map((d) => (
                  <option key={d.disciplina_id} value={d.disciplina_id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min="1"
                value={filters.disciplina_id}
                onChange={(e) => setFilters((c) => ({ ...c, disciplina_id: e.target.value }))}
                placeholder="ID de disciplina"
              />
            )}
          </label>
          <label>
            <span>Estado</span>
            <select value={filters.estado} onChange={(e) => setFilters((c) => ({ ...c, estado: e.target.value }))}>
              <option value="">Todos</option>
              {estadoOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="tb-filter-actions">
            <button type="submit" className="tb-primary-button">
              <Filter size={16} />
              Aplicar
            </button>
            <button type="button" className="tb-secondary-button" onClick={handleClearFilters}>
              <RotateCcw size={16} />
              Limpiar
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
              style={{
                width: '100%',
                marginBottom: 10,
                background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
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
              {torneos.map((t) => (
                <TournamentRow
                  key={t.torneo_id}
                  torneo={t}
                  selected={selectedTorneo?.torneo_id === t.torneo_id}
                  onSelect={setSelectedTorneo}
                />
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
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '7px 14px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      color: '#1e3a5f'
                    }}
                  >
                    <Edit2 size={13} /> Editar torneo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerParticipantes(selectedTorneo)}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #93c5fd',
                      borderRadius: 8,
                      padding: '7px 14px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      color: '#1d4ed8'
                    }}
                  >
                    <Users size={13} /> Inscritos ({selectedTorneo.total_participantes ?? 0})
                  </button>
                </div>
              )}

              {/* Acciones */}
              <AccionesTorneo torneo={selectedTorneo} onActualizar={handleTorneoActualizado} readOnly={readOnly} />

              {/* Bracket */}
              <div
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}
              >
                {hasBracket && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.75rem'
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                      Bracket del torneo
                      {!readOnly && (
                        <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>
                          — haz clic en un encuentro para editarlo
                        </span>
                      )}
                    </span>
                    {selectedEncuentroId && (
                      <button
                        onClick={() => setSelectedEncuentroId(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 11
                        }}
                      >
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
                      onMatchClick={(enc) =>
                        setSelectedEncuentroId(enc.encuentro_id === selectedEncuentroId ? null : enc.encuentro_id)
                      }
                      selectedId={selectedEncuentroId}
                    />
                    {selectedEncuentro && (
                      <MatchEditPanel
                        key={selectedEncuentro.encuentro_id}
                        encuentro={selectedEncuentro}
                        onClose={() => setSelectedEncuentroId(null)}
                        onSaved={() => setSelectedTorneo((prev) => ({ ...prev }))}
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                {editingTorneo ? 'Editar Torneo' : 'Nuevo Torneo'}
              </h3>
              <button
                onClick={() => setShowTorneoModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleSaveTorneo}>
              <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {torneoFormErrors.general && (
                  <p style={{ margin: 0, color: '#dc2626', fontWeight: 600, fontSize: 13 }}>
                    {torneoFormErrors.general}
                  </p>
                )}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                    Nombre <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    value={formTorneo.nombre}
                    onChange={(e) => setFormTorneo((p) => ({ ...p, nombre: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${torneoFormErrors.nombre ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                    placeholder="Ej: Copa Verano 2025"
                  />
                  {torneoFormErrors.nombre && (
                    <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: 12 }}>{torneoFormErrors.nombre}</p>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                    Disciplina <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formTorneo.disciplina_id}
                    onChange={(e) => setFormTorneo((p) => ({ ...p, disciplina_id: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${torneoFormErrors.disciplina_id ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Seleccionar disciplina</option>
                    {disciplinas.map((d) => (
                      <option key={d.disciplina_id} value={d.disciplina_id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                  {torneoFormErrors.disciplina_id && (
                    <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: 12 }}>
                      {torneoFormErrors.disciplina_id}
                    </p>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label
                      style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}
                    >
                      Fecha inicio
                    </label>
                    <input
                      type="date"
                      value={formTorneo.fecha_inicio}
                      onChange={(e) => setFormTorneo((p) => ({ ...p, fecha_inicio: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}
                    >
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={formTorneo.fecha_fin}
                      onChange={(e) => setFormTorneo((p) => ({ ...p, fecha_fin: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${torneoFormErrors.fecha_fin ? '#ef4444' : '#cbd5e1'}`,
                        fontSize: 14,
                        boxSizing: 'border-box'
                      }}
                    />
                    {torneoFormErrors.fecha_fin && (
                      <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: 12 }}>{torneoFormErrors.fecha_fin}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#374151' }}>
                    Modalidad
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { v: 'Individual', l: 'Individual' },
                      { v: 'Equipos', l: 'Equipos' }
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setFormTorneo((p) => ({ ...p, tipo_torneo: opt.v }))}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 8,
                          fontSize: 12,
                          border: `2px solid ${formTorneo.tipo_torneo === opt.v ? '#3b82f6' : '#e2e8f0'}`,
                          background: formTorneo.tipo_torneo === opt.v ? '#eff6ff' : 'white',
                          color: formTorneo.tipo_torneo === opt.v ? '#1d4ed8' : '#475569',
                          fontWeight: formTorneo.tipo_torneo === opt.v ? 700 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                    Categoría del torneo
                  </label>
                  <select
                    value={formTorneo.categoria_id}
                    onChange={(e) => setFormTorneo((p) => ({ ...p, categoria_id: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.categoria_id} value={c.categoria_id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                    Define la categoría para todos los participantes de este torneo.
                  </p>
                </div>
                {editingTorneo && (
                  <div>
                    <label
                      style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}
                    >
                      Estado
                    </label>
                    <select
                      value={formTorneo.estado}
                      onChange={(e) => setFormTorneo((p) => ({ ...p, estado: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box'
                      }}
                    >
                      {DEFAULT_ESTADO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid #e2e8f0'
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowTorneoModal(false)}
                  disabled={savingTorneo}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    color: '#374151'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTorneo}
                  style={{
                    background: savingTorneo ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#3b82f6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: savingTorneo ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingTorneo ? 'Guardando...' : editingTorneo ? 'Actualizar' : 'Crear Torneo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ver participantes */}
      {showParticipantes && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              width: '100%',
              maxWidth: 560,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                  Inscritos — {selectedTorneo?.nombre}
                </h3>
                {!loadingParticipantes && (
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 12,
                      color: participantes.length >= 4 ? '#15803d' : '#b45309',
                      fontWeight: 700
                    }}
                  >
                    {participantes.length} participante{participantes.length !== 1 ? 's' : ''} —
                    {participantes.length >= 4
                      ? ' ✅ Se realizará (mínimo 4 alcanzado)'
                      : ` ⚠️ Faltan ${4 - participantes.length} para realizarse`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowParticipantes(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.5rem' }}>
              {loadingParticipantes && <p style={{ color: '#64748b', textAlign: 'center' }}>Cargando...</p>}
              {!loadingParticipantes && participantes.length === 0 && (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>
                  No hay participantes inscritos aún.
                </p>
              )}
              {!loadingParticipantes && participantes.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>
                        Participante
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>Tipo</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>
                        Categoría
                      </th>
                      {!readOnly && torneoParticipantesActual?.estado === 'Abierto' && (
                        <th style={{ textAlign: 'center', padding: '8px 4px', color: '#475569', fontWeight: 700 }}>
                          Acción
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {participantes.map((p, i) => (
                      <tr key={p.participante_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '8px 4px', fontWeight: 600, color: '#0f172a' }}>
                          {p.nombre_participante}
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 20,
                              background:
                                p.tipo_participante === 'Socio'
                                  ? '#dbeafe'
                                  : p.tipo_participante === 'Visita'
                                    ? '#dcfce7'
                                    : '#f1f5f9',
                              color:
                                p.tipo_participante === 'Socio'
                                  ? '#1d4ed8'
                                  : p.tipo_participante === 'Visita'
                                    ? '#15803d'
                                    : '#475569'
                            }}
                          >
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
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 8px',
                                cursor: 'pointer',
                                color: '#dc2626',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700
                              }}
                            >
                              {desinscribiendoId === p.participante_id ? (
                                <Loader2 size={12} className="icon-spin" />
                              ) : (
                                <>
                                  <Trash2 size={12} /> Quitar
                                </>
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                {!readOnly && torneoParticipantesActual?.estado === 'Abierto' && (
                  <button
                    onClick={() => setShowInscribirModal(true)}
                    style={{
                      background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                  >
                    <UserPlus size={14} /> Inscribir
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowParticipantes(false)}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
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
