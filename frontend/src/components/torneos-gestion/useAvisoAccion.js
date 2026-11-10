import { useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';

/**
 * Muestra como toast el mensaje que deja useAccionesTorneo (el del backend o "✅ Listo"; el error,
 * tal cual). Es el mismo texto que antes salía debajo de los botones de AccionesTorneo.
 */
export function useAvisoAccion(mensaje) {
  const { toast } = useNotification();
  useEffect(() => {
    if (mensaje) toast(mensaje.texto, mensaje.tipo === 'ok' ? 'success' : 'error');
  }, [mensaje, toast]);
}

export default useAvisoAccion;
