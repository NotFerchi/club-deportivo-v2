import React from 'react';
import { MessageSquareQuote, X } from 'lucide-react';
import { Avatar, Badge, Card, IconButton, RatingDistribution, Stack, Stars, Text } from '../ui';
import { nombreMes } from '../evaluaciones-ui/resultadosUtils';
import { unaDecimal } from './evaluacionesVista';

const MAX_COMENTARIOS = 5;

/** "2026-11" → "Nov 2026". */
function mesCorto(periodo) {
  const texto = nombreMes(periodo);
  const m = texto.match(/^(\S+) de (\d{4})$/);
  return m ? `${m[1].slice(0, 3)} ${m[2]}` : texto;
}

/**
 * Panel de un instructor (U4-20): promedio grande con estrellas, total del mes, distribución de 5★ a
 * 1★ y los comentarios anónimos más recientes. De cada comentario solo se muestra lo que da la API
 * anónima (disciplina, calificación y mes): ningún dato del socio.
 */
function DetalleInstructorPanel({ fila, periodo, onCerrar }) {
  const comentarios = fila.lista.filter((e) => e.comentario && String(e.comentario).trim()).slice(0, MAX_COMENTARIOS);
  const mes = nombreMes(periodo);

  return (
    <Card id="detalle-instructor" aria-label={`Evaluaciones de ${fila.nombre}`}>
      <Stack gap={24}>
        <Stack direction="row" gap={16} align="center" justify="between">
          <Stack direction="row" gap={12} align="center">
            <Avatar name={fila.nombre} src={fila.foto || undefined} size="lg" />
            <Stack gap={4}>
              <Text variant="subheading" as="h3">
                {fila.nombre}
              </Text>
              {fila.detalle && (
                <Text variant="small" muted as="span">
                  {fila.detalle}
                </Text>
              )}
            </Stack>
          </Stack>
          <IconButton label="Cerrar detalle" onClick={onCerrar}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </Stack>

        {fila.total === 0 ? (
          <Text muted>Sin evaluaciones en {mes}.</Text>
        ) : (
          <>
            <Card>
              <Stack gap={8}>
                <Stack direction="row" gap={12} align="center" justify="between" wrap>
                  <Stack direction="row" gap={8} align="end">
                    <Text variant="title" as="span">
                      {unaDecimal(fila.promedio)}
                    </Text>
                    <Text muted as="span">
                      de 5.0
                    </Text>
                  </Stack>
                  <Stars value={fila.promedio} size="lg" />
                </Stack>
                <Text variant="small" muted>
                  {fila.total} {fila.total === 1 ? 'evaluación recibida' : 'evaluaciones recibidas'} en {mes}
                </Text>
              </Stack>
            </Card>

            <Stack gap={12}>
              <Text variant="overline" as="h4">
                Distribución de calificaciones
              </Text>
              <RatingDistribution distribucion={fila.distribucion} />
            </Stack>

            <Stack gap={12}>
              <Stack direction="row" gap={8} align="center" justify="between">
                <Text variant="overline" as="h4">
                  Comentarios anónimos recientes
                </Text>
                {comentarios.length > 0 && <Badge variant="muted">{comentarios.length === 1 ? 'Último' : `Últimos ${comentarios.length}`}</Badge>}
              </Stack>
              {comentarios.length === 0 ? (
                <Text variant="small" muted>
                  Las evaluaciones de este mes no tienen comentarios.
                </Text>
              ) : (
                <Stack gap={12} role="list" aria-label="Comentarios anónimos">
                  {comentarios.map((e) => (
                    <Card key={e.evaluacion_id} role="listitem">
                      <Stack gap={8}>
                        <Stack direction="row" gap={8} align="center" justify="between" wrap>
                          <Badge variant="glass">
                            Anónimo · {mesCorto(e.periodo)}
                            {e.disciplina ? ` · ${e.disciplina}` : ''}
                          </Badge>
                          <Stars value={e.calificacion} size="sm" />
                        </Stack>
                        <Stack direction="row" gap={8} align="start">
                          <MessageSquareQuote size={16} aria-hidden="true" />
                          <Text variant="small" as="p">
                            {e.comentario}
                          </Text>
                        </Stack>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Card>
  );
}

export default DetalleInstructorPanel;
