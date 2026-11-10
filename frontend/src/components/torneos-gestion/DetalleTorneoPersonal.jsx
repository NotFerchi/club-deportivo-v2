import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Badge, Card, DetailHeader, Stack, Tabs, Text } from '../ui';
import { siguienteAccion } from '../torneos/useAccionesTorneo';
import AccionPrincipal from './AccionPrincipal';
import MenuTorneo from './MenuTorneo';
import CuadroPersonal from './CuadroPersonal';
import { IconoDisciplina, pastillaDe, rangoFechasLargo, temporadaDe } from './torneoVista';

/** Panel derecho del encabezado: la misma siguiente acción y el mismo ⋯ de la lista. */
function PanelAccion({ torneo, etiquetaAccion, onActualizar, onEditar, onVerInscritos, onVerCuadro }) {
  const accion = siguienteAccion(torneo.estado);
  return (
    <Card>
      <Stack gap={12}>
        <Text variant="overline" muted as="span">
          {accion ? etiquetaAccion : 'Sin acciones pendientes'}
        </Text>
        <Stack direction="row" gap={8} align="center" justify="between">
          {/* key: el aviso de una acción no pasa a otro torneo (B-24) */}
          <AccionPrincipal key={torneo.torneo_id} torneo={torneo} onActualizar={onActualizar} />
          <MenuTorneo
            key={`menu-${torneo.torneo_id}`}
            torneo={torneo}
            puedeEditar
            onActualizar={onActualizar}
            onEditar={onEditar}
            onVerInscritos={onVerInscritos}
            onVerCuadro={onVerCuadro}
          />
        </Stack>
      </Stack>
    </Card>
  );
}

/**
 * Detalle del torneo del personal (U4-03, Paso 2): encabezado con "← Torneos", temporada, estado,
 * nombre y fechas, la siguiente acción y el ⋯ (solo quien edita), y las pestañas.
 *
 * Props:
 *   gestion        - objeto de useGestionTorneos
 *   torneo         - torneo abierto (el más reciente de la lista)
 *   puedeEditar    - admin, gerente y coordinador; el instructor solo ve
 *   etiquetaAccion - rótulo del panel de acción
 *   pestana / onPestana - pestaña activa ('cuadro')
 *   onVolver, onEditar, onVerInscritos, onActualizar
 */
function DetalleTorneoPersonal({ gestion, torneo, puedeEditar, etiquetaAccion, pestana, onPestana, onVolver, onEditar, onVerInscritos, onActualizar }) {
  const pastilla = pastillaDe(torneo);
  const pestanas = [{ value: 'cuadro', label: 'Cuadro' }];

  return (
    <Stack gap={24}>
      <DetailHeader
        icon={<IconoDisciplina nombre={torneo.nombre_disciplina} size={32} />}
        backLabel="Torneos"
        onBack={onVolver}
        badges={
          <>
            <Badge variant="sky">Temporada {temporadaDe(torneo)}</Badge>
            <Badge variant={pastilla.variant}>{pastilla.label}</Badge>
          </>
        }
        title={torneo.nombre || `Torneo #${torneo.torneo_id}`}
        meta={
          <>
            <CalendarDays size={16} aria-hidden="true" />
            {rangoFechasLargo(torneo)} {temporadaDe(torneo)}
          </>
        }
        aside={
          puedeEditar && (
            <PanelAccion
              torneo={torneo}
              etiquetaAccion={etiquetaAccion}
              onActualizar={onActualizar}
              onEditar={onEditar}
              onVerInscritos={onVerInscritos}
              onVerCuadro={() => onPestana('cuadro')}
            />
          )
        }
      />

      {/* en fila: la barra de pestañas mide lo que sus pestañas, no todo el ancho */}
      <Stack direction="row">
        <Tabs ariaLabel="Secciones del torneo" idPrefix="torneo-detalle" tabs={pestanas} value={pestana} onChange={onPestana} />
      </Stack>

      <div role="tabpanel" id={`torneo-detalle-panel-${pestana}`} aria-labelledby={`torneo-detalle-tab-${pestana}`}>
        {pestana === 'cuadro' && <CuadroPersonal gestion={gestion} torneo={torneo} puedeEditar={puedeEditar} />}
      </div>
    </Stack>
  );
}

export default DetalleTorneoPersonal;
