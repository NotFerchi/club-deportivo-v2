import React from 'react';
import './DayStrip.css';

/**
 * DayStrip - tira horizontal de días de la semana (abreviatura arriba, número abajo) para filtrar
 * una lista por día. El día elegido va en azul marino. Controlado por el padre; se desliza de lado
 * si no caben todos.
 *
 *   <DayStrip
 *     ariaLabel="Día de la semana"
 *     days={[{ value: 1, label: 'LUN', number: 9 }, { value: 2, label: 'MAR', number: 10 }]}
 *     value={2}
 *     onChange={(dia) => setDia(dia)}
 *   />
 *
 * Es un grupo de botones con aria-pressed: el estado no depende solo del color. Tocar el día ya
 * elegido llama a onChange(null) para quitar el filtro.
 *
 * Props:
 *   days      - [{ value, label, number, disabled? }]
 *   value     - valor del día elegido (o null/undefined si ninguno)
 *   onChange  - (value | null) => void
 *   ariaLabel - nombre accesible del grupo
 *   className - clase extra; opcional
 */
export function DayStrip({ days, value, onChange, ariaLabel, className }) {
  const classes = ['ui-day-strip', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      {days.map((d) => {
        const selected = d.value === value;
        return (
          <button
            key={d.value}
            type="button"
            className={['ui-day-strip__day', selected && 'ui-day-strip__day--selected'].filter(Boolean).join(' ')}
            aria-pressed={selected}
            disabled={d.disabled}
            onClick={() => onChange?.(selected ? null : d.value)}
          >
            <span className="ui-day-strip__label">{d.label}</span>
            <span className="ui-day-strip__number">{d.number}</span>
          </button>
        );
      })}
    </div>
  );
}

export default DayStrip;
