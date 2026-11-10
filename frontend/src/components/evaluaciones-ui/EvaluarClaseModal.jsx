import React, { useRef, useState } from 'react';
import { Alert, Avatar, Button, Modal, Stack, StarRating, Text, Textarea } from '../ui';
import { COMENTARIO_MAX, ETIQUETAS_CALIFICACION, horaCorta, nombreDia, validarEvaluacion } from './evaluacionUtils';

/**
 * EvaluarClaseModal - formulario para que el socio califique al instructor de una clase (§3.1 del contrato).
 * Valida en el cliente (calificación obligatoria de 1 a 5, comentario de hasta 500 caracteres), deshabilita
 * el envío mientras espera y, si el backend rechaza (403, 409 "Ya evaluaste esta clase este mes"…),
 * muestra su mensaje tal cual y el modal sigue abierto.
 *
 * Props:
 *   clase       - clase a evaluar (forma de GET /api/inscripciones/mis-inscripciones); null cierra el modal
 *   onConfirmar - ({ sesion_id, calificacion, comentario }) => Promise; si rechaza se muestra err.message
 *   onClose     - cierra el modal
 */
export default function EvaluarClaseModal({ clase, onConfirmar, onClose }) {
  const [calificacion, setCalificacion] = useState(null);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // evita un segundo envío antes de que React pinte el botón deshabilitado

  if (!clase) return null;

  const enviar = async () => {
    if (enviandoRef.current) return;
    const mensaje = validarEvaluacion({ calificacion, comentario });
    if (mensaje) {
      setError(mensaje);
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar({ sesion_id: clase.sesion_id, calificacion, comentario: comentario.trim() });
    } catch (err) {
      setError(err.message);
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  return (
    <Modal
      isOpen
      variant="sheet"
      onClose={onClose}
      title="Evaluar clase"
      subtitle={`${clase.disciplina} · ${nombreDia(clase.dia_semana)} · ${horaCorta(clase.hora_inicio)}`}
      footer={(
        <>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar evaluación'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
        </>
      )}
    >
      <Stack gap={16}>
        {error && <Alert variant="error">{error}</Alert>}

        <Stack direction="row" gap={12} align="center">
          <Avatar name={clase.instructor} src={clase.instructor_foto} size="lg" />
          <Text variant="subheading" as="span">{clase.instructor}</Text>
        </Stack>

        <Stack gap={8}>
          <Text variant="small" as="span" id="evaluacion-calificacion">Calificación *</Text>
          <StarRating value={calificacion} onChange={setCalificacion} disabled={enviando} labelledBy="evaluacion-calificacion" />
          <Text variant="caption" muted>
            {calificacion ? `${calificacion} de 5 · ${ETIQUETAS_CALIFICACION[calificacion]}` : '1 = muy mala · 5 = excelente'}
          </Text>
        </Stack>

        <Textarea
          label="Comentario (opcional)"
          placeholder="Cuéntanos cómo fue la clase"
          maxLength={COMENTARIO_MAX}
          showCount
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          disabled={enviando}
        />

        <Text variant="caption" muted>
          Tu evaluación es anónima para el instructor.
        </Text>
      </Stack>
    </Modal>
  );
}
