import React, { useId } from 'react';
import './StepSection.css';

/**
 * StepSection - sección numerada de un flujo por pasos (Stitch: socio/reservar).
 *
 *   <StepSection step={1} title="¿Qué quieres jugar?" aside="9 deportes">
 *     …contenido del paso…
 *   </StepSection>
 *
 * Props:
 *   step      - número del paso
 *   title     - título del paso (h2)
 *   aside     - texto o nodo a la derecha del título; opcional
 *   ref       - ref a la <section> (p. ej. para hacer scroll hasta el paso)
 *   className - clase extra; opcional
 *   children  - contenido del paso
 */
export function StepSection({ step, title, aside, ref, className, children }) {
  const titleId = useId();
  return (
    <section ref={ref} className={['ui-step', className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <header className="ui-step__header">
        <span className="ui-step__number" aria-hidden="true">{step}</span>
        <h2 id={titleId} className="ui-step__title">{title}</h2>
        {aside && <div className="ui-step__aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

export default StepSection;
