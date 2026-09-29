const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { requireBodyOrEscalate } = require('./escalate');
const { enTransaccion } = require('./transaction');

const ROLES_ARBITRAJE = ['instructor', 'admin', 'gerente', 'coordinador'];

const fail = (status, error) => new ServiceError(status, { ok: false, error });

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

/** Registra (o edita con allowEdit) el marcador, avanza al ganador y activa la siguiente ronda. */
async function registrarResultado(user, encuentroIdParam, body) {
  const rolUsuario = user?.rol;
  if (!rolUsuario || !ROLES_ARBITRAJE.includes(rolUsuario)) {
    throw fail(403, 'No tienes permisos para registrar resultados');
  }

  const encuentroId = Number(encuentroIdParam);
  if (!Number.isInteger(encuentroId) || encuentroId <= 0) {
    throw fail(400, 'encuentro_id debe ser un entero válido');
  }

  requireBodyOrEscalate(body);
  const marcador1 = Number(body.marcador_1);
  const marcador2 = Number(body.marcador_2);

  if (!Number.isInteger(marcador1) || marcador1 < 0 || !Number.isInteger(marcador2) || marcador2 < 0) {
    throw fail(400, 'marcador_1 y marcador_2 deben ser enteros no negativos');
  }

  if (marcador1 === marcador2) {
    throw fail(400, 'No se permiten empates. Corrige el marcador para determinar un ganador.');
  }

  const allowEdit = body.allowEdit === true;
  const cancha = body.cancha_asignada !== undefined ? String(body.cancha_asignada).trim() || null : undefined;

  return enTransaccion(async (client) => {
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

async function asignarCancha(encuentroIdParam, body) {
  const encuentroId = Number(encuentroIdParam);
  if (!Number.isInteger(encuentroId) || encuentroId <= 0) throw fail(400, 'encuentro_id inválido');

  const cancha = String(requireBodyOrEscalate(body).cancha_asignada || '').trim();
  if (!cancha) throw fail(400, 'cancha_asignada es requerida');

  const { rows, rowCount } = await pool.query(
    `UPDATE encuentros_torneo SET cancha_asignada = $1 WHERE encuentro_id = $2
         RETURNING encuentro_id, cancha_asignada`,
    [cancha, encuentroId]
  );
  if (rowCount === 0) throw fail(404, 'Encuentro no encontrado');
  return rows[0];
}

/** Reasigna los participantes de un encuentro pendiente (ambos del mismo torneo). */
async function actualizarParticipantes(encuentroIdParam, body) {
  const { participante_1_id, participante_2_id } = requireBodyOrEscalate(body);

  const encuentroId = Number(encuentroIdParam);
  const p1Id = Number(participante_1_id);
  const p2Id = Number(participante_2_id);

  if (!Number.isInteger(encuentroId)) throw fail(400, 'encuentro_id debe ser un entero valido');

  if (!Number.isInteger(p1Id) || !Number.isInteger(p2Id)) {
    throw fail(400, 'participante_1_id y participante_2_id deben ser enteros validos');
  }

  if (p1Id === p2Id) throw fail(400, 'Los participantes deben ser distintos');

  return enTransaccion(async (client) => {
    const encuentro = await client.query(
      `SELECT encuentro_id, torneo_id, estado
         FROM encuentros_torneo
         WHERE encuentro_id = $1
         FOR UPDATE`,
      [encuentroId]
    );

    if (encuentro.rowCount === 0) throw fail(404, 'Encuentro no encontrado');

    const encuentroActual = encuentro.rows[0];

    if (encuentroActual.estado !== 'pendiente') {
      throw fail(409, 'No se puede modificar un encuentro que no esta pendiente');
    }

    const torneoId = encuentroActual.torneo_id;

    const participantes = await client.query(
      `SELECT participante_id, torneo_id
         FROM participantes_torneo
         WHERE torneo_id = $1
           AND participante_id = ANY($2::int[])`,
      [torneoId, [p1Id, p2Id]]
    );

    if (participantes.rowCount !== 2) throw fail(400, 'Ambos participantes deben pertenecer al mismo torneo');

    const updated = await client.query(
      `UPDATE encuentros_torneo
         SET participante_1_id = $1,
             participante_2_id = $2
         WHERE encuentro_id = $3
         RETURNING encuentro_id, torneo_id, participante_1_id, participante_2_id, estado`,
      [p1Id, p2Id, encuentroId]
    );

    return updated.rows[0];
  });
}

module.exports = { registrarResultado, asignarCancha, actualizarParticipantes };
