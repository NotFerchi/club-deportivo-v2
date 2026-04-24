const pool = require('../config/database');

const sancionesController = {
  // Obtener todas las sanciones
  getSanciones: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          s.sancion_id,
          s.socio_id,
          s.motivo,
          s.gravedad,
          s.fecha_inicio,
          s.fecha_fin,
          s.activa,
          soc.numero_socio,
          soc.tipo as tipo_socio,
          u.nombres as socio_nombre,
          u.apellido_paterno as socio_apellido
        FROM sanciones s
        JOIN socios soc ON s.socio_id = soc.socio_id
        JOIN usuarios u ON soc.usuario_id = u.usuario_id
        ORDER BY s.fecha_inicio DESC
      `);
      
      // Formatear los datos
      const sanciones = result.rows.map(row => ({
        ...row,
        socio_nombre: `${row.socio_nombre} ${row.socio_apellido || ''}`.trim()
      }));
      
      res.json(sanciones);
    } catch (error) {
      console.error('Error en getSanciones:', error);
      res.status(500).json({ error: 'Error al obtener sanciones: ' + error.message });
    }
  },

  // Obtener una sanción por ID
  getSancionById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        SELECT 
          s.*,
          soc.numero_socio,
          u.nombres as socio_nombre,
          u.apellido_paterno as socio_apellido
        FROM sanciones s
        JOIN socios soc ON s.socio_id = soc.socio_id
        JOIN usuarios u ON soc.usuario_id = u.usuario_id
        WHERE s.sancion_id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Sanción no encontrada' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error en getSancionById:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear nueva sanción
  createSancion: async (req, res) => {
    const { socio_id, motivo, gravedad, fecha_inicio, fecha_fin } = req.body;
    
    if (!socio_id || !motivo || !gravedad) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    
    try {
      const result = await pool.query(`
        INSERT INTO sanciones (socio_id, motivo, gravedad, fecha_inicio, fecha_fin, activa)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING sancion_id
      `, [socio_id, motivo, gravedad, fecha_inicio || new Date(), fecha_fin || null]);
      
      res.json({ ok: true, id: result.rows[0].sancion_id, message: 'Sanción creada correctamente' });
    } catch (error) {
      console.error('Error en createSancion:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Actualizar sanción
  updateSancion: async (req, res) => {
    const { id } = req.params;
    const { motivo, gravedad, fecha_inicio, fecha_fin, activa } = req.body;
    
    try {
      await pool.query(`
        UPDATE sanciones SET
          motivo = COALESCE($1, motivo),
          gravedad = COALESCE($2, gravedad),
          fecha_inicio = COALESCE($3, fecha_inicio),
          fecha_fin = $4,
          activa = COALESCE($5, activa)
        WHERE sancion_id = $6
      `, [motivo, gravedad, fecha_inicio, fecha_fin, activa, id]);
      
      res.json({ ok: true, message: 'Sanción actualizada correctamente' });
    } catch (error) {
      console.error('Error en updateSancion:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Eliminar sanción
  deleteSancion: async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM sanciones WHERE sancion_id = $1', [id]);
      res.json({ ok: true, message: 'Sanción eliminada correctamente' });
    } catch (error) {
      console.error('Error en deleteSancion:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Levantar sanción (marcar como inactiva/expipada)
  levantarSancion: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        UPDATE sanciones 
        SET activa = false, fecha_fin = NOW()
        WHERE sancion_id = $1 AND activa = true
        RETURNING sancion_id
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Sanción no encontrada o ya estaba levantada' });
      }
      
      res.json({ ok: true, message: 'Sanción levantada correctamente' });
    } catch (error) {
      console.error('Error en levantarSancion:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = sancionesController;