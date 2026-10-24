import React, { useEffect, useState } from 'react';
import { Users, UserCheck, UserX } from 'lucide-react';
import {
  Alert, Avatar, Badge, Button, Checkbox, Chip, Input, Modal, Stack, StatCard, Table, Text,
} from '../../../components/ui';
import { useNotification } from '../../../context/NotificationContext';
import { API_BASE_URL } from '../../../services/api';

// ── Selector de especialidades desde disciplinas BD ───────────────────────────
function EspecialidadesSelector({ value, onChange }) {
  const [disciplinas, setDisciplinas] = useState([]);
  const seleccionadas = value ? value.split(',').map(e => e.trim()).filter(Boolean) : [];

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE_URL}/disciplinas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setDisciplinas(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const toggle = (nombre) => {
    const nuevas = seleccionadas.includes(nombre)
      ? seleccionadas.filter(e => e !== nombre)
      : [...seleccionadas, nombre];
    onChange(nuevas.join(', '));
  };

  return (
    <Stack gap={8}>
      <Text variant="small" as="span">Especialidades</Text>
      <Stack direction="row" gap={8} wrap>
        {disciplinas.map(d => (
          <Chip key={d.disciplina_id} selected={seleccionadas.includes(d.nombre)} onClick={() => toggle(d.nombre)}>
            {d.nombre}
          </Chip>
        ))}
      </Stack>
      {seleccionadas.length > 0 && (
        <Text variant="caption" muted>Seleccionadas: {seleccionadas.join(', ')}</Text>
      )}
    </Stack>
  );
}

// ── Modal Crear/Editar Instructor ─────────────────────────────────────────────
function ModalInstructor({ instructor, onClose, onGuardado }) {
  const esEdicion = !!instructor;
  const [form, setForm] = useState({
    nombre:       instructor?.nombre       || '',
    especialidad: instructor?.especialidad || '',
    email:        instructor?.email        || '',
    telefono:     instructor?.telefono     || '',
    activo:       instructor?.activo ?? true,
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }

    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const url = esEdicion
        ? `${API_BASE_URL}/instructores/${instructor.instructor_id}`
        : `${API_BASE_URL}/instructores`;
      const method = esEdicion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      onGuardado();
      onClose();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={esEdicion ? 'Editar instructor' : 'Nuevo instructor'}
      subtitle={esEdicion ? 'Modifica los datos del instructor' : 'Agrega un nuevo instructor al club'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={cargando}>
            {cargando ? 'Guardando…' : esEdicion ? 'Actualizar' : 'Crear instructor'}
          </Button>
        </>
      )}
    >
      <Stack gap={16}>
        {error && <Alert variant="error">{error}</Alert>}
        <Input label="Nombre completo" markRequired name="nombre" value={form.nombre}
          onChange={handleChange} placeholder="Ej: Carlos López" />
        <EspecialidadesSelector
          value={form.especialidad}
          onChange={val => setForm(prev => ({ ...prev, especialidad: val }))}
        />
        <Input label="Email" type="email" name="email" value={form.email}
          onChange={handleChange} placeholder="instructor@club.com" />
        <Input label="Teléfono" name="telefono" value={form.telefono}
          onChange={handleChange} placeholder="55-1234-5678" />
        {esEdicion && (
          <Checkbox label="Instructor activo" name="activo" checked={form.activo} onChange={handleChange} />
        )}
      </Stack>
    </Modal>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function GestionInstructores() {
  const { showConfirm } = useNotification();
  const [instructores, setInstructores] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState('');
  const [filtro, setFiltro]             = useState('todos');
  const [showModal, setShowModal]       = useState(false);
  const [editando, setEditando]         = useState(null);

  const fetchInstructores = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/instructores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setInstructores(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInstructores(); }, []);

  const handleEliminar = async (inst) => {
    if (!await showConfirm(`¿Eliminar a ${inst.nombre}? Esta acción no se puede deshacer.`, { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/instructores/${inst.instructor_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInstructores();
    } catch (err) { console.error(err); }
  };

  const abrirNuevo = () => { setEditando(null); setShowModal(true); };

  const activos    = instructores.filter(i => i.activo);
  const inactivos  = instructores.filter(i => !i.activo);
  const filtrados  = instructores
    .filter(i => filtro === 'todos' ? true : filtro === 'activos' ? i.activo : !i.activo)
    .filter(i =>
      i.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.especialidad?.toLowerCase().includes(busqueda.toLowerCase())
    );

  if (loading) return <Text role="status" muted>Cargando instructores…</Text>;

  const indicadores = [
    { label: 'Total',     valor: instructores.length, tone: 'primary', icono: <Users size={18} />,     key: 'todos' },
    { label: 'Activos',   valor: activos.length,      tone: 'success', icono: <UserCheck size={18} />, key: 'activos' },
    { label: 'Inactivos', valor: inactivos.length,    tone: 'danger',  icono: <UserX size={18} />,     key: 'inactivos' },
  ];

  const columnas = [
    {
      key: 'instructor',
      header: 'Instructor',
      render: (inst) => (
        <Stack direction="row" gap={12} align="center">
          <Avatar name={inst.nombre} src={inst.foto_perfil} size="sm" />
          <span>{inst.nombre}</span>
        </Stack>
      ),
    },
    {
      key: 'especialidades',
      header: 'Especialidades',
      render: (inst) => {
        const lista = inst.especialidad ? inst.especialidad.split(',').map(e => e.trim()).filter(Boolean) : [];
        if (lista.length === 0) return '—';
        return (
          <Stack direction="row" gap={4} wrap>
            {lista.map((esp) => <Badge key={esp} variant="info">{esp}</Badge>)}
          </Stack>
        );
      },
    },
    {
      key: 'contacto',
      header: 'Contacto',
      render: (inst) => (
        inst.email || inst.telefono
          ? (
            <Stack gap={0}>
              {inst.email && <Text variant="small" as="span">{inst.email}</Text>}
              {inst.telefono && <Text variant="caption" muted as="span">{inst.telefono}</Text>}
            </Stack>
          )
          : <Text variant="caption" muted as="span">Sin información de contacto</Text>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (inst) => <Badge variant={inst.activo ? 'success' : 'neutral'}>{inst.activo ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (inst) => (
        <Stack direction="row" gap={8} wrap>
          <Button variant="secondary" onClick={() => { setEditando(inst); setShowModal(true); }}>Editar</Button>
          <Button variant="error" onClick={() => handleEliminar(inst)}>Eliminar</Button>
        </Stack>
      ),
    },
  ];

  return (
    <Stack gap={16}>
      <Stack direction="row" justify="end">
        <Button onClick={abrirNuevo}>Nuevo instructor</Button>
      </Stack>

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
      </Stack>

      <Input
        label="Buscar"
        type="search"
        placeholder="Buscar por nombre o especialidad..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />

      <Table
        columns={columnas}
        data={filtrados}
        getRowKey={(inst) => inst.instructor_id}
        minWidth={680}
        emptyTitle="No se encontraron instructores"
        emptyMessage="Prueba con otra búsqueda o agrega un instructor."
        emptyAction={<Button variant="secondary" onClick={abrirNuevo}>Agregar instructor</Button>}
      />

      {showModal && (
        <ModalInstructor
          instructor={editando}
          onClose={() => { setShowModal(false); setEditando(null); }}
          onGuardado={fetchInstructores}
        />
      )}
    </Stack>
  );
}

export default GestionInstructores;
