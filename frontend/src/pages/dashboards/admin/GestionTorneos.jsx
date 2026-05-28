import React from 'react';
import TournamentBracket from '../../../components/TournamentBracket';

export default function GestionTorneos({ readOnly = false }) {
  return (
    <TournamentBracket
      title="Gestión de Torneos"
      subtitle="Administra torneos, participantes, brackets y resultados del club."
      readOnly={readOnly}
    />
  );
}
