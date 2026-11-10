import React from 'react';
import { CheckCircle, Lock, Trophy } from 'lucide-react';
import { Button, Spinner } from '../ui';
import { siguienteAccion, useAccionesTorneo } from '../torneos/useAccionesTorneo';
import { useAvisoAccion } from './useAvisoAccion';

const ICONO_ACCION = { cerrar: Lock, confirmar: CheckCircle, finalizar: Trophy };

/** Botón con la siguiente acción del torneo (Cerrar inscripciones / Confirmar bracket / Finalizar). */
function AccionPrincipal({ torneo, onActualizar }) {
  const { cargando, mensaje, ejecutar } = useAccionesTorneo(torneo, onActualizar);
  useAvisoAccion(mensaje);
  const accion = siguienteAccion(torneo.estado);
  if (!accion) return null;
  const Icono = ICONO_ACCION[accion.id];
  return (
    <Button variant="soft" disabled={cargando} onClick={() => ejecutar(accion)}>
      {cargando ? <Spinner label={accion.cargandoLabel} /> : <Icono size={16} aria-hidden="true" />}
      {cargando ? accion.cargandoLabel : accion.label}
    </Button>
  );
}

export default AccionPrincipal;
