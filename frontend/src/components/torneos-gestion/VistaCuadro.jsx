import React from 'react';
import { ArrowLeft, Pencil, Users } from 'lucide-react';
import { Button, Stack } from '../ui';
import DetalleTorneo from '../torneos/DetalleTorneo';
import AccionesTorneo from '../torneos/AccionesTorneo';
import CuadroTorneo from '../torneos/CuadroTorneo';

/**
 * "Ver cuadro": el detalle de siempre (DetalleTorneo, AccionesTorneo, cuadro y editar encuentro).
 * Se rediseña en el Paso 2 de U4-03; aquí solo se monta con un botón para volver a la lista.
 */
function VistaCuadro({ gestion, torneo, puedeEditar, onVolver, onEditar, onVerInscritos }) {
  return (
    <Stack gap={16}>
      <Stack direction="row" gap={8} wrap>
        <Button variant="secondary" onClick={onVolver}>
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la lista
        </Button>
        {puedeEditar && (
          <>
            <Button variant="secondary" onClick={() => onEditar(torneo)}>
              <Pencil size={16} aria-hidden="true" />
              Editar torneo
            </Button>
            <Button variant="secondary" onClick={() => onVerInscritos(torneo)}>
              <Users size={16} aria-hidden="true" />
              Inscritos ({torneo.total_participantes ?? 0})
            </Button>
          </>
        )}
      </Stack>
      <div>
        <DetalleTorneo torneo={torneo} />
        {/* key por torneo: el mensaje de una acción no pasa al siguiente torneo (B-24) */}
        <AccionesTorneo
          key={torneo.torneo_id}
          torneo={torneo}
          onActualizar={gestion.handleTorneoActualizado}
          readOnly={!puedeEditar}
        />
        <CuadroTorneo gestion={gestion} />
      </div>
    </Stack>
  );
}

export default VistaCuadro;
