import React from 'react';
import { Alert, Badge, Button, Stack, Table, Text, ProgressBar } from '../ui';
import { estadoTorneo, formatFecha } from './torneoEstado';

/**
 * TorneosListado - tabla de torneos con sus estados de carga, error y vacío.
 *
 * Props:
 *   torneos       - arreglo con la forma de GET /api/torneos
 *   cargando      - true mientras llega la lista
 *   error         - mensaje del backend si la carga falló; null si no
 *   onReintentar  - vuelve a pedir la lista
 *   onSeleccionar - (torneo) => void; clic en una fila
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
  if (cargando) {
    return <Text role="status" muted>Cargando torneos…</Text>;
  }

  if (error) {
    return (
      <Alert variant="error" action={<Button variant="secondary" onClick={onReintentar}>Reintentar</Button>}>
        {error}
      </Alert>
    );
  }

  const columnas = [
    {
      key: 'nombre',
      header: 'Torneo',
      render: (t) => (
        <Stack gap={0}>
          <span>{t.nombre}</span>
          <Text variant="caption" muted as="span">{t.nombre_disciplina}</Text>
        </Stack>
      ),
    },
    { key: 'categoria', header: 'Categoría', render: (t) => t.nombre_categoria || 'Sin categoría' },
    { key: 'inicio', header: 'Inicio', render: (t) => formatFecha(t.fecha_inicio) },
    {
      key: 'estado',
      header: 'Estado',
      render: (t) => {
        const estado = estadoTorneo(t.estado);
        return <Badge variant={estado.variant}>{estado.label}</Badge>;
      },
    },
    {
      key: 'inscritos',
      header: 'Inscritos',
      width: 160,
      render: (t) => (
        t.cupo_maximo === null
          ? `${t.total_participantes} (sin límite)`
          : <ProgressBar value={t.total_participantes} max={t.cupo_maximo} />
      ),
    },
  ];

  return (
    <Table
      columns={columnas}
      data={torneos}
      getRowKey={(t) => t.torneo_id}
      onRowClick={onSeleccionar}
      minWidth={720}
      emptyTitle={hayFiltros ? 'Sin resultados' : 'Aún no hay torneos'}
      emptyMessage={hayFiltros ? 'Ningún torneo coincide con los filtros.' : 'Cuando se cree un torneo aparecerá aquí.'}
      emptyAction={hayFiltros && onLimpiarFiltros
        ? <Button variant="secondary" onClick={onLimpiarFiltros}>Limpiar filtros</Button>
        : undefined}
    />
  );
}
