import React, { useEffect, useMemo, useState } from 'react';
import { Badge, ChampionCard, EmptyState, ErrorState, EventCard, LoadingState, MatchCard, Select, Stack, Stepper, Tabs, Text } from '../ui';
import { listarTorneos, obtenerBracket } from '../../services/torneosApi';
import { estadoTorneo, formatFechaHora } from './torneoEstado';
import { iconoDisciplina } from './disciplinaIcono';
import { fotoDisciplina } from './fotoDisciplina';

/** Nombre de la ronda según su lugar contando desde la final. */
function nombreRonda(indice, total) {
  const desdeFinal = total - 1 - indice;
  if (desdeFinal === 0) return total === 1 ? 'Final' : 'Final';
  if (desdeFinal === 1) return 'Semifinal';
  if (desdeFinal === 2) return 'Cuartos';
  return `Ronda ${indice + 1}`;
}

/** Estado de un encuentro → texto y variante del Badge del kit. */
function estadoEncuentro(estado) {
  const e = String(estado || '').trim().toLowerCase();
  if (e === 'finalizado') return { label: 'Finalizado', variant: 'success' };
  if (e === 'en_juego' || e === 'en juego' || e === 'en_curso') return { label: 'En juego', variant: 'danger' };
  if (e === 'programado') return { label: 'Programado', variant: 'info' };
  return { label: 'Pendiente', variant: 'neutral' };
}

const esFinalizado = (enc) => String(enc?.estado || '').trim().toLowerCase() === 'finalizado';
const nombreDe = (p) => (p?.participante_id ? p.nombre : 'Por definir');

/**
 * BracketSocio - bracket de solo lectura para el socio: elige un torneo, cambia de ronda y ve
 * los encuentros y el campeón. Solo hace GET (torneos y bracket); no hay acciones de edición.
 */
export default function BracketSocio() {
  const [torneos, setTorneos] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState(null);
  const [versionLista, setVersionLista] = useState(0);

  const [torneoId, setTorneoId] = useState('');
  const [bracket, setBracket] = useState([]);
  const [cargandoBracket, setCargandoBracket] = useState(false);
  const [errorBracket, setErrorBracket] = useState(null);
  const [versionBracket, setVersionBracket] = useState(0);
  const [ronda, setRonda] = useState(null);

  // Torneos que ya tienen bracket: los que no están abiertos ni cancelados.
  useEffect(() => {
    let cancelado = false;
    listarTorneos()
      .then((lista) => {
        if (cancelado) return;
        const conBracket = (Array.isArray(lista) ? lista : [])
          .filter((t) => t.estado !== 'Abierto' && t.estado !== 'Cancelado');
        setTorneos(conBracket);
        const elegido = conBracket.find((t) => t.estado === 'En_curso') || conBracket[0];
        setErrorLista(null);
        if (elegido) { setCargandoBracket(true); setTorneoId(String(elegido.torneo_id)); }
      })
      .catch((err) => { if (!cancelado) { setTorneos([]); setErrorLista(err.message); } })
      .finally(() => { if (!cancelado) setCargandoLista(false); });
    return () => { cancelado = true; };
  }, [versionLista]);

  useEffect(() => {
    if (!torneoId) return undefined;
    let cancelado = false;
    obtenerBracket(torneoId)
      .then((rondas) => {
        if (cancelado) return;
        setBracket(rondas.slice().sort((a, b) => Number(a.ronda) - Number(b.ronda)));
        setErrorBracket(null);
      })
      .catch((err) => { if (!cancelado) { setBracket([]); setErrorBracket(err.message); } })
      .finally(() => { if (!cancelado) setCargandoBracket(false); });
    return () => { cancelado = true; };
  }, [torneoId, versionBracket]);

  const cambiarTorneo = (event) => {
    setCargandoBracket(true);
    setRonda(null);
    setTorneoId(event.target.value);
  };

  const reintentarLista = () => { setCargandoLista(true); setVersionLista((v) => v + 1); };
  const reintentarBracket = () => { setCargandoBracket(true); setVersionBracket((v) => v + 1); };

  const torneo = torneos.find((t) => String(t.torneo_id) === String(torneoId));
  const total = bracket.length;

  // Ronda que se abre por defecto: la primera con partidos sin terminar; si todo terminó, la final.
  const rondaPorDefecto = useMemo(() => {
    const i = bracket.findIndex((r) => (r.encuentros || []).some((e) => !esFinalizado(e)));
    return String(bracket[i >= 0 ? i : total - 1]?.ronda ?? '');
  }, [bracket, total]);
  const rondaActiva = ronda ?? rondaPorDefecto;
  const indiceActivo = bracket.findIndex((r) => String(r.ronda) === rondaActiva);
  const rondaActual = bracket[indiceActivo];

  // El campeón sale de ganador_id de la final (nunca por nombre).
  const final = bracket[total - 1]?.encuentros?.[0];
  const campeon = final && esFinalizado(final) && final.ganador_id
    ? [final.participante_1, final.participante_2].find((p) => p?.participante_id === final.ganador_id)
    : null;

  if (cargandoLista) return <LoadingState rows={3} label="Cargando brackets…" />;
  if (errorLista) return <ErrorState message={errorLista} onRetry={reintentarLista} />;
  if (!torneos.length) {
    return (
      <EmptyState
        title="Aún no hay brackets"
        message="Cuando un torneo cierre inscripciones, sus cruces aparecerán aquí."
      />
    );
  }

  const estado = torneo ? estadoTorneo(torneo.estado) : null;
  const finalizados = (rondaActual?.encuentros || []).filter(esFinalizado).length;

  return (
    <Stack gap={16}>
      <Select
        label="Torneo"
        value={torneoId}
        onChange={cambiarTorneo}
        options={torneos.map((t) => ({ value: t.torneo_id, label: t.nombre }))}
      />

      {torneo && (
        <EventCard
          as="div"
          kicker={torneo.nombre_disciplina}
          icon={iconoDisciplina(torneo.nombre_disciplina)}
          photo={fotoDisciplina(torneo.nombre_disciplina)}
          title={torneo.nombre}
          description={torneo.nombre_categoria || 'Sin categoría'}
          status={<Badge variant={estado.variant}>{estado.label}</Badge>}
        />
      )}

      {cargandoBracket && <LoadingState rows={3} label="Cargando cruces…" />}
      {!cargandoBracket && errorBracket && <ErrorState message={errorBracket} onRetry={reintentarBracket} />}
      {!cargandoBracket && !errorBracket && !total && (
        <EmptyState title="Sin cruces todavía" message="Este torneo aún no tiene encuentros generados." />
      )}

      {!cargandoBracket && !errorBracket && total > 0 && (
        <>
          <Tabs
            ariaLabel="Rondas del torneo"
            tabs={bracket.map((r, i) => ({ value: String(r.ronda), label: nombreRonda(i, total) }))}
            value={rondaActiva}
            onChange={setRonda}
            fullWidth
          />
          <Stepper
            ariaLabel="Progreso del torneo"
            steps={bracket.map((r, i) => ({
              label: nombreRonda(i, total),
              done: (r.encuentros || []).length > 0 && (r.encuentros || []).every(esFinalizado),
              current: i === indiceActivo,
            }))}
          />
          <Text variant="caption" muted>
            {finalizados} de {rondaActual?.encuentros?.length || 0} partidos finalizados
          </Text>

          {(rondaActual?.encuentros || []).map((enc) => {
            const bye = indiceActivo === 0 && esFinalizado(enc)
              && Boolean(enc.participante_1?.participante_id) !== Boolean(enc.participante_2?.participante_id);
            const g1 = esFinalizado(enc) && enc.ganador_id === enc.participante_1?.participante_id;
            const g2 = esFinalizado(enc) && enc.ganador_id === enc.participante_2?.participante_id;
            const hora = enc.hora_programada ? formatFechaHora(enc.hora_programada) : null;
            return (
              <MatchCard
                key={enc.encuentro_id}
                jugador1={{ nombre: nombreDe(enc.participante_1), marcador: enc.marcador_1, ganador: g1 }}
                jugador2={{ nombre: nombreDe(enc.participante_2), marcador: enc.marcador_2, ganador: g2 }}
                estado={estadoEncuentro(enc.estado)}
                meta={[enc.cancha_asignada, hora].filter(Boolean).join(' · ') || undefined}
                avanza={indiceActivo < total - 1 ? `Avanza a: ${nombreRonda(indiceActivo + 1, total)}` : undefined}
                bye={bye}
              />
            );
          })}

          <ChampionCard nombre={campeon ? campeon.nombre : null} torneo={torneo?.nombre} />
        </>
      )}
    </Stack>
  );
}
