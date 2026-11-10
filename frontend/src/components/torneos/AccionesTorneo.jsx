import React from 'react';
import { CheckCircle, Lock, Loader2, Trophy, X } from 'lucide-react';
import { ACCION_CANCELAR, ACCION_CERRAR, ACCION_CONFIRMAR, ACCION_FINALIZAR, useAccionesTorneo } from './useAccionesTorneo';

// El padre lo monta con key={torneo_id}: el mensaje de un torneo no pasa a otro (B-24)
function AccionesTorneo({ torneo, onActualizar, readOnly }) {
  const { cargando, mensaje, ejecutar } = useAccionesTorneo(torneo, onActualizar);

  const estadoReal = torneo.estado;
  if (readOnly) return null;

  const mostrarBotones = !readOnly && !['Cancelado', 'Finalizado'].includes(estadoReal);
  if (!mostrarBotones) return null;

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.25rem'
      }}
    >
      <p style={{ margin: '0 0 0.75rem', fontSize: '12px', fontWeight: 700, color: '#475569' }}>
        ⚙️ Gestión del torneo
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {estadoReal === 'Abierto' && (
          <button
            onClick={() => ejecutar(ACCION_CERRAR)}
            disabled={cargando}
            style={{
              background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: cargando ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {cargando ? (
              <>
                <Loader2 size={13} className="icon-spin" /> Cerrando...
              </>
            ) : (
              <>
                <Lock size={13} /> Cerrar inscripciones
              </>
            )}
          </button>
        )}
        {estadoReal === 'Inscripciones_cerradas' && (
          <button
            onClick={() => ejecutar(ACCION_CONFIRMAR)}
            disabled={cargando}
            style={{
              background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: cargando ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {cargando ? (
              <>
                <Loader2 size={13} className="icon-spin" /> Confirmando...
              </>
            ) : (
              <>
                <CheckCircle size={13} /> Confirmar bracket
              </>
            )}
          </button>
        )}
        {estadoReal === 'En_curso' && (
          <button
            onClick={() => ejecutar(ACCION_FINALIZAR)}
            disabled={cargando}
            style={{
              background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: cargando ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {cargando ? (
              <>
                <Loader2 size={13} className="icon-spin" /> Finalizando...
              </>
            ) : (
              <>
                <Trophy size={13} /> Finalizar torneo
              </>
            )}
          </button>
        )}
        <button
          onClick={() => ejecutar(ACCION_CANCELAR)}
          disabled={cargando}
          style={{
            background: 'white',
            color: '#dc2626',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '7px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: cargando ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <X size={13} /> Cancelar torneo
        </button>
      </div>
      {mensaje && (
        <p
          style={{
            margin: '0.75rem 0 0',
            fontSize: '12px',
            fontWeight: 600,
            color: mensaje.tipo === 'ok' ? '#15803d' : '#dc2626'
          }}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

export default AccionesTorneo;
