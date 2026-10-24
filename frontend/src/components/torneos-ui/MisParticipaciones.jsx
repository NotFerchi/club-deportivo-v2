import React from 'react';
import { Alert, Badge, Button, Stack, Table, Text } from '../ui';
import { estadoTorneo, formatFecha } from './torneoEstado';

/**
 * MisParticipaciones - tabla de los torneos en los que participa el socio, con sus estados de
 * carga, error y vacío. Los datos tienen la forma de GET /api/torneos/mis-participaciones.
 *
 * Props:
 *   participaciones - [{ participante_id, torneo_id, nombre, estado, fecha_inicio, fecha_fin,
 *                        nombre_disciplina, categoria }]
 *   cargando        - true mientras llega la lista
 *   error           - mensaje del backend si la carga falló; null si no
 *   onReintentar    - vuelve a pedir la lista
 *   onSeleccionar   - (participacion) => void; clic en una fila
 */
export default function MisParticipaciones({ participaciones, cargando, error, onReintentar, onSeleccionar }) {
  if (cargando) {
    return <Text role="status" muted>Cargando tus participaciones…</Text>;
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
      render: (p) => (
        <Stack gap={0}>
          <span>{p.nombre}</span>
          <Text variant="caption" muted as="span">{p.nombre_disciplina}</Text>
        </Stack>
      ),
    },
    { key: 'categoria', header: 'Categoría', render: (p) => p.categoria || 'Sin categoría' },
    { key: 'inicio', header: 'Inicio', render: (p) => formatFecha(p.fecha_inicio) },
    {
      key: 'estado',
      header: 'Estado',
      render: (p) => {
        const estado = estadoTorneo(p.estado);
        return <Badge variant={estado.variant}>{estado.label}</Badge>;
      },
    },
  ];

  return (
    <Table
      columns={columnas}
      data={participaciones}
      getRowKey={(p) => p.participante_id}
      onRowClick={onSeleccionar}
      minWidth={560}
      emptyTitle="Aún no participas en ningún torneo"
      emptyMessage="Cuando te inscribas a un torneo aparecerá aquí."
    />
  );
}
