import React from 'react';
import { Network } from 'lucide-react';
import { Button, HeroCard, HeroPanel, HeroStat, Stack } from '../ui';
import { estadoTorneo } from '../torneos/torneoUtils';
import { siguienteAccion } from '../torneos/useAccionesTorneo';
import AccionPrincipal from './AccionPrincipal';
import MenuTorneo from './MenuTorneo';
import { cupoDe, rangoFechasLargo, temporadaDe } from './torneoVista';

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
