import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Modal, Select, Stack, Table, Text } from '../ui';
import { obtenerReporte } from '../../services/torneosApi';
import { estadoTorneo, formatFechaHora } from './torneoEstado';
import {
  estadoEncuentro,
  calcularPosiciones,
  etiquetaRonda,
  formatMarcador,
  totalRondas,
} from './reporteTorneo';

/**
 * ReporteTorneoModal - resultados de un torneo: encuentros por ronda con participantes,
 * marcador, ganador, cancha y fecha. Pide GET /api/torneos/:id/reporte (§5.1) al abrirse.
 *
 * Estados: cargando, error (mensaje del backend + Reintentar) y vacío (aún no hay encuentros).
 *
 * El padre debe montarlo solo mientras está abierto (o cambiarle la `key` al cambiar de torneo).
 *
 * Props:
 *   torneo  - torneo de la lista (usa torneo_id, nombre, nombre_disciplina y estado)
 *   onClose - cierra el modal
 */
export default function ReporteTorneoModal({ torneo, onClose }) {
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [ronda, setRonda] = useState('');

  // Pide el reporte al abrir y cada vez que se presiona Reintentar (cambia `version`).
  useEffect(() => {
    let cancelado = false;
    obtenerReporte(torneo.torneo_id)
      .then((datos) => {
        if (cancelado) return;
        setReporte(datos);
        setError(null);
      })
      .catch((err) => {
        if (cancelado) return;
        setReporte(null);
        setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [torneo.torneo_id, version]);

  const reintentar = () => {
    setCargando(true);
    setVersion((v) => v + 1);
  };

  const encuentros = useMemo(() => reporte?.encuentros ?? [], [reporte]);
  const rondas = totalRondas(encuentros);
  const visibles = ronda ? encuentros.filter((e) => String(e.ronda) === ronda) : encuentros;
  const estado = estadoTorneo(torneo.estado);
  const resultado = useMemo(() => calcularPosiciones(encuentros), [encuentros]);

  const columnas = [
    { key: 'ronda', header: 'Ronda', render: (e) => etiquetaRonda(e.ronda, rondas) },
    {
      key: 'participantes',
      header: 'Encuentro',
      render: (e) => `${e.participante_1?.nombre ?? 'Por definir'} vs ${e.participante_2?.nombre ?? 'Por definir'}`,
    },
    { key: 'marcador', header: 'Marcador', render: formatMarcador },
    { key: 'ganador', header: 'Ganador', render: (e) => e.ganador?.nombre ?? '—' },
    { key: 'cancha', header: 'Cancha', render: (e) => e.cancha_asignada ?? 'Sin asignar' },
    { key: 'hora', header: 'Fecha y hora', render: (e) => formatFechaHora(e.hora_programada) },
    {
      key: 'estado',
      header: 'Estado',
      render: (e) => {
        const est = estadoEncuentro(e.estado);
        return <Badge variant={est.variant}>{est.label}</Badge>;
      },
    },
  ];

  let contenido;
  if (cargando) {
    contenido = <Text role="status" muted>Cargando resultados…</Text>;
  } else if (error) {
    contenido = (
      <Alert variant="error" action={<Button variant="secondary" onClick={reintentar}>Reintentar</Button>}>
        {error}
      </Alert>
    );
  } else if (encuentros.length === 0) {
    contenido = <Alert variant="info">Este torneo aún no tiene resultados.</Alert>;
  } else {
    contenido = (
      <Stack gap={16}>
        {resultado && (
          <>
            <Alert variant="success" title="Campeón">{resultado.campeon.nombre}</Alert>
            <Stack gap={8}>
              <Text variant="subheading">Posiciones</Text>
              <Table
                columns={[
                  { key: 'lugar', header: 'Lugar', width: 100 },
                  { key: 'nombre', header: 'Participante' },
                  { key: 'detalle', header: 'Resultado' },
                ]}
                data={resultado.posiciones}
                getRowKey={(p) => `${p.lugar}-${p.nombre}`}
                minWidth={420}
              />
            </Stack>
            <Text variant="subheading">Encuentros</Text>
          </>
        )}
        <Select
          label="Ronda"
          placeholder="Todas las rondas"
          value={ronda}
          onChange={(event) => setRonda(event.target.value)}
          options={Array.from({ length: rondas }, (_, i) => ({ value: i + 1, label: etiquetaRonda(i + 1, rondas) }))}
        />
        <Table
          columns={columnas}
          data={visibles}
          getRowKey={(e) => e.encuentro_id}
          minWidth={820}
          emptyTitle="Sin encuentros"
          emptyMessage="Esta ronda no tiene encuentros."
        />
      </Stack>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Resultados — ${torneo.nombre}`}
      subtitle={torneo.nombre_disciplina}
      maxWidth={960}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}
    >
      <Stack gap={16}>
        <Stack direction="row" gap={8} wrap align="center">
          <Badge variant={estado.variant}>{estado.label}</Badge>
        </Stack>
        {contenido}
      </Stack>
    </Modal>
  );
}
