import React, { useState } from 'react';
import {
  Alert, Avatar, Badge, Button, Card, Checkbox, Chip, ConfirmDialog, EmptyState, ErrorState, Input, LoadingState, Modal,
  PageHeader, ProgressBar, Select, SocioPicker, Spinner, StatCard, Table, Tabs, Textarea, Toast, ToastViewport,
} from '../components/ui';
import { brand } from '../config/brand';
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

const SOCIOS = [
  { id: 1, nombre: 'Sofía Torres Ruiz', numero: '3410', detalle: 'Tenis singular', estado: 'Al día' },
  { id: 2, nombre: 'Carlos Mendoza Ortiz', numero: '1822', detalle: 'Pádel dobles', estado: 'Al día' },
  { id: 3, nombre: 'Lucía Vega Galindo', numero: '4901', detalle: 'Natación máster', estado: 'Pendiente', estadoVariant: 'warning' },
];

function SocioPickerDemo() {
  const [socio, setSocio] = useState(null);
  const [resultados, setResultados] = useState([]);
  // simula la consulta del padre: filtra una lista local
  const buscar = (texto) => {
    const t = texto.toLowerCase();
    setResultados(SOCIOS.filter((x) => x.nombre.toLowerCase().includes(t) || x.numero.includes(t)));
  };
  return (
    <SocioPicker label="Socio anfitrión" value={socio} onChange={setSocio} onSearch={buscar} options={resultados} helperText="Prueba con «sof», «mendoza» o «1822»" />
  );
}

function TabsDemo() {
  const [tab, setTab] = useState('todos');
  return (
    <Tabs
      ariaLabel="Filtrar socios"
      value={tab}
      onChange={setTab}
      tabs={[
        { value: 'todos', label: 'Todos los socios' },
        { value: 'activos', label: 'Con membresía activa', count: 120 },
        { value: 'espera', label: 'En lista de espera' },
      ]}
    />
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
  const [comentario, setComentario] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDangerOpen, setIsDangerOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const addToast = (variant, message) => setToasts((prev) => [...prev, { id: Date.now() + Math.random(), variant, message }]);
  const removeToast = (id) => setToasts((prev) => prev.filter((x) => x.id !== id));

  const closeModal = () => setIsModalOpen(false);

  return (
    <main className="uikit-page">
      <header className="uikit-header">
        <p className="uikit-overline">Solo desarrollo · /ui-kit</p>
        <h1 className="uikit-title">UI Kit Playground</h1>
      </header>

      <Section title="Marca · config/brand.js">
        <div className="uikit-stage">
          <div className="uikit-row">
            {[brand.logos.principalA.logotipo.azul, brand.logos.principalA.simbolo.azul, brand.logos.atleta.logotipo.azul, brand.logos.atleta.simbolo.azul].map((src) => (
              <img key={src} src={src} alt="" height={40} />
            ))}
          </div>
          <div className="uikit-row uikit-brand-dark">
            {[brand.logos.principalA.logotipo.blanco, brand.logos.principalA.simbolo.blanco, brand.logos.atleta.logotipo.blanco, brand.logos.atleta.simbolo.blanco].map((src) => (
              <img key={src} src={src} alt="" height={40} />
            ))}
          </div>
        </div>
        <p className="uikit-modal-text">{brand.nombre} · {brand.club}{brand.contacto.esDemo ? ' · contacto y horario son datos de demostración' : ''}</p>
      </Section>

      <Section title="Button">
        <div className="uikit-grid uikit-grid--buttons">
          {['primary', 'secondary', 'soft', 'error'].map((variant) => (
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

      <Section title="Textarea">
        <div className="uikit-grid uikit-grid--inputs">
          <Textarea
            label="Comentario"
            placeholder="Cuéntanos cómo fue la clase"
            maxLength={500}
            showCount
            value={comentario}
            onChange={(event) => setComentario(event.target.value)}
          />
          <Textarea label="Comentario" defaultValue="Muy corto" error="El comentario es obligatorio" />
          <Textarea label="Comentario" placeholder="Campo no editable" helperText="Texto de ayuda" disabled />
        </div>
      </Section>

      <Section title="Select · listbox propio (↑ ↓ Enter Esc, letras para buscar)">
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
          <Badge variant="ice">Hoy · 18:00 hrs</Badge>
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

      <Section title="StatCard · degradado por área">
        <div className="uikit-stage">
          <div className="uikit-grid uikit-grid--inputs">
            <StatCard gradient="reservas" tag="Hoy" label="Reservas · Alberca olímpica" value="14" hint="Carriles disponibles en turno vespertino" />
            <StatCard gradient="clases" tag="En vivo" label="Clases · Actividad física" value="38" hint="Sesiones de pádel, yoga y spinning" />
            <StatCard gradient="torneos" tag="Nuevo" label="Torneos · Primavera 2026" value="08" hint="Cuadros abiertos de tenis y pádel" onClick={() => {}} />
            <StatCard gradient="ludoteca" tag="Familia" label="Ludoteca · Club kids" value="25" hint="Talleres creativos y estimulación" />
          </div>
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

      <Section title="Card · vidrio">
        <div className="uikit-stage">
          <div className="uikit-grid uikit-grid--inputs">
            <Card glass title="Luz difusa y profundidad" action={<Badge variant="ice">Activo</Badge>}>
              Tarjeta de vidrio sobre fondo con orbes (blur 24 px, saturación 180 %).
            </Card>
            <Card title="Tarjeta normal">Fondo blanco, radio de 28 px y sombra suave.</Card>
          </div>
        </div>
      </Section>

      <Section title="PageHeader">
        <PageHeader
          overline="Módulo oficial del club"
          title="Torneos y competencias"
          subtitle="Gestión oficial de cuadros, inscripciones y sedes activas del club."
          actions={(
            <>
              <Input placeholder="Buscar torneo o socio…" aria-label="Buscar torneo o socio" />
              <Button>Nuevo torneo</Button>
            </>
          )}
        />
      </Section>

      <Section title="Tabs · segmented control">
        <TabsDemo />
      </Section>

      <Section title="Estados · cargando, vacío y error">
        <div className="uikit-grid uikit-grid--inputs">
          <LoadingState rows={2} />
          <EmptyState title="Aún no hay torneos" message="Crea el primer torneo de la temporada para recibir inscripciones." action={<Button>Crear torneo</Button>} />
          <ErrorState message="Una interrupción de red impidió sincronizar la disponibilidad." onRetry={() => {}} />
        </div>
        <div className="uikit-row"><Spinner /><span>Spinner</span></div>
      </Section>

      <Section title="SocioPicker">
        <div className="uikit-grid uikit-grid--inputs">
          <SocioPickerDemo />
        </div>
      </Section>

      <Section title="ConfirmDialog">
        <div className="uikit-row">
          <Button variant="secondary" onClick={() => setIsConfirmOpen(true)}>Confirmación normal</Button>
          <Button variant="error" onClick={() => setIsDangerOpen(true)}>Confirmación destructiva</Button>
        </div>
      </Section>

      <Section title="Toast">
        <div className="uikit-row">
          <Button variant="secondary" onClick={() => addToast('success', 'Inscripción confirmada con éxito')}>Éxito</Button>
          <Button variant="secondary" onClick={() => addToast('info', 'Tu reserva empieza en 30 minutos')}>Info</Button>
          <Button variant="secondary" onClick={() => addToast('warning', 'Cupo limitado: quedan solo 2 lugares')}>Advertencia</Button>
          <Button variant="secondary" onClick={() => addToast('error', 'Error al procesar el pago de la cuota anual')}>Error</Button>
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
        <Select
          label="Disciplina (el panel no se recorta dentro del modal)"
          placeholder="Elige una disciplina"
          name="disciplina"
          options={DISCIPLINAS}
          value={disciplina}
          onChange={(event) => setDisciplina(event.target.value)}
        />
        <SocioPickerDemo />
      </Modal>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="¿Confirmar la reserva?"
        message="Cancha 3 · hoy a las 18:00 hrs."
        confirmLabel="Confirmar"
        onConfirm={() => setIsConfirmOpen(false)}
        onCancel={() => setIsConfirmOpen(false)}
      />
      <ConfirmDialog
        isOpen={isDangerOpen}
        destructive
        title="¿Eliminar inscripción del torneo?"
        message="Esta acción liberará el lugar en el cuadro y no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => setIsDangerOpen(false)}
        onCancel={() => setIsDangerOpen(false)}
      />

      <ToastViewport>
        {toasts.map((t) => (
          <Toast key={t.id} variant={t.variant} onClose={() => removeToast(t.id)}>{t.message}</Toast>
        ))}
      </ToastViewport>
    </main>
  );
}
