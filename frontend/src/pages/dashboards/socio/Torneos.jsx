import React, { useCallback, useEffect, useState } from 'react';
import SocioLayout from '../../../components/SocioLayout';
import TournamentBracket from '../../../components/TournamentBracket';
import { Alert, Button, Select, Stack, Text } from '../../../components/ui';
import TorneosListado from '../../../components/torneos-ui/TorneosListado';
import TorneoDetalleModal from '../../../components/torneos-ui/TorneoDetalleModal';
import InscripcionModal from '../../../components/torneos-ui/InscripcionModal';
import ReporteTorneoModal from '../../../components/torneos-ui/ReporteTorneoModal';
import MisParticipaciones from '../../../components/torneos-ui/MisParticipaciones';
import { ESTADOS_TORNEO } from '../../../components/torneos-ui/torneoEstado';
import {
  inscribirme,
  listarDisciplinas,
  listarMisParticipaciones,
  listarTorneos,
} from '../../../services/torneosApi';

const VISTAS = [
  { id: 'torneos', label: 'Torneos' },
  { id: 'mis-participaciones', label: 'Mis participaciones' },
  { id: 'bracket', label: 'Bracket' },
];

/**
 * Torneos (socio) - ruta /torneos. Lista los torneos con filtros, permite inscribirse y ver
 * resultados, y muestra las participaciones del socio. Todo sale del backend (services/torneosApi);
 * los mensajes de error son los que manda el servidor. El bracket gráfico sigue siendo el de
 * components/TournamentBracket (solo lectura) hasta que se migre.
 */
function Torneos() {
  const [vista, setVista] = useState('torneos');
  const [torneos, setTorneos] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [filtros, setFiltros] = useState({ disciplina_id: '', estado: '' });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [versionTorneos, setVersionTorneos] = useState(0);

  const [participaciones, setParticipaciones] = useState([]);
  const [cargandoMias, setCargandoMias] = useState(true);
  const [errorMias, setErrorMias] = useState(null);
  const [versionMias, setVersionMias] = useState(0);

  const [seleccionado, setSeleccionado] = useState(null);
  const [inscribiendo, setInscribiendo] = useState(null);
  const [viendoResultados, setViendoResultados] = useState(null);
  const [aviso, setAviso] = useState(null);

  // Cada cambio de filtros o de `versionTorneos` (Reintentar, tras inscribirse) vuelve a pedir la lista.
  useEffect(() => {
    let cancelado = false;
    listarTorneos(filtros)
      .then((lista) => {
        if (cancelado) return;
        setTorneos(Array.isArray(lista) ? lista : []);
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
  }, [filtros, versionTorneos]);

  useEffect(() => {
    let cancelado = false;
    listarMisParticipaciones()
      .then((lista) => {
        if (cancelado) return;
        setParticipaciones(Array.isArray(lista) ? lista : []);
        setErrorMias(null);
      })
      .catch((err) => {
        if (cancelado) return;
        setParticipaciones([]);
        setErrorMias(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargandoMias(false);
      });
    return () => { cancelado = true; };
  }, [versionMias]);

  useEffect(() => {
    listarDisciplinas().then(setDisciplinas).catch(() => setDisciplinas([]));
  }, []);

  const recargarTorneos = useCallback(() => {
    setCargando(true);
    setVersionTorneos((v) => v + 1);
  }, []);

  const recargarMias = useCallback(() => {
    setCargandoMias(true);
    setVersionMias((v) => v + 1);
  }, []);

  const cambiarFiltro = (campo) => (event) => {
    setCargando(true);
    setFiltros((previos) => ({ ...previos, [campo]: event.target.value }));
  };

  const limpiarFiltros = () => {
    setCargando(true);
    setFiltros({ disciplina_id: '', estado: '' });
  };

  // Si inscribirme rechaza, InscripcionModal muestra el mensaje del backend y sigue abierto.
  const confirmarInscripcion = async (torneo) => {
    await inscribirme(torneo.torneo_id);
    setInscribiendo(null);
    setAviso(`¡Inscripción exitosa en ${torneo.nombre}!`);
    recargarTorneos();
    recargarMias();
  };

  const idsInscritos = new Set(participaciones.map((p) => p.torneo_id));
  const hayFiltros = Boolean(filtros.disciplina_id || filtros.estado);

  return (
    <SocioLayout activeTab="torneos" title="Club Social | Torneos">
      <Stack gap={24} padding={24}>
        <Stack gap={4}>
          <Text variant="title">Torneos y competencias</Text>
          <Text muted>Participa en los eventos deportivos del club.</Text>
        </Stack>

        {aviso && <Alert variant="success">{aviso}</Alert>}

        <Stack direction="row" gap={8} wrap role="tablist" aria-label="Secciones de torneos">
          {VISTAS.map((v) => (
            <Button
              key={v.id}
              role="tab"
              aria-selected={vista === v.id}
              variant={vista === v.id ? 'primary' : 'secondary'}
              onClick={() => setVista(v.id)}
            >
              {v.label}
            </Button>
          ))}
        </Stack>

        {vista === 'torneos' && (
          <Stack gap={16}>
            <Stack direction="row" gap={16} grow minChild={200}>
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
              onReintentar={recargarTorneos}
              onSeleccionar={setSeleccionado}
              hayFiltros={hayFiltros}
              onLimpiarFiltros={limpiarFiltros}
            />
          </Stack>
        )}

        {vista === 'mis-participaciones' && (
          <MisParticipaciones
            participaciones={participaciones}
            cargando={cargandoMias}
            error={errorMias}
            onReintentar={recargarMias}
            onSeleccionar={setViendoResultados}
          />
        )}

        {vista === 'bracket' && (
          <TournamentBracket
            title="Brackets y Resultados"
            subtitle="Consulta los cruces y resultados de los torneos del club."
            readOnly
          />
        )}
      </Stack>

      <TorneoDetalleModal
        torneo={seleccionado}
        yaInscrito={seleccionado ? idsInscritos.has(seleccionado.torneo_id) : false}
        onClose={() => setSeleccionado(null)}
        onInscribir={(torneo) => { setSeleccionado(null); setAviso(null); setInscribiendo(torneo); }}
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
    </SocioLayout>
  );
}

export default Torneos;
