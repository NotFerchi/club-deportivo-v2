import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Select, Stack, Table, Text } from '../ui';
import {
  listarEvaluacionesDeInstructor,
  listarInstructores,
  obtenerPromedio,
} from '../../services/evaluacionesResultadosApi';
import { ESTRELLAS, mensajeDeError, nombreMes, opcionesDePeriodo } from './resultadosUtils';

const OPCIONES_PERIODO = opcionesDePeriodo(12);

/**
 * ResultadosInstructor - resultados de las evaluaciones de un instructor (E5.2, SC-01).
 * Se elige instructor y, si se quiere, un mes. Muestra el promedio, el total y la distribución tal como
 * los entrega el backend (el promedio NO se calcula aquí) y la lista anónima de evaluaciones.
 * Estados: cargando, vacío, error (con Reintentar) y 403 con mensaje claro. Contrato: docs/api-evaluaciones.md.
 */
export default function ResultadosInstructor() {
  const [instructores, setInstructores] = useState([]);
  const [cargandoInstructores, setCargandoInstructores] = useState(true);
  const [errorInstructores, setErrorInstructores] = useState(null);
  const [versionInstructores, setVersionInstructores] = useState(0);

  const [instructorId, setInstructorId] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [resultado, setResultado] = useState(null); // { promedio, lista }
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    listarInstructores()
      .then((lista) => {
        if (cancelado) return;
        setInstructores(lista);
        setErrorInstructores(null);
      })
      .catch((err) => {
        if (!cancelado) setErrorInstructores(mensajeDeError(err));
      })
      .finally(() => {
        if (!cancelado) setCargandoInstructores(false);
      });
    return () => { cancelado = true; };
  }, [versionInstructores]);

  // Cada cambio de instructor, mes o `version` (Reintentar) vuelve a consultar promedio y lista.
  useEffect(() => {
    if (!instructorId) return undefined;
    let cancelado = false;
    Promise.all([
      obtenerPromedio(instructorId, periodo),
      listarEvaluacionesDeInstructor(instructorId, periodo),
    ])
      .then(([promedio, lista]) => {
        if (cancelado) return;
        setResultado({ promedio, lista });
        setError(null);
      })
      .catch((err) => {
        if (cancelado) return;
        setResultado(null);
        setError(mensajeDeError(err));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [instructorId, periodo, version]);

  const elegirInstructor = (valor) => {
    setInstructorId(valor);
    setResultado(null);
    setError(null);
    setCargando(Boolean(valor));
  };

  const elegirPeriodo = (valor) => {
    setPeriodo(valor);
    setResultado(null);
    setError(null);
    setCargando(Boolean(instructorId));
  };

  const reintentar = () => {
    setError(null);
    setCargando(true);
    setVersion((v) => v + 1);
  };

  const reintentarInstructores = () => {
    setErrorInstructores(null);
    setCargandoInstructores(true);
    setVersionInstructores((v) => v + 1);
  };

  const opcionesInstructor = instructores.map((i) => ({
    value: i.instructor_id,
    label: i.activo === false ? `${i.nombre} (inactivo)` : i.nombre,
  }));

  const columnasDistribucion = [
    { key: 'estrellas', header: 'Calificación', render: (f) => `${f.estrellas} ${f.estrellas === 1 ? 'estrella' : 'estrellas'}` },
    { key: 'cantidad', header: 'Evaluaciones' },
  ];

  const columnasLista = [
    { key: 'periodo', header: 'Mes', width: 180, render: (e) => nombreMes(e.periodo) },
    { key: 'disciplina', header: 'Clase' },
    { key: 'calificacion', header: 'Calificación', width: 130, render: (e) => <Badge variant="info">{e.calificacion} / 5</Badge> },
    {
      key: 'comentario',
      header: 'Comentario',
      render: (e) => e.comentario || <Text variant="caption" muted as="span">Sin comentario</Text>,
    },
  ];

  const promedio = resultado?.promedio;
  const filasDistribucion = promedio
    ? ESTRELLAS.map((n) => ({ estrellas: n, cantidad: promedio.distribucion?.[String(n)] ?? 0 }))
    : [];
  const sufijoPeriodo = periodo ? nombreMes(periodo) : 'Todos los meses';

  return (
    <Stack gap={24} padding={24}>
      <Stack gap={4}>
        <Text variant="title">Evaluaciones de instructores</Text>
        <Text muted>Calificaciones que los socios han dado a cada instructor. Las evaluaciones son anónimas.</Text>
      </Stack>

      {errorInstructores && (
        <Stack gap={12} align="start">
          <Alert variant="error">{errorInstructores}</Alert>
          <Button variant="secondary" onClick={reintentarInstructores}>Reintentar</Button>
        </Stack>
      )}

      {!errorInstructores && (
        <Stack direction="row" gap={16} wrap>
          <Select
            label="Instructor"
            placeholder={cargandoInstructores ? 'Cargando instructores…' : 'Elige un instructor'}
            options={opcionesInstructor}
            value={instructorId}
            onChange={(e) => elegirInstructor(e.target.value)}
            disabled={cargandoInstructores}
          />
          <Select
            label="Mes"
            placeholder="Todos los meses"
            options={OPCIONES_PERIODO}
            value={periodo}
            onChange={(e) => elegirPeriodo(e.target.value)}
            disabled={!instructorId}
          />
        </Stack>
      )}

      {!errorInstructores && !cargandoInstructores && instructores.length === 0 && (
        <Alert variant="info">Todavía no hay instructores registrados.</Alert>
      )}

      {!instructorId && instructores.length > 0 && (
        <Text muted>Elige un instructor para ver sus resultados.</Text>
      )}

      {cargando && <Text role="status" muted>Cargando evaluaciones…</Text>}

      {error && !cargando && (
        <Stack gap={12} align="start">
          <Alert variant="error">{error}</Alert>
          <Button variant="secondary" onClick={reintentar}>Reintentar</Button>
        </Stack>
      )}

      {resultado && !cargando && !error && (
        <>
          <Stack gap={8}>
            <Text variant="subheading">Resumen · {sufijoPeriodo}</Text>
            {promedio.total === 0 ? (
              <Alert variant="info">Este instructor no tiene evaluaciones en este periodo.</Alert>
            ) : (
              <Stack direction="row" gap={32} wrap align="center">
                <Stack gap={0}>
                  <Text variant="caption" muted>Promedio</Text>
                  <Text variant="title" as="span">{Number(promedio.promedio).toFixed(2)} / 5</Text>
                </Stack>
                <Stack gap={0}>
                  <Text variant="caption" muted>Evaluaciones</Text>
                  <Text variant="title" as="span">{promedio.total}</Text>
                </Stack>
              </Stack>
            )}
          </Stack>

          {promedio.total > 0 && (
            <Stack gap={8}>
              <Text variant="subheading">Distribución</Text>
              <Table
                columns={columnasDistribucion}
                data={filasDistribucion}
                getRowKey={(f) => f.estrellas}
              />
            </Stack>
          )}

          <Stack gap={8}>
            <Text variant="subheading">Evaluaciones recibidas</Text>
            <Table
              columns={columnasLista}
              data={resultado.lista}
              getRowKey={(e) => e.evaluacion_id}
              minWidth={640}
              emptyTitle="Sin evaluaciones"
              emptyMessage="Cuando los socios evalúen sus clases, aparecerán aquí."
            />
          </Stack>
        </>
      )}
    </Stack>
  );
}
