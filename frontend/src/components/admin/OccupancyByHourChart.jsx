import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, TrendingUp } from 'lucide-react';
import { normalizeEstadoReserva, toDateInputValue, toTimeInputValue } from '../../utils/adminData';

const HOURS = Array.from({ length: 17 }, (_, index) => `${String(index + 6).padStart(2, '0')}:00`);

function dateToLocal(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function daysBetween(startDate, endDate) {
  const start = dateToLocal(startDate);
  const end = dateToLocal(endDate);
  if (!start || !end || end < start) return 1;
  return Math.floor((end - start) / 86400000) + 1;
}

function isInRange(value, startDate, endDate) {
  const date = toDateInputValue(value);
  return date && date >= startDate && date <= endDate;
}

function getReservaHour(reserva) {
  const time = toTimeInputValue(reserva.hora_inicio);
  if (!time) return '';
  return `${time.slice(0, 2)}:00`;
}

export default function OccupancyByHourChart({
  reservas,
  startDate,
  endDate,
  activeSpaces = 1
}) {
  const data = useMemo(() => {
    const denominator = Math.max(daysBetween(startDate, endDate) * Number(activeSpaces || 1), 1);
    const activeReservas = reservas.filter(reserva =>
      isInRange(reserva.fecha || reserva.fecha_reserva, startDate, endDate) &&
      !['cancelada', 'sancionada'].includes(normalizeEstadoReserva(reserva.estado))
    );

    return HOURS.map(hora => {
      const count = activeReservas.filter(reserva => getReservaHour(reserva) === hora).length;
      return {
        hora,
        count,
        ocupacion: Math.min(Math.round((count / denominator) * 100), 100)
      };
    });
  }, [activeSpaces, endDate, reservas, startDate]);

  const maxValue = Math.max(...data.map(item => item.ocupacion), 0);
  const minValue = Math.min(...data.filter(item => item.count > 0).map(item => item.ocupacion));
  const high = data.find(item => item.ocupacion === maxValue && item.count > 0);
  const low = Number.isFinite(minValue) ? data.find(item => item.ocupacion === minValue && item.count > 0) : null;
  const average = data.length ? Math.round(data.reduce((sum, item) => sum + item.ocupacion, 0) / data.length) : 0;

  if (!data.some(item => item.count > 0)) {
    return (
      <div className="occupancy-empty">
        <TrendingUp size={36} />
        <strong>Sin ocupacion en el rango seleccionado</strong>
        <span>Ajusta las fechas o revisa las reservas registradas.</span>
      </div>
    );
  }

  return (
    <div className="occupancy-chart">
      <div className="occupancy-insights">
        <span className="occupancy-chip tone-info">Promedio {average}%</span>
        {high && (
          <span className="occupancy-chip tone-danger">
            <ArrowUp size={14} /> Mayor: {high.hora} ({high.ocupacion}%)
          </span>
        )}
        {low && (
          <span className="occupancy-chip tone-success">
            <ArrowDown size={14} /> Menor: {low.hora} ({low.ocupacion}%)
          </span>
        )}
      </div>

      <div className="occupancy-bars" role="img" aria-label="Ocupacion por hora">
        {data.map(item => {
          const isHigh = high?.hora === item.hora;
          const isLow = low?.hora === item.hora;
          return (
            <div key={item.hora} className="occupancy-bar-item">
              <div className="occupancy-bar-track">
                <div
                  className={`occupancy-bar ${isHigh ? 'is-high' : ''} ${isLow ? 'is-low' : ''}`}
                  style={{ height: `${Math.max(item.ocupacion, item.count ? 8 : 2)}%` }}
                  title={`${item.hora}: ${item.ocupacion}% (${item.count} reservas)`}
                />
              </div>
              <strong>{item.ocupacion}%</strong>
              <span>{item.hora}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
