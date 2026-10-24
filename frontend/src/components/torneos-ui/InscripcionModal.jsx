import React, { useState } from 'react';
import { Alert, Button, Modal, Stack, Text } from '../ui';
import { formatFecha } from './torneoEstado';

/**
 * InscripcionModal - confirmación para que el socio se inscriba (§3.6 del contrato).
 * Si el backend rechaza la inscripción (cupo lleno, periodo cerrado, ya inscrito…),
 * se muestra su mensaje tal cual y el modal sigue abierto.
 *
 * Props:
 *   torneo      - torneo al que se inscribe; null cierra el modal
 *   onConfirmar - (torneo) => Promise; si rechaza, se muestra err.message
 *   onClose     - cierra el modal
 */
export default function InscripcionModal({ torneo, onConfirmar, onClose }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  if (!torneo) return null;

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(torneo);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Inscribirme al torneo"
      subtitle={torneo.nombre}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? 'Procesando…' : 'Confirmar inscripción'}
          </Button>
        </>
      )}
    >
      <Stack gap={12}>
        {error && <Alert variant="error">{error}</Alert>}
        <Text>
          Te vas a inscribir en <strong>{torneo.nombre}</strong> ({torneo.nombre_disciplina}), categoría{' '}
          <strong>{torneo.nombre_categoria}</strong>.
        </Text>
        <Text muted>Inicio: {formatFecha(torneo.fecha_inicio)}</Text>
      </Stack>
    </Modal>
  );
}
