import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquareText, SearchX, Star } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  KpiCard,
  LoadingState,
  Select,
  SplitLayout,
  Stack,
  Stars,
  Table,
  Text
} from '../ui';
import { nombreMes, opcionesDePeriodo, periodoActual } from '../evaluaciones-ui/resultadosUtils';
import { useEvaluacionesCoordinador } from './useEvaluacionesCoordinador';
import { disciplinasDelMes, kpis, ranking, textoDiferencia, unaDecimal } from './evaluacionesVista';
import DetalleInstructorPanel from './DetalleInstructorPanel';

const OPCIONES_MES = opcionesDePeriodo(12);

/**
 * Evaluaciones de instructores del coordinador (U4-20, diseño de Stitch coordinador/evaluaciones).
 * Mes (por defecto el actual en hora de México), disciplina (la de las evaluaciones) y búsqueda de
 * instructor en el navegador. KPI del mes, ranking por promedio y panel con distribución y
 * comentarios anónimos. Mismas llamadas y permisos que ResultadosInstructor (E5.2): ver
 * useEvaluacionesCoordinador. Carga, error y vacío son estados aparte, nunca junto con datos.
 */
function EvaluacionesCoordinador() {
  const [periodo, setPeriodo] = useState(periodoActual);
  const [disciplina, setDisciplina] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [elegidoId, setElegidoId] = useState(null);
  const { estado, error, instructores, listasMes, listasPrevio, reintentar } = useEvaluacionesCoordinador(periodo);

  const disciplinas = useMemo(() => disciplinasDelMes(listasMes), [listasMes]);
  // Si el mes nuevo no tiene la disciplina elegida, se vuelve a "Todas"
  const filtro = disciplinas.includes(disciplina) ? disciplina : '';
  const filas = useMemo(() => ranking(instructores, listasMes, filtro), [instructores, listasMes, filtro]);
  const resumen = useMemo(() => kpis(instructores, listasMes, listasPrevio, filtro, filas), [instructores, listasMes, listasPrevio, filtro, filas]);

  const q = busqueda.trim().toLowerCase();
  const visibles = q ? filas.filter((f) => f.nombre.toLowerCase().includes(q)) : filas;
  const elegido = filas.find((f) => String(f.instructor_id) === String(elegidoId)) || null;
  const evaluados = filas.filter((f) => f.total > 0).length;
  const mes = nombreMes(periodo);

  // En pantallas angostas el panel queda debajo de la tabla: se lleva a la vista al elegir
  useEffect(() => {
    if (!elegidoId || !window.matchMedia?.('(max-width: 1024px)').matches) return;
    document.getElementById('detalle-instructor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [elegidoId]);

  const cambiarMes = (valor) => {
    setPeriodo(valor);
    setElegidoId(null);
  };

  const columnas = [
    {
      key: 'posicion',
      header: '#',
      width: 64,
      render: (f) => (
        <Text variant="subheading" as="span" muted={f.posicion !== 1}>
          {f.posicion ? String(f.posicion).padStart(2, '0') : '—'}
        </Text>
      )
    },
    {
      key: 'nombre',
      header: 'Instructor / disciplina',
      render: (f) => (
        <Stack direction="row" gap={12} align="center">
          <Avatar name={f.nombre} src={f.foto || undefined} />
          <Stack gap={0}>
            <Text as="span">
              {f.nombre}
              {!f.activo && ' (inactivo)'}
            </Text>
            {f.detalle && (
              <Text variant="caption" muted as="span">
                {f.detalle}
              </Text>
            )}
          </Stack>
        </Stack>
      )
    },
    {
      key: 'promedio',
      header: 'Promedio',
      width: 190,
      render: (f) =>
        f.total > 0 ? (
          <Stack direction="row" gap={8} align="center">
            <Text variant="subheading" as="span">
              {unaDecimal(f.promedio)}
            </Text>
            <Stars value={f.promedio} size="sm" />
          </Stack>
        ) : (
          <Text variant="small" muted as="span">
            Sin evaluaciones
          </Text>
        )
    },
    {
      key: 'total',
      header: 'Evaluaciones',
      width: 130,
      render: (f) =>
        f.total > 0 ? (
          <Text variant="small" as="span">
            {f.total} eval.
          </Text>
        ) : (
          <Text variant="small" muted as="span">
            —
          </Text>
        )
    }
  ];

  const encabezado = (
    <Stack gap={16}>
      <Stack gap={4}>
        <Text variant="title" as="h2">
          Evaluaciones de instructores
        </Text>
        <Text muted>Calificaciones que los socios dan a cada instructor. Las evaluaciones son anónimas.</Text>
      </Stack>
      <Stack direction="row" gap={12} wrap grow minChild={200}>
        <Select aria-label="Mes" value={periodo} onChange={(e) => cambiarMes(e.target.value)} options={OPCIONES_MES} />
        <Select
          aria-label="Disciplina"
          placeholder="Todas las disciplinas"
          value={filtro}
          onChange={(e) => setDisciplina(e.target.value)}
          options={disciplinas.map((d) => ({ value: d, label: d }))}
          disabled={estado !== 'listo' || disciplinas.length === 0}
        />
        <Input
          type="search"
          aria-label="Buscar instructor"
          placeholder="Buscar instructor"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </Stack>
    </Stack>
  );

  let contenido;
  if (estado === 'cargando') {
    contenido = <LoadingState rows={5} label="Cargando evaluaciones…" />;
  } else if (estado === 'error') {
    contenido = <ErrorState title="No se pudieron cargar las evaluaciones" message={error} onRetry={reintentar} />;
  } else if (resumen.total === 0) {
    contenido = (
      <EmptyState
        icon={<MessageSquareText size={24} />}
        title="Aún no hay evaluaciones este mes"
        message={`Las calificaciones que los socios den a sus instructores en ${mes} aparecerán aquí.`}
      />
    );
  } else {
    const mejor = resumen.mejor;
    contenido = (
      <Stack gap={32}>
        <Stack direction="row" gap={24} wrap grow minChild={260}>
          <KpiCard
            label="Promedio general"
            icon={<Star size={18} />}
            value={unaDecimal(resumen.promedio)}
            addon={<Stars value={resumen.promedio} />}
            caption={`Promedio ponderado de ${mes}`}
            badge={textoDiferencia(resumen.diferencia)}
          />
          <KpiCard
            label="Evaluaciones del mes"
            icon={<MessageSquareText size={18} />}
            value={resumen.total}
            addon={resumen.total === 1 ? 'evaluación' : 'evaluaciones'}
            caption={`${evaluados} ${evaluados === 1 ? 'instructor evaluado' : 'instructores evaluados'}`}
          />
          <KpiCard
            label="Instructor mejor calificado"
            tag={<Badge variant="ice">Top #1</Badge>}
            caption={`${mejor.total} ${mejor.total === 1 ? 'evaluación recibida' : 'evaluaciones recibidas'}`}
            badge={`${unaDecimal(mejor.promedio)} ★`}
          >
            <Stack direction="row" gap={12} align="center">
              <Avatar name={mejor.nombre} src={mejor.foto || undefined} size="lg" />
              <Stack gap={0}>
                <Text variant="subheading" as="span">
                  {mejor.nombre}
                </Text>
                {mejor.detalle && (
                  <Text variant="small" muted as="span">
                    {mejor.detalle}
                  </Text>
                )}
              </Stack>
            </Stack>
          </KpiCard>
        </Stack>

        <SplitLayout aside={elegido && <DetalleInstructorPanel fila={elegido} periodo={periodo} onCerrar={() => setElegidoId(null)} />}>
          <Stack gap={16}>
            <Stack direction="row" gap={12} align="center" wrap>
              <Text variant="heading" as="h3">
                Ranking de instructores
              </Text>
              <Badge variant="muted">
                {evaluados} {evaluados === 1 ? 'evaluado' : 'evaluados'}
              </Badge>
            </Stack>
            {visibles.length === 0 ? (
              <EmptyState compact icon={<SearchX size={20} />} title="Ningún instructor coincide con la búsqueda" message="Prueba con otro nombre." />
            ) : (
              <Card flush>
                <Table
                  columns={columnas}
                  data={visibles}
                  getRowKey={(f) => f.instructor_id}
                  onRowClick={(f) => setElegidoId(String(f.instructor_id) === String(elegidoId) ? null : f.instructor_id)}
                  selectedKey={elegidoId}
                  minWidth={560}
                />
              </Card>
            )}
          </Stack>
        </SplitLayout>
      </Stack>
    );
  }

  return (
    <Stack gap={32} padding={24}>
      {encabezado}
      {contenido}
    </Stack>
  );
}

export default EvaluacionesCoordinador;
