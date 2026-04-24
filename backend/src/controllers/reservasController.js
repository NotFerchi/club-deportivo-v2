const pool = require('../config/database');

const reservasController = {
  // Obtener todas las reservas
  getReservas: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          r.reserva_id,
          r.espacio_id,
          r.socio_id,
          r.fecha_reserva as fecha,
          r.hora_inicio,
          r.hora_fin,
          r.estado,
          r.fecha_creacion,
          e.nombre as espacio_nombre,
          u.nombres as socio_nombre,
          u.apellido_paterno as socio_apellido,
          s.numero_socio
        FROM reservaciones r
        LEFT JOIN espacios e ON r.espacio_id = e.espacio_id
        LEFT JOIN socios s ON r.socio_id = s.socio_id
        LEFT JOIN usuarios u ON s.usuario_id = u.usuario_id
        ORDER BY r.fecha_reserva DESC, r.hora_inicio ASC
      `);
      
      // Formatear nombres
      const reservas = result.rows.map(row => ({
        ...row,
        socio_nombre: `${row.socio_nombre || ''} ${row.socio_apellido || ''}`.trim(),
        fecha: row.fecha
      }));
      
      res.json(reservas);
    } catch (error) {
      console.error('Error en getReservas:', error);
      res.status(500).json({ error: 'Error al obtener reservas: ' + error.message });
    }
  },

  // Obtener reserva por ID
  getReservaById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        SELECT r.*, e.nombre as espacio_nombre
        FROM reservaciones r
        LEFT JOIN espacios e ON r.espacio_id = e.espacio_id
        WHERE r.reserva_id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error en getReservaById:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear nueva reserva
  createReserva: async (req, res) => {
    const { espacio_id, socio_id, fecha, hora_inicio, hora_fin, estado } = req.body;
    
    // Validaciones
    if (!espacio_id || !socio_id || !fecha || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    
    // Validar que hora_inicio < hora_fin
    if (hora_inicio >= hora_fin) {
      return res.status(400).json({ error: 'La hora de fin debe ser mayor a la hora de inicio' });
    }
    
    try {
      // Verificar disponibilidad del espacio
      const disponibilidad = await pool.query(`
        SELECT * FROM reservaciones 
        WHERE espacio_id = $1 
        AND fecha_reserva = $2 
        AND estado != 'cancelada'
        AND (
          (hora_inicio < $4 AND hora_fin > $3)
        )
      `, [espacio_id, fecha, hora_inicio, hora_fin]);
      
      if (disponibilidad.rows.length > 0) {
        return res.status(409).json({ error: 'El espacio ya está reservado en ese horario' });
      }
      
      const result = await pool.query(`
        INSERT INTO reservaciones (espacio_id, socio_id, fecha_reserva, hora_inicio, hora_fin, estado)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING reserva_id
      `, [espacio_id, socio_id, fecha, hora_inicio, hora_fin, estado || 'pendiente']);
      
      res.json({ ok: true, id: result.rows[0].reserva_id, message: 'Reserva creada correctamente' });
    } catch (error) {
      console.error('Error en createReserva:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Actualizar reserva
  updateReserva: async (req, res) => {
    const { id } = req.params;
    const { espacio_id, socio_id, fecha, hora_inicio, hora_fin, estado } = req.body;
    
    try {
      // Verificar si existe
      const existCheck = await pool.query('SELECT * FROM reservaciones WHERE reserva_id = $1', [id]);
      if (existCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }
      
      await pool.query(`
        UPDATE reservaciones SET
          espacio_id = COALESCE($1, espacio_id),
          socio_id = COALESCE($2, socio_id),
          fecha_reserva = COALESCE($3, fecha_reserva),
          hora_inicio = COALESCE($4, hora_inicio),
          hora_fin = COALESCE($5, hora_fin),
          estado = COALESCE($6, estado)
        WHERE reserva_id = $7
      `, [espacio_id, socio_id, fecha, hora_inicio, hora_fin, estado, id]);
      
      res.json({ ok: true, message: 'Reserva actualizada correctamente' });
    } catch (error) {
      console.error('Error en updateReserva:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Cancelar reserva
  cancelarReserva: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        UPDATE reservaciones 
        SET estado = 'cancelada' 
        WHERE reserva_id = $1 AND estado != 'cancelada'
        RETURNING reserva_id
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva no encontrada o ya estaba cancelada' });
      }
      
      res.json({ ok: true, message: 'Reserva cancelada correctamente' });
    } catch (error) {
      console.error('Error en cancelarReserva:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Eliminar reserva permanentemente
  deleteReserva: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM reservaciones WHERE reserva_id = $1 RETURNING reserva_id', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }
      
      res.json({ ok: true, message: 'Reserva eliminada correctamente' });
    } catch (error) {
      console.error('Error en deleteReserva:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = reservasController;