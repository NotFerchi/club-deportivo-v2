import React, { useState } from 'react';
import { Button, Input, Modal, Table } from '../components/ui';
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
