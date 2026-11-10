import React, { useState } from 'react';
import { Alert, Button, Input, ScoreField, Select, SidePanel, Spinner, Stack, Text } from '../ui';
import { apiRequest } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { getParticipantName, isBye, isWinner, mensajeDeError, normalizeEstado } from '../torneos/torneoUtils';
import { horarioLargo, partesHorario } from './cuadroVista';

const QUITAR_ARBITRO = 'ninguno';

// Título de la alerta de cada cambio que falle; el mensaje es el del backend, tal cual
const TITULO_ERROR = {
  horario: 'No se guardó el horario',
  cancha: 'No se guardó la cancha',
  arbitro: 'No se guardó el árbitro',
  resultado: 'No se guardó el resultado'
};
const NOMBRE_CAMBIO = { horario: 'el horario', cancha: 'la cancha', arbitro: 'el árbitro', resultado: 'el marcador' };

function unirLista(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Ganador que se ve en el panel: con los dos marcadores escritos y distintos, el mayor; si no, el de la API. */
function ganadorVisible(m1, m2, encuentro, p1, p2) {
  const n1 = Number.parseInt(m1, 10);
  const n2 = Number.parseInt(m2, 10);
  if (m1 !== '' && m2 !== '' && Number.isFinite(n1) && Number.isFinite(n2) && n1 !== n2) {
    return { a: n1 > n2, b: n2 > n1 };
  }
  return { a: isWinner(encuentro, p1), b: isWinner(encuentro, p2) };
}

function Dato({ label, children }) {
  return (
    <Stack gap={4}>
      <Text variant="overline" muted as="span">
        {label}
      </Text>
      <Text as="span">{children}</Text>
    </Stack>
  );
}

/**
 * Panel lateral "Editar encuentro" (U4-03, Paso 2). Marcador A y B, ganador (se calcula del
 * marcador), fecha, hora, cancha y árbitro. Cada cambio usa su propia ruta, en este orden:
 *   PATCH /encuentros/:id/horario · /cancha · /arbitro · /resultado
 * Si una falla, se muestra su mensaje (el del backend, tal cual) y lo que sí se guardó se conserva.
 * Mismas reglas que MatchEditPanel: resultado solo con el torneo En curso; cancha (y horario y
 * árbitro, mismos estados en el backend) con inscripciones cerradas o en curso y el encuentro sin
 * resultado; los byes no se editan. El instructor (puedeEditar = false) solo ve los datos.
 *
 * Montarlo con key={encuentro_id}: el estado del formulario es del encuentro abierto.
 */
function EditarEncuentroPanel({ torneo, encuentro, ronda, rondaLabel, puedeEditar, espacios, instructores, instructoresError, onClose, onSaved }) {
  const { toast } = useNotification();
  const est = normalizeEstado(encuentro.estado);
  const done = est === 'finalizado';
  const bye = isBye(encuentro, ronda);
  const p1 = encuentro.participante_1 || {};
  const p2 = encuentro.participante_2 || {};
  const nombre = (p) => (bye && !p.participante_id ? 'Sin rival' : getParticipantName(p));
  const ambosListos = getParticipantName(p1) !== 'Por definir' && getParticipantName(p2) !== 'Por definir';

  const admiteResultados = torneo.estado === 'En_curso';
  const admiteProgramar = torneo.estado === 'Inscripciones_cerradas' || torneo.estado === 'En_curso';
  const puedeMarcador = puedeEditar && admiteResultados && !bye && ambosListos && (est === 'programado' || done);
  const puedeProgramar = puedeEditar && admiteProgramar && !bye && (est === 'programado' || est === 'pendiente');

  const original = {
    m1: String(encuentro.marcador_1 ?? ''),
    m2: String(encuentro.marcador_2 ?? ''),
    ...partesHorario(encuentro.hora_programada),
    cancha: encuentro.cancha_asignada || ''
  };

  const [m1, setM1] = useState(original.m1);
  const [m2, setM2] = useState(original.m2);
  const [fecha, setFecha] = useState(original.fecha);
  const [hora, setHora] = useState(original.hora);
  const [cancha, setCancha] = useState(original.cancha);
  const [arbitro, setArbitro] = useState('');
  const [arbitroAsignado, setArbitroAsignado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [guardados, setGuardados] = useState([]);

  const cambios = {
    horario: puedeProgramar && (fecha !== original.fecha || hora !== original.hora),
    cancha: puedeProgramar && cancha.trim() !== original.cancha.trim() && Boolean(cancha.trim()),
    arbitro: puedeProgramar && arbitro !== '',
    resultado: puedeMarcador && (m1 !== original.m1 || m2 !== original.m2) && !(m1 === '' && m2 === '')
  };
  const hayCambios = Object.values(cambios).some(Boolean);
  const ganador = ganadorVisible(m1, m2, encuentro, p1, p2);

  const nombreInstructor = (id) => instructores.find((i) => String(i.instructor_id) === String(id))?.nombre || `Instructor #${id}`;

  // Validación solo de formato; las reglas (choques, fechas del torneo, estados) las decide el backend
  const validar = () => {
    const e = {};
    if (cambios.horario && Boolean(fecha) !== Boolean(hora)) e.horario = 'Indica la fecha y la hora del encuentro';
    if (cambios.resultado) {
      const n1 = Number.parseInt(m1, 10);
      const n2 = Number.parseInt(m2, 10);
      if (!Number.isFinite(n1) || !Number.isFinite(n2) || n1 < 0 || n2 < 0) e.resultado = 'Marcadores inválidos (enteros ≥ 0)';
      else if (n1 === n2) e.resultado = 'No se permiten empates';
    }
    return e;
  };

  const llamar = (ruta, body) =>
    apiRequest(`/encuentros/${encuentro.encuentro_id}/${ruta}`, { method: 'PATCH', body: JSON.stringify(body) });

  const guardar = async () => {
    const previos = validar();
    setErrores(previos);
    setGuardados([]);
    if (Object.keys(previos).length > 0) return;

    setGuardando(true);
    const fallos = {};
    const ok = [];
    const pasos = [
      ['horario', () => llamar('horario', { hora_programada: fecha && hora ? `${fecha}T${hora}` : null })],
      ['cancha', () => llamar('cancha', { cancha_asignada: cancha.trim() })],
      ['arbitro', () => llamar('arbitro', { instructor_id: arbitro === QUITAR_ARBITRO ? null : Number(arbitro) })],
      [
        'resultado',
        () =>
          llamar('resultado', {
            marcador_1: Number.parseInt(m1, 10),
            marcador_2: Number.parseInt(m2, 10),
            ...(done ? { allowEdit: true } : {})
          })
      ]
    ];
    for (const [campo, ejecutar] of pasos) {
      if (!cambios[campo]) continue;
      try {
        await ejecutar();
        ok.push(campo);
      } catch (err) {
        fallos[campo] = mensajeDeError(err);
      }
    }
    setGuardando(false);

    if (ok.includes('arbitro')) {
      setArbitroAsignado(arbitro === QUITAR_ARBITRO ? 'Sin árbitro' : nombreInstructor(arbitro));
      setArbitro('');
    }
    if (ok.length > 0 && onSaved) onSaved();
    if (Object.keys(fallos).length === 0) {
      toast('Cambios guardados', 'success');
      onClose();
      return;
    }
    // Lo que falló conserva lo escrito; el marcador que no se guardó vuelve al de la API (como antes)
    if (fallos.resultado) {
      setM1(original.m1);
      setM2(original.m2);
    }
    setErrores(fallos);
    setGuardados(ok);
  };

  const opcionesArbitro = [
    ...instructores.map((i) => ({ value: String(i.instructor_id), label: i.nombre })),
    { value: QUITAR_ARBITRO, label: 'Quitar árbitro' }
  ];

  const subtitulo = [rondaLabel, `Encuentro #${encuentro.encuentro_id}${original.cancha ? ` (${original.cancha})` : ''}`]
    .filter(Boolean)
    .join(' · ');

  const editable = puedeMarcador || puedeProgramar;
  const footer = editable ? (
    <>
      <Button variant="secondary" onClick={onClose} disabled={guardando}>
        Cancelar
      </Button>
      <Button onClick={guardar} disabled={guardando || !hayCambios}>
        {guardando && <Spinner label="Guardando…" />}
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </>
  ) : null;

  return (
    <SidePanel open onClose={onClose} title={editable ? 'Editar encuentro' : 'Encuentro'} subtitle={subtitulo} footer={footer}>
      <ScoreField
        name={nombre(p1)}
        tag="Participante A"
        value={puedeMarcador ? m1 : bye ? '' : original.m1}
        onChange={puedeMarcador ? setM1 : undefined}
        readOnly={!puedeMarcador}
        disabled={guardando}
        winner={ganador.a}
        error={Boolean(errores.resultado)}
      />
      <ScoreField
        name={nombre(p2)}
        tag="Participante B"
        value={puedeMarcador ? m2 : bye ? '' : original.m2}
        onChange={puedeMarcador ? setM2 : undefined}
        readOnly={!puedeMarcador}
        disabled={guardando}
        winner={ganador.b}
        error={Boolean(errores.resultado)}
      />
      {bye && <Alert variant="info">Pase directo: este encuentro no tiene marcador.</Alert>}
      {errores.resultado && <Alert title={TITULO_ERROR.resultado}>{errores.resultado}</Alert>}

      {puedeProgramar ? (
        <>
          <Stack direction="row" gap={12} grow minChild={140}>
            <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={guardando} error={Boolean(errores.horario)} />
            <Input label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={guardando} error={Boolean(errores.horario)} />
          </Stack>
          {errores.horario && <Alert title={TITULO_ERROR.horario}>{errores.horario}</Alert>}

          {espacios.length > 0 ? (
            <Select
              label="Cancha"
              placeholder="Sin asignar"
              value={cancha}
              onChange={(e) => setCancha(e.target.value)}
              disabled={guardando}
              error={Boolean(errores.cancha)}
              options={[
                // La cancha guardada puede no estar entre los espacios activos: se conserva como opción
                ...(original.cancha && !espacios.some((e) => e.nombre === original.cancha)
                  ? [{ value: original.cancha, label: original.cancha }]
                  : []),
                ...espacios.map((e) => ({ value: e.nombre, label: e.nombre }))
              ]}
            />
          ) : (
            <Input
              label="Cancha"
              value={cancha}
              maxLength={100}
              placeholder="Asignar espacio"
              onChange={(e) => setCancha(e.target.value)}
              disabled={guardando}
              error={Boolean(errores.cancha)}
            />
          )}
          {errores.cancha && <Alert title={TITULO_ERROR.cancha}>{errores.cancha}</Alert>}

          <Select
            label="Árbitro"
            placeholder="Sin cambios"
            value={arbitro}
            onChange={(e) => setArbitro(e.target.value)}
            disabled={guardando}
            error={Boolean(errores.arbitro)}
            helperText={
              instructoresError
                ? 'No se pudo cargar la lista de instructores.'
                : arbitroAsignado
                  ? `Asignado: ${arbitroAsignado}`
                  : 'Elegir uno reemplaza al árbitro actual.'
            }
            options={opcionesArbitro}
          />
          {errores.arbitro && <Alert title={TITULO_ERROR.arbitro}>{errores.arbitro}</Alert>}
        </>
      ) : (
        <Stack gap={16}>
          <Dato label="Fecha y hora">{horarioLargo(encuentro.hora_programada) || 'Sin programar'}</Dato>
          <Dato label="Cancha">{original.cancha || 'Sin asignar'}</Dato>
        </Stack>
      )}

      {guardados.length > 0 && (
        <Alert variant="success">Se guardó {unirLista(guardados.map((c) => NOMBRE_CAMBIO[c]))}.</Alert>
      )}
    </SidePanel>
  );
}

export default EditarEncuentroPanel;
