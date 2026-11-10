import React from 'react';
import GestionTorneosPersonal from '../../../components/torneos-gestion/GestionTorneosPersonal';

// Pestaña Torneos de admin y gerente (Dashboard.jsx): la lista del personal con el diseño nuevo
// (U4-03). Quién edita lo sigue decidiendo Dashboard.jsx con readOnly (admin, gerente y coordinador
// editan). ResultadosTorneo está en components/torneos/ResultadosTorneo.jsx (B-22).
export default function GestionTorneos({ readOnly = false }) {
  return <GestionTorneosPersonal puedeEditar={!readOnly} etiquetaAccion="Acción de gestión" />;
}
