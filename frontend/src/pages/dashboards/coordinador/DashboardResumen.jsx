import React, { useEffect, useState } from 'react';
import { Users, Calendar, ShieldAlert, UserCheck } from 'lucide-react';
import { Badge, Button, Card, Stack, StatCard, Table, Text } from '../../../components/ui';
import { API_BASE_URL } from '../../../services/api';

const MAX_FILAS = 4;

// Vista previa de una lista: tabla corta con las primeras filas y "+N más".
function Resumen({ titulo, icono, columnas, filas, vacio, onVerTodo }) {
  return (
    <Card
      title={titulo}
      icon={icono}
      flush
      action={onVerTodo && <Button variant="secondary" onClick={onVerTodo}>Ver todo</Button>}
    >
      <Table
        columns={columnas}
        data={filas.slice(0, MAX_FILAS)}
        getRowKey={(_, i) => i}
        emptyTitle="Sin registros"
        emptyMessage={vacio}
      />
      {filas.length > MAX_FILAS && (
        <Stack padding={8}>
          <Text variant="caption" muted>+{filas.length - MAX_FILAS} más</Text>
        </Stack>
      )}
    </Card>
  );
}

function DashboardResumen({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [socios, setSocios] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const _hoy = new Date();
        const _fechaHoy = `${_hoy.getFullYear()}-${String(_hoy.getMonth()+1).padStart(2,'0')}-${String(_hoy.getDate()).padStart(2,'0')}`;
        const [sRes, vRes, rRes, sanRes] = await Promise.all([
          fetch(`${API_BASE_URL}/recepcion/socios`,                         { headers }),
          fetch(`${API_BASE_URL}/recepcion/visitas/activas`,               { headers }),
          fetch(`${API_BASE_URL}/recepcion/reservas?fecha=${_fechaHoy}`,   { headers }),
          fetch(`${API_BASE_URL}/sanciones`,                               { headers }),
        ]);
        const sa   = await sRes.json().then(d => Array.isArray(d) ? d : []);
        const va   = await vRes.json().then(d => Array.isArray(d) ? d : (Array.isArray(d?.visitas) ? d.visitas : []));
        const ra   = await rRes.json().then(d => Array.isArray(d) ? d : []);
        const sana = await sanRes.json().then(d => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []));
        setSocios(sa); setVisitas(va); setReservas(ra); setSanciones(sana);
        setStats({
          totalSocios:      sa.length,
          sociosActivos:    sa.filter(x => x.activo).length,
          visitasHoy:       va.length,
          reservasHoy:      ra.length,
          sancionesActivas: sana.filter(x => x.estado === 'Activa').length,
        });
      } catch (err) {
        console.error(err);
        setStats({ totalSocios: 0, sociosActivos: 0, visitasHoy: 0, reservasHoy: 0, sancionesActivas: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return <Text role="status" muted>Cargando resumen…</Text>;

  const hoyTexto = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });
  const hoy = hoyTexto.charAt(0).toUpperCase() + hoyTexto.slice(1);
  const sancionesActivas = sanciones.filter(s => s.estado === 'Activa');

  return (
    <Stack gap={24}>
      <Stack gap={4}>
        <Text variant="heading">Bienvenido al Panel de Coordinación</Text>
        <Text muted>{hoy}</Text>
      </Stack>

      <Stack direction="row" gap={16} grow minChild={180}>
        <StatCard value={stats.totalSocios} label="Total socios" tone="primary"
          hint={`${stats.sociosActivos} activos`}
          icon={<Users size={20} />}
          onClick={() => onNavigate('socios')} />
        <StatCard value={stats.visitasHoy} label="Visitas activas" tone="success"
          hint="En instalaciones ahora"
          icon={<UserCheck size={20} />}
          onClick={() => onNavigate('recepcion')} />
        <StatCard value={stats.reservasHoy} label="Reservas hoy" tone="warning"
          hint="Espacios reservados"
          icon={<Calendar size={20} />}
          onClick={() => onNavigate('reservas')} />
        <StatCard value={stats.sancionesActivas} label="Sanciones activas" tone="danger"
          hint="Requieren atención"
          icon={<ShieldAlert size={20} />}
          onClick={() => onNavigate('sanciones')} />
      </Stack>

      <Stack direction="row" gap={16} grow minChild={300}>
        <Resumen
          titulo="Socios recientes"
          icono={<Users size={16} />}
          vacio="No hay socios registrados."
          onVerTodo={() => onNavigate('socios')}
          columnas={[
            { key: 'socio', header: 'Socio', render: (s) => s.nombre_completo || s.email?.split('@')[0] || '—' },
            { key: 'numero', header: 'Número', render: (s) => <Badge variant={s.activo ? 'success' : 'danger'}>{s.numero_socio}</Badge> },
          ]}
          filas={socios}
        />
        <Resumen
          titulo="Visitas activas"
          icono={<UserCheck size={16} />}
          vacio="No hay visitas activas ahora."
          onVerTodo={() => onNavigate('recepcion')}
          columnas={[
            { key: 'visitante', header: 'Visitante', render: (v) => v.nombre_completo },
            { key: 'estado', header: 'Estado', render: () => <Badge variant="success">En instalaciones</Badge> },
          ]}
          filas={visitas}
        />
        <Resumen
          titulo="Reservas del día"
          icono={<Calendar size={16} />}
          vacio="No hay reservas hoy."
          onVerTodo={() => onNavigate('reservas')}
          columnas={[
            { key: 'espacio', header: 'Espacio', render: (r) => r.espacio_nombre || '—' },
            { key: 'horario', header: 'Horario', render: (r) => `${r.hora_inicio?.slice(0, 5)}\u00A0a\u00A0${r.hora_fin?.slice(0, 5)}` },
          ]}
          filas={reservas}
        />
        <Resumen
          titulo="Sanciones activas"
          icono={<ShieldAlert size={16} />}
          vacio="Sin sanciones activas."
          onVerTodo={() => onNavigate('sanciones')}
          columnas={[
            { key: 'socio', header: 'Socio', render: (s) => s.socio_nombre || '—' },
            { key: 'origen', header: 'Origen', render: (s) => <Badge variant="danger">{s.origen || '—'}</Badge> },
          ]}
          filas={sancionesActivas}
        />
      </Stack>
    </Stack>
  );
}

export default DashboardResumen;
