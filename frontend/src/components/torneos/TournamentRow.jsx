import React from 'react';

function TournamentRow({ torneo, selected, onSelect }) {
  const estadoColor =
    {
      Abierto: '#22c55e',
      Inscripciones_cerradas: '#f59e0b',
      En_curso: '#3b82f6',
      Finalizado: '#64748b'
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
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '20px',
          background: `${estadoColor}20`,
          color: estadoColor,
          whiteSpace: 'nowrap',
          alignSelf: 'flex-start',
          marginTop: '4px'
        }}
      >
        {torneo.estado || 'Sin estado'}
      </span>
    </button>
  );
}

export default TournamentRow;
