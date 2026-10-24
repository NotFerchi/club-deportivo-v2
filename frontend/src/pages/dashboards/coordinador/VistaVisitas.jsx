import React, { useEffect, useState } from 'react';
import { LogIn, UserCheck, Users } from 'lucide-react';
import { Badge, Stack, StatCard, Table, Text } from '../../../components/ui';
import { API_BASE_URL } from '../../../services/api';

function VistaVisitas() {
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('activas');

  useEffect(() => {
    const fetchVisitas = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [res1, res2] = await Promise.all([
          fetch(`${API_BASE_URL}/recepcion/visitas/activas`, { headers }),
          fetch(`${API_BASE_URL}/recepcion/visitas/historial`, { headers }),
        ]);

        const activas   = await res1.json().then(d => Array.isArray(d) ? d : []);
        const historial = await res2.json().then(d => Array.isArray(d) ? d : []);

        setVisitas([...activas, ...historial]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchVisitas();
  }, []);

  const activas    = visitas.filter(v => v.vigente || v.estado === 'activo');
  const finalizadas = visitas.filter(v => !v.vigente && v.estado !== 'activo');
  const mostrar     = filtro === 'activas' ? activas : finalizadas;

  const formatHora = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
  };

  const duracion = (entrada, salida) => {
    if (!entrada || !salida) return null;
    const mins = Math.round((new Date(salida) - new Date(entrada)) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  if (loading) return <Text role="status" muted>Cargando visitas…</Text>;

  const columnas = [
    {
      key: 'visitante',
      header: 'Visitante',
      render: (v) => (
        <Stack direction="row" gap={8} wrap align="center">
          <span>{v.nombre_completo}</span>
          {v.identificacion_tipo && <Badge>{v.identificacion_tipo}</Badge>}
        </Stack>
      ),
    },
    { key: 'entrada', header: 'Entrada', render: (v) => formatHora(v.hora_entrada) },
    { key: 'salida', header: 'Salida', render: (v) => (v.hora_salida ? formatHora(v.hora_salida) : '—') },
    { key: 'duracion', header: 'Duración', render: (v) => duracion(v.hora_entrada, v.hora_salida) || '—' },
    {
      key: 'estado',
      header: 'Estado',
      render: (v) => (
        <Badge variant={v.vigente ? 'success' : 'neutral'}>{v.vigente ? 'En instalaciones' : 'Finalizada'}</Badge>
      ),
    },
  ];

  return (
    <Stack gap={16}>
      <Stack direction="row" gap={16} grow minChild={160}>
        <StatCard
          label="En instalaciones"
          value={activas.length}
          tone="success"
          icon={<UserCheck size={20} />}
          selected={filtro === 'activas'}
          onClick={() => setFiltro('activas')}
        />
        <StatCard
          label="Finalizadas hoy"
          value={finalizadas.length}
          tone="neutral"
          icon={<Users size={20} />}
          selected={filtro === 'finalizadas'}
          onClick={() => setFiltro('finalizadas')}
        />
        <StatCard label="Total del día" value={visitas.length} tone="primary" icon={<LogIn size={20} />} />
      </Stack>

      <Table
        columns={columnas}
        data={mostrar}
        getRowKey={(v) => v.visita_id}
        minWidth={640}
        emptyTitle="Sin visitas"
        emptyMessage={filtro === 'activas' ? 'No hay visitas activas en este momento.' : 'No hay visitas finalizadas hoy.'}
      />
    </Stack>
  );
}

export default VistaVisitas;
