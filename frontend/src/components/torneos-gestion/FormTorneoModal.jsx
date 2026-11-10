import React from 'react';
import { CalendarClock, CalendarDays, Infinity as SinLimite, User, Users, UsersRound } from 'lucide-react';
import { Alert, Button, Input, Modal, SegmentedControl, Select, Spinner, Stack, Text } from '../ui';

const AVISO_BLOQUEO = 'No se puede cambiar con las inscripciones cerradas';

function Seccion({ icon, title, help, children }) {
  return (
    <Stack gap={12} as="section">
      <Stack gap={4}>
        <Stack direction="row" gap={8} align="center">
          {icon}
          <Text variant="overline" as="h3">
            {title}
          </Text>
        </Stack>
        {help && (
          <Text variant="small" muted>
            {help}
          </Text>
        )}
      </Stack>
      {children}
    </Stack>
  );
}

/**
 * Modal "Nuevo torneo" / "Editar torneo" (U4-03, Paso 2; diseño editar-torneo de Stitch) con el kit.
 * Mismo estado, validaciones, mensajes y guardado de useGestionTorneos (POST /torneos o
 * PUT /torneos/:id). Campos: nombre, disciplina, modalidad, categoría, fechas del torneo, fechas de
 * inscripción y límite de cupo. La alerta de arriba solo sale con el error que devuelve el backend;
 * los de cada campo van debajo del campo. El cuerpo hace scroll por dentro si no cabe.
 */
function FormTorneoModal({ gestion }) {
  const {
    showTorneoModal,
    setShowTorneoModal,
    editingTorneo,
    formTorneo,
    setFormTorneo,
    torneoFormErrors: errores,
    savingTorneo,
    categoriaRequerida,
    estructuraBloqueada,
    handleSaveTorneo,
    disciplinas,
    categorias
  } = gestion;

  const cambiar = (campo) => (e) => {
    const valor = e && e.target ? e.target.value : e;
    setFormTorneo((p) => ({ ...p, [campo]: valor }));
  };
  const cerrar = () => setShowTorneoModal(false);
  const formId = 'form-torneo-personal';

  return (
    <Modal
      isOpen={showTorneoModal}
      onClose={cerrar}
      title={editingTorneo ? 'Editar torneo' : 'Nuevo torneo'}
      subtitle={
        editingTorneo
          ? 'Modifica los datos generales, el calendario y el cupo de la competencia.'
          : 'Define los datos generales, el calendario y el cupo de la competencia.'
      }
      maxWidth="760px"
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={savingTorneo}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={savingTorneo}>
            {savingTorneo && <Spinner label="Guardando…" />}
            {savingTorneo ? 'Guardando...' : editingTorneo ? 'Guardar cambios' : 'Crear torneo'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSaveTorneo} noValidate>
        <Stack gap={24}>
          {/* Errores del backend al guardar (p. ej. 409 al cambiar la categoría con inscritos), tal cual */}
          {errores.general && <Alert title="No se pudo guardar el torneo">{errores.general}</Alert>}

          <Input
            label="Nombre del torneo"
            markRequired
            value={formTorneo.nombre}
            maxLength={150}
            onChange={cambiar('nombre')}
            placeholder="Ej: Copa Verano 2025"
            error={errores.nombre || false}
          />

          <Stack direction="row" gap={16} wrap grow minChild={260} align="start">
            <Select
              label="Disciplina"
              markRequired
              placeholder="Seleccionar disciplina"
              value={formTorneo.disciplina_id}
              disabled={estructuraBloqueada}
              onChange={cambiar('disciplina_id')}
              options={disciplinas.map((d) => ({ value: String(d.disciplina_id), label: d.nombre }))}
              error={errores.disciplina_id || false}
              helperText={estructuraBloqueada ? AVISO_BLOQUEO : undefined}
            />
            <SegmentedControl
              label="Modalidad de juego"
              markRequired
              fullWidth
              value={formTorneo.tipo_torneo}
              onChange={cambiar('tipo_torneo')}
              disabled={estructuraBloqueada}
              helperText={estructuraBloqueada ? AVISO_BLOQUEO : undefined}
              options={[
                { value: 'Individual', label: 'Individual', icon: <User size={16} /> },
                { value: 'Equipos', label: 'Por equipos', icon: <Users size={16} /> }
              ]}
            />
          </Stack>

          <Select
            label="Categoría de competición"
            markRequired={categoriaRequerida}
            placeholder={categoriaRequerida ? 'Selecciona una categoría' : 'Sin categoría'}
            value={formTorneo.categoria_id}
            disabled={estructuraBloqueada}
            onChange={cambiar('categoria_id')}
            options={categorias.map((c) => ({ value: String(c.categoria_id), label: c.nombre }))}
            error={errores.categoria_id || false}
            helperText={
              estructuraBloqueada ? AVISO_BLOQUEO : 'Define la categoría para todos los participantes de este torneo.'
            }
          />

          <Seccion icon={<CalendarDays size={18} aria-hidden="true" />} title="Fechas del torneo">
            <Stack direction="row" gap={16} wrap grow minChild={220} align="start">
              <Input label="Fecha de inicio" type="date" value={formTorneo.fecha_inicio} onChange={cambiar('fecha_inicio')} />
              <Input
                label="Fecha de término"
                type="date"
                value={formTorneo.fecha_fin}
                onChange={cambiar('fecha_fin')}
                error={errores.fecha_fin || false}
              />
            </Stack>
          </Seccion>

          <Seccion
            icon={<CalendarClock size={18} aria-hidden="true" />}
            title="Fechas de inscripción"
            help="Opcional. Si indicas un periodo, escribe la apertura y el cierre; sin periodo, las inscripciones siguen abiertas hasta que las cierres."
          >
            <Stack direction="row" gap={16} wrap grow minChild={220} align="start">
              <Input
                label="Apertura"
                type="date"
                value={formTorneo.fecha_inicio_inscripcion}
                onChange={cambiar('fecha_inicio_inscripcion')}
                error={errores.fecha_inicio_inscripcion || false}
              />
              <Input
                label="Cierre"
                type="date"
                value={formTorneo.fecha_fin_inscripcion}
                onChange={cambiar('fecha_fin_inscripcion')}
                error={errores.fecha_fin_inscripcion || false}
              />
            </Stack>
          </Seccion>

          <Seccion icon={<UsersRound size={18} aria-hidden="true" />} title="Límite de cupo">
            <Stack direction="row" gap={16} wrap grow minChild={220} align="start">
              <SegmentedControl
                ariaLabel="Límite de cupo"
                fullWidth
                value={formTorneo.limite_cupo}
                onChange={cambiar('limite_cupo')}
                options={[
                  { value: 'con', label: 'Con límite (4–256)', icon: <UsersRound size={16} /> },
                  { value: 'sin', label: 'Sin límite', icon: <SinLimite size={16} /> }
                ]}
              />
              {formTorneo.limite_cupo === 'con' && (
                <Input
                  label="Cupo máximo"
                  type="number"
                  inputMode="numeric"
                  min={4}
                  max={256}
                  step={1}
                  markRequired
                  value={formTorneo.cupo_maximo}
                  onChange={cambiar('cupo_maximo')}
                  error={errores.cupo_maximo || false}
                  placeholder="Ej: 16"
                />
              )}
            </Stack>
          </Seccion>
        </Stack>
      </form>
    </Modal>
  );
}

export default FormTorneoModal;
