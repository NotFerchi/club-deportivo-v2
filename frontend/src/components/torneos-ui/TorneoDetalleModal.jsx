import React from 'react';
import { Alert, Badge, Button, Modal, ProgressBar, Stack, Text } from '../ui';
import { estadoTorneo, formatFecha, motivoSinInscripcion } from './torneoEstado';

function Dato({ etiqueta, children }) {
  return (
    <Stack gap={4}>
      <Text variant="overline" muted>{etiqueta}</Text>
      <Text>{children}</Text>
    </Stack>
  );
}

/**
 * TorneoDetalleModal - ficha de un torneo: estado, fechas, categoría, cupo y, si no admite
 * inscripción, el motivo. Los botones de acción solo aparecen si se pasa su manejador.
 *
 * Props:
 *   torneo       - torneo con la forma de GET /api/torneos; null cierra el modal
 *   onClose      - cierra el modal
 *   onEditar     - (torneo) => void; staff. Sin esta prop no se muestra "Editar"
 *   onInscribir  - (torneo) => void; socio. Se muestra solo si el torneo admite inscripción
 */
export default function TorneoDetalleModal({ torneo, onClose, onEditar, onInscribir }) {
  if (!torneo) return null;

  const estado = estadoTorneo(torneo.estado);
  const esEquipos = torneo.tipo_torneo === 'Equipos';
  const motivo = motivoSinInscripcion(torneo);
  const puedeInscribirse = Boolean(onInscribir) && torneo.admite_inscripcion && !esEquipos;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={torneo.nombre}
      subtitle={torneo.nombre_disciplina}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          {onEditar && <Button variant="secondary" onClick={() => onEditar(torneo)}>Editar</Button>}
          {puedeInscribirse && <Button onClick={() => onInscribir(torneo)}>Inscribirme</Button>}
        </>
      )}
    >
      <Stack gap={16}>
        <Stack direction="row" gap={8} wrap>
          <Badge variant={estado.variant}>{estado.label}</Badge>
          <Badge>{esEquipos ? 'Por equipos' : 'Individual'}</Badge>
        </Stack>

        <Stack direction="row" gap={16} grow minChild={120}>
          <Dato etiqueta="Inicio">{formatFecha(torneo.fecha_inicio)}</Dato>
          <Dato etiqueta="Fin">{formatFecha(torneo.fecha_fin)}</Dato>
          <Dato etiqueta="Categoría">{torneo.nombre_categoria || 'Sin categoría'}</Dato>
        </Stack>

        {torneo.cupo_maximo === null
          ? <Dato etiqueta="Inscritos">{torneo.total_participantes} (sin límite de cupo)</Dato>
          : <ProgressBar label="Inscritos" value={torneo.total_participantes} max={torneo.cupo_maximo} />}

        {onInscribir && esEquipos && torneo.estado === 'Abierto' && (
          <Alert variant="info">Este torneo es por equipos: la inscripción la hace el staff.</Alert>
        )}
        {onInscribir && !esEquipos && motivo && <Alert variant="warning">{motivo}</Alert>}
      </Stack>
    </Modal>
  );
}
