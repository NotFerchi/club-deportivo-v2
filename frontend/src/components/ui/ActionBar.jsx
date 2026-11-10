import React from 'react';
import './ActionBar.css';

/**
 * ActionBar - barra fija de resumen y acción principal (Stitch: socio/reservar, "Reservar →").
 *
 *   <ActionBar ariaLabel="Resumen de la reserva" title="Pádel · Cancha 2" meta="11:00 – 12:00 · 1 h"
 *              action={<Button onClick={abrir}>Reservar <ArrowRight size={16} /></Button>} />
 *
 * En móvil flota justo encima de la barra del socio (MemberTabBar); en escritorio, al pie de
 * la pantalla. Deja un espacio en el flujo de la página para no tapar el contenido final.
 *
 * Props:
 *   ariaLabel - nombre accesible de la región
 *   title     - texto principal del resumen
 *   meta      - texto secundario; opcional
 *   action    - botón (normalmente Button primary)
 *   className - clase extra; opcional
 */
export function ActionBar({ ariaLabel, title, meta, action, className }) {
  return (
    <>
      <div className="ui-actionbar-spacer" aria-hidden="true" />
      <div className={['ui-actionbar', className].filter(Boolean).join(' ')} role="region" aria-label={ariaLabel}>
        <div className="ui-actionbar__summary">
          <span className="ui-actionbar__title">
            <span className="ui-actionbar__dot" aria-hidden="true" />
            {title}
          </span>
          {meta && <span className="ui-actionbar__meta">{meta}</span>}
        </div>
        {action}
      </div>
    </>
  );
}

export default ActionBar;
