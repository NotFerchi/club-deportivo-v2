const pool = require('../config/database');

const encuentrosController = {
  updateEncuentro: async (req, res) => {
    const { encuentro_id } = req.params;
    const { participante_1_id, participante_2_id } = req.body;

    const encuentroId = Number(encuentro_id);
    const p1Id = Number(participante_1_id);
    const p2Id = Number(participante_2_id);

    if (!Number.isInteger(encuentroId)) {
      return res.status(400).json({
        ok: false,
        error: 'encuentro_id debe ser un entero valido'
      });
    }

    if (!Number.isInteger(p1Id) || !Number.isInteger(p2Id)) {
      return res.status(400).json({
        ok: false,
        error: 'participante_1_id y participante_2_id deben ser enteros validos'
      });
    }

    if (p1Id === p2Id) {
      return res.status(400).json({
        ok: false,
        error: 'Los participantes deben ser distintos'
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const encuentro = await client.query(
        `
        SELECT encuentro_id, torneo_id, estado
        FROM encuentros_torneo
        WHERE encuentro_id = $1
        FOR UPDATE
        `,
        [encuentroId]
      );

      if (encuentro.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          ok: false,
          error: 'Encuentro no encontrado'
        });
      }

      const encuentroActual = encuentro.rows[0];

      if (encuentroActual.estado !== 'pendiente') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          ok: false,
          error: 'No se puede modificar un encuentro que no esta pendiente'
        });
      }

      const torneoId = encuentroActual.torneo_id;

      const participantes = await client.query(
        `
        SELECT participante_id, torneo_id
        FROM participantes_torneo
        WHERE torneo_id = $1
          AND participante_id = ANY($2::int[])
        `,
        [torneoId, [p1Id, p2Id]]
      );

      if (participantes.rowCount !== 2) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          error: 'Ambos participantes deben pertenecer al mismo torneo'
        });
      }

      const updated = await client.query(
        `
        UPDATE encuentros_torneo
        SET participante_1_id = $1,
            participante_2_id = $2
        WHERE encuentro_id = $3
        RETURNING encuentro_id, torneo_id, participante_1_id, participante_2_id, estado
        `,
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

      return res.status(500).json({
        ok: false,
        error: 'Error interno del servidor'
      });
    } finally {
      client.release();
    }
  }
};

module.exports = encuentrosController;
