import React, { useEffect, useState } from 'react';
import { Badge, Input, Stack, StatCard, Table, Text } from '../../../components/ui';
import { API_BASE_URL } from '../../../services/api';

const BADGE_ESTADO = {
  Confirmada: 'success',
  Cancelada: 'danger',
  'No-Show': 'warning',
};

function VistaReservas() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => {
    const fetchReservas = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/recepcion/reservas?fecha=${fecha}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setReservas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReservas();
  }, [fecha]);

  const formatHora = (t) => {
    if (!t) return '—';
    const [hh, mm] = t.split(':');
    const h = parseInt(hh);
    return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const formatFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const confirmadas = reservas.filter(r => r.estado === 'Confirmada');
  const canceladas  = reservas.filter(r => r.estado === 'Cancelada');
  const noShow      = reservas.filter(r => r.estado === 'No-Show');

  const filtradas = reservas.filter(r =>
    filtro === 'todas' ? true : r.estado === filtro
  );

  const indicadores = [
    { label: 'Total', valor: reservas.length, tone: 'primary', key: 'todas' },
    { label: 'Confirmadas', valor: confirmadas.length, tone: 'success', key: 'Confirmada' },
    { label: 'No-Show', valor: noShow.length, tone: 'warning', key: 'No-Show' },
    { label: 'Canceladas', valor: canceladas.length, tone: 'danger', key: 'Cancelada' },
  ];

  const columnas = [
    {
      key: 'socio',
      header: 'Socio',
      render: (r) => (
        <Stack gap={0}>
          <span>{r.socio_nombre || '—'}</span>
          <Text variant="caption" muted as="span">{r.espacio_nombre || '—'}</Text>
        </Stack>
      ),
    },
    { key: 'horario', header: 'Horario', render: (r) => `${formatHora(r.hora_inicio)} – ${formatHora(r.hora_fin)}` },
    {
      key: 'estado',
      header: 'Estado',
      render: (r) => <Badge variant={BADGE_ESTADO[r.estado] || 'neutral'}>{r.estado}</Badge>,
    },
  ];

  return (
    <Stack gap={16}>
      <Stack direction="row" gap={16} grow minChild={150}>
        {indicadores.map((k) => (
          <StatCard
            key={k.key}
            label={k.label}
            value={k.valor}
            tone={k.tone}
            selected={filtro === k.key}
            onClick={() => setFiltro(k.key)}
          />
        ))}
      </Stack>

      <Stack direction="row" gap={16} wrap align="end" justify="between">
        <Stack gap={0}>
          <Text variant="subheading">Reservas del {formatFecha(fecha)}</Text>
          <Text variant="caption" muted>
            {filtradas.length} reserva{filtradas.length !== 1 ? 's' : ''}{filtro !== 'todas' ? ` · ${filtro}` : ''}
          </Text>
        </Stack>
        <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Stack>

      {loading ? (
        <Text role="status" muted>Cargando reservas…</Text>
      ) : (
        <Table
          columns={columnas}
          data={filtradas}
          getRowKey={(r) => r.reserva_id}
          minWidth={560}
          emptyTitle="Sin reservas"
          emptyMessage={`No hay reservas para el ${formatFecha(fecha)}.`}
        />
      )}
    </Stack>
  );
}

export default VistaReservas;
