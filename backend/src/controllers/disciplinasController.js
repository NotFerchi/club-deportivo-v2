const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');

const disciplinasController = {
  // Obtener todas las disciplinas
  getDisciplinas: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT disciplina_id, nombre 
        FROM disciplinas 
        ORDER BY nombre
      `);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener disciplinas' });
    }
  },

  // Obtener una disciplina por ID
  getDisciplinaById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'SELECT disciplina_id, nombre FROM disciplinas WHERE disciplina_id = $1',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Disciplina no encontrada' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener disciplina' });
    }
  },

  // Crear nueva disciplina
  createDisciplina: async (req, res) => {
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
      const result = await pool.query(
        'INSERT INTO disciplinas (nombre) VALUES ($1) RETURNING disciplina_id',
        [nombre]
      );
      await logAudit(req, {
        accion: 'crear_disciplina',
        tabla_afectada: 'disciplinas',
        registro_id: result.rows[0].disciplina_id,
        detalles: `Disciplina creada: ${nombre}`
      });
      res.json({ ok: true, id: result.rows[0].disciplina_id, message: 'Disciplina creada correctamente' });
    } catch (error) {
      console.error(error);
      if (error.code === '23505') { // Código de unique violation en PostgreSQL
        res.status(400).json({ error: 'Ya existe una disciplina con ese nombre' });
      } else {
        res.status(500).json({ error: 'Error al crear disciplina' });
      }
    }
  },

  // Actualizar disciplina
  updateDisciplina: async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
      const result = await pool.query(
        'UPDATE disciplinas SET nombre = $1 WHERE disciplina_id = $2 RETURNING disciplina_id',
        [nombre, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Disciplina no encontrada' });
      }
      await logAudit(req, {
        accion: 'actualizar_disciplina',
        tabla_afectada: 'disciplinas',
        registro_id: id,
        detalles: `Disciplina actualizada: ${nombre}`
      });
      
      res.json({ ok: true, message: 'Disciplina actualizada correctamente' });
    } catch (error) {
      console.error(error);
      if (error.code === '23505') {
        res.status(400).json({ error: 'Ya existe una disciplina con ese nombre' });
      } else {
        res.status(500).json({ error: 'Error al actualizar disciplina' });
      }
    }
  },

  // Eliminar disciplina
  deleteDisciplina: async (req, res) => {
    const { id } = req.params;
    
    try {
      // Verificar si la disciplina está siendo usada en espacios
      const checkResult = await pool.query(
        'SELECT COUNT(*) FROM espacios WHERE disciplina_id = $1',
        [id]
      );
      
      if (parseInt(checkResult.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar la disciplina porque está siendo usada por uno o más espacios' 
        });
      }
      
      const result = await pool.query(
        'DELETE FROM disciplinas WHERE disciplina_id = $1 RETURNING disciplina_id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Disciplina no encontrada' });
      }
      await logAudit(req, {
        accion: 'eliminar_disciplina',
        tabla_afectada: 'disciplinas',
        registro_id: id,
        detalles: 'Disciplina eliminada'
      });
      
      res.json({ ok: true, message: 'Disciplina eliminada correctamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al eliminar disciplina' });
    }
  }
};

module.exports = disciplinasController;
