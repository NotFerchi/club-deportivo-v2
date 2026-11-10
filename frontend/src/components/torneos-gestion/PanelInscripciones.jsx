import React from 'react';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState, ProgressBar, Stack, Text } from '../ui';
import { cierreInscripciones, cupoDe, pastillaDe } from './torneoVista';
import { useInscritosTorneo } from './useInscritosTorneo';

/**
 * Panel derecho "Inscripciones del torneo": estado, progreso de cupos, cierre de inscripciones (si
 * la API lo da; solo fecha) y los últimos 4 inscritos con su tipo (Socio, Visita o Externo).
 * "Ver todos los inscritos" abre el modal de siempre; como antes, solo para quien edita.
 */
function PanelInscripciones({ torneo, puedeEditar, onVerInscritos }) {
  const cupo = cupoDe(torneo);
  const pastilla = pastillaDe(torneo);
  const cierre = cierreInscripciones(torneo);
  // total_participantes cambia al inscribir o dar de baja: vuelve a pedir la lista
  const { inscritos, ultimos, cargando, error, reintentar } = useInscritosTorneo(torneo.torneo_id, torneo.total_participantes);

  return (
    <Card title="Inscripciones del torneo" action={<Badge variant={pastilla.variant}>{pastilla.label}</Badge>}>
      <Stack gap={24}>
        <Text variant="small" muted>
          {torneo.nombre || `Torneo #${torneo.torneo_id}`}
          {torneo.nombre_categoria ? ` · ${torneo.nombre_categoria}` : ''}
        </Text>

        <Stack gap={12}>
          {cupo.maximo ? (
            <ProgressBar label="Progreso de cupos" value={cupo.inscritos} max={cupo.maximo} />
          ) : (
            <Stack direction="row" justify="between" align="center" gap={8}>
              <Text variant="overline" muted>
                Progreso de cupos
              </Text>
              <Text variant="small">
                {cupo.inscritos} {cupo.inscritos === 1 ? 'inscrito' : 'inscritos'} · Sin límite
              </Text>
            </Stack>
          )}
          {cierre && (
            <Stack direction="row" gap={8} align="center">
              <CalendarCheck size={16} aria-hidden="true" />
              <Text variant="small">Cierre de inscripciones {cierre}</Text>
            </Stack>
          )}
        </Stack>

        <Stack gap={12}>
          <Text variant="overline" muted as="h4">
            Inscritos
          </Text>
          {cargando && <LoadingState rows={2} label="Cargando inscritos…" />}
          {!cargando && error && <ErrorState message={error} onRetry={reintentar} />}
          {!cargando && !error && inscritos.length === 0 && (
            <EmptyState title="Sin inscritos" message="Aún no hay participantes en este torneo." />
          )}
          {!cargando && !error && ultimos.length > 0 && (
            <Stack gap={12} role="list" aria-label="Últimos inscritos">
              {ultimos.map((p) => (
                <Stack key={p.participante_id} role="listitem" direction="row" gap={12} align="center">
                  <Avatar name={p.nombre_participante} />
                  <Stack gap={0}>
                    <Text variant="small" as="span">
                      {p.nombre_participante}
                    </Text>
                    <Text variant="caption" muted as="span">
                      {p.tipo_participante}
                      {p.categoria ? ` · ${p.categoria}` : ''}
                    </Text>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>

        {puedeEditar && (
          <Button onClick={() => onVerInscritos(torneo)}>
            Ver todos los inscritos
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        )}
      </Stack>
    </Card>
  );
}

export default PanelInscripciones;
