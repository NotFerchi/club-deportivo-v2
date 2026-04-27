const pool = require('../config/database');

module.exports = {
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
      await pool.query('UPDATE ludoteca SET hora_salida = NOW() WHERE registro_id = $1', [id]);
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
  }
};