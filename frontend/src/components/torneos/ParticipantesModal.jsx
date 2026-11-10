import React from 'react';
import { Loader2, Trash2, UserPlus, X } from 'lucide-react';
import ErrorReintentar from './ErrorReintentar';
import InscribirModal from './InscribirModal';

// Modal "Inscritos" (+ modal para inscribir). Movido tal cual desde TournamentBracket (U4-03);
// se rediseña en el Paso 2. Recibe el objeto de useGestionTorneos.
function ParticipantesModal({ gestion }) {
  const {
    readOnly,
    selectedTorneo,
    showParticipantes,
    setShowParticipantes,
    participantes,
    loadingParticipantes,
    participantesError,
    cargarParticipantes,
    torneoParticipantesActual,
    desinscribiendoId,
    handleDesinscribir,
    showInscribirModal,
    setShowInscribirModal,
    handleInscrito,
    socios,
    categorias
  } = gestion;

  return (
    <>
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
              {!loadingParticipantes && participantesError && (
                <ErrorReintentar onReintentar={() => cargarParticipantes(torneoParticipantesActual)} />
              )}
              {!loadingParticipantes && !participantesError && participantes.length === 0 && (
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
          onInscribir={handleInscrito}
        />
      )}
    </>
  );
}

export default ParticipantesModal;
