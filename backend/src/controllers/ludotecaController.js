const pool = require('../config/database');

module.exports = {

  // ── Existentes ──
  registrosActivos: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT l.*, s.nombres, s.apellido_paterno 
        FROM ludoteca l
        JOIN socios s ON l.socio_id = s.socio_id
        WHERE l.hora_salida IS NULL
        ORDER BY l.hora_entrada DESC
      `);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  registrarEntrada: async (req, res) => {
    const { socio_id, nombre_nino, edad } = req.body;
    try {
      await pool.query(
        `INSERT INTO ludoteca (socio_id, nombre_nino, edad, hora_entrada)
         VALUES ($1, $2, $3, NOW())`,
        [socio_id, nombre_nino, edad]
      );
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  registrarSalida: async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query(
        'UPDATE ludoteca SET hora_salida = NOW() WHERE registro_id = $1',
        [id]
      );
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  historial: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT l.*, s.nombres, s.apellido_paterno 
        FROM ludoteca l
        JOIN socios s ON l.socio_id = s.socio_id
        ORDER BY l.hora_entrada DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ── NUEVO: POST /api/ludoteca/entrada ──
  registrarEntradaLudoteca: async (req, res) => {
    // Solo estos 3 campos — instructor_id ignorado aunque venga en el body
    const { socio_padre_id, nombre_hijo, fecha_nacimiento } = req.body;

    // Validar campos requeridos
    if (!socio_padre_id || !nombre_hijo || !fecha_nacimiento) {
      return res.status(400).json({
        error: 'socio_padre_id, nombre_hijo y fecha_nacimiento son requeridos'
      });
    }

    if (typeof nombre_hijo !== 'string' || nombre_hijo.trim() === '') {
      return res.status(400).json({ error: 'nombre_hijo no puede estar vacío' });
    }

    // Validar formato de fecha
    const nacimiento = new Date(fecha_nacimiento);
    if (isNaN(nacimiento.getTime())) {
      return res.status(400).json({ error: 'fecha_nacimiento debe tener formato YYYY-MM-DD' });
    }

    // Validar edad entre 3 y 7 años
    const hoy = new Date();
    const edadAnios = (hoy - nacimiento) / (1000 * 60 * 60 * 24 * 365.25);

    if (edadAnios < 3 || edadAnios > 7) {
      return res.status(400).json({ error: 'El niño debe tener entre 3 y 7 años' });
    }

    // Validar que socio_padre_id sea entero válido
    const socioPadreId = Number(socio_padre_id);
    if (!Number.isInteger(socioPadreId) || socioPadreId <= 0) {
      return res.status(400).json({ error: 'socio_padre_id debe ser un entero válido' });
    }

    try {
      // Verificar que el socio padre existe
      const socio = await pool.query(
        'SELECT socio_id FROM socios WHERE socio_id = $1',
        [socioPadreId]
      );

      if (socio.rowCount === 0) {
        return res.status(400).json({ error: 'El socio padre no existe' });
      }

      // Insertar registro — hora_entrada la asigna la BD automáticamente
      const result = await pool.query(
        `INSERT INTO registro_ludoteca (socio_padre_id, nombre_hijo, fecha_nacimiento)
         VALUES ($1, $2, $3)
         RETURNING registro_id, socio_padre_id, nombre_hijo, fecha_nacimiento, hora_entrada`,
        [socioPadreId, nombre_hijo.trim(), fecha_nacimiento]
      );

      return res.status(201).json({
        ok: true,
        message: 'Entrada registrada correctamente',
        registro: result.rows[0]
      });

    } catch (error) {
      console.error('Error al registrar entrada a ludoteca:', error);

      // FK violation — socio_padre_id no existe
      if (error.code === '23503') {
        return res.status(400).json({ error: 'El socio padre no existe' });
      }

      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

};