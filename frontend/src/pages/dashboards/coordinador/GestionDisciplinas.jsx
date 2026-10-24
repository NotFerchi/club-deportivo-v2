import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import {
  Alert, Badge, Button, Input, Modal, ProgressBar, Select, Stack, StatCard, Table, Text,
} from '../../../components/ui';
import { useNotification } from '../../../context/NotificationContext';
import { apiRequest } from '../../../services/api';

const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

function formatHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function getBadge(pct) {
  if (pct >= 100) return { label: 'Lleno',      variant: 'danger' };
  if (pct >= 80)  return { label: 'Casi lleno', variant: 'warning' };
  if (pct >= 50)  return { label: 'Medio',      variant: 'info' };
  return                  { label: 'Disponible', variant: 'success' };
}

function getLunes() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = dia === 0 ? 1 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
}

// ── Helpers de carga de catálogos ─────────────────────────────────────────────
async function fetchCatalogos() {
  const [d, e, i] = await Promise.all([
    apiRequest('/disciplinas'),
    apiRequest('/espacios/todos'),
    apiRequest('/instructores'),
  ]);
  return {
    disciplinas:  Array.isArray(d) ? d : d?.data || [],
    espacios:     Array.isArray(e) ? e : e?.data || [],
    instructores: Array.isArray(i) ? i : i?.data || [],
  };
}

// ── Formulario compartido para crear/editar ───────────────────────────────────
function FormSesion({ form, setForm, disciplinas, espacios, instructores }) {
  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <Stack gap={16}>
      <Select label="Disciplina" markRequired name="disciplina_id" placeholder="Selecciona una disciplina"
        value={form.disciplina_id} onChange={handleChange}
        options={disciplinas.map(d => ({ value: d.disciplina_id, label: d.nombre }))} />
      <Select label="Instructor" markRequired name="instructor_id" placeholder="Selecciona un instructor"
        value={form.instructor_id} onChange={handleChange}
        options={instructores.map(i => ({
          value: i.instructor_id,
          label: i.nombre || `${i.nombres || ''} ${i.apellido_paterno || ''}`.trim(),
        }))} />
      <Select label="Espacio" markRequired name="espacio_id" placeholder="Selecciona un espacio"
        value={form.espacio_id} onChange={handleChange}
        options={espacios.map(e => ({ value: e.espacio_id, label: e.nombre }))} />
      <Select label="Día de la semana" markRequired name="dia_semana" placeholder="Selecciona un día"
        value={form.dia_semana} onChange={handleChange} options={DIAS_SEMANA} />
      <Stack direction="row" gap={12} grow minChild={140}>
        <Input label="Hora inicio" markRequired type="time" name="hora_inicio" value={form.hora_inicio} onChange={handleChange} />
        <Input label="Hora fin" markRequired type="time" name="hora_fin" value={form.hora_fin} onChange={handleChange} />
      </Stack>
      <Input label="Cupo máximo" markRequired type="number" name="cupo_maximo" min="1" max="100"
        value={form.cupo_maximo} onChange={handleChange} />
    </Stack>
  );
}

// Pie común de los modales de formulario
function PieFormulario({ onClose, onConfirm, cargando, textoConfirm }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose} disabled={cargando}>Cancelar</Button>
      <Button onClick={onConfirm} disabled={cargando}>{cargando ? 'Guardando…' : textoConfirm}</Button>
    </>
  );
}

// ── Modal Nueva Sesión ────────────────────────────────────────────────────────
function ModalNuevaSesion({ onClose, onCreada }) {
  const [catalogos, setCatalogos] = useState({ disciplinas: [], espacios: [], instructores: [] });
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState(null);
  const [form, setForm] = useState({
    disciplina_id: '', espacio_id: '', instructor_id: '',
    dia_semana: '', hora_inicio: '', hora_fin: '', cupo_maximo: '15',
  });

  useEffect(() => {
    fetchCatalogos().then(setCatalogos).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const { disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo } = form;
    if (!disciplina_id || !espacio_id || !instructor_id || !dia_semana || !hora_inicio || !hora_fin) {
      setError('Todos los campos son requeridos'); return;
    }
    if (hora_inicio >= hora_fin) { setError('La hora de fin debe ser mayor a la hora de inicio'); return; }

    setCargando(true);
    try {
      await apiRequest('/sesiones', {
        method: 'POST',
        body: JSON.stringify({
          disciplina_id: parseInt(disciplina_id),
          espacio_id:    parseInt(espacio_id),
          instructor_id: parseInt(instructor_id),
          dia_semana:    parseInt(dia_semana),
          hora_inicio, hora_fin,
          cupo_maximo:  parseInt(cupo_maximo),
        })
      });
      onCreada();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Nueva sesión" subtitle="Programa una nueva clase"
      footer={<PieFormulario onClose={onClose} onConfirm={handleSubmit} cargando={cargando} textoConfirm="Crear sesión" />}>
      <Stack gap={16}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormSesion form={form} setForm={setForm} {...catalogos} />
      </Stack>
    </Modal>
  );
}

// ── Modal Editar Sesión ───────────────────────────────────────────────────────
function ModalEditarSesion({ sesion, onClose, onActualizada }) {
  const [catalogos, setCatalogos] = useState({ disciplinas: [], espacios: [], instructores: [] });
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState(null);
  const [form, setForm] = useState({
    disciplina_id: String(sesion.disciplina_id || ''),
    espacio_id:    String(sesion.espacio_id || ''),
    instructor_id: String(sesion.instructor_id || ''),
    dia_semana:    String(sesion.dia_semana || ''),
    hora_inicio:   String(sesion.hora_inicio || '').slice(0, 5),
    hora_fin:      String(sesion.hora_fin || '').slice(0, 5),
    cupo_maximo:   String(sesion.cupo_maximo || '15'),
  });

  useEffect(() => {
    fetchCatalogos().then(setCatalogos).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const { disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo } = form;
    if (!disciplina_id || !espacio_id || !instructor_id || !dia_semana || !hora_inicio || !hora_fin) {
      setError('Todos los campos son requeridos'); return;
    }
    if (hora_inicio >= hora_fin) { setError('La hora de fin debe ser mayor a la hora de inicio'); return; }

    setCargando(true);
    try {
      await apiRequest(`/sesiones/${sesion.sesion_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          disciplina_id: parseInt(disciplina_id),
          espacio_id:    parseInt(espacio_id),
          instructor_id: parseInt(instructor_id),
          dia_semana:    parseInt(dia_semana),
          hora_inicio, hora_fin,
          cupo_maximo:  parseInt(cupo_maximo),
          activo:        true,
        })
      });
      onActualizada();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al actualizar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Editar sesión" subtitle={`Modificando: ${sesion.disciplina}`}
      footer={<PieFormulario onClose={onClose} onConfirm={handleSubmit} cargando={cargando} textoConfirm="Guardar cambios" />}>
      <Stack gap={16}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormSesion form={form} setForm={setForm} {...catalogos} />
      </Stack>
    </Modal>
  );
}

// ── Modal Inscritos ───────────────────────────────────────────────────────────
function ModalInscritos({ sesion, fecha, onClose }) {
  const [inscritos, setInscritos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    const query = fecha ? `?fecha=${fecha}` : '';
    setLoading(true);
    setError('');
    apiRequest(`/instructor/sesiones/${sesion.sesion_id}/inscritos${query}`)
      .then(data => setInscritos(Array.isArray(data) ? data : []))
      .catch(err => {
        setInscritos([]);
        setError(err.message || 'No se pudieron cargar los inscritos');
      })
      .finally(() => setLoading(false));
  }, [sesion.sesion_id, fecha]);

  const columnas = [
    {
      key: 'socio',
      header: 'Socio',
      render: (s) => (
        <Stack gap={0}>
          <span>{s.nombre_socio}</span>
          {s.numero_socio && <Text variant="caption" muted as="span">#{s.numero_socio}</Text>}
        </Stack>
      ),
    },
    { key: 'tipo', header: 'Tipo', render: (s) => <Badge variant="success">{s.tipo || 'Confirmado'}</Badge> },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Inscritos — ${sesion.disciplina}`}
      subtitle={`${formatHora(sesion.hora_inicio)} – ${formatHora(sesion.hora_fin)} · ${sesion.espacio}`}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}
    >
      {loading ? (
        <Text role="status" muted>Cargando inscritos…</Text>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <Stack gap={16}>
          {inscritos.length > 0 && (
            <ProgressBar label="Inscritos" value={inscritos.length} max={parseInt(sesion.cupo_maximo) || 1} />
          )}
          <Table
            columns={columnas}
            data={inscritos}
            getRowKey={(s) => s.inscripcion_id}
            emptyTitle="Sin inscritos aún"
            emptyMessage="Los socios pueden inscribirse desde su panel."
          />
        </Stack>
      )}
    </Modal>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function GestionDisciplinas() {
  const { showConfirm, toast } = useNotification();
  const [sesiones, setSesiones]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState('');
  const [filtroCupo, setFiltroCupo]     = useState('todas');
  const [showModal, setShowModal]       = useState(false);
  const [editingSesion, setEditingSesion] = useState(null);
  const [inscritosSesion, setInscritosSesion] = useState(null);
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    if (hoy.getDay() === 0) return getLunes();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  });

  const fetchSesiones = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/instructor/clases-general?fecha=${fecha}`);
      setSesiones(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSesiones(); }, [fecha]);

  const handleDelete = async (sesion) => {
    if (!await showConfirm(`¿Eliminar la sesión de ${sesion.disciplina} (${formatHora(sesion.hora_inicio)})? Esta acción no se puede deshacer.`, { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      await apiRequest(`/sesiones/${sesion.sesion_id}`, { method: 'DELETE' });
      fetchSesiones();
    } catch (err) {
      toast(err.message || 'Error al eliminar sesión', 'error');
    }
  };

  const formatFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const filtradas = sesiones
    .filter(s => {
      const pct = Math.min(100, Math.round((parseInt(s.cupo_actual) || 0) / (parseInt(s.cupo_maximo) || 1) * 100));
      if (filtroCupo === 'disponible') return pct < 80;
      if (filtroCupo === 'lleno') return pct >= 100;
      return true;
    })
    .filter(s =>
      s.disciplina?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.instructor?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.espacio?.toLowerCase().includes(busqueda.toLowerCase())
    );

  const llenas      = sesiones.filter(s => parseInt(s.cupo_actual) >= parseInt(s.cupo_maximo)).length;
  const disponibles = sesiones.filter(s => parseInt(s.cupo_actual) < parseInt(s.cupo_maximo)).length;

  const indicadores = [
    { label: 'Total sesiones', valor: sesiones.length, tone: 'primary', key: 'todas' },
    { label: 'Disponibles',    valor: disponibles,     tone: 'success', key: 'disponible' },
    { label: 'Llenas',         valor: llenas,          tone: 'danger',  key: 'lleno' },
  ];

  const columnas = [
    {
      key: 'clase',
      header: 'Clase',
      render: (s) => (
        <Stack gap={4}>
          <span><Badge variant="info">{s.disciplina}</Badge></span>
          <Text variant="caption" muted as="span">{s.instructor || 'Sin instructor'}</Text>
        </Stack>
      ),
    },
    {
      key: 'horario',
      header: 'Horario',
      render: (s) => (
        <Stack gap={4}>
          <span>{formatHora(s.hora_inicio)} – {formatHora(s.hora_fin)}</span>
          {s.dia_semana && (
            <span>
              <Badge>{DIAS_SEMANA.find(d => d.value === parseInt(s.dia_semana))?.label || `Día ${s.dia_semana}`}</Badge>
            </span>
          )}
        </Stack>
      ),
    },
    { key: 'espacio', header: 'Espacio', render: (s) => s.espacio },
    {
      key: 'cupo',
      header: 'Cupo',
      width: 170,
      render: (s) => <ProgressBar value={parseInt(s.cupo_actual) || 0} max={parseInt(s.cupo_maximo) || 1} />,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (s) => {
        const pct = Math.min(100, Math.round(((parseInt(s.cupo_actual) || 0) / (parseInt(s.cupo_maximo) || 1)) * 100));
        const badge = getBadge(pct);
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (s) => (
        <Stack direction="row" gap={8} wrap>
          <Button variant="secondary" onClick={() => setInscritosSesion(s)}>
            <Users size={14} />&nbsp;Inscritos ({parseInt(s.cupo_actual) || 0})
          </Button>
          <Button variant="secondary" onClick={() => setEditingSesion(s)}>Editar</Button>
          <Button variant="error" onClick={() => handleDelete(s)}>Eliminar</Button>
        </Stack>
      ),
    },
  ];

  return (
    <Stack gap={16}>
      <Stack direction="row" justify="end">
        <Button onClick={() => setShowModal(true)}>Nueva sesión</Button>
      </Stack>

      <Stack direction="row" gap={16} grow minChild={150}>
        {indicadores.map(k => (
          <StatCard
            key={k.key}
            label={k.label}
            value={k.valor}
            tone={k.tone}
            selected={filtroCupo === k.key}
            onClick={() => setFiltroCupo(k.key)}
          />
        ))}
      </Stack>

      <Stack direction="row" gap={16} grow minChild={220} align="end">
        <Input label="Buscar" type="search" placeholder="Buscar disciplina, instructor o espacio..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </Stack>

      <Text variant="caption" muted role="status">
        {loading ? 'Cargando…' : `${filtradas.length} sesiones para el ${formatFecha(fecha)}`}
      </Text>

      {!loading && (
        <Table
          columns={columnas}
          data={filtradas}
          getRowKey={(s) => s.sesion_id}
          minWidth={820}
          emptyTitle="Sin clases"
          emptyMessage={`No hay clases para el ${formatFecha(fecha)}.`}
          emptyAction={<Button variant="secondary" onClick={() => setShowModal(true)}>Crear primera sesión</Button>}
        />
      )}

      {showModal && (
        <ModalNuevaSesion onClose={() => setShowModal(false)} onCreada={fetchSesiones} />
      )}
      {editingSesion && (
        <ModalEditarSesion
          sesion={editingSesion}
          onClose={() => setEditingSesion(null)}
          onActualizada={() => { setEditingSesion(null); fetchSesiones(); }}
        />
      )}
      {inscritosSesion && (
        <ModalInscritos sesion={inscritosSesion} fecha={fecha} onClose={() => setInscritosSesion(null)} />
      )}
    </Stack>
  );
}

export default GestionDisciplinas;
