import React from 'react';
import './Alert.css';

const VARIANTS = ['error', 'success', 'warning', 'info'];

/**
 * Alert - aviso en línea para errores, confirmaciones y notas.
 *
 *   <Alert variant="error" action={<Button variant="secondary" onClick={recargar}>Reintentar</Button>}>
 *     No se pudieron cargar los torneos.
 *   </Alert>
 *   <Alert variant="success">¡Inscripción exitosa!</Alert>
 *   <Alert variant="warning" title="Cupo casi lleno">Quedan 2 lugares.</Alert>
 *
 * Los errores se anuncian como `role="alert"`; el resto como `role="status"`.
 * Úsalo para mostrar el mensaje que devuelve el backend tal cual.
 *
 * Props:
 *   variant   - 'error' (default) | 'success' | 'warning' | 'info'
 *   title     - título en negrita sobre el mensaje; opcional
 *   action    - nodo a la derecha (normalmente un Button); opcional
 *   className - clase extra; opcional
 *   children  - el mensaje
 */
export function Alert({ variant = 'error', title, action, className, children }) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'error';
  const classes = ['ui-alert', `ui-alert--${safeVariant}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role={safeVariant === 'error' ? 'alert' : 'status'}>
      <div className="ui-alert__content">
        {title && <p className="ui-alert__title">{title}</p>}
        <p className="ui-alert__message">{children}</p>
      </div>
      {action && <div className="ui-alert__action">{action}</div>}
    </div>
  );
}

export default Alert;
