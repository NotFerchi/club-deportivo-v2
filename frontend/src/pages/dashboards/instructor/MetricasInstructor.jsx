import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, Calendar, BarChart2, Award } from 'lucide-react';
import { Badge, Card, Stack, StatCard, Table, Text } from '../../../components/ui';
import { API_BASE_URL } from '../../../services/api';

function MetricasInstructor() {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetricas = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/instructor/metricas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setMetricas(data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetricas();
  }, []);

  if (loading) return <Text muted>Cargando métricas...</Text>;

  if (!metricas) return <Text muted>No se pudieron cargar las métricas.</Text>;

  const asistenciaDatos  = metricas.asistenciaMensual || [];
  const convocatoriaDatos = metricas.convocatoriaMensualData || [];

  const nivelAsistencia = metricas.asistenciaPromedio >= 80 ? { label: 'Excelente', tone: 'success' }
    : metricas.asistenciaPromedio >= 60 ? { label: 'Bueno', tone: 'warning' }
    : { label: 'Mejorable', tone: 'danger' };

  const columnasAsistencia = [
    { key: 'mes', header: 'Mes' },
    { key: 'porcentaje', header: 'Asistencia', render: (d) => `${parseFloat(d.porcentaje) || 0}%` },
  ];

  const columnasConvocatoria = [
    { key: 'mes', header: 'Mes' },
    { key: 'total', header: 'Alumnos', render: (d) => String(d.total) },
  ];

  return (
    <Stack gap={24}>
      {/* Encabezado */}
      <Stack direction="row" gap={16} align="center" justify="between" wrap>
        <Stack gap={4}>
          <Text variant="heading">Métricas de Rendimiento</Text>
          <Text variant="small" muted>Últimos 5 meses de actividad</Text>
        </Stack>
        <Badge variant={nivelAsistencia.tone}>
          <Award size={14} /> Nivel: {nivelAsistencia.label}
        </Badge>
      </Stack>

      {/* KPIs */}
      <Stack direction="row" gap={16} grow minChild={150}>
        <StatCard
          value={`${metricas.asistenciaPromedio || 0}%`}
          label="Promedio Asistencia"
          hint={nivelAsistencia.label}
          tone={nivelAsistencia.tone}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          value={metricas.convocatoriaMensual || 0}
          label="Convocatoria Mensual"
          hint="Este mes"
          icon={<Users size={20} />}
        />
        <StatCard
          value={metricas.sesionesHoy || 0}
          label="Sesiones Hoy"
          hint="Programadas"
          tone="warning"
          icon={<Calendar size={20} />}
        />
        <StatCard
          value={metricas.totalAlumnos || 0}
          label="Total Alumnos"
          hint="Únicos"
          tone="neutral"
          icon={<BarChart2 size={20} />}
        />
      </Stack>

      {/* Asistencia mensual */}
      <Card title="Asistencia Mensual" action={<Text variant="caption" muted>% por mes</Text>} flush>
        <Table
          columns={columnasAsistencia}
          data={asistenciaDatos}
          getRowKey={(d, i) => d.mes ?? i}
          emptyTitle="Sin datos"
          emptyMessage="Sin datos de asistencia aún"
        />
      </Card>

      {/* Convocatoria mensual */}
      <Card title="Convocatoria Mensual" action={<Text variant="caption" muted>alumnos por mes</Text>} flush>
        <Table
          columns={columnasConvocatoria}
          data={convocatoriaDatos}
          getRowKey={(d, i) => d.mes ?? i}
          emptyTitle="Sin datos"
          emptyMessage="Sin datos de convocatoria aún"
        />
      </Card>
    </Stack>
  );
}

export default MetricasInstructor;
