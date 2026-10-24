const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const { admiteAsignarCancha, admiteResultados } = require('./torneoEstados');
const { ERROR_BRACKET_INCONSISTENTE, encuentroDestino } = require('./bracketPosicion');

const ROLES_ARBITRAJE = ['instructor', 'admin', 'gerente', 'coordinador'];

const fail = (status, error) => new ServiceError(status, { ok: false, error });

const ERROR_NO_ES_ARBITRO = 'Solo el árbitro asignado o el staff pueden registrar el resultado de este encuentro';
const ERROR_NO_ES_INSTRUCTOR = 'instructor_id no corresponde a un instructor activo';

/**
 * Estado del torneo del encuentro, con su fila bloqueada (FOR SHARE) antes que la del encuentro:
 * el mismo orden que cerrar, confirmar, finalizar y cancelar, que no pueden cambiar el estado
 * mientras tanto. 404 si el encuentro no existe o su torneo está eliminado.
 */
async function estadoDelTorneo(client, encuentroId) {
  return (await torneoDelEncuentro(client, encuentroId)).estado;
}

/** Como estadoDelTorneo, pero devuelve las `columnas` pedidas de la fila del torneo. */
async function torneoDelEncuentro(client, encuentroId, columnas = 't.estado') {
  const { rows, rowCount } = await client.query(
    `SELECT ${columnas}
       FROM encuentros_torneo e
       JOIN torneos t ON t.torneo_id = e.torneo_id
       WHERE e.encuentro_id = $1 AND t.activo
       FOR SHARE OF t`,
    [encuentroId]
  );
  if (rowCount === 0) throw fail(404, 'Encuentro no encontrado');
  return rows[0];
}

/**
 * Comprueba que el ganador pueda ir al slot que marca la regla de posición:
 * - Al editar (allowEdit) cambiando el ganador, el destino no debe tener resultado (sin cascada).
 *   Con el mismo ganador (p. ej. corregir 3-1 a 4-1) solo cambia el marcador y el destino no se toca.
 *   El slot debe tener al ganador anterior, al nuevo o estar vacío.
 * - Al registrar, el slot debe estar vacío o tener ya al ganador.
 * Si el slot tiene a otro participante, el bracket viene de la regla vieja (datos heredados): 409.
 */
function validarDestino(destino, { allowEdit, ganadorAnterior, ganadorId }) {
  if (allowEdit && ganadorId !== ganadorAnterior && destino.estado === 'finalizado') {
    throw fail(409, 'No se puede editar: el siguiente partido ya tiene resultado. Corrige primero ese partido.');
  }
  const ocupante = destino[destino.campo];
  const admitidos = [null, ganadorId];
  if (allowEdit) admitidos.push(ganadorAnterior);
  if (!admitidos.includes(ocupante)) throw fail(409, ERROR_BRACKET_INCONSISTENTE);
}

/** Coloca al ganador en su slot del encuentro destino (reemplaza al ganador anterior si se editó). */
async function colocarGanador(client, destino, ganadorId) {
  if (destino[destino.campo] === ganadorId) {
    const { encuentro_id, ronda, participante_1_id, participante_2_id } = destino;
    return { encuentro_id, ronda, participante_1_id, participante_2_id };
  }
  const { rows } = await client.query(
    `UPDATE encuentros_torneo
         SET ${destino.campo} = $1
         WHERE encuentro_id = $2
         RETURNING encuentro_id, ronda, participante_1_id, participante_2_id`,
    [ganadorId, destino.encuentro_id]
  );
  return rows[0];
}

/**
 * E2.8: con árbitro asignado, un instructor solo registra (o edita) el resultado si es ese árbitro (403).
 * Sin árbitro asignado, cualquier instructor puede, como antes de E2.8. El staff siempre puede.
 */
async function validarArbitro(client, user, enc) {
  if (user.rol !== 'instructor' || enc.arbitro_id === null || enc.arbitro_id === undefined) return;
  const { rows } = await client.query('SELECT instructor_id FROM instructores WHERE usuario_id = $1', [
    user.usuario_id
  ]);
  if (!rows.some((row) => row.instructor_id === enc.arbitro_id)) throw fail(403, ERROR_NO_ES_ARBITRO);
}

/**
 * Registra (o edita con allowEdit) el marcador, avanza al ganador y activa la siguiente ronda.
 * Solo con el torneo En_curso; allowEdit solo sobre encuentros ya finalizados.
 */
async function registrarResultado(user, encuentroIdParam, body) {
  const rolUsuario = user?.rol;
  if (!rolUsuario || !ROLES_ARBITRAJE.includes(rolUsuario)) {
    throw fail(403, 'No tienes permisos para registrar resultados');
  }

  // encuentro_id positivo y marcadores (enteros ≥ 0, sin empate): validados en la ruta
  const encuentroId = Number(encuentroIdParam);
  const marcador1 = Number(body.marcador_1);
  const marcador2 = Number(body.marcador_2);

  const allowEdit = body.allowEdit === true;
  const cancha = body.cancha_asignada !== undefined ? String(body.cancha_asignada).trim() || null : undefined;

  return enTransaccion(async (client) => {
    const estadoTorneo = await estadoDelTorneo(client, encuentroId);
    if (!admiteResultados(estadoTorneo)) {
      throw fail(409, `Solo se pueden registrar resultados con el torneo en curso (estado actual: ${estadoTorneo})`);
    }

    const { rows, rowCount } = await client.query(
      `SELECT encuentro_id, torneo_id, ronda, estado,
                participante_1_id, participante_2_id, ganador_id, arbitro_id
         FROM encuentros_torneo
         WHERE encuentro_id = $1
         FOR UPDATE`,
      [encuentroId]
    );

    if (rowCount === 0) throw fail(404, 'Encuentro no encontrado');

    const enc = rows[0];
    await validarArbitro(client, user, enc);
    const ganadorAnterior = enc.ganador_id;

    if (allowEdit && enc.estado !== 'finalizado') {
      throw fail(409, 'Solo se puede editar el resultado de un encuentro finalizado');
    }

    if (enc.estado === 'finalizado' && !allowEdit) {
      throw fail(409, 'No se puede editar un encuentro ya finalizado');
    }

    if (enc.estado !== 'programado' && !allowEdit) {
      throw fail(409, `El encuentro no está en estado programado (estado actual: ${enc.estado})`);
    }

    if (!enc.participante_1_id || !enc.participante_2_id) {
      throw fail(409, 'El encuentro aún no tiene ambos participantes asignados');
    }

    // Determinar nuevo ganador y comprobar su destino antes de escribir nada
    const ganadorId = marcador1 > marcador2 ? enc.participante_1_id : enc.participante_2_id;
    const destino = await encuentroDestino(client, enc);
    if (destino) validarDestino(destino, { allowEdit, ganadorAnterior, ganadorId });

    // UPDATE del encuentro actual
    const { rows: updated } = await client.query(
      `UPDATE encuentros_torneo
         SET marcador_1 = $1,
             marcador_2 = $2,
             ganador_id = $3,
             estado     = 'finalizado',
             cancha_asignada = COALESCE($5, cancha_asignada)
         WHERE encuentro_id = $4
         RETURNING encuentro_id, ronda, marcador_1, marcador_2, ganador_id, estado, cancha_asignada`,
      [marcador1, marcador2, ganadorId, encuentroId, cancha ?? null]
    );

    const siguienteRonda = enc.ronda + 1;
    const siguienteEncuentro = destino ? await colocarGanador(client, destino, ganadorId) : null;

    // Activar siguiente ronda si todos finalizados
    const { rows: pendientesRonda } = await client.query(
      `SELECT COUNT(*) as total
         FROM encuentros_torneo
         WHERE torneo_id = $1
           AND ronda = $2
           AND estado != 'finalizado'`,
      [enc.torneo_id, enc.ronda]
    );

    if (parseInt(pendientesRonda[0].total) === 0) {
      await client.query(
        `UPDATE encuentros_torneo
           SET estado = 'programado'
           WHERE torneo_id = $1
             AND ronda = $2
             AND estado = 'pendiente'`,
        [enc.torneo_id, siguienteRonda]
      );
    }

    return {
      ok: true,
      message: allowEdit ? 'Resultado actualizado correctamente' : 'Resultado registrado correctamente',
      encuentro: updated[0],
      ganador_id: ganadorId,
      siguiente_encuentro: siguienteEncuentro
    };
  });
}

/** encuentro_id positivo y cancha no vacía: validados en la ruta. Solo con el bracket generado y sin terminar. */
async function asignarCancha(encuentroIdParam, body) {
  const encuentroId = Number(encuentroIdParam);
  const cancha = String(body.cancha_asignada || '').trim();

  return enTransaccion(async (client) => {
    const estadoTorneo = await estadoDelTorneo(client, encuentroId);
    if (!admiteAsignarCancha(estadoTorneo)) {
      throw fail(
        409,
        `Solo se puede asignar cancha con las inscripciones cerradas o el torneo en curso (estado actual: ${estadoTorneo})`
      );
    }

    const { rows } = await client.query(
      `UPDATE encuentros_torneo SET cancha_asignada = $1 WHERE encuentro_id = $2
           RETURNING encuentro_id, cancha_asignada`,
      [cancha, encuentroId]
    );
    return rows[0];
  });
}

// ── Horario (E2.7 / F-09) ────────────────────────────────────────────────────

// Serializa todas las programaciones: el choque de horario se busca en otros encuentros (incluso de otros
// torneos), que ningún FOR UPDATE de este encuentro protege. Las programaciones son pocas y cortas.
const LOCK_HORARIOS = "SELECT pg_advisory_xact_lock(hashtext('encuentros_torneo.hora_programada'))";

/** 400 si la fecha (YYYY-MM-DD) de `hora` cae fuera de fecha_inicio / fecha_fin del torneo (las que tenga). */
function validarDentroDelTorneo(hora, { fecha_inicio, fecha_fin }) {
  const dia = hora.slice(0, 10);
  if (fecha_inicio && fecha_fin) {
    if (dia < fecha_inicio || dia > fecha_fin) {
      throw fail(400, `La fecha debe estar entre el inicio y el fin del torneo (${fecha_inicio} a ${fecha_fin})`);
    }
  } else if (fecha_inicio && dia < fecha_inicio) {
    throw fail(400, `La fecha no puede ser anterior al inicio del torneo (${fecha_inicio})`);
  } else if (fecha_fin && dia > fecha_fin) {
    throw fail(400, `La fecha no puede ser posterior al fin del torneo (${fecha_fin})`);
  }
}

/**
 * 409 si alguno de los participantes del encuentro ya tiene otro encuentro a la misma hora. Se compara el
 * participante y también la persona (mismo socio o misma visita) en otros torneos activos no cancelados.
 * Los encuentros no tienen duración: el choque es a la misma hora exacta (minuto).
 */
async function validarSinChoque(client, enc, hora) {
  const ids = [enc.participante_1_id, enc.participante_2_id].filter((id) => id !== null);
  if (ids.length === 0) return;

  const { rows } = await client.query(
    `SELECT e.encuentro_id
       FROM encuentros_torneo e
       JOIN torneos t ON t.torneo_id = e.torneo_id AND t.activo AND t.estado <> 'Cancelado'
       JOIN participantes_torneo otro ON otro.participante_id IN (e.participante_1_id, e.participante_2_id)
       JOIN participantes_torneo yo ON yo.participante_id = ANY($2::int[])
        AND (yo.participante_id = otro.participante_id OR yo.socio_id = otro.socio_id OR yo.visita_id = otro.visita_id)
       WHERE e.encuentro_id <> $1 AND e.hora_programada = $3::timestamp
       ORDER BY e.encuentro_id
       LIMIT 1`,
    [enc.encuentro_id, ids, hora]
  );
  if (rows.length > 0) {
    throw fail(409, `Un participante ya tiene otro encuentro a esa hora (encuentro ${rows[0].encuentro_id})`);
  }
}

/**
 * Programa (o quita, con null) la hora de un encuentro. encuentro_id y formato YYYY-MM-DDTHH:mm validados en
 * la ruta. Mismos estados que la cancha; 409 si el encuentro ya tiene resultado o si un participante choca;
 * 400 si cae fuera de las fechas del torneo. TIMESTAMP sin zona: entra y sale como texto local del club.
 */
async function asignarHorario(encuentroIdParam, body) {
  const encuentroId = Number(encuentroIdParam);
  const hora = body.hora_programada; // 'YYYY-MM-DDTHH:mm' o null

  return enTransaccion(async (client) => {
    await client.query(LOCK_HORARIOS);
    const torneo = await torneoDelEncuentro(
      client,
      encuentroId,
      "t.estado, to_char(t.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(t.fecha_fin, 'YYYY-MM-DD') AS fecha_fin"
    );
    if (!admiteAsignarCancha(torneo.estado)) {
      throw fail(
        409,
        `Solo se puede programar el horario con las inscripciones cerradas o el torneo en curso (estado actual: ${torneo.estado})`
      );
    }

    const { rows } = await client.query(
      `SELECT encuentro_id, estado, ganador_id, participante_1_id, participante_2_id
         FROM encuentros_torneo WHERE encuentro_id = $1 FOR UPDATE`,
      [encuentroId]
    );
    const enc = rows[0];
    if (enc.estado === 'finalizado' || enc.ganador_id !== null) {
      throw fail(409, 'No se puede reprogramar un encuentro que ya tiene resultado');
    }

    if (hora !== null) {
      validarDentroDelTorneo(hora, torneo);
      await validarSinChoque(client, enc, hora);
    }

    const { rows: actualizado } = await client.query(
      `UPDATE encuentros_torneo SET hora_programada = $1::timestamp WHERE encuentro_id = $2
           RETURNING encuentro_id, to_char(hora_programada, 'YYYY-MM-DD"T"HH24:MI') AS hora_programada`,
      [hora, encuentroId]
    );
    return actualizado[0];
  });
}

// ── Árbitro (E2.8) ───────────────────────────────────────────────────────────

/**
 * Asigna (o quita, con null) el instructor árbitro. encuentro_id e instructor_id validados en la ruta.
 * Mismos estados que la cancha; 409 si el encuentro ya tiene resultado; 400 si instructor_id no es un
 * instructor activo (registro activo en instructores y usuario activo).
 */
async function asignarArbitro(encuentroIdParam, body) {
  const encuentroId = Number(encuentroIdParam);
  const instructorId = body.instructor_id === null ? null : Number(body.instructor_id);

  return enTransaccion(async (client) => {
    const estadoTorneo = await estadoDelTorneo(client, encuentroId);
    if (!admiteAsignarCancha(estadoTorneo)) {
      throw fail(
        409,
        `Solo se puede asignar árbitro con las inscripciones cerradas o el torneo en curso (estado actual: ${estadoTorneo})`
      );
    }

    const { rows } = await client.query(
      'SELECT estado, ganador_id FROM encuentros_torneo WHERE encuentro_id = $1 FOR UPDATE',
      [encuentroId]
    );
    if (rows[0].estado === 'finalizado' || rows[0].ganador_id !== null) {
      throw fail(409, 'No se puede cambiar el árbitro de un encuentro que ya tiene resultado');
    }

    if (instructorId !== null) {
      const instructor = await client.query(
        `SELECT i.instructor_id
           FROM instructores i
           JOIN usuarios u ON u.usuario_id = i.usuario_id
           WHERE i.instructor_id = $1 AND i.activo IS NOT FALSE AND u.activo IS NOT FALSE`,
        [instructorId]
      );
      if (instructor.rowCount === 0) throw fail(400, ERROR_NO_ES_INSTRUCTOR);
    }

    const { rows: actualizado } = await client.query(
      'UPDATE encuentros_torneo SET arbitro_id = $1 WHERE encuentro_id = $2 RETURNING encuentro_id, arbitro_id',
      [instructorId, encuentroId]
    );
    return actualizado[0];
  });
}

module.exports = { registrarResultado, asignarCancha, asignarHorario, asignarArbitro };
