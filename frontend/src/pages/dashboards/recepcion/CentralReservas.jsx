import React from 'react';
import ReservationManager from '../../../components/admin/ReservationManager';

function CentralReservas() {
  return (
    <ReservationManager
      dailyMode
      title="Central de Reservas"
      subtitle="Vista diaria para recepcion con el mismo flujo reutilizable de reservas."
    />
  );
}

export default CentralReservas;
