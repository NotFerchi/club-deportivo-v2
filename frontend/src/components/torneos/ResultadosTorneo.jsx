import React, { useEffect, useMemo, useState } from 'react';
import { Award, Trophy, X } from 'lucide-react';
import { adminApi } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { formatDate } from '../../utils/adminData';
import { estadoTorneo } from './torneoUtils';

// Reporte de resultados de un torneo (campeón, ruta del campeón e historial de encuentros).
// Movido tal cual desde admin/GestionTorneos.jsx, donde no se montaba (B-22). Se reutilizará en E2 (F-03).

function EstadoBadge({ estado }) {
  const cfg = estadoTorneo(estado);
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap'
    }}>
      {cfg.label}
    </span>
  );
}

const RONDA_LABELS = { 1: 'Octavos', 2: 'Cuartos', 3: 'Semis', 4: 'Final' };
function rondaLabel(n, totalRondas) {
  if (n === totalRondas) return 'Final';
  if (n === totalRondas - 1) return 'Semifinal';
  if (n === totalRondas - 2) return 'Cuartos de Final';
  return RONDA_LABELS[n] || `Ronda ${n}`;
}

function ResultadosTorneo({ torneo, onClose }) {
  const { toast: toastResultados } = useNotification();
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getTorneoReporte(torneo.torneo_id)
      .then(data => setReporte(data))
      .catch(e => toastResultados(e.message || 'Error al cargar reporte', 'error'))
      .finally(() => setLoading(false));
  }, [torneo.torneo_id]);

  const { ganador, encuentrosFin, rutaCampeon, totalRondas } = useMemo(() => {
    if (!reporte?.encuentros?.length) return { ganador: null, encuentrosFin: [], rutaCampeon: [], totalRondas: 1 };
    const enc = reporte.encuentros.filter(e => e.estado === 'finalizado');
    const maxRonda = Math.max(...reporte.encuentros.map(e => e.ronda));
    const final = enc.filter(e => e.ronda === maxRonda).at(-1);
    const ganadorObj = final?.ganador || null;
    const ruta = ganadorObj
      ? enc.filter(e => e.ganador?.id === ganadorObj.id).sort((a, b) => a.ronda - b.ronda)
      : [];
    return { ganador: ganadorObj, encuentrosFin: enc, rutaCampeon: ruta, totalRondas: maxRonda };
  }, [reporte]);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 780, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={20} style={{ color: '#d97706' }} />
            <div>
              <h3 style={{ margin: 0 }}>Resultados — {torneo.nombre}</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{torneo.nombre_disciplina} · <EstadoBadge estado={torneo.estado} /></p>
            </div>
          </div>
          <button onClick={onClose} className="close-modal"><X size={22} /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Cargando resultados...</p>
          ) : !reporte?.encuentros?.length ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aún no hay encuentros registrados.</p>
          ) : (
            <>
              {/* Tarjeta del campeón */}
              {ganador && (
                <div style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  border: '2px solid #f59e0b', borderRadius: 12, padding: '1.25rem',
                  display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.5rem'
                }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Award size={28} style={{ color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#92400e' }}>Campeón</p>
                    <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#1e3a5f' }}>{ganador.nombre}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#78716c' }}>
                      {torneo.nombre_disciplina}
                      {torneo.fecha_fin ? ` · Finalizado: ${formatDate(torneo.fecha_fin)}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#f59e0b', color: '#fff' }}>
                    🏆 Campeón
                  </span>
                </div>
              )}

              {/* Ruta del campeón */}
              {rutaCampeon.length > 1 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h5 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Award size={15} style={{ color: '#f59e0b' }} /> Ruta del campeón
                  </h5>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {rutaCampeon.map(e => {
                      const rival = e.participante_1?.id === ganador.id ? e.participante_2 : e.participante_1;
                      const m1 = e.participante_1?.id === ganador.id ? e.marcador_1 : e.marcador_2;
                      const m2 = e.participante_1?.id === ganador.id ? e.marcador_2 : e.marcador_1;
                      return (
                        <div key={e.encuentro_id} style={{
                          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
                          padding: '8px 12px', fontSize: 12
                        }}>
                          <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#15803d', fontSize: 11 }}>{rondaLabel(e.ronda, totalRondas)}</p>
                          <p style={{ margin: 0, color: '#1e293b' }}>vs <strong>{rival?.nombre || 'Por definir'}</strong></p>
                          <p style={{ margin: '2px 0 0', color: '#16a34a', fontWeight: 700 }}>{m1} — {m2}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Historial de encuentros */}
              <h5 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                Historial de encuentros ({encuentrosFin.length})
              </h5>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ronda</th>
                      <th>Participante A</th>
                      <th>Marcador</th>
                      <th>Participante B</th>
                      <th>Ganador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encuentrosFin.map(e => {
                      const esDelCampeon = ganador && e.ganador?.id === ganador.id;
                      return (
                        <tr key={e.encuentro_id} style={esDelCampeon ? { background: '#fffbeb' } : {}}>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12 }}>{rondaLabel(e.ronda, totalRondas)}</td>
                          <td style={{ fontWeight: e.ganador?.id === e.participante_1?.id ? 700 : 400 }}>
                            {e.participante_1?.nombre || '—'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
                            {e.marcador_1 ?? '—'} : {e.marcador_2 ?? '—'}
                          </td>
                          <td style={{ fontWeight: e.ganador?.id === e.participante_2?.id ? 700 : 400 }}>
                            {e.participante_2?.nombre || '—'}
                          </td>
                          <td>
                            {e.ganador ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: e.ganador.id === ganador?.id ? '#15803d' : '#475569' }}>
                                {esDelCampeon ? '🏆 ' : ''}{e.ganador.nombre}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {encuentrosFin.length === 0 && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin encuentros finalizados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-outline">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default ResultadosTorneo;
