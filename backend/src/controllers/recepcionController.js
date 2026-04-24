const pool = require('../config/database');

const recepcionController = {
  // Obtener visitas activas (sin hora de salida)
  visitasActivas: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          v.*,
          s.socio_id,
          s.nombres as socio_anfitrion_nombre,
          s.apellido_paterno as socio_anfitrion_apellido
        FROM visitas v
        LEFT JOIN socios s ON v.socio_anfitrion_id = s.socio_id
        WHERE v.hora_salida IS NULL
        ORDER BY v.hora_entrada DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener visitas activas' });
    }
  },

  // Historial de visitas (últimos días)
  historialVisitas: async (req, res) => {
    const { dias = 7 } = req.query;
    try {
      const result = await pool.query(`
        SELECT 
          v.*,
          s.nombres as socio_anfitrion_nombre,
          s.apellido_paterno as socio_anfitrion_apellido
        FROM visitas v
        LEFT JOIN socios s ON v.socio_anfitrion_id = s.socio_id
        WHERE v.fecha_visita >= CURRENT_DATE - ($1 || ' days')::INTERVAL
        ORDER BY v.hora_entrada DESC
      `, [dias]);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener historial' });
    }
  },

  // Crear nueva visita
  crearVisita: async (req, res) => {
    const { nombre_completo, identificacion_tipo, socio_anfitrion_id, motivo } = req.body;
    
    if (!nombre_completo) {
      return res.status(400).json({ error: 'Nombre completo es requerido' });
    }

    try {
      const result = await pool.query(`
        INSERT INTO visitas (nombre_completo, identificacion_tipo, socio_anfitrion_id, motivo, fecha_visita, hora_entrada, vigente)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, NOW(), true)
        RETURNING visita_id
      `, [nombre_completo, identificacion_tipo || null, socio_anfitrion_id || null, motivo || null]);
      
      res.json({ ok: true, id: result.rows[0].visita_id, message: 'Visita registrada correctamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al registrar visita' });
    }
  },

  // Registrar salida de visita
  registrarSalida: async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query(`
        UPDATE visitas 
        SET hora_salida = NOW(), vigente = false
        WHERE visita_id = $1 AND hora_salida IS NULL
        RETURNING visita_id
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Visita no encontrada o ya finalizada' });
      }
      
      res.json({ ok: true, message: 'Salida registrada correctamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al registrar salida' });
    }
  },

  // Lista de socios para selector en el frontend
  listaSociosParaVisitas: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          s.socio_id,
          u.nombres,
          u.apellido_paterno,
          s.tipo as tipo_socio
        FROM socios s
        JOIN usuarios u ON s.usuario_id = u.usuario_id
        WHERE s.activo = true
        ORDER BY u.nombres
      `);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener lista de socios' });
    }
  }
};

module.exports = recepcionController;