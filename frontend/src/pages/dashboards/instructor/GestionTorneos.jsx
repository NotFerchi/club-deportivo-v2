import React from 'react';
import { Trophy } from 'lucide-react';

function GestionTorneos() {
  return (
    <div className="chart-box">
      <h4>Gestión de Torneos</h4>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Trophy size={48} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
        <p>Próximamente: Creación de brackets, registro de resultados y asignación de árbitros</p>
      </div>
    </div>
  );
}

export default GestionTorneos;