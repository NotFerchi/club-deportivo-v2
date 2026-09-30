import React, { useState } from 'react';
import { CheckCircle, Lock, Loader2, Trophy, X } from 'lucide-react';
import { API_BASE_URL } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

function AccionesTorneo({ torneo, onActualizar, readOnly }) {
  const { showConfirm } = useNotification();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const llamar = async (endpoint) => {
    setCargando(true);
    setMensaje(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/torneos/${torneo.torneo_id}/${endpoint}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error || 'Error' });
        return;
      }
      setMensaje({ tipo: 'ok', texto: data.message || '✅ Listo' });
      if (onActualizar) onActualizar();
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' });
    } finally {
      setCargando(false);
    }
  };

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
            onClick={async () => {
              if (
                await showConfirm('¿Cerrar inscripciones y generar el bracket?', {
                  confirmLabel: 'Cerrar inscripciones'
                })
              )
                llamar('cerrar-inscripciones');
            }}
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
            onClick={async () => {
              if (await showConfirm('¿Confirmar bracket?', { confirmLabel: 'Confirmar' })) llamar('confirmar-bracket');
            }}
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
            onClick={async () => {
              if (
                await showConfirm('¿Finalizar el torneo? Esta acción no se puede deshacer.', {
                  danger: true,
                  confirmLabel: 'Finalizar'
                })
              )
                llamar('finalizar');
            }}
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
          onClick={() => {
            if (window.confirm('¿Cancelar el torneo? Esta acción no se puede deshacer.')) llamar('cancelar');
          }}
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
