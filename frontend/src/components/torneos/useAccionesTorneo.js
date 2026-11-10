import { useState } from 'react';
import { apiRequest } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { mensajeDeError } from './torneoUtils';

// Acciones del torneo con sus confirmaciones. Salieron de AccionesTorneo (U4-03) para que la lista
// nueva del personal use exactamente los mismos endpoints, textos y showConfirm.
export const ACCION_CERRAR = {
  id: 'cerrar',
  endpoint: 'cerrar-inscripciones',
  label: 'Cerrar inscripciones',
  cargandoLabel: 'Cerrando...',
  confirmar: ['¿Cerrar inscripciones y generar el bracket?', { confirmLabel: 'Cerrar inscripciones' }]
};

export const ACCION_CONFIRMAR = {
  id: 'confirmar',
  endpoint: 'confirmar-bracket',
  label: 'Confirmar bracket',
  cargandoLabel: 'Confirmando...',
  confirmar: ['¿Confirmar bracket?', { confirmLabel: 'Confirmar' }]
};

export const ACCION_FINALIZAR = {
  id: 'finalizar',
  endpoint: 'finalizar',
  label: 'Finalizar torneo',
  cargandoLabel: 'Finalizando...',
  confirmar: ['¿Finalizar el torneo? Esta acción no se puede deshacer.', { danger: true, confirmLabel: 'Finalizar' }]
};

export const ACCION_CANCELAR = {
  id: 'cancelar',
  endpoint: 'cancelar',
  label: 'Cancelar torneo',
  cargandoLabel: 'Cancelando...',
  confirmar: ['¿Cancelar el torneo? Esta acción no se puede deshacer.', { danger: true, confirmLabel: 'Cancelar torneo' }]
};

const SIGUIENTE_POR_ESTADO = {
  Abierto: ACCION_CERRAR,
  Inscripciones_cerradas: ACCION_CONFIRMAR,
  En_curso: ACCION_FINALIZAR
};

/** Siguiente acción del torneo según su estado; null si ya no tiene (Finalizado, Cancelado). */
export function siguienteAccion(estado) {
  return SIGUIENTE_POR_ESTADO[estado] || null;
}

/** Con Finalizado o Cancelado ya no hay acciones (ni cancelar). */
export function admiteAcciones(estado) {
  return !['Cancelado', 'Finalizado'].includes(estado);
}

/**
 * Ejecuta una acción del torneo: pide confirmación y llama PATCH /torneos/:id/:endpoint.
 * Quien lo use debe montarse con key={torneo_id} para que el mensaje no pase a otro torneo (B-24).
 */
export function useAccionesTorneo(torneo, onActualizar) {
  const { showConfirm } = useNotification();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const llamar = async (endpoint) => {
    setCargando(true);
    setMensaje(null);
    try {
      // apiRequest revisa res.ok y, con la sesión vencida, redirige al login (B-25)
      const data = await apiRequest(`/torneos/${torneo.torneo_id}/${endpoint}`, { method: 'PATCH' });
      setMensaje({ tipo: 'ok', texto: data?.message || '✅ Listo' });
      if (onActualizar) onActualizar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(err) });
    } finally {
      setCargando(false);
    }
  };

  const ejecutar = async (accion) => {
    if (await showConfirm(...accion.confirmar)) llamar(accion.endpoint);
  };

  return { cargando, mensaje, ejecutar };
}

export default useAccionesTorneo;
