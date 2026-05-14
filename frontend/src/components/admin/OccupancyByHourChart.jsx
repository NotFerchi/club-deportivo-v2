import React, { useMemo } from 'react';
import { normalizeEstadoReserva, toDateInputValue, toTimeInputValue } from '../../utils/adminData';

const HOURS = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

const W = 700, H = 260, PX = 44, PY = 20;

const DISCIPLINE_COLORS = [
  { key: 'tenis',    label: 'Tenis',    stroke: '#3b82f6', fill: 'rgba(59,130,246,0.12)',  dash: '' },
  { key: 'padel',    label: 'Padel',    stroke: '#10b981', fill: 'rgba(16,185,129,0.10)',  dash: '' },
  { key: 'alberca',  label: 'Alberca',  stroke: '#f59e0b', fill: 'rgba(245,158,11,0.10)',  dash: '6 3' },
  { key: 'gimnasio', label: 'Gimnasio', stroke: '#ef4444', fill: 'rgba(239,68,68,0.08)',   dash: '4 2' },
];

function normalizeDiscipline(name) {
  const n = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('tenis') || n.includes('tennis')) return 'tenis';
  if (n.includes('padel') || n.includes('paddle')) return 'padel';
  if (n.includes('alberca') || n.includes('pool') || n.includes('natacion')) return 'alberca';
  if (n.includes('gimnasio') || n.includes('gym') || n.includes('fitness')) return 'gimnasio';
  return 'otro';
}

function dateInRange(value, startDate, endDate) {
  const d = toDateInputValue(value);
  return d && d >= startDate && d <= endDate;
}

function smooth(points, width, height, padX, padY) {
  if (points.length < 2) return { line: '', area: '' };
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const pts = points.map(([xi, y], i) => ({
    x: padX + (i / (points.length - 1)) * chartW,
    y: padY + chartH - (y / 100) * chartH
  }));
  const cmd = pts.map((p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }).join(' ');
  const bottom = padY + chartH;
  const area = `${cmd} L ${pts[pts.length - 1].x},${bottom} L ${pts[0].x},${bottom} Z`;
  return { line: cmd, area };
}

export default function OccupancyByHourChart({ reservas = [], startDate, endDate, activeSpaces = 1, espacios = [] }) {
  const seriesData = useMemo(() => {
    // Build map espacio_id → discipline key
    const espacioDisc = new Map();
    espacios.forEach(e => {
      const disc = normalizeDiscipline(e.disciplina || e.nombre);
      espacioDisc.set(String(e.espacio_id), disc);
    });

    const activeReservas = (reservas || []).filter(r =>
      dateInRange(r.fecha || r.fecha_reserva, startDate, endDate) &&
      !['cancelada', 'sancionada'].includes(normalizeEstadoReserva(r.estado))
    );

    // Group by discipline
    const byDisc = {};
    DISCIPLINE_COLORS.forEach(d => { byDisc[d.key] = {}; });

    activeReservas.forEach(r => {
      const disc = espacioDisc.get(String(r.espacio_id)) || normalizeDiscipline(r.espacio_nombre || '');
      if (!byDisc[disc]) byDisc[disc] = {};
      const hour = toTimeInputValue(r.hora_inicio)?.slice(0, 2);
      const key = hour ? `${hour}:00` : null;
      if (key) byDisc[disc][key] = (byDisc[disc][key] || 0) + 1;
    });

    // Determine denominator per discipline
    const totalSpaces = Math.max(activeSpaces, 1);

    return DISCIPLINE_COLORS.map(def => {
      const counts = byDisc[def.key] || {};
      const hasData = Object.values(counts).some(v => v > 0);
      const data = HOURS.map(h => {
        const count = counts[h] || 0;
        return Math.min(Math.round((count / totalSpaces) * 100), 100);
      });
      const pts = data.map((v, i) => [i, v]);
      const paths = hasData ? smooth(pts, W, H, PX, PY) : { line: '', area: '' };
      return { ...def, data, hasData, paths };
    });
  }, [reservas, startDate, endDate, activeSpaces, espacios]);

  const hasSomeData = seriesData.some(s => s.hasData);

  const chartW = W - PX * 2;
  const chartH = H - PY * 2;

  const peakHour = useMemo(() => {
    const totals = HOURS.map((h, i) =>
      seriesData.reduce((sum, s) => sum + s.data[i], 0)
    );
    const maxVal = Math.max(...totals);
    const maxIdx = totals.indexOf(maxVal);
    if (maxVal === 0) return null;
    const end = HOURS[Math.min(maxIdx + 1, HOURS.length - 1)];
    return `${HOURS[maxIdx]} - ${end}`;
  }, [seriesData]);

  if (!hasSomeData) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
        <p>Sin datos de ocupación en el rango seleccionado</p>
      </div>
    );
  }

  return (
    <div className="occupancy-multiline">
      {peakHour && (
        <div className="occupancy-peak-badge">
          <span>⏱ Pico: {peakHour}</span>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 480, display: 'block' }}>
          <defs>
            {seriesData.map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.stroke} stopOpacity="0.3" />
                <stop offset="100%" stopColor={s.stroke} stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(v => {
            const y = PY + chartH - (v / 100) * chartH;
            return (
              <g key={v}>
                <line x1={PX} x2={W - PX} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={PX - 6} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{v}</text>
              </g>
            );
          })}

          {/* Hour labels on X axis */}
          {HOURS.map((h, i) => {
            const x = PX + (i / (HOURS.length - 1)) * chartW;
            return (
              <text key={h} x={x} y={H - 4} fontSize="10" fill="#94a3b8" textAnchor="middle">
                {h}
              </text>
            );
          })}

          {/* Areas first so they don't cover lines */}
          {seriesData.filter(s => s.hasData).map(s => (
            <path key={`area-${s.key}`} d={s.paths.area} fill={`url(#grad-${s.key})`} />
          ))}
          {seriesData.filter(s => s.hasData).map(s => (
            <path
              key={`line-${s.key}`}
              d={s.paths.line}
              fill="none"
              stroke={s.stroke}
              strokeWidth="2.5"
              strokeDasharray={s.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="occupancy-legend">
        {seriesData.filter(s => s.hasData).map(s => (
          <span key={s.key} className="occupancy-legend-item">
            <svg width="24" height="10">
              <line
                x1="0" y1="5" x2="24" y2="5"
                stroke={s.stroke}
                strokeWidth="2.5"
                strokeDasharray={s.dash}
              />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
