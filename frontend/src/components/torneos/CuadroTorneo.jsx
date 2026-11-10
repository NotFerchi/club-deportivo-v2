import React from 'react';
import { X } from 'lucide-react';
import ErrorReintentar from './ErrorReintentar';
import EmptyState from './EmptyState';
import BracketVisual from './BracketVisual';
import MatchEditPanel from './MatchEditPanel';

// Cuadro (bracket) del torneo seleccionado + panel para editar el encuentro. Movido tal cual desde
// TournamentBracket (U4-03); se rediseña en el Paso 2. Recibe el objeto de useGestionTorneos.
function CuadroTorneo({ gestion }) {
  const {
    readOnly,
    selectedTorneo,
    setSelectedTorneo,
    bracket,
    hasBracket,
    loadingBracket,
    bracketError,
    selectedEncuentroId,
    setSelectedEncuentroId,
    selectedEncuentro,
    selectedRonda,
    espacios
  } = gestion;

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
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
      {bracketError && (
        <ErrorReintentar
          mensaje={bracketError}
          onReintentar={() => setSelectedTorneo((prev) => (prev ? { ...prev } : null))}
        />
      )}
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
              ronda={selectedRonda}
              torneoEstado={selectedTorneo.estado}
              onClose={() => setSelectedEncuentroId(null)}
              onSaved={() => setSelectedTorneo((prev) => ({ ...prev }))}
              readOnly={readOnly}
              espacios={espacios}
            />
          )}
        </>
      )}
    </div>
  );
}

export default CuadroTorneo;
