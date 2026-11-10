import React from 'react';
import { Badge, Button, EmptyState, ErrorState, FocusList, LoadingState, EventCard } from '../ui';
import { diaMes, estadoTorneo } from './torneoEstado';
import { iconoDisciplina } from './disciplinaIcono';
import { fotoDisciplina } from './fotoDisciplina';

/**
 * TorneosListado - torneos como tarjetas con efecto de enfoque al hacer scroll (la del centro se
 * ve más grande), con sus estados de carga, error y vacío.
 *
 * Props:
 *   torneos       - arreglo con la forma de GET /api/torneos
 *   cargando      - true mientras llega la lista
 *   error         - mensaje del backend si la carga falló; null si no
 *   onReintentar  - vuelve a pedir la lista
 *   onSeleccionar - (torneo) => void; toque en una tarjeta
 *   hayFiltros    - true si hay filtros activos (cambia el mensaje de "vacío")
 *   onLimpiarFiltros - quita los filtros; opcional
 */
export default function TorneosListado({
  torneos,
  cargando,
  error,
  onReintentar,
  onSeleccionar,
  hayFiltros = false,
  onLimpiarFiltros,
}) {
  if (cargando) return <LoadingState rows={3} label="Cargando torneos…" />;
  if (error) return <ErrorState message={error} onRetry={onReintentar} />;

  if (!torneos.length) {
    return (
      <EmptyState
        title={hayFiltros ? 'Sin resultados' : 'Aún no hay torneos'}
        message={hayFiltros ? 'Ningún torneo coincide con los filtros.' : 'Cuando se cree un torneo aparecerá aquí.'}
        action={hayFiltros && onLimpiarFiltros
          ? <Button variant="secondary" onClick={onLimpiarFiltros}>Limpiar filtros</Button>
          : undefined}
      />
    );
  }

  return (
    <FocusList ariaLabel="Torneos del club">
      {torneos.map((t) => {
        const estado = estadoTorneo(t.estado);
        const { day, month } = diaMes(t.fecha_inicio);
        const sinLimite = t.cupo_maximo === null;
        return (
          <EventCard
            key={t.torneo_id}
            kicker={t.nombre_disciplina}
            icon={iconoDisciplina(t.nombre_disciplina)}
            photo={fotoDisciplina(t.nombre_disciplina)}
            day={day}
            month={month}
            title={t.nombre}
            description={t.nombre_categoria || 'Sin categoría'}
            chips={[t.tipo_torneo === 'Equipos' ? 'Por equipos' : 'Individual']}
            progress={sinLimite
              ? { label: `${t.total_participantes} inscritos (sin límite)` }
              : { value: t.total_participantes, max: t.cupo_maximo, label: 'Cupo' }}
            status={<Badge variant={estado.variant}>{estado.label}</Badge>}
            cta="Ver detalle"
            onClick={() => onSeleccionar?.(t)}
            aria-label={`${t.nombre}, ${estado.label}. Ver detalle`}
          />
        );
      })}
    </FocusList>
  );
}
