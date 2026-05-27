import React from 'react';
import ReservationManager from '../../../components/admin/ReservationManager';

function CentralReservas() {
  return (
    <ReservationManager
      dailyMode
      title="Central de Reservas"
      subtitle="Planeación diaria de espacios con el mismo diseño operativo del administrador."
    />
  );
}

export default CentralReservas;
