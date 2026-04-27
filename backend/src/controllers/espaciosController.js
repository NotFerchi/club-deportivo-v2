const pool = require('../config/database');

const espaciosController = {
  // Obtener todos los espacios
  getEspacios: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          e.espacio_id,
          e.nombre,
          e.capacidad_maxima,
          e.activo,
          d.disciplina_id,
          d.nombre as disciplina
        FROM espacios e
        LEFT JOIN disciplinas d ON e.disciplina_id = d.disciplina_id
        ORDER BY e.nombre
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error en getEspacios:', error);
      res.status(500).json({ error: 'Error al obtener espacios' });
    }
  },

  // Obtener un espacio por ID
  getEspacioById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM espacios WHERE espacio_id = $1',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Espacio no encontrado' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error en getEspacioById:', error);
      res.status(500).json({ error: 'Error al obtener espacio' });
    }
  },

  // Crear un nuevo espacio
  createEspacio: async (req, res) => {
    const { nombre, disciplina_id, capacidad_maxima, activo } = req.body;
    
    if (!nombre || !capacidad_maxima) {
      return res.status(400).json({ error: 'Nombre y capacidad máxima son requeridos' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO espacios (nombre, disciplina_id, capacidad_maxima, activo)
         VALUES ($1, $2, $3, $4)
         RETURNING espacio_id`,
        [nombre, disciplina_id || null, capacidad_maxima, activo !== undefined ? activo : true]
      );
      res.json({ ok: true, id: result.rows[0].espacio_id, message: 'Espacio creado correctamente' });
    } catch (error) {
      console.error('Error en createEspacio:', error);
      res.status(500).json({ error: 'Error al crear espacio' });
    }
  },

  // Actualizar espacio
  updateEspacio: async (req, res) => {
    const { id } = req.params;
    const { nombre, disciplina_id, capacidad_maxima, activo } = req.body;

    try {
      const result = await pool.query(
        `UPDATE espacios 
         SET nombre = $1, 
             disciplina_id = $2, 
             capacidad_maxima = $3, 
             activo = $4
         WHERE espacio_id = $5
         RETURNING espacio_id`,
        [nombre, disciplina_id || null, capacidad_maxima, activo, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Espacio no encontrado' });
      }
      
      res.json({ ok: true, message: 'Espacio actualizado correctamente' });
    } catch (error) {
      console.error('Error en updateEspacio:', error);
      res.status(500).json({ error: 'Error al actualizar espacio' });
    }
  },

  // Eliminar espacio (borrado físico)
  deleteEspacio: async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query(
        'DELETE FROM espacios WHERE espacio_id = $1 RETURNING espacio_id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Espacio no encontrado' });
      }
      
      res.json({ ok: true, message: 'Espacio eliminado correctamente' });
    } catch (error) {
      console.error('Error en deleteEspacio:', error);
      res.status(500).json({ error: 'Error al eliminar espacio' });
    }
  },

  // Obtener disciplinas (para el select)
  getDisciplinas: async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT disciplina_id, nombre FROM disciplinas ORDER BY nombre'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error en getDisciplinas:', error);
      res.status(500).json({ error: 'Error al obtener disciplinas' });
    }
  }
};

module.exports = espaciosController;