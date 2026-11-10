import React from 'react';
import './HeroCard.css';

/**
 * HeroCard - tarjeta navy grande para destacar un elemento (p. ej. el torneo seleccionado).
 * Usa la foto si hay `image`; si no, un degradado navy. A la derecha van paneles de vidrio.
 *
 *   <HeroCard
 *     eyebrow="Temporada 2026"
 *     title="Copa del Rey 2026"
 *     subtitle="Tenis · Adulto libre · 15 al 22 Nov"
 *   >
 *     <HeroPanel label="Cupo de participantes">
 *       <HeroStat value={12} max={16} caption="Quedan 4 lugares disponibles" />
 *     </HeroPanel>
 *     <HeroPanel label="Fase: En curso" title="Acción del coordinador">
 *       <Button variant="soft">Finalizar torneo</Button>
 *     </HeroPanel>
 *   </HeroCard>
 *
 * Props:
 *   eyebrow   - texto de la pastilla superior; opcional
 *   title     - título grande (h2)
 *   subtitle  - línea de apoyo bajo el título; opcional
 *   image     - URL de una foto de fondo; opcional (sin foto: degradado navy)
 *   children  - paneles (HeroPanel) a la derecha; opcional
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo de <section> (aria-*, etc.)
 */
export function HeroCard({ eyebrow, title, subtitle, image, children, className, ...rest }) {
  const classes = ['ui-hero', image && 'ui-hero--image', className].filter(Boolean).join(' ');
  return (
    <section className={classes} {...rest}>
      {image && <img className="ui-hero__image" src={image} alt="" />}
      <div className="ui-hero__content">
        {eyebrow && <span className="ui-hero__eyebrow">{eyebrow}</span>}
        <h2 className="ui-hero__title">{title}</h2>
        {subtitle && <p className="ui-hero__subtitle">{subtitle}</p>}
      </div>
      {children && <div className="ui-hero__panels">{children}</div>}
    </section>
  );
}

/**
 * HeroPanel - panel de vidrio oscuro dentro de HeroCard.
 *   label    - rótulo pequeño en mayúsculas; opcional
 *   dot      - true pone un punto antes del rótulo (p. ej. "● Fase: En curso")
 *   title    - texto en negritas bajo el rótulo; opcional
 *   children - contenido (HeroStat, botones…)
 */
export function HeroPanel({ label, dot = false, title, children, className }) {
  return (
    <div className={['ui-hero-panel', className].filter(Boolean).join(' ')}>
      {label && (
        <span className={['ui-hero-panel__label', dot && 'ui-hero-panel__label--dot'].filter(Boolean).join(' ')}>
          {label}
        </span>
      )}
      {title && <span className="ui-hero-panel__title">{title}</span>}
      {children}
    </div>
  );
}

/**
 * HeroStat - cifra "valor / máximo" con barra, para HeroPanel.
 *   value   - valor actual
 *   max     - máximo; si no es un número mayor que 0 no se dibuja la barra ni "/ máximo"
 *   caption - texto bajo la barra (p. ej. "Quedan 4 lugares disponibles"); opcional
 */
export function HeroStat({ value, max, caption }) {
  const tieneMax = Number(max) > 0;
  const pct = tieneMax ? Math.min(100, Math.max(0, (Number(value) / Number(max)) * 100)) : 0;
  return (
    <div className="ui-hero-stat">
      <span className="ui-hero-stat__value">
        {value}
        {tieneMax && <span className="ui-hero-stat__max"> / {max}</span>}
      </span>
      {tieneMax && (
        <span
          className="ui-hero-stat__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={Number(max)}
          aria-valuenow={Number(value)}
          aria-label={`${value} de ${max}`}
        >
          {/* Ancho dinámico dentro del kit, igual que ProgressBar */}
          <span className="ui-hero-stat__fill" style={{ width: `${pct}%` }} />
        </span>
      )}
      {caption && <span className="ui-hero-stat__caption">{caption}</span>}
    </div>
  );
}

export default HeroCard;
