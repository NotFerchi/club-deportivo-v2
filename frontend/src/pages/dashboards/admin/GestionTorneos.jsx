import React from 'react';
import TournamentBracket from '../../../components/TournamentBracket';

// La pestaña Torneos de admin/gerente solo monta TournamentBracket, que carga sus propios datos.
// Antes este componente pedía /torneos, /disciplinas, /torneos/categorias y /socios (con CURP y
// dirección) y los descartaba (B-22). ResultadosTorneo se movió a components/torneos/ResultadosTorneo.jsx.
export default function GestionTorneos({ readOnly = false }) {
  return (
    <TournamentBracket
      title="Gestión de Torneos"
      subtitle="Administra torneos, participantes, brackets y resultados del club."
      readOnly={readOnly}
    />
  );
}
