import React from 'react';
import { CheckCircle, Lock, Network, Trophy } from 'lucide-react';
import { Button, HeroCard, HeroPanel, HeroStat, Spinner, Stack } from '../ui';
import { estadoTorneo } from '../torneos/torneoUtils';
import { siguienteAccion, useAccionesTorneo } from '../torneos/useAccionesTorneo';
import { useAvisoAccion } from './useAvisoAccion';
import MenuTorneo from './MenuTorneo';
import { cupoDe, rangoFechasLargo, temporadaDe } from './torneoVista';

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

/**
 * Hero del torneo seleccionado: nombre, temporada, disciplina · categoría · fechas, cupo y fase.
 * Quien edita ve la siguiente acción y el menú ⋯; en solo lectura solo "Ver cuadro".
 * El padre lo monta con key={torneo_id} (los avisos de una acción no pasan a otro torneo).
 */
function TorneoHero({ torneo, puedeEditar, etiquetaAccion, onActualizar, onEditar, onVerInscritos, onVerCuadro }) {
  const cupo = cupoDe(torneo);
  const subtitulo = [torneo.nombre_disciplina, torneo.nombre_categoria, rangoFechasLargo(torneo)].filter(Boolean).join(' · ');
  const leyendaCupo =
    cupo.maximo === null
      ? 'Sin límite de cupo'
      : cupo.quedan === 0
        ? 'Cupo lleno'
        : `Quedan ${cupo.quedan} ${cupo.quedan === 1 ? 'lugar disponible' : 'lugares disponibles'}`;

  return (
    <HeroCard
      eyebrow={`Temporada ${temporadaDe(torneo)}`}
      title={torneo.nombre || `Torneo #${torneo.torneo_id}`}
      subtitle={subtitulo}
      aria-label={`Torneo seleccionado: ${torneo.nombre || torneo.torneo_id}`}
    >
      <HeroPanel label="Cupo de participantes">
        <HeroStat value={cupo.inscritos} max={cupo.maximo} caption={leyendaCupo} />
      </HeroPanel>
      <HeroPanel label={`Fase: ${estadoTorneo(torneo.estado).label}`} dot title={!puedeEditar ? 'Cuadro del torneo' : siguienteAccion(torneo.estado) ? etiquetaAccion : 'Sin acciones pendientes'}>
        <Stack direction="row" gap={8} align="center">
          {puedeEditar ? (
            <>
              <AccionPrincipal torneo={torneo} onActualizar={onActualizar} />
              <MenuTorneo
                torneo={torneo}
                puedeEditar
                triggerVariant="glass"
                onActualizar={onActualizar}
                onEditar={onEditar}
                onVerInscritos={onVerInscritos}
                onVerCuadro={onVerCuadro}
              />
            </>
          ) : (
            <Button variant="soft" onClick={() => onVerCuadro(torneo)}>
              <Network size={16} aria-hidden="true" />
              Ver cuadro
            </Button>
          )}
        </Stack>
      </HeroPanel>
    </HeroCard>
  );
}

export default TorneoHero;
