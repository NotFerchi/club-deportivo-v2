import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import './Toast.css';

const VARIANTS = {
  success: { Icon: CheckCircle2, role: 'status' },
  info: { Icon: Info, role: 'status' },
  warning: { Icon: AlertTriangle, role: 'alert' },
  error: { Icon: XCircle, role: 'alert' },
};

// Regla del tablero M0: éxito e info se cierran solos (4.5 s); advertencias y errores
// esperan confirmación del usuario.
const AUTO_CLOSE_MS = { success: 4500, info: 4500, warning: 0, error: 0 };

/**
 * Toast - notificación flotante en píldora (vidrio). Solo presentación: el padre decide
 * cuándo montarlo y qué hace `onClose`. Sin lógica de cola (la conexión con
 * NotificationContext va en la Parte 2).
 *
 *   <Toast variant="success" onClose={cerrar}>Inscripción confirmada con éxito</Toast>
 *   <Toast variant="error" title="No se pudo guardar" onClose={cerrar}>Error al procesar el pago.</Toast>
 *
 * Props:
 *   variant  - 'success' (default) | 'info' | 'warning' | 'error'
 *   title    - línea en negrita sobre el mensaje; opcional
 *   children - mensaje
 *   onClose  - muestra el botón cerrar y se llama al expirar `duration`
 *   duration - ms para cerrarse solo; 0 = no se cierra. Default según la variante
 *   className - clase extra; opcional
 */
export function Toast({ variant = 'success', title, children, onClose, duration, className }) {
  const safeVariant = Object.hasOwn(VARIANTS, variant) ? variant : 'success';
  const { Icon, role } = VARIANTS[safeVariant];
  const ms = duration ?? AUTO_CLOSE_MS[safeVariant];
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!ms || !onCloseRef.current) return undefined;
    const timer = setTimeout(() => onCloseRef.current?.(), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  const classes = ['ui-toast', `ui-toast--${safeVariant}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role={role}>
      <span className="ui-toast__icon" aria-hidden="true"><Icon size={20} /></span>
      <div className="ui-toast__content">
        {title && <p className="ui-toast__title">{title}</p>}
        <p className="ui-toast__message">{children}</p>
      </div>
      {onClose && (
        <button type="button" className="ui-toast__close" onClick={onClose} aria-label="Cerrar notificación">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/** ToastViewport - contenedor fijo (abajo a la derecha; centrado en móvil) que apila toasts. */
export function ToastViewport({ children, className }) {
  return <div className={['ui-toast-viewport', className].filter(Boolean).join(' ')}>{children}</div>;
}

export default Toast;
