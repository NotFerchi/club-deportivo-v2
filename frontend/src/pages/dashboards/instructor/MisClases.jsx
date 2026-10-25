import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Calendar, ClipboardList, Dumbbell, TrendingUp } from 'lucide-react';
import { Alert, Badge, Card, Chip, ProgressBar, Stack, StatCard, Text } from '../../../components/ui';
import { API_BASE_URL } from '../../../services/api';

const DIAS_NOMBRE = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_CORTO  = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function formatHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function getProximaFecha(diaSemana) {
  const hoy = new Date();
  const js = hoy.getDay();
  const diaHoy = js === 0 ? 7 : js;
  let diff = diaSemana - diaHoy;
  if (diff < 0) diff += 7;
  const fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() + diff);
  return {
    diff,
    texto: fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }),
    fechaCompleta: fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  };
}

// Ícono + texto secundario en una línea (horario, espacio…)
function Dato({ icon, children }) {
  return (
    <Stack direction="row" gap={8} align="center">
      {icon}
      <Text variant="small" muted as="span">{children}</Text>
    </Stack>
  );
}

function MisClases() {
  const [clases, setClases]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrodia, setFiltroDia] = useState('todos');

  useEffect(() => {
    const fetchClases = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/instructor/mis-clases`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        const _js = new Date().getDay();
        const diaHoy = _js === 0 ? 7 : _js;
        const ordenadas = [...data].sort((a, b) => {
          let diffA = a.dia_semana - diaHoy; if (diffA < 0) diffA += 7;
          let diffB = b.dia_semana - diaHoy; if (diffB < 0) diffB += 7;
          if (diffA !== diffB) return diffA - diffB;
          return a.hora_inicio.localeCompare(b.hora_inicio);
        });
        setClases(ordenadas);
      } catch (err) { console.error('Error:', err); }
      finally { setLoading(false); }
    };
    fetchClases();
  }, []);

  const _jsDay = new Date().getDay();
  const diaHoy       = _jsDay === 0 ? 7 : _jsDay;
  const clasesHoy    = clases.filter(c => c.dia_semana === diaHoy).length;
  const totalAlumnos = clases.reduce((acc, c) => acc + (parseInt(c.cupo_actual) || 0), 0);
  const totalCupo    = clases.reduce((acc, c) => acc + (parseInt(c.cupo_maximo) || 0), 0);
  const ocupacion    = totalCupo > 0 ? Math.round((totalAlumnos / totalCupo) * 100) : 0;

  const diasConClases = [...new Set(clases.map(c => c.dia_semana))].sort((a, b) => {
    let da = a - diaHoy; if (da < 0) da += 7;
    let db = b - diaHoy; if (db < 0) db += 7;
    return da - db;
  });

  const filtradas = filtrodia === 'todos'
    ? clases
    : clases.filter(c => c.dia_semana === parseInt(filtrodia));

  if (loading) return <Text muted>Cargando tus clases...</Text>;

  return (
    <Stack gap={24}>
      {/* ── Encabezado ── */}
      <Stack gap={4}>
        <Text variant="heading">Mis Clases Asignadas</Text>
        <Text variant="small" muted>{clases.length} sesiones semanales programadas</Text>
      </Stack>

      <Stack direction="row" gap={16} grow minChild={150}>
        {[
          { valor: clasesHoy,       label: 'Hoy',       sub: 'sesiones',  icon: <Dumbbell size={20} /> },
          { valor: totalAlumnos,    label: 'Alumnos',   sub: 'inscritos', icon: <Users size={20} /> },
          { valor: `${ocupacion}%`, label: 'Ocupación', sub: 'promedio',  icon: <TrendingUp size={20} /> },
        ].map(({ valor, label, sub, icon }) => (
          <StatCard key={label} label={label} value={valor} hint={sub} icon={icon} />
        ))}
      </Stack>

      {/* ── Filtro por día ── */}
      <Stack direction="row" gap={8} wrap>
        <Chip selected={filtrodia === 'todos'} onClick={() => setFiltroDia('todos')}>
          Todos · {clases.length}
        </Chip>
        {diasConClases.map(d => {
          const { diff } = getProximaFecha(d);
          const esHoy    = diff === 0;
          const activo   = filtrodia === String(d);
          return (
            <Chip key={d} selected={activo} onClick={() => setFiltroDia(String(d))}>
              {esHoy && 'Hoy · '}{DIAS_CORTO[d]} · {clases.filter(c => c.dia_semana === d).length}
            </Chip>
          );
        })}
      </Stack>

      {/* ── Grid de clases ── */}
      {filtradas.length === 0 ? (
        <Stack gap={4} align="center" padding={32}>
          <ClipboardList size={24} />
          <Text variant="subheading">Sin clases para este día</Text>
          <Text variant="small" muted>Prueba seleccionando otro día</Text>
        </Stack>
      ) : (
        <Stack direction="row" gap={16} grow minChild={280}>
          {filtradas.map((clase) => {
            const cupoActual = parseInt(clase.cupo_actual) || 0;
            const cupoMax    = parseInt(clase.cupo_maximo) || 1;
            const pct        = Math.min(100, Math.round((cupoActual / cupoMax) * 100));
            const { diff, texto } = getProximaFecha(clase.dia_semana);
            const esHoy      = diff === 0;
            const lleno      = pct >= 100;

            return (
              <Card
                key={clase.sesion_id}
                title={clase.disciplina}
                action={
                  <Badge variant={esHoy ? 'success' : 'neutral'}>
                    {esHoy ? 'Hoy' : DIAS_NOMBRE[clase.dia_semana]}
                  </Badge>
                }
              >
                <Stack gap={12}>
                  <Dato icon={<Clock size={14} />}>{formatHora(clase.hora_inicio)} – {formatHora(clase.hora_fin)}</Dato>
                  <Dato icon={<MapPin size={14} />}>{clase.espacio}</Dato>
                  <Dato icon={<Calendar size={14} />}>
                    {esHoy ? `Hoy, ${texto}` : diff === 1 ? `Mañana, ${texto}` : texto}
                  </Dato>

                  {/* Cupo */}
                  <ProgressBar value={cupoActual} max={cupoMax} label="Ocupación" />
                  <Stack direction="row" gap={8} align="center" justify="between">
                    <Text variant="caption" muted>{pct}% ocupado</Text>
                    {lleno && <Badge variant="danger">Lleno</Badge>}
                  </Stack>

                  {esHoy && <Alert variant="success">Clase programada para hoy</Alert>}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default MisClases;
