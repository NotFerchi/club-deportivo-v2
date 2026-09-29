import React, { useEffect, useState } from 'react';
import { Clock, Edit2, Loader2, MapPin, Save, X } from 'lucide-react';
import { API_BASE_URL } from '../../services/api';
import { normalizeEstado, formatTime, getParticipantName, isWinner } from './torneoUtils';

function MatchEditPanel({ encuentro, onClose, onSaved, readOnly, espacios = [] }) {
  const est = normalizeEstado(encuentro.estado);
  const done = est === 'finalizado';
  const p1 = encuentro.participante_1 || {};
  const p2 = encuentro.participante_2 || {};
  const w1 = isWinner(encuentro, p1);
  const w2 = isWinner(encuentro, p2);

  const [editMode, setEditMode] = useState(false);
  const [m1, setM1] = useState(String(encuentro.marcador_1 ?? ''));
  const [m2, setM2] = useState(String(encuentro.marcador_2 ?? ''));
  const [cancha, setCancha] = useState(encuentro.cancha_asignada || '');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setM1(String(encuentro.marcador_1 ?? ''));
    setM2(String(encuentro.marcador_2 ?? ''));
    setCancha(encuentro.cancha_asignada || '');
    setEditMode(false);
    setError('');
  }, [encuentro.encuentro_id, encuentro.estado, encuentro.marcador_1, encuentro.marcador_2, encuentro.cancha_asignada]);

  const showInputs = !readOnly && (est === 'programado' || editMode);
  const ambosListos = getParticipantName(p1) !== 'Por definir' && getParticipantName(p2) !== 'Por definir';
  const canSaveResult = showInputs && ambosListos;
  const canchaChanged = cancha.trim() !== (encuentro.cancha_asignada || '').trim();

  const guardarResultado = async () => {
    setError('');
    const n1 = parseInt(m1, 10);
    const n2 = parseInt(m2, 10);
    if (!Number.isFinite(n1) || !Number.isFinite(n2) || n1 < 0 || n2 < 0) {
      setError('Marcadores inválidos (enteros ≥ 0)');
      return;
    }
    if (n1 === n2) {
      setError('No se permiten empates');
      return;
    }
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
      if (!res.ok) {
        setError(data.error || 'Error al guardar');
        return;
      }
      setEditMode(false);
      if (onSaved) onSaved();
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  const guardarCancha = async () => {
    if (!cancha.trim()) return;
    setCargando(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/encuentros/${encuentro.encuentro_id}/cancha`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancha_asignada: cancha.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error');
        return;
      }
      if (onSaved) onSaved();
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  const inputSt = {
    width: 52,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 800,
    padding: '6px 4px',
    borderRadius: 8,
    border: '2px solid #3b82f6',
    outline: 'none'
  };

  return (
    <div
      style={{
        marginTop: '0.85rem',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '1rem 1.1rem'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Encuentro #{encuentro.encuentro_id}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 20,
              background: done ? '#dcfce7' : est === 'programado' ? '#dbeafe' : '#f1f5f9',
              color: done ? '#15803d' : est === 'programado' ? '#1d4ed8' : '#64748b'
            }}
          >
            {done ? 'Finalizado' : est === 'programado' ? 'Programado' : 'Pendiente'}
          </span>
          {encuentro.hora_programada && (
            <span style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} />
              {formatTime(encuentro.hora_programada)}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Participants + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
        <span style={{ flex: '1 1 90px', fontWeight: w1 ? 800 : 600, color: w1 ? '#15803d' : '#1e293b', fontSize: 13 }}>
          {w1 && '🏆 '}
          {getParticipantName(p1)}
        </span>
        {showInputs ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              min="0"
              value={m1}
              onChange={(e) => setM1(e.target.value)}
              disabled={cargando}
              style={inputSt}
              placeholder="0"
            />
            <span style={{ fontWeight: 800, color: '#94a3b8', fontSize: 13 }}>—</span>
            <input
              type="number"
              min="0"
              value={m2}
              onChange={(e) => setM2(e.target.value)}
              disabled={cargando}
              style={inputSt}
              placeholder="0"
            />
          </div>
        ) : (
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: '#1e293b',
              background: done ? '#f0fdf4' : '#f1f5f9',
              padding: '5px 16px',
              borderRadius: 8,
              border: `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}`
            }}
          >
            {done ? `${encuentro.marcador_1 ?? '-'} — ${encuentro.marcador_2 ?? '-'}` : 'VS'}
          </div>
        )}
        <span
          style={{
            flex: '1 1 90px',
            textAlign: 'right',
            fontWeight: w2 ? 800 : 600,
            color: w2 ? '#15803d' : '#1e293b',
            fontSize: 13
          }}
        >
          {getParticipantName(p2)}
          {w2 && ' 🏆'}
        </span>
      </div>

      {/* Cancha */}
      {!readOnly ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
          <MapPin size={14} color="#64748b" style={{ flexShrink: 0 }} />
          {espacios.length > 0 ? (
            <select
              value={cancha}
              onChange={(e) => setCancha(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 12,
                outline: 'none',
                background: 'white'
              }}
            >
              <option value="">Sin asignar</option>
              {espacios.map((e) => (
                <option key={e.espacio_id} value={e.nombre}>
                  {e.nombre}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={cancha}
              onChange={(e) => setCancha(e.target.value)}
              placeholder="Asignar espacio"
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 12,
                outline: 'none',
                background: 'white'
              }}
            />
          )}
        </div>
      ) : encuentro.cancha_asignada ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: '0.5rem',
            fontSize: 12,
            color: '#64748b'
          }}
        >
          <MapPin size={13} /> {encuentro.cancha_asignada}
        </div>
      ) : null}

      {error && <p style={{ color: '#dc2626', fontSize: 11, fontWeight: 600, margin: '0 0 8px' }}>⚠ {error}</p>}

      {/* Buttons */}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {done && !editMode && (
            <button
              onClick={() => {
                setEditMode(true);
                setM1(String(encuentro.marcador_1 ?? ''));
                setM2(String(encuentro.marcador_2 ?? ''));
              }}
              style={{
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fbbf24',
                borderRadius: 8,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Edit2 size={11} /> Editar resultado
            </button>
          )}
          {editMode && (
            <button
              onClick={() => setEditMode(false)}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          )}
          {canSaveResult && (
            <button
              onClick={guardarResultado}
              disabled={cargando}
              style={{
                background: cargando
                  ? '#94a3b8'
                  : editMode
                    ? 'linear-gradient(135deg,#d97706,#f59e0b)'
                    : 'linear-gradient(135deg,#2563eb,#3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: 700,
                cursor: cargando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {cargando ? (
                <>
                  <Loader2 size={11} /> Guardando...
                </>
              ) : (
                <>
                  <Save size={11} /> {editMode ? 'Actualizar resultado' : 'Guardar resultado'}
                </>
              )}
            </button>
          )}
          {canchaChanged && cancha.trim() && !showInputs && (
            <button
              onClick={guardarCancha}
              disabled={cargando}
              style={{
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #86efac',
                borderRadius: 8,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: cargando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <MapPin size={11} /> Guardar cancha
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MatchEditPanel;
