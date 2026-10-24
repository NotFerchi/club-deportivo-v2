import React, { useState } from 'react';
import { Alert, Button, Input, Modal, Select, Stack } from '../ui';

const TIPOS = [
  { value: 'Individual', label: 'Individual' },
  { value: 'Equipos', label: 'Por equipos' },
];

/**
 * TorneoFormModal - formulario para crear o editar un torneo (§3.3 y §3.4 del contrato).
 * Las reglas las valida el backend; aquí se muestra tal cual el mensaje que devuelve.
 *
 * Para empezar con campos limpios en cada apertura, el padre debe montarlo solo mientras
 * está abierto (o cambiarle la `key`).
 *
 * Props:
 *   torneo      - torneo a editar; null/undefined crea uno nuevo
 *   disciplinas - [{ disciplina_id, nombre }]
 *   categorias  - [{ categoria_id, nombre }]
 *   onGuardar   - (payload, torneo_id?) => Promise; si rechaza, se muestra err.message
 *   onClose     - cierra el modal
 */
export default function TorneoFormModal({ torneo, disciplinas, categorias, onGuardar, onClose }) {
  const editando = Boolean(torneo);
  const [datos, setDatos] = useState({
    nombre: torneo?.nombre ?? '',
    disciplina_id: torneo?.disciplina_id ?? '',
    categoria_id: torneo?.categoria_id ?? '',
    tipo_torneo: torneo?.tipo_torneo ?? 'Individual',
    fecha_inicio: torneo?.fecha_inicio ?? '',
    fecha_fin: torneo?.fecha_fin ?? '',
    cupo_maximo: torneo?.cupo_maximo ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (campo) => (event) => {
    setDatos((previos) => ({ ...previos, [campo]: event.target.value }));
  };

  const enviar = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      // Vacío = "sin límite" / "sin fecha": se manda null, como pide el contrato
      await onGuardar({
        ...datos,
        fecha_inicio: datos.fecha_inicio || null,
        fecha_fin: datos.fecha_fin || null,
        cupo_maximo: datos.cupo_maximo === '' ? null : Number(datos.cupo_maximo),
      }, torneo?.torneo_id);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editando ? 'Editar torneo' : 'Nuevo torneo'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="torneo-form" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      )}
    >
      <form id="torneo-form" onSubmit={enviar} noValidate>
        <Stack gap={16}>
          {error && <Alert variant="error">{error}</Alert>}

          <Input label="Nombre" markRequired value={datos.nombre} onChange={cambiar('nombre')} placeholder="Ej. Copa Otoño 2026" />

          <Stack direction="row" gap={16} grow minChild={160}>
            <Select
              label="Disciplina"
              markRequired
              placeholder="Elige una disciplina"
              value={datos.disciplina_id}
              onChange={cambiar('disciplina_id')}
              options={disciplinas.map((d) => ({ value: d.disciplina_id, label: d.nombre }))}
            />
            <Select
              label="Categoría"
              markRequired
              placeholder="Elige una categoría"
              value={datos.categoria_id}
              onChange={cambiar('categoria_id')}
              options={categorias.map((c) => ({ value: c.categoria_id, label: c.nombre }))}
            />
          </Stack>

          <Select label="Tipo de torneo" value={datos.tipo_torneo} onChange={cambiar('tipo_torneo')} options={TIPOS} />

          <Stack direction="row" gap={16} grow minChild={160}>
            <Input label="Fecha de inicio" type="date" value={datos.fecha_inicio} onChange={cambiar('fecha_inicio')} />
            <Input label="Fecha de fin" type="date" value={datos.fecha_fin} onChange={cambiar('fecha_fin')} />
          </Stack>

          <Input
            label="Cupo máximo"
            type="number"
            inputMode="numeric"
            min={4}
            max={256}
            value={datos.cupo_maximo}
            onChange={cambiar('cupo_maximo')}
            helperText="Entre 4 y 256. Déjalo vacío para no poner límite."
          />
        </Stack>
      </form>
    </Modal>
  );
}
