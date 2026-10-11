const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const { admiteAsignarCancha, admiteResultados } = require('./torneoEstados');

const ROLES_ARBITRAJE = ['instructor', 'admin', 'gerente', 'coordinador'];

const fail = (status, error) => new ServiceError(status, { ok: false, error });

/**
 * Estado del torneo del encuentro, con su fila bloqueada (FOR SHARE) antes que la del encuentro:
 * el mismo orden que cerrar, confirmar, finalizar y cancelar, que no pueden cambiar el estado
 * mientras tanto. 404 si el encuentro no existe.
 */
async function estadoDelTorneo(client, encuentroId) {
  const { rows, rowCount } = await client.query(
    `SELECT t.estado
       FROM encuentros_torneo e
       JOIN torneos t ON t.torneo_id = e.torneo_id
       WHERE e.encuentro_id = $1
       FOR SHARE OF t`,
    [encuentroId]
  );
  if (rowCount === 0) throw fail(404, 'Encuentro no encontrado');
  return rows[0].estado;
}

/** Coloca al ganador en la siguiente ronda (slot del ganador anterior al editar, o slot libre). */
async function avanzarGanador(client, { enc, ganadorId, ganadorAnterior, allowEdit, siguienteRonda }) {
  if (allowEdit && ganadorAnterior && ganadorAnterior !== ganadorId) {
    // Edición: actualizar el ganador anterior por el nuevo en la siguiente ronda
    const { rows: slotAnterior } = await client.query(
      `SELECT encuentro_id, participante_1_id, participante_2_id
           FROM encuentros_torneo
           WHERE torneo_id = $1
             AND ronda = $2
             AND (participante_1_id = $3 OR participante_2_id = $3)
           LIMIT 1 FOR UPDATE`,
      [enc.torneo_id, siguienteRonda, ganadorAnterior]
    );

    if (slotAnterior.length > 0) {
      const slot = slotAnterior[0];
      const campo = slot.participante_1_id === ganadorAnterior ? 'participante_1_id' : 'participante_2_id';

      const { rows: slotActualizado } = await client.query(
        `UPDATE encuentros_torneo
             SET ${campo} = $1
             WHERE encuentro_id = $2
             RETURNING encuentro_id, ronda, participante_1_id, participante_2_id`,
        [ganadorId, slot.encuentro_id]
      );
      return slotActualizado[0];
    }
  } else if (!allowEdit) {
    // Registro nuevo: buscar slot libre
    const { rows: slotRows } = await client.query(
      `SELECT encuentro_id, participante_1_id, participante_2_id
           FROM encuentros_torneo
           WHERE torneo_id = $1
             AND ronda     = $2
             AND (participante_1_id IS NULL OR participante_2_id IS NULL)
           ORDER BY encuentro_id ASC
           LIMIT 1
           FOR UPDATE`,
      [enc.torneo_id, siguienteRonda]
    );

    if (slotRows.length > 0) {
      const slot = slotRows[0];
      const campo = slot.participante_1_id === null ? 'participante_1_id' : 'participante_2_id';

      const { rows: slotActualizado } = await client.query(
        `UPDATE encuentros_torneo
             SET ${campo} = $1
             WHERE encuentro_id = $2
             RETURNING encuentro_id, ronda, participante_1_id, participante_2_id`,
        [ganadorId, slot.encuentro_id]
      );
      return slotActualizado[0];
    }
  }
  return null;
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
                participante_1_id, participante_2_id, ganador_id
         FROM encuentros_torneo
         WHERE encuentro_id = $1
         FOR UPDATE`,
      [encuentroId]
    );

    if (rowCount === 0) throw fail(404, 'Encuentro no encontrado');

    const enc = rows[0];
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

    // Determinar nuevo ganador
    const ganadorId = marcador1 > marcador2 ? enc.participante_1_id : enc.participante_2_id;

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
    const siguienteEncuentro = await avanzarGanador(client, {
      enc,
      ganadorId,
      ganadorAnterior,
      allowEdit,
      siguienteRonda
    });

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

module.exports = { registrarResultado, asignarCancha };
