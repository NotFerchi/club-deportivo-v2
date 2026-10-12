import React from 'react';
import { estadoTorneo } from './torneoUtils';

function TournamentRow({ torneo, selected, onSelect }) {
  const estado = estadoTorneo(torneo.estado);

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
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '20px',
          background: estado.bg,
          color: estado.color,
          whiteSpace: 'nowrap',
          alignSelf: 'flex-start',
          marginTop: '4px'
        }}
      >
        {estado.label}
      </span>
    </button>
  );
}

export default TournamentRow;
