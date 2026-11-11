import React from 'react';
import './Card.css';

/**
 * Card - panel con título opcional, ícono y una acción en el encabezado.
 *
 *   <Card title="Visitas activas" icon={<UserCheck size={16} />}
 *         action={<Button variant="secondary" onClick={verTodo}>Ver todo</Button>}>
 *     ...contenido
 *   </Card>
 *
 * Props:
 *   title     - título del panel; si no hay título ni acción, no se dibuja encabezado
 *   icon      - nodo (ícono) junto al título; opcional
 *   action    - nodo a la derecha del encabezado (p. ej. un Button); opcional
 *   glass     - true usa el estilo de vidrio (Liquid Glass); úsalo sobre fondos con color
 *   accent    - barra de color a la izquierda: 'blue' | 'violet' | 'green' | 'amber' | 'cyan'; opcional
 *   footer    - nodo al pie, separado por una línea y alineado a la derecha (p. ej. un Button); opcional
 *   flush     - true quita el margen interior del cuerpo (para tablas o listas a ras del borde)
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo de <section>
 */
export function Card({ title, icon, action, accent, footer, flush = false, glass = false, className, children, ...rest }) {
  const classes = ['ui-card', glass && 'ui-card--glass', accent && `ui-card--accent ui-card--accent-${accent}`, className].filter(Boolean).join(' ');
  const hasHeader = Boolean(title || action);

  return (
    <section className={classes} {...rest}>
      {hasHeader && (
        <header className="ui-card__header">
          <span className="ui-card__heading">
            {icon && <span className="ui-card__icon" aria-hidden="true">{icon}</span>}
            {title && <h3 className="ui-card__title">{title}</h3>}
          </span>
          {action}
        </header>
      )}
      <div className={flush ? 'ui-card__body ui-card__body--flush' : 'ui-card__body'}>{children}</div>
      {footer && <footer className="ui-card__footer">{footer}</footer>}
    </section>
  );
}

export default Card;
