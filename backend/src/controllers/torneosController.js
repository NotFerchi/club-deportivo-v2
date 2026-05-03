const pool = require('../config/database');

const ERROR_DISCIPLINA_NO_EXISTE = 'La disciplina no existe';
const ERROR_FECHAS_TORNEO = 'La fecha de fin no puede ser menor que la fecha de inicio';

function normalizarFechaOpcional(fecha) {
  return fecha === undefined || fecha === '' ? null : fecha;
}

const torneosController = {
  getTorneos: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          t.torneo_id,
          t.nombre,
          d.nombre AS nombre_disciplina,
          t.fecha_inicio,
          t.fecha_fin,
          t.estado
        FROM torneos t
        JOIN disciplinas d ON t.disciplina_id = d.disciplina_id
        ORDER BY t.fecha_inicio DESC NULLS LAST, t.torneo_id DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error('Error al obtener torneos:', error);
      res.status(500).json({ error: 'Error al obtener torneos' });
    }
  },

  createTorneo: async (req, res) => {
    const { nombre, disciplina_id, fecha_inicio, fecha_fin } = req.body;

    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    if (disciplina_id === undefined || disciplina_id === null || disciplina_id === '') {
      return res.status(400).json({ error: 'disciplina_id es requerido' });
    }

    const disciplinaId = Number(disciplina_id);
    if (!Number.isInteger(disciplinaId)) {
      return res.status(400).json({ error: 'disciplina_id debe ser un entero valido' });
    }

    try {
      const disciplina = await pool.query(
        'SELECT disciplina_id FROM disciplinas WHERE disciplina_id = $1',
        [disciplinaId]
      );

      if (disciplina.rowCount === 0) {
        return res.status(400).json({ error: ERROR_DISCIPLINA_NO_EXISTE });
      }

      const result = await pool.query(
        `
          INSERT INTO torneos (disciplina_id, nombre, fecha_inicio, fecha_fin, estado)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING torneo_id
        `,
        [
          disciplinaId,
          nombre.trim(),
          normalizarFechaOpcional(fecha_inicio),
          normalizarFechaOpcional(fecha_fin),
          'Abierto',
        ]
      );

      res.status(201).json({ torneo_id: result.rows[0].torneo_id });
    } catch (error) {
      console.error('Error al crear torneo:', error);

      if (error.code === '23514') {
        return res.status(400).json({ error: ERROR_FECHAS_TORNEO });
      }

      if (error.code === '23503') {
        return res.status(400).json({ error: ERROR_DISCIPLINA_NO_EXISTE });
      }

      if (error.code === '22007' || error.code === '22008') {
        return res.status(400).json({ error: 'Formato de fecha invalido' });
      }

      res.status(500).json({ error: 'Error al crear torneo' });
    }
  },
};

module.exports = torneosController;
