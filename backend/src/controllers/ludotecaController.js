const pool = require('../config/database');
const LUDOTECA_TIME_ZONE = 'America/Mexico_City';

module.exports = {

  // ── Existentes ──
  registrosActivos: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          rl.registro_id,
          rl.nombre_hijo,
          rl.nombre_hijo AS nombre_nino,
          rl.fecha_nacimiento,
          rl.hora_entrada,
          rl.hora_salida,
          TO_CHAR(rl.hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
          rl.socio_padre_id,

          DATE_PART('year', AGE(CURRENT_DATE, rl.fecha_nacimiento))::int AS edad,

          GREATEST(FLOOR(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - rl.hora_entrada)))::int, 0) AS segundos_transcurridos,
          GREATEST(FLOOR(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - rl.hora_entrada)) / 60)::int, 0) AS minutos_transcurridos,

          u.nombres,
          u.apellido_paterno,
          TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno)) AS nombre_padre,
          TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno)) AS tutor_nombre,
          NULL::text AS observaciones

        FROM registro_ludoteca rl
        JOIN socios s ON rl.socio_padre_id = s.socio_id
        JOIN usuarios u ON s.usuario_id = u.usuario_id
        WHERE rl.hora_salida IS NULL
        ORDER BY rl.hora_entrada ASC
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

  // ── SCRUM-108: POST /api/ludoteca/entrada ──
  registrarEntradaLudoteca: async (req, res) => {
    const { socio_padre_id, nombre_hijo, fecha_nacimiento } = req.body;

    if (!socio_padre_id || !nombre_hijo || !fecha_nacimiento) {
      return res.status(400).json({
        error: 'socio_padre_id, nombre_hijo y fecha_nacimiento son requeridos'
      });
    }

    if (typeof nombre_hijo !== 'string' || nombre_hijo.trim() === '') {
      return res.status(400).json({ error: 'nombre_hijo no puede estar vacío' });
    }

    const nacimiento = new Date(fecha_nacimiento);
    if (isNaN(nacimiento.getTime())) {
      return res.status(400).json({ error: 'fecha_nacimiento debe tener formato YYYY-MM-DD' });
    }

    const hoy = new Date();
    const edadAnios = (hoy - nacimiento) / (1000 * 60 * 60 * 24 * 365.25);

    if (edadAnios < 3 || edadAnios > 7) {
      return res.status(400).json({ error: 'El niño debe tener entre 3 y 7 años' });
    }

    const socioPadreId = Number(socio_padre_id);
    if (!Number.isInteger(socioPadreId) || socioPadreId <= 0) {
      return res.status(400).json({ error: 'socio_padre_id debe ser un entero válido' });
    }

    try {
      const socio = await pool.query(
        'SELECT socio_id FROM socios WHERE socio_id = $1',
        [socioPadreId]
      );

      if (socio.rowCount === 0) {
        return res.status(400).json({ error: 'El socio padre no existe' });
      }

      const result = await pool.query(
        `INSERT INTO registro_ludoteca (socio_padre_id, nombre_hijo, fecha_nacimiento, hora_entrada)
         VALUES ($1, $2, $3, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}')
         RETURNING
           registro_id,
           socio_padre_id,
           nombre_hijo,
           fecha_nacimiento,
           hora_entrada,
           TO_CHAR(hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local`,
        [socioPadreId, nombre_hijo.trim(), fecha_nacimiento]
      );

      return res.status(201).json({
        ok: true,
        message: 'Entrada registrada correctamente',
        registro: result.rows[0]
      });

    } catch (error) {
      console.error('Error al registrar entrada a ludoteca:', error);
      if (error.code === '23503') {
        return res.status(400).json({ error: 'El socio padre no existe' });
      }
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── SCRUM-109: PATCH /api/ludoteca/salida/:registro_id ──
  registrarSalidaLudoteca: async (req, res) => {
    const registroId = Number(req.params.registro_id);

    if (!Number.isInteger(registroId) || registroId <= 0) {
      return res.status(400).json({ error: 'registro_id debe ser un entero válido' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows, rowCount } = await client.query(
        `SELECT registro_id, socio_padre_id, hora_entrada, hora_salida
         FROM registro_ludoteca
         WHERE registro_id = $1
         FOR UPDATE`,
        [registroId]
      );

      if (rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Registro no encontrado' });
      }

      const registro = rows[0];

      if (registro.hora_salida !== null) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Este niño ya tiene salida registrada' });
      }

      const { rows: updated } = await client.query(
        `UPDATE registro_ludoteca
         SET hora_salida = NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}'
         WHERE registro_id = $1
         RETURNING
           hora_salida,
           ROUND(EXTRACT(EPOCH FROM (hora_salida - hora_entrada)) / 60)::int AS duracion_minutos`,
        [registroId]
      );

      const horaSalida = updated[0].hora_salida;
      const duracionMinutos = Number(updated[0].duracion_minutos) || 0;

      let sancionGenerada = false;

      if (duracionMinutos > 120) {
        const minutosExceso = duracionMinutos - 120;
        const motivo = `Exceso de estancia: ${minutosExceso} min sobre el límite de 2 horas`;

        await client.query(
          `INSERT INTO sanciones (socio_id, origen, motivo, estado, registro_ludoteca_id)
           VALUES ($1, 'Ludoteca', $2, 'Activo', $3)`,
          [registro.socio_padre_id, motivo, registroId]
        );

        sancionGenerada = true;
      }

      await client.query('COMMIT');

      return res.json({
        ok: true,
        registro_id:      registroId,
        hora_salida:      horaSalida,
        duracion_minutos: duracionMinutos,
        sancion_generada: sancionGenerada
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al registrar salida de ludoteca:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
      client.release();
    }
  },

  // ── SCRUM-110: GET /api/ludoteca/mis-registros ──
  misRegistros: async (req, res) => {
    try {
      const usuarioId = req.user.usuario_id;

      const socio = await pool.query(
        'SELECT socio_id FROM socios WHERE usuario_id = $1',
        [usuarioId]
      );

      if (socio.rowCount === 0) {
        return res.json([]);
      }

      const socioPadreId = socio.rows[0].socio_id;

      const result = await pool.query(
        `SELECT
           registro_id,
           nombre_hijo,
           fecha_nacimiento,
           hora_entrada,
           hora_salida,
           CASE WHEN hora_salida IS NULL THEN 'activo' ELSE 'finalizado' END as estado,
           ROUND(EXTRACT(EPOCH FROM (COALESCE(hora_salida, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - hora_entrada)) / 60) as minutos_transcurridos
         FROM registro_ludoteca
         WHERE socio_padre_id = $1
         ORDER BY hora_entrada DESC
         LIMIT 10`,
        [socioPadreId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Error al obtener registros de ludoteca:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

};
