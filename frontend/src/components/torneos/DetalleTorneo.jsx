import React from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from './torneoUtils';

function DetalleTorneo({ torneo }) {
  if (!torneo) return null;
  const estadoColor = {
    Abierto: { color: '#15803d', bg: '#dcfce7' },
    Inscripciones_cerradas: { color: '#b45309', bg: '#fef3c7' },
    En_curso: { color: '#1d4ed8', bg: '#dbeafe' },
    Finalizado: { color: '#475569', bg: '#f1f5f9' }
  }[torneo.estado] || { color: '#475569', bg: '#f1f5f9' };

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '1.25rem',
        marginBottom: '1.25rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 700,
              color: '#2563eb',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {torneo.nombre_disciplina || 'Disciplina'}
          </p>
          <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
            {torneo.nombre || `Torneo #${torneo.torneo_id}`}
          </h3>
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: '20px',
            background: estadoColor.bg,
            color: estadoColor.color
          }}
        >
          {torneo.estado}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
          <Calendar size={13} />{' '}
          <span>
            <strong>Inicio:</strong> {formatDate(torneo.fecha_inicio)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
          <Calendar size={13} />{' '}
          <span>
            <strong>Fin:</strong> {formatDate(torneo.fecha_fin)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default DetalleTorneo;
