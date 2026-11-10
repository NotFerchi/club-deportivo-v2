import React from 'react';
import './EventRow.css';

/**
 * EventRow - fila de un evento en una lista (torneo, clase…): bloque de fecha, ícono, nombre,
 * datos, un extra (p. ej. inscritos), una pastilla de estado y acciones al final.
 *
 *   <EventRow
 *     weekday="SÁB" day="15"
 *     icon={<Trophy size={20} />}
 *     title="Copa del Rey 2026"
 *     meta={<><CalendarDays size={14} /> 15 - 22 Nov</>}
 *     extra="12 / 16"
 *     badge={<Badge variant="ice">En curso</Badge>}
 *     actions={<IconButton label="Editar"><Pencil size={16} /></IconButton>}
 *     selected={seleccionado}
 *     onClick={() => seleccionar(t)}
 *   />
 *
 * La zona principal es un solo <button> (clic o teclado la eligen); las acciones van fuera de él
 * para no anidar botones. `selected` la muestra blanca y elevada.
 *
 * Props:
 *   weekday, day - texto del bloque de fecha (si falta `day`, el bloque muestra "—")
 *   icon         - nodo del ícono; opcional
 *   title        - nombre del evento
 *   meta         - línea de apoyo bajo el nombre (fechas…); opcional
 *   extra        - nodo antes de la pastilla (p. ej. contador de inscritos); opcional
 *   extraLabel   - texto para lectores de pantalla en lugar de `extra` (si `extra` es solo ícono y número)
 *   badge        - pastilla de estado; opcional
 *   actions      - botones al final de la fila; opcional
 *   selected     - true la marca como seleccionada
 *   onClick      - al elegir la fila
 *   className    - clase extra; opcional
 */
export function EventRow({ weekday, day, icon, title, meta, extra, extraLabel, badge, actions, selected = false, onClick, className }) {
  const classes = ['ui-event-row', selected && 'is-selected', className].filter(Boolean).join(' ');

  return (
    <article className={classes}>
      <button type="button" className="ui-event-row__main" onClick={onClick}>
        <span className="ui-event-row__date" aria-hidden={!day}>
          {weekday && <span className="ui-event-row__weekday">{weekday}</span>}
          <span className="ui-event-row__day">{day || '—'}</span>
        </span>
        {icon && (
          <span className="ui-event-row__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="ui-event-row__body">
          <span className="ui-event-row__title">{title}</span>
          {meta && <span className="ui-event-row__meta">{meta}</span>}
        </span>
        {extra && (
          <span className="ui-event-row__extra">
            <span className="ui-event-row__extra-visible" aria-hidden={extraLabel ? true : undefined}>
              {extra}
            </span>
            {extraLabel && <span className="ui-event-row__sr">{extraLabel}</span>}
          </span>
        )}
        {badge && <span className="ui-event-row__badge">{badge}</span>}
      </button>
      {actions && <div className="ui-event-row__actions">{actions}</div>}
    </article>
  );
}

export default EventRow;
