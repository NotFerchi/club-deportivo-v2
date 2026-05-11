import React from 'react';
import ReservationManager from '../../../components/admin/ReservationManager';

function Reservas({ readOnly = false }) {
  return (
    <ReservationManager
      readOnly={readOnly}
      title="Gestion de Reservas"
      subtitle="Panel operativo con filtros, disponibilidad por espacio y reglas de validacion compartidas."
    />
  );
}

export default Reservas;
