const pool = require('../config/database');

const ROLES_ARBITRAJE = ['instructor', 'admin', 'gerente', 'coordinador'];

const encuentrosController = {

  registrarResultado: async (req, res) => {
    const rolUsuario = req.user?.rol;
    if (!rolUsuario || !ROLES_ARBITRAJE.includes(rolUsuario)) {
      return res.status(403).json({ ok: false, error: 'No tienes permisos para registrar resultados' });
    }

    const encuentroId = Number(req.params.encuentro_id);
    if (!Number.isInteger(encuentroId) || encuentroId <= 0) {
      return res.status(400).json({ ok: false, error: 'encuentro_id debe ser un entero válido' });
    }

    const marcador1 = Number(req.body.marcador_1);
    const marcador2 = Number(req.body.marcador_2);

    if (!Number.isInteger(marcador1) || marcador1 < 0 ||
        !Number.isInteger(marcador2) || marcador2 < 0) {
      return res.status(400).json({ ok: false, error: 'marcador_1 y marcador_2 deben ser enteros no negativos' });
    }

    if (marcador1 === marcador2) {
      return res.status(400).json({ ok: false, error: 'No se permiten empates. Corrige el marcador para determinar un ganador.' });
    }

    const allowEdit = req.body.allowEdit === true;
    const cancha = req.body.cancha_asignada !== undefined
      ? (String(req.body.cancha_asignada).trim() || null)
      : undefined;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows, rowCount } = await client.query(
        `SELECT encuentro_id, torneo_id, ronda, estado,
                participante_1_id, participante_2_id, ganador_id
         FROM encuentros_torneo
         WHERE encuentro_id = $1
         FOR UPDATE`,
        [encuentroId]
      );

      if (rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Encuentro no encontrado' });
      }

      const enc = rows[0];
      const ganadorAnterior = enc.ganador_id;

      if (enc.estado === 'finalizado' && !allowEdit) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, error: 'No se puede editar un encuentro ya finalizado' });
      }

      if (enc.estado !== 'programado' && !allowEdit) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, error: `El encuentro no está en estado programado (estado actual: ${enc.estado})` });
      }

      if (!enc.participante_1_id || !enc.participante_2_id) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, error: 'El encuentro aún no tiene ambos participantes asignados' });
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
      let siguienteEncuentro = null;

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
          const campo = slot.participante_1_id === ganadorAnterior
            ? 'participante_1_id'
            : 'participante_2_id';

          const { rows: slotActualizado } = await client.query(
            `UPDATE encuentros_torneo
             SET ${campo} = $1
             WHERE encuentro_id = $2
             RETURNING encuentro_id, ronda, participante_1_id, participante_2_id`,
            [ganadorId, slot.encuentro_id]
          );
          siguienteEncuentro = slotActualizado[0];
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
          siguienteEncuentro = slotActualizado[0];
        }
      }

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

      await client.query('COMMIT');

      return res.json({
        ok: true,
        message: allowEdit ? 'Resultado actualizado correctamente' : 'Resultado registrado correctamente',
        encuentro: updated[0],
        ganador_id: ganadorId,
        siguiente_encuentro: siguienteEncuentro
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error al registrar resultado:', err);
      return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
    } finally {
      client.release();
    }
  },

  asignarCancha: async (req, res) => {
    const encuentroId = Number(req.params.encuentro_id);
    if (!Number.isInteger(encuentroId) || encuentroId <= 0) {
      return res.status(400).json({ ok: false, error: 'encuentro_id inválido' });
    }
    const cancha = String(req.body.cancha_asignada || '').trim();
    if (!cancha) {
      return res.status(400).json({ ok: false, error: 'cancha_asignada es requerida' });
    }
    try {
      const { rows, rowCount } = await pool.query(
        `UPDATE encuentros_torneo SET cancha_asignada = $1 WHERE encuentro_id = $2
         RETURNING encuentro_id, cancha_asignada`,
        [cancha, encuentroId]
      );
      if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Encuentro no encontrado' });
      return res.json({ ok: true, message: 'Cancha asignada correctamente', encuentro: rows[0] });
    } catch (err) {
      console.error('Error al asignar cancha:', err);
      return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
    }
  },

  updateEncuentro: async (req, res) => {
    const { encuentro_id } = req.params;
    const { participante_1_id, participante_2_id } = req.body;

    const encuentroId = Number(encuentro_id);
    const p1Id = Number(participante_1_id);
    const p2Id = Number(participante_2_id);

    if (!Number.isInteger(encuentroId)) {
      return res.status(400).json({ ok: false, error: 'encuentro_id debe ser un entero valido' });
    }

    if (!Number.isInteger(p1Id) || !Number.isInteger(p2Id)) {
      return res.status(400).json({ ok: false, error: 'participante_1_id y participante_2_id deben ser enteros validos' });
    }

    if (p1Id === p2Id) {
      return res.status(400).json({ ok: false, error: 'Los participantes deben ser distintos' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const encuentro = await client.query(
        `SELECT encuentro_id, torneo_id, estado
         FROM encuentros_torneo
         WHERE encuentro_id = $1
         FOR UPDATE`,
        [encuentroId]
      );

      if (encuentro.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Encuentro no encontrado' });
      }

      const encuentroActual = encuentro.rows[0];

      if (encuentroActual.estado !== 'pendiente') {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, error: 'No se puede modificar un encuentro que no esta pendiente' });
      }

      const torneoId = encuentroActual.torneo_id;

      const participantes = await client.query(
        `SELECT participante_id, torneo_id
         FROM participantes_torneo
         WHERE torneo_id = $1
           AND participante_id = ANY($2::int[])`,
        [torneoId, [p1Id, p2Id]]
      );

      if (participantes.rowCount !== 2) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Ambos participantes deben pertenecer al mismo torneo' });
      }

      const updated = await client.query(
        `UPDATE encuentros_torneo
         SET participante_1_id = $1,
             participante_2_id = $2
         WHERE encuentro_id = $3
         RETURNING encuentro_id, torneo_id, participante_1_id, participante_2_id, estado`,
        [p1Id, p2Id, encuentroId]
      );

      await client.query('COMMIT');

      return res.json({
        ok: true,
        message: 'Encuentro actualizado correctamente',
        encuentro: updated.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al actualizar encuentro:', error);
      return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
    } finally {
      client.release();
    }
  }

};

module.exports = encuentrosController;