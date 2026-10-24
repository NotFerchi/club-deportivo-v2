import React, { useEffect, useState } from 'react';
import { MapPin, CheckCircle, XCircle, Users } from 'lucide-react';
import { Badge, Input, Stack, StatCard, Table, Text } from '../../../components/ui';
import { API_BASE_URL } from '../../../services/api';

function VistaEspacios() {
  const [espacios, setEspacios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    const fetchEspacios = async () => {
      try {
        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE_URL}/espacios/todos`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();

        setEspacios(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEspacios();
  }, []);

  const activos = espacios.filter(e => e.activo);
  const inactivos = espacios.filter(e => !e.activo);
  const capacidadTotal = espacios.reduce((acc, e) => acc + (e.capacidad_maxima || 0), 0);

  const filtrados = espacios
    .filter(e =>
      filtro === 'todos' ? true : filtro === 'activos' ? e.activo : !e.activo
    )
    .filter(
      e =>
        e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.disciplina?.toLowerCase().includes(busqueda.toLowerCase())
    );

  if (loading) return <Text role="status" muted>Cargando espacios…</Text>;

  const indicadores = [
    { label: 'Total espacios', valor: espacios.length, tone: 'primary', icono: <MapPin size={18} />, key: 'todos' },
    { label: 'Activos', valor: activos.length, tone: 'success', icono: <CheckCircle size={18} />, key: 'activos' },
    { label: 'Inactivos', valor: inactivos.length, tone: 'danger', icono: <XCircle size={18} />, key: 'inactivos' },
  ];

  const columnas = [
    {
      key: 'espacio',
      header: 'Espacio',
      render: (e) => (
        <Stack gap={0}>
          <span>{e.nombre}</span>
          <Text variant="caption" muted as="span">Espacio #{e.espacio_id}</Text>
        </Stack>
      ),
    },
    {
      key: 'disciplina',
      header: 'Disciplina',
      render: (e) => (e.disciplina ? <Badge variant="info">{e.disciplina}</Badge> : '—'),
    },
    {
      key: 'capacidad',
      header: 'Capacidad máxima',
      render: (e) => (e.capacidad_maxima ? `${e.capacidad_maxima} personas` : '—'),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (e) => (
        <Badge variant={e.activo ? 'success' : 'danger'}>
          {e.activo ? 'Activo' : 'Fuera de servicio'}
        </Badge>
      ),
    },
  ];

  return (
    <Stack gap={16}>
      <Stack direction="row" gap={16} grow minChild={150}>
        {indicadores.map(k => (
          <StatCard
            key={k.key}
            label={k.label}
            value={k.valor}
            tone={k.tone}
            icon={k.icono}
            selected={filtro === k.key}
            onClick={() => setFiltro(k.key)}
          />
        ))}
        <StatCard
          label="Capacidad total"
          value={capacidadTotal}
          hint="personas"
          tone="neutral"
          icon={<Users size={18} />}
        />
      </Stack>

      <Input
        label="Buscar"
        type="search"
        placeholder="Buscar por nombre o disciplina..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />

      <Text variant="caption" muted role="status">
        {filtrados.length} espacio{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
      </Text>

      <Table
        columns={columnas}
        data={filtrados}
        getRowKey={(e) => e.espacio_id}
        minWidth={600}
        emptyTitle="No se encontraron espacios"
        emptyMessage="Intenta con otro término de búsqueda."
      />
    </Stack>
  );
}

export default VistaEspacios;
