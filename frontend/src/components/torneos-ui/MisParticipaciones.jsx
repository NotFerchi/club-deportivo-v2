import React, { useState } from 'react';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, ErrorState, EventCard, FocusList, LoadingState, Select, Stack, Text } from '../ui';
import { ESTADOS_TORNEO, diaMes, estadoTorneo, formatFecha } from './torneoEstado';
import { iconoDisciplina } from './disciplinaIcono';
import { fotoDisciplina } from './fotoDisciplina';

/**
 * MisParticipaciones - torneos en los que participa el socio: filtros, un
 * carrusel de tarjetas y la lista completa con su estado. Con sus estados de carga, error y vacío.
 * Los datos tienen la forma de GET /api/torneos/mis-participaciones.
 *
 * Props:
 *   participaciones - [{ participante_id, torneo_id, nombre, estado, fecha_inicio, fecha_fin,
 *                        nombre_disciplina, categoria }]
 *   cargando        - true mientras llega la lista
 *   error           - mensaje del backend si la carga falló; null si no
 *   onReintentar    - vuelve a pedir la lista
 *   onSeleccionar   - (participacion) => void; toque en una tarjeta o fila
 */
export default function MisParticipaciones({ participaciones, cargando, error, onReintentar, onSeleccionar }) {
  const [disciplina, setDisciplina] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  if (cargando) return <LoadingState rows={2} label="Cargando tus participaciones…" />;
  if (error) return <ErrorState message={error} onRetry={onReintentar} />;

  if (!participaciones.length) {
    return (
      <EmptyState
        title="Aún no participas en ningún torneo"
        message="Cuando te inscribas a un torneo aparecerá aquí."
      />
    );
  }

  const disciplinas = [...new Set(participaciones.map((p) => p.nombre_disciplina).filter(Boolean))];
  const visibles = participaciones.filter((p) => (
    (!disciplina || p.nombre_disciplina === disciplina) && (!estadoFiltro || p.estado === estadoFiltro)
  ));
  const hayFiltros = Boolean(disciplina || estadoFiltro);
  const limpiar = () => { setDisciplina(''); setEstadoFiltro(''); };

  return (
    <Stack gap={16}>
      <ChipRow ariaLabel="Disciplina">
        <Chip selected={disciplina === ''} onClick={() => setDisciplina('')}>Todos</Chip>
        {disciplinas.map((d) => (
          <Chip key={d} selected={disciplina === d} onClick={() => setDisciplina(d)}>{d}</Chip>
        ))}
      </ChipRow>
      <Select
        label="Estado"
        placeholder="Todos"
        value={estadoFiltro}
        onChange={(event) => setEstadoFiltro(event.target.value)}
        options={ESTADOS_TORNEO.map((e) => ({ value: e.value, label: e.label }))}
      />

      {!visibles.length && (
        <EmptyState
          title="Sin resultados"
          message="Ninguno de tus torneos coincide con los filtros."
          action={hayFiltros ? <Button variant="secondary" onClick={limpiar}>Limpiar filtros</Button> : undefined}
        />
      )}

      {visibles.length > 0 && (
      <FocusList ariaLabel="Mis torneos">
        {visibles.map((p) => {
          const estado = estadoTorneo(p.estado);
          const { day, month } = diaMes(p.fecha_inicio);
          const fin = diaMes(p.fecha_fin);
          const chips = [fin.day && `Termina ${fin.day} ${fin.month}`].filter(Boolean);
          return (
            <EventCard
              key={p.participante_id}
              kicker={p.nombre_disciplina}
              icon={iconoDisciplina(p.nombre_disciplina)}
              photo={fotoDisciplina(p.nombre_disciplina)}
              day={day}
              month={month}
              title={p.nombre}
              description={p.categoria || 'Sin categoría'}
              chips={chips.length ? chips : undefined}
              progress={{ label: '✓ Estás inscrito en este torneo' }}
              status={<Badge variant={estado.variant}>{estado.label}</Badge>}
              cta="Ver resultados"
              onClick={() => onSeleccionar?.(p)}
              aria-label={`${p.nombre}, ${estado.label}. Ver resultados`}
            />
          );
        })}
      </FocusList>
      )}

      <Card title="Resumen de mis torneos">
        <Stack gap={12}>
          {participaciones.map((p) => {
            const estado = estadoTorneo(p.estado);
            return (
              <Stack key={p.participante_id} direction="row" gap={12} align="center" justify="between">
                <Stack gap={0}>
                  <Text>{p.nombre}</Text>
                  <Text variant="caption" muted>{p.nombre_disciplina} · {formatFecha(p.fecha_inicio)}</Text>
                </Stack>
                <Badge variant={estado.variant}>{estado.label}</Badge>
              </Stack>
            );
          })}
        </Stack>
      </Card>
    </Stack>
  );
}
