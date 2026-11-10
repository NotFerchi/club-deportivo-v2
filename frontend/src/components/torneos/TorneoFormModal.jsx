import React from 'react';
import { X } from 'lucide-react';

// Modal crear/editar torneo. Movido tal cual desde TournamentBracket (U4-03); se rediseña en el Paso 2.
// Recibe el objeto de useGestionTorneos.
function TorneoFormModal({ gestion }) {
  const {
    showTorneoModal,
    setShowTorneoModal,
    editingTorneo,
    formTorneo,
    setFormTorneo,
    torneoFormErrors,
    savingTorneo,
    categoriaRequerida,
    estructuraBloqueada,
    handleSaveTorneo,
    disciplinas,
    categorias
  } = gestion;

  if (!showTorneoModal) return null;

  const avisoBloqueo = estructuraBloqueada && (
    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#b45309' }}>
      No se puede cambiar con las inscripciones cerradas
    </p>
  );

  return (
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
              // Errores del backend al guardar (p. ej. 409 al cambiar la categoría con inscritos)
              <p
                role="alert"
                style={{
                  margin: 0,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#b91c1c',
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                {torneoFormErrors.general}
              </p>
            )}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                Nombre <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                value={formTorneo.nombre}
                maxLength={150}
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
                disabled={estructuraBloqueada}
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
                <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: 12 }}>{torneoFormErrors.disciplina_id}</p>
              )}
              {avisoBloqueo}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
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
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
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
                    disabled={estructuraBloqueada}
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
                      cursor: estructuraBloqueada ? 'not-allowed' : 'pointer',
                      opacity: estructuraBloqueada && formTorneo.tipo_torneo !== opt.v ? 0.5 : 1
                    }}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
              {avisoBloqueo}
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#374151' }}>
                Categoría del torneo {categoriaRequerida && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <select
                value={formTorneo.categoria_id}
                disabled={estructuraBloqueada}
                onChange={(e) => setFormTorneo((p) => ({ ...p, categoria_id: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${torneoFormErrors.categoria_id ? '#ef4444' : '#cbd5e1'}`,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              >
                {categoriaRequerida ? (
                  <option value="" disabled>
                    Selecciona una categoría
                  </option>
                ) : (
                  <option value="">Sin categoría</option>
                )}
                {categorias.map((c) => (
                  <option key={c.categoria_id} value={c.categoria_id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {torneoFormErrors.categoria_id && (
                <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: 12 }}>{torneoFormErrors.categoria_id}</p>
              )}
              {avisoBloqueo}
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                Define la categoría para todos los participantes de este torneo.
              </p>
            </div>
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
  );
}

export default TorneoFormModal;
