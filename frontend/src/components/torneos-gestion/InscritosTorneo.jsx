import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SearchX, UserMinus, UserPlus, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  ProgressBar,
  Spinner,
  Stack,
  Table,
  Text
} from '../ui';
import { cupoDe } from './torneoVista';
import InscribirParticipanteModal from './InscribirParticipanteModal';

const MINIMO = 4; // mismo mínimo que mostraba el modal de inscritos (lo confirma el backend: se_realiza)
const VARIANTE_TIPO = { Socio: 'ice', Visita: 'success', Externo: 'neutral' };

function BotonQuitar({ participante, quitando, onQuitar }) {
  const ocupado = quitando === participante.participante_id;
  return (
    <Button variant="secondary" disabled={Boolean(quitando)} onClick={() => onQuitar(participante)} aria-label={`Quitar a ${participante.nombre_participante}`}>
      {ocupado ? <Spinner label="Quitando…" /> : <UserMinus size={16} aria-hidden="true" />}
      Quitar
    </Button>
  );
}

/**
 * Pestaña "Inscritos" del detalle (U4-03, Paso 2; estructura de detalle-inscritos de Stitch):
 * resumen "N de M participantes", barra de cupo, lugares libres, buscador e "Inscribir
 * participante" (quien edita, con el torneo Abierto, como antes). Torneo por equipos: tarjetas por
 * equipo; individual: tabla con nombre, categoría y tipo. "Quitar" con la misma confirmación.
 *
 * Usa GET /torneos/:id/participantes, la baja y el alta de useGestionTorneos (mismos mensajes).
 * La API no da los integrantes de cada equipo: la tarjeta muestra el equipo.
 */
function InscritosTorneo({ gestion, torneo, puedeEditar }) {
  const {
    participantes,
    loadingParticipantes,
    participantesError,
    cargarParticipantes,
    handleVerParticipantes,
    desinscribiendoId,
    handleDesinscribir,
    showInscribirModal,
    setShowInscribirModal,
    handleInscrito,
    socios,
    categorias
  } = gestion;
  const [busqueda, setBusqueda] = useState('');

  // Carga los inscritos del torneo abierto (y deja listo el torneo para dar de baja)
  // solo al cambiar de torneo; tras inscribir o quitar recargan handleInscrito / handleDesinscribir
  const cargar = useRef({ fn: handleVerParticipantes, torneo });
  useEffect(() => {
    cargar.current = { fn: handleVerParticipantes, torneo };
  });
  const torneoId = torneo.torneo_id;
  useEffect(() => {
    cargar.current.fn(cargar.current.torneo);
  }, [torneoId]);

  const editable = puedeEditar && torneo.estado === 'Abierto';
  const esEquipos = torneo.tipo_torneo === 'Equipos';
  const total = loadingParticipantes || participantesError ? Number(torneo.total_participantes) || 0 : participantes.length;
  const { maximo } = cupoDe(torneo);
  const quedan = maximo !== null ? Math.max(0, maximo - total) : null;
  const porcentaje = maximo ? Math.round((Math.min(total, maximo) / maximo) * 100) : null;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return participantes;
    return participantes.filter((p) => String(p.nombre_participante || '').toLowerCase().includes(q));
  }, [participantes, busqueda]);

  const columnas = [
    {
      key: 'nombre_participante',
      header: 'Participante',
      render: (p) => (
        <Stack direction="row" gap={12} align="center">
          <Avatar name={p.nombre_participante} size="sm" />
          <Text as="span">{p.nombre_participante}</Text>
        </Stack>
      )
    },
    { key: 'categoria', header: 'Categoría', render: (p) => (p.categoria ? <Badge>{p.categoria}</Badge> : '—') },
    { key: 'tipo_participante', header: 'Tipo', render: (p) => <Badge variant={VARIANTE_TIPO[p.tipo_participante] || 'neutral'}>{p.tipo_participante}</Badge> },
    ...(editable
      ? [{ key: 'accion', header: 'Acción', render: (p) => <BotonQuitar participante={p} quitando={desinscribiendoId} onQuitar={handleDesinscribir} /> }]
      : [])
  ];

  return (
    <Stack gap={24}>
      <Card>
        <Stack direction="row" gap={24} align="center" justify="between" wrap>
          <Stack gap={12}>
            <Stack direction="row" gap={8} align="center" wrap>
              <Text variant="heading" as="h3">
                {maximo ? `${total} de ${maximo}` : total}
              </Text>
              <Text muted as="span">
                {maximo ? 'participantes' : total === 1 ? 'participante · sin límite de cupo' : 'participantes · sin límite de cupo'}
              </Text>
            </Stack>
            {maximo && <ProgressBar value={total} max={maximo} label="Cupo" />}
            <Stack direction="row" gap={8} wrap>
              {porcentaje !== null && <Badge variant="ice">{porcentaje}% cupo cubierto</Badge>}
              {quedan !== null && (
                <Badge variant={quedan === 0 ? 'muted' : 'glass'}>
                  {quedan === 0 ? 'Cupo lleno' : `${quedan} ${quedan === 1 ? 'lugar libre' : 'lugares libres'}`}
                </Badge>
              )}
              {!loadingParticipantes && !participantesError && (
                <Badge variant={total >= MINIMO ? 'success' : 'warning'}>
                  {total >= MINIMO ? `Se realizará (mínimo ${MINIMO} alcanzado)` : `Faltan ${MINIMO - total} para realizarse`}
                </Badge>
              )}
            </Stack>
          </Stack>
          <Stack direction="row" gap={12} align="center" wrap>
            <Input
              type="search"
              aria-label="Buscar participante"
              placeholder={esEquipos ? 'Buscar equipo' : 'Buscar participante'}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {editable && (
              <Button onClick={() => setShowInscribirModal(true)}>
                <UserPlus size={16} aria-hidden="true" />
                Inscribir participante
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>

      {loadingParticipantes && <LoadingState rows={4} label="Cargando inscritos…" />}
      {!loadingParticipantes && participantesError && (
        <ErrorState message="No se pudieron cargar los inscritos." onRetry={() => cargarParticipantes(torneo)} />
      )}
      {!loadingParticipantes && !participantesError && participantes.length === 0 && (
        <EmptyState
          icon={<Users size={24} />}
          title="Aún no hay inscritos"
          message="No hay participantes inscritos aún."
          action={
            editable && (
              <Button onClick={() => setShowInscribirModal(true)}>
                <UserPlus size={16} aria-hidden="true" />
                Inscribir participante
              </Button>
            )
          }
        />
      )}
      {!loadingParticipantes && !participantesError && participantes.length > 0 && visibles.length === 0 && (
        <EmptyState compact icon={<SearchX size={20} />} title="Nadie coincide con la búsqueda" message="Prueba con otro nombre." />
      )}

      {!loadingParticipantes && !participantesError && visibles.length > 0 && esEquipos && (
        <Stack gap={16}>
          <Stack direction="row" gap={8} align="center">
            <Text variant="subheading" as="h3">
              Equipos registrados
            </Text>
            <Badge variant="ice">{participantes.length}</Badge>
          </Stack>
          <Stack direction="row" gap={16} wrap grow minChild={400} role="list" aria-label="Equipos inscritos">
            {visibles.map((p) => (
              <Card key={p.participante_id} role="listitem">
                <Stack gap={16}>
                  <Stack direction="row" gap={12} align="center">
                    <Avatar name={p.nombre_participante} />
                    <Stack gap={4}>
                      <Text variant="subheading" as="span">
                        {p.nombre_participante}
                      </Text>
                      <Stack direction="row" gap={8} wrap>
                        {p.categoria && <Badge>{p.categoria}</Badge>}
                        <Badge variant={VARIANTE_TIPO[p.tipo_participante] || 'neutral'}>{p.tipo_participante}</Badge>
                      </Stack>
                    </Stack>
                  </Stack>
                  {editable && (
                    <Stack direction="row" justify="end">
                      <BotonQuitar participante={p} quitando={desinscribiendoId} onQuitar={handleDesinscribir} />
                    </Stack>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}

      {!loadingParticipantes && !participantesError && visibles.length > 0 && !esEquipos && (
        <Stack gap={16}>
          <Stack direction="row" gap={8} align="center">
            <Text variant="subheading" as="h3">
              Participantes individuales
            </Text>
            <Badge variant="ice">{participantes.length}</Badge>
          </Stack>
          <Table columns={columnas} data={visibles} getRowKey={(p) => p.participante_id} minWidth={560} />
        </Stack>
      )}

      {showInscribirModal && (
        <InscribirParticipanteModal
          torneo={torneo}
          socios={socios}
          categorias={categorias}
          onClose={() => setShowInscribirModal(false)}
          onInscribir={handleInscrito}
        />
      )}
    </Stack>
  );
}

export default InscritosTorneo;
