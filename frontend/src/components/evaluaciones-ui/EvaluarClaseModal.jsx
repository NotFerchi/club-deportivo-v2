import React, { useRef, useState } from 'react';
import { Alert, Button, Modal, Stack, Text, Textarea } from '../ui';
import { COMENTARIO_MAX, ETIQUETAS_CALIFICACION, validarEvaluacion } from './evaluacionUtils';

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
      onClose={onClose}
      title="Evaluar clase"
      subtitle={`${clase.disciplina} · ${clase.instructor}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar evaluación'}
          </Button>
        </>
      )}
    >
      <Stack gap={16}>
        {error && <Alert variant="error">{error}</Alert>}

        <Stack gap={8}>
          <Text variant="small" as="span" id="evaluacion-calificacion">Calificación *</Text>
          <Stack direction="row" gap={8} wrap role="radiogroup" aria-labelledby="evaluacion-calificacion">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                role="radio"
                aria-checked={calificacion === n}
                variant={calificacion === n ? 'primary' : 'secondary'}
                onClick={() => setCalificacion(n)}
                disabled={enviando}
              >
                {n}
              </Button>
            ))}
          </Stack>
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
          Tu evaluación es anónima: el instructor ve la calificación y el comentario, pero no quién la hizo.
        </Text>
      </Stack>
    </Modal>
  );
}
