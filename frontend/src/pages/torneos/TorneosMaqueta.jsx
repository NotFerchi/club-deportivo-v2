import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Select, Stack, Text } from '../../components/ui';
import TorneosListado from '../../components/torneos-ui/TorneosListado';
import TorneoDetalleModal from '../../components/torneos-ui/TorneoDetalleModal';
import TorneoFormModal from '../../components/torneos-ui/TorneoFormModal';
import InscripcionModal from '../../components/torneos-ui/InscripcionModal';
import ReporteTorneoModal from '../../components/torneos-ui/ReporteTorneoModal';
import { ESTADOS_TORNEO } from '../../components/torneos-ui/torneoEstado';
import { guardarTorneo, listarCategorias, inscribirme, listarDisciplinas, listarTorneos } from '../../mocks/torneos';

/**
 * TorneosMaqueta - pantalla de torneos con datos simulados (E3.1). Ruta /torneos-ui (solo desarrollo).
 * Usa solo componentes de components/ui. En E3.3 los datos de `mocks/torneos` pasan a ser
 * llamadas reales al backend y este archivo se borra o se renombra.
 */
export default function TorneosMaqueta() {
  const [torneos, setTorneos] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ disciplina_id: '', estado: '' });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  // Maqueta: permite ver la pantalla con las acciones de un socio o de un coordinador.
  const [rol, setRol] = useState('socio');
  const [seleccionado, setSeleccionado] = useState(null);
  // undefined = formulario cerrado; null = crear; objeto = editar ese torneo
  const [formTorneo, setFormTorneo] = useState(undefined);
  const [inscribiendo, setInscribiendo] = useState(null);
  const [viendoResultados, setViendoResultados] = useState(null);
  const [aviso, setAviso] = useState(null);

  // Cada cambio de filtros o de `version` (Reintentar) vuelve a pedir la lista.
  useEffect(() => {
    let cancelado = false;
    listarTorneos(filtros)
      .then((lista) => {
        if (cancelado) return;
        setTorneos(lista);
        setError(null);
      })
      .catch((err) => {
        if (cancelado) return;
        setTorneos([]);
        setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [filtros, version]);

  useEffect(() => {
    listarDisciplinas().then(setDisciplinas).catch(() => setDisciplinas([]));
    listarCategorias().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  const recargar = useCallback(() => {
    setCargando(true);
    setVersion((v) => v + 1);
  }, []);

  const cambiarFiltro = (campo) => (event) => {
    setCargando(true);
    setFiltros((previos) => ({ ...previos, [campo]: event.target.value }));
  };

  const limpiarFiltros = () => {
    setCargando(true);
    setFiltros({ disciplina_id: '', estado: '' });
  };

  // Si guardarTorneo rechaza, TorneoFormModal muestra el mensaje del backend y sigue abierto.
  const guardar = async (payload, torneoId) => {
    const respuesta = await guardarTorneo(payload, torneoId);
    setFormTorneo(undefined);
    setAviso(torneoId ? respuesta.message : 'Torneo creado correctamente');
    recargar();
  };

  // Si inscribirme rechaza, InscripcionModal muestra el mensaje del backend y sigue abierto.
  const confirmarInscripcion = async (torneo) => {
    await inscribirme(torneo.torneo_id);
    setInscribiendo(null);
    setAviso(`¡Inscripción exitosa en ${torneo.nombre}!`);
    recargar();
  };

  const esStaff = rol === 'staff';
  const hayFiltros = Boolean(filtros.disciplina_id || filtros.estado);

  return (
    <Stack gap={24} padding={24} as="main">
      <Stack direction="row" gap={16} wrap align="center" justify="between">
        <Stack gap={4}>
          <Text variant="title">Torneos</Text>
          <Text muted>Consulta los torneos del club y su cupo.</Text>
        </Stack>
        {esStaff && <Button onClick={() => { setAviso(null); setFormTorneo(null); }}>Nuevo torneo</Button>}
      </Stack>

      {aviso && <Alert variant="success">{aviso}</Alert>}

      <Stack direction="row" gap={16} grow minChild={200}>
        <Select
          label="Ver como (solo maqueta)"
          value={rol}
          onChange={(event) => setRol(event.target.value)}
          options={[{ value: 'socio', label: 'Socio' }, { value: 'staff', label: 'Coordinador' }]}
        />
        <Select
          label="Disciplina"
          placeholder="Todas"
          value={filtros.disciplina_id}
          onChange={cambiarFiltro('disciplina_id')}
          options={disciplinas.map((d) => ({ value: d.disciplina_id, label: d.nombre }))}
        />
        <Select
          label="Estado"
          placeholder="Todos"
          value={filtros.estado}
          onChange={cambiarFiltro('estado')}
          options={ESTADOS_TORNEO.map((e) => ({ value: e.value, label: e.label }))}
        />
      </Stack>

      <TorneosListado
        torneos={torneos}
        cargando={cargando}
        error={error}
        onReintentar={recargar}
        onSeleccionar={setSeleccionado}
        hayFiltros={hayFiltros}
        onLimpiarFiltros={limpiarFiltros}
      />

      <TorneoDetalleModal
        torneo={seleccionado}
        onClose={() => setSeleccionado(null)}
        onEditar={esStaff ? (torneo) => { setSeleccionado(null); setAviso(null); setFormTorneo(torneo); } : undefined}
        onInscribir={esStaff ? undefined : (torneo) => { setSeleccionado(null); setAviso(null); setInscribiendo(torneo); }}
        onVerResultados={(torneo) => { setSeleccionado(null); setViendoResultados(torneo); }}
      />

      {viendoResultados && (
        <ReporteTorneoModal
          key={viendoResultados.torneo_id}
          torneo={viendoResultados}
          onClose={() => setViendoResultados(null)}
        />
      )}

      <InscripcionModal
        torneo={inscribiendo}
        onConfirmar={confirmarInscripcion}
        onClose={() => setInscribiendo(null)}
      />

      {formTorneo !== undefined && (
        <TorneoFormModal
          torneo={formTorneo}
          disciplinas={disciplinas}
          categorias={categorias}
          onGuardar={guardar}
          onClose={() => setFormTorneo(undefined)}
        />
      )}
    </Stack>
  );
}
