import React, { useState } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { apiRequest } from '../../services/api';

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
      if (!nombreExterno.trim()) {
        setError(esEquipos ? 'Ingresa el nombre del equipo' : 'Ingresa el nombre');
        return;
      }
      payload.nombre_externo = nombreExterno.trim();
    } else {
      if (!socioId) {
        setError('Selecciona un socio');
        return;
      }
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 10000,
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
          maxWidth: 460,
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
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Inscribir participante</h3>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b' }}>
              {torneo.nombre} · <strong>{torneo.tipo_torneo || 'Individual'}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <p style={{ margin: 0, color: '#dc2626', fontWeight: 600, fontSize: 12 }}>⚠ {error}</p>}
            {!esEquipos && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#374151' }}>
                  Tipo de participante
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { v: 'socio', l: 'Socio del club' },
                    { v: 'externo', l: 'Externo' }
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setTipo(opt.v)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        borderRadius: 8,
                        fontSize: 12,
                        border: `2px solid ${tipo === opt.v ? '#3b82f6' : '#e2e8f0'}`,
                        background: tipo === opt.v ? '#eff6ff' : 'white',
                        color: tipo === opt.v ? '#1d4ed8' : '#475569',
                        fontWeight: tipo === opt.v ? 700 : 400,
                        cursor: 'pointer'
                      }}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {esEquipos || tipo === 'externo' ? (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                  {esEquipos ? 'Nombre del equipo' : 'Nombre del participante'}{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={nombreExterno}
                  onChange={(e) => setNombreExterno(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                  placeholder={esEquipos ? 'Ej. Águilas FC' : 'Ej. Juan Pérez'}
                />
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                  Socio <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={socioId}
                  onChange={(e) => setSocioId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Seleccionar socio</option>
                  {socios.map((s) => (
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
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                  Categoría
                </label>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
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
              onClick={onClose}
              disabled={cargando}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '8px 18px',
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
              disabled={cargando}
              style={{
                background: cargando ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontWeight: 700,
                fontSize: 13,
                cursor: cargando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              {cargando ? (
                <>
                  <Loader2 size={13} /> Inscribiendo...
                </>
              ) : (
                <>
                  <UserPlus size={13} /> Inscribir
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InscribirModal;
