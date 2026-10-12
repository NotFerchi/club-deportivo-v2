import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

// Estado de error al cargar datos del módulo de torneos, con botón para reintentar (B-25).
// Evita mostrar "No hay…" cuando en realidad la carga falló.
function ErrorReintentar({ mensaje = 'No se pudieron cargar los datos.', onReintentar }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 10,
        padding: '1rem',
        margin: '0.5rem 0',
        borderRadius: 10,
        background: '#fef2f2',
        border: '1px solid #fca5a5',
        color: '#b91c1c',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center'
      }}
    >
      <AlertCircle size={16} />
      <span>{mensaje}</span>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'white',
            color: '#b91c1c',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={12} /> Reintentar
        </button>
      )}
    </div>
  );
}

export default ErrorReintentar;
