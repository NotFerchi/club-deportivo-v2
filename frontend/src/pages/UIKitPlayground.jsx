import React, { useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, Checkbox, Chip, Input, Modal, ProgressBar, Select, StatCard, Table } from '../components/ui';
import './UIKitPlayground.css';

/**
 * UIKitPlayground - página de pruebas de components/ui/ (solo desarrollo, ruta /ui-kit).
 * Muestra cada componente en sus estados y un modal para probar foco y bloqueo de scroll.
 */

const COLUMNS = [
  { key: 'socio', header: 'Socio', width: 200 },
  { key: 'espacio', header: 'Espacio', width: 200 },
  { key: 'fecha', header: 'Fecha', width: 180 },
  { key: 'estado', header: 'Estado' },
];

const RESERVAS = [
  { id: 1, socio: 'María López', espacio: 'Cancha de pádel 1', fecha: '12/10/2026 · 18:00', estado: 'Confirmada' },
  { id: 2, socio: 'Carlos Ruiz', espacio: 'Alberca semiolímpica', fecha: '12/10/2026 · 19:00', estado: 'Pendiente' },
  { id: 3, socio: 'Ana Torres', espacio: 'Cancha de tenis 2', fecha: '13/10/2026 · 08:00', estado: 'Cancelada' },
];

const DISCIPLINAS = [
  { value: 1, label: 'Tenis' },
  { value: 2, label: 'Pádel' },
  { value: 3, label: 'Natación' },
];

function ChipsDemo() {
  const [sel, setSel] = useState(['Yoga']);
  const toggle = (n) => setSel((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  return (
    <div className="uikit-grid">
      {['Natación', 'Yoga', 'Tenis'].map((n) => (
        <Chip key={n} selected={sel.includes(n)} onClick={() => toggle(n)}>{n}</Chip>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="uikit-section">
      <h2 className="uikit-section__title">{title}</h2>
      {children}
    </section>
  );
}

export default function UIKitPlayground() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [socio, setSocio] = useState('');
  const [disciplina, setDisciplina] = useState('');

  const closeModal = () => setIsModalOpen(false);

  return (
    <main className="uikit-page">
      <header className="uikit-header">
        <p className="uikit-overline">Solo desarrollo · /ui-kit</p>
        <h1 className="uikit-title">UI Kit Playground</h1>
      </header>

      <Section title="Button">
        <div className="uikit-grid uikit-grid--buttons">
          {['primary', 'secondary', 'error'].map((variant) => (
            <div key={variant} className="uikit-row">
              <span className="uikit-label">{variant}</span>
              <Button variant={variant}>Button</Button>
              <Button variant={variant} disabled>Disabled</Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Input">
        <div className="uikit-grid uikit-grid--inputs">
          <Input
            label="Nombre completo"
            placeholder="Ej. Juan Pérez"
            helperText="Texto de ayuda"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
          />
          <Input label="Nombre completo" defaultValue="Juan Pé" error="Este campo es obligatorio" />
          <Input label="Nombre completo" placeholder="Ej. Juan Pérez" helperText="Campo no editable" disabled />
        </div>
      </Section>

      <Section title="Select">
        <div className="uikit-grid uikit-grid--inputs">
          <Select
            label="Disciplina"
            placeholder="Todas"
            helperText="Texto de ayuda"
            options={DISCIPLINAS}
            value={disciplina}
            onChange={(event) => setDisciplina(event.target.value)}
          />
          <Select label="Categoría" placeholder="Elige una categoría" options={DISCIPLINAS} error="Elige una categoría" />
          <Select label="Tipo de torneo" options={DISCIPLINAS} disabled />
        </div>
      </Section>

      <Section title="Badge">
        <div className="uikit-row">
          <Badge>Neutral</Badge>
          <Badge variant="success">Abierto</Badge>
          <Badge variant="warning">Inscripciones cerradas</Badge>
          <Badge variant="danger">Cancelado</Badge>
          <Badge variant="info">En curso</Badge>
        </div>
      </Section>

      <Section title="Alert">
        <div className="uikit-grid">
          <Alert variant="error" action={<Button variant="secondary">Reintentar</Button>}>
            No se pudieron cargar los torneos.
          </Alert>
          <Alert variant="error">El torneo alcanzó su cupo máximo (16 participantes)</Alert>
          <Alert variant="success">¡Inscripción exitosa en Copa Otoño 2026!</Alert>
          <Alert variant="warning" title="Cupo casi lleno">Quedan 2 lugares.</Alert>
          <Alert variant="info">Las inscripciones cierran un día antes del inicio.</Alert>
        </div>
      </Section>

      <Section title="ProgressBar">
        <div className="uikit-grid uikit-grid--inputs">
          <ProgressBar label="Inscritos" value={6} max={16} />
          <ProgressBar label="Inscritos" value={14} max={16} />
          <ProgressBar label="Inscritos" value={16} max={16} />
          <ProgressBar label="Sin cupo definido" value={6} />
        </div>
      </Section>

      <Section title="StatCard">
        <div className="uikit-grid uikit-grid--inputs">
          <StatCard label="Total socios" value={248} hint="231 activos" tone="primary" />
          <StatCard label="Confirmadas" value={8} tone="success" />
          <StatCard label="No-Show" value={2} tone="warning" />
          <StatCard label="Canceladas" value={1} tone="danger" selected onClick={() => {}} />
          <StatCard label="Acceso directo" value={12} tone="neutral" onClick={() => {}} />
        </div>
      </Section>

      <Section title="Card">
        <div className="uikit-grid uikit-grid--inputs">
          <Card title="Visitas activas" action={<Button variant="secondary">Ver todo</Button>}>
            Contenido del panel con margen interior.
          </Card>
          <Card title="Con tabla a ras del borde" flush>
            <Table columns={[{ key: 'a', header: 'Socio' }, { key: 'b', header: 'Número' }]} data={[{ id: 1, a: 'Ana López', b: 'S-001' }]} />
          </Card>
        </div>
      </Section>

      <Section title="Avatar">
        <div className="uikit-grid">
          <Avatar name="Carlos López" size="sm" />
          <Avatar name="María Fernanda Hernández" size="md" />
          <Avatar name="Ana Gil" size="lg" />
        </div>
      </Section>

      <Section title="Chip">
        <ChipsDemo />
      </Section>

      <Section title="Checkbox">
        <div className="uikit-grid">
          <Checkbox label="Instructor activo" defaultChecked />
          <Checkbox label="Opción sin marcar" />
          <Checkbox label="Deshabilitada" disabled />
        </div>
      </Section>

      <Section title="Table · con datos">
        <Table columns={COLUMNS} data={RESERVAS} />
      </Section>

      <Section title="Table · vacía">
        <Table
          columns={COLUMNS}
          data={[]}
          emptyMessage="No hay reservas que coincidan con los filtros."
          emptyAction={<Button variant="secondary">Limpiar filtros</Button>}
        />
      </Section>

      <Section title="Modal">
        <div>
          <Button onClick={() => setIsModalOpen(true)}>Abrir modal</Button>
        </div>
      </Section>

      <Section title="Relleno para probar el bloqueo de scroll">
        <div className="uikit-filler">
          {Array.from({ length: 30 }, (_, index) => (
            <p key={index} className="uikit-filler__item">
              Bloque de relleno {index + 1}. Abre el modal y comprueba que la página no se desplaza.
            </p>
          ))}
        </div>
      </Section>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Nueva reserva"
        footer={(
          <>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button onClick={closeModal}>Guardar</Button>
          </>
        )}
      >
        <p className="uikit-modal-text">Completa los datos para registrar la reserva del espacio.</p>
        <Input
          label="Socio"
          placeholder="Ej. Juan Pérez"
          value={socio}
          onChange={(event) => setSocio(event.target.value)}
        />
      </Modal>
    </main>
  );
}
