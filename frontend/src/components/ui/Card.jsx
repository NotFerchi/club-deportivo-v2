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
 *   flush     - true quita el margen interior del cuerpo (para tablas o listas a ras del borde)
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo de <section>
 */
export function Card({ title, icon, action, flush = false, className, children, ...rest }) {
  const classes = ['ui-card', className].filter(Boolean).join(' ');
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
    </section>
  );
}

export default Card;
