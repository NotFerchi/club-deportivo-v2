const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const LUDOTECA_TIME_ZONE = 'America/Mexico_City';
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');

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
          TO_CHAR(rl.hora_salida, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_salida_local,
          rl.socio_padre_id,

          DATE_PART('year', AGE(CURRENT_DATE, rl.fecha_nacimiento))::int AS edad,

          GREATEST(FLOOR(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - rl.hora_entrada)))::int, 0) AS segundos_transcurridos,
          GREATEST(FLOOR(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - rl.hora_entrada)) / 60)::int, 0) AS minutos_transcurridos,

          u.nombres,
          u.apellido_paterno,
          TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno)) AS nombre_padre,
          TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno)) AS tutor_nombre,
          rl.observaciones

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
    req.body = {
      ...req.body,
      socio_padre_id: req.body.socio_padre_id || req.body.socio_id,
      nombre_hijo: req.body.nombre_hijo || req.body.nombre_nino
    };
    return module.exports.registrarEntradaLudoteca(req, res);
  },

  registrarSalida: async (req, res) => {
    req.params.registro_id = req.params.registro_id || req.params.id;
    return module.exports.registrarSalidaLudoteca(req, res);
  },

  historial: async (req, res) => {
    try {
      const dias = Number.parseInt(req.query.dias || '7', 10);
      const result = await pool.query(`
        SELECT
          rl.registro_id,
          rl.socio_padre_id,
          rl.nombre_hijo,
          rl.nombre_hijo AS nombre_nino,
          rl.fecha_nacimiento,
          rl.hora_entrada,
          rl.hora_salida,
          TO_CHAR(rl.hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
          TO_CHAR(rl.hora_salida, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_salida_local,
          DATE_PART('year', AGE(CURRENT_DATE, rl.fecha_nacimiento))::int AS edad,
          u.nombres,
          u.apellido_paterno,
          TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno)) AS nombre_padre,
          TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno)) AS tutor_nombre,
          rl.observaciones
        FROM registro_ludoteca rl
        JOIN socios s ON rl.socio_padre_id = s.socio_id
        JOIN usuarios u ON s.usuario_id = u.usuario_id
        WHERE rl.hora_entrada >= (NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - ($1::text || ' days')::interval
        ORDER BY rl.hora_entrada DESC
        LIMIT 100
      `, [Number.isFinite(dias) && dias > 0 ? dias : 7]);
      res.setHeader('Cache-Control', 'no-store');
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ── SCRUM-108: POST /api/ludoteca/entrada ──
  registrarEntradaLudoteca: async (req, res) => {
    const { socio_padre_id, nombre_hijo, fecha_nacimiento, observaciones } = req.body;

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
        `INSERT INTO registro_ludoteca (socio_padre_id, nombre_hijo, fecha_nacimiento, hora_entrada, observaciones)
         VALUES ($1, $2, $3, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}', $4)
         RETURNING
           registro_id,
           socio_padre_id,
           nombre_hijo,
           fecha_nacimiento,
           hora_entrada,
           TO_CHAR(hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
           observaciones`,
        [socioPadreId, nombre_hijo.trim(), fecha_nacimiento, String(observaciones || '').trim() || null]
      );

      await logAudit(req, {
        accion: 'entrada_ludoteca',
        tabla_afectada: 'registro_ludoteca',
        registro_id: result.rows[0].registro_id,
        detalles: 'Entrada de ludoteca registrada'
      });

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
      await logAudit(req, {
        accion: 'salida_ludoteca',
        tabla_afectada: 'registro_ludoteca',
        registro_id: registroId,
        detalles: `Salida de ludoteca. Duracion ${duracionMinutos} min. Sancion: ${sancionGenerada ? 'si' : 'no'}`
      });

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
           TO_CHAR(hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada,
           TO_CHAR(hora_salida,  'YYYY-MM-DD"T"HH24:MI:SS') AS hora_salida,
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
  },

  // ── Entrada autoservicio del socio ──
  socioEntradaLudoteca: async (req, res) => {
    const { nombre_hijo, fecha_nacimiento, observaciones } = req.body;

    if (!nombre_hijo || !fecha_nacimiento) {
      return res.status(400).json({ error: 'nombre_hijo y fecha_nacimiento son requeridos' });
    }
    if (typeof nombre_hijo !== 'string' || nombre_hijo.trim() === '') {
      return res.status(400).json({ error: 'nombre_hijo no puede estar vacío' });
    }

    const nacimiento = new Date(fecha_nacimiento);
    if (isNaN(nacimiento.getTime())) {
      return res.status(400).json({ error: 'fecha_nacimiento debe tener formato YYYY-MM-DD' });
    }

    const edadAnios = (new Date() - nacimiento) / (1000 * 60 * 60 * 24 * 365.25);
    if (edadAnios < 3 || edadAnios > 7) {
      return res.status(400).json({ error: 'El niño debe tener entre 3 y 7 años' });
    }

    try {
      const socioResult = await pool.query(
        'SELECT socio_id FROM socios WHERE usuario_id = $1',
        [req.user.usuario_id]
      );
      if (socioResult.rowCount === 0) {
        return res.status(403).json({ error: 'Solo los socios pueden registrar entradas' });
      }
      const socioPadreId = socioResult.rows[0].socio_id;

      const activo = await pool.query(
        `SELECT registro_id FROM registro_ludoteca
         WHERE socio_padre_id = $1 AND LOWER(nombre_hijo) = LOWER($2) AND hora_salida IS NULL`,
        [socioPadreId, nombre_hijo.trim()]
      );
      if (activo.rowCount > 0) {
        return res.status(409).json({ error: 'Este niño ya tiene una entrada activa en la ludoteca' });
      }

      const result = await pool.query(
        `INSERT INTO registro_ludoteca (socio_padre_id, nombre_hijo, fecha_nacimiento, hora_entrada, observaciones)
         VALUES ($1, $2, $3, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}', $4)
         RETURNING
           registro_id, socio_padre_id, nombre_hijo, fecha_nacimiento, hora_entrada,
           TO_CHAR(hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
           observaciones`,
        [socioPadreId, nombre_hijo.trim(), fecha_nacimiento, String(observaciones || '').trim() || null]
      );

      return res.status(201).json({ ok: true, message: 'Entrada registrada', registro: result.rows[0] });
    } catch (error) {
      console.error('Error socioEntradaLudoteca:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Salida autoservicio del socio ──
  socioSalidaLudoteca: async (req, res) => {
    const registroId = Number(req.params.registro_id);
    if (!Number.isInteger(registroId) || registroId <= 0) {
      return res.status(400).json({ error: 'registro_id debe ser un entero válido' });
    }

    const socioResult = await pool.query(
      'SELECT socio_id FROM socios WHERE usuario_id = $1',
      [req.user.usuario_id]
    );
    if (socioResult.rowCount === 0) {
      return res.status(403).json({ error: 'Solo los socios pueden registrar salidas' });
    }
    const socioPadreId = socioResult.rows[0].socio_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows, rowCount } = await client.query(
        `SELECT registro_id, socio_padre_id, hora_entrada, hora_salida
         FROM registro_ludoteca WHERE registro_id = $1 FOR UPDATE`,
        [registroId]
      );

      if (rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Registro no encontrado' });
      }

      const registro = rows[0];

      if (registro.socio_padre_id !== socioPadreId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'No tienes permiso para registrar esta salida' });
      }
      if (registro.hora_salida !== null) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Este niño ya tiene salida registrada' });
      }

      const { rows: updated } = await client.query(
        `UPDATE registro_ludoteca
         SET hora_salida = NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}'
         WHERE registro_id = $1
         RETURNING hora_salida,
           ROUND(EXTRACT(EPOCH FROM (hora_salida - hora_entrada)) / 60)::int AS duracion_minutos`,
        [registroId]
      );

      const duracionMinutos = Number(updated[0].duracion_minutos) || 0;
      let sancionGenerada = false;

      if (duracionMinutos > 120) {
        const exceso = duracionMinutos - 120;
        await client.query(
          `INSERT INTO sanciones (socio_id, origen, motivo, estado, registro_ludoteca_id)
           VALUES ($1, 'Ludoteca', $2, 'Activo', $3)`,
          [socioPadreId, `Exceso de estancia: ${exceso} min sobre el límite de 2 horas`, registroId]
        );
        sancionGenerada = true;
      }

      await client.query('COMMIT');
      return res.json({ ok: true, registro_id: registroId, duracion_minutos: duracionMinutos, sancion_generada: sancionGenerada });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error socioSalidaLudoteca:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
      client.release();
    }
  },

  getAforo: async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) AS activos FROM registro_ludoteca WHERE hora_salida IS NULL'
      );
      res.json({ activos: parseInt(result.rows[0].activos), maximo: 15 });
    } catch (error) {
      console.error('Error al obtener aforo:', error);
      res.status(500).json({ error: 'Error al obtener aforo' });
    }
  },

  accesoQrLudoteca: async (req, res) => {
  const { codigo_qr, nombre_hijo, fecha_nacimiento, observaciones } = req.body;

  if (!codigo_qr) {
    return res.status(400).json({ error: 'codigo_qr es requerido' });
  }

  let payload;
  try {
    payload = validarQrFirmado(codigo_qr);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (payload.type !== 'socio') {
    return res.status(400).json({ error: 'Solo socios pueden registrar niños en ludoteca' });
  }

  const socioPadreId = Number(payload.socio_id);
  if (!Number.isInteger(socioPadreId) || socioPadreId <= 0) {
    return res.status(400).json({ error: 'QR inválido: socio_id no válido' });
  }

  const socioResult = await pool.query(
    'SELECT socio_id, activo FROM socios WHERE socio_id = $1',
    [socioPadreId]
  );

  if (socioResult.rowCount === 0) {
    return res.status(404).json({ error: 'Socio no encontrado' });
  }

  if (!socioResult.rows[0].activo) {
    return res.status(403).json({ error: 'El socio no está activo' });
  }

  const registroActivo = await pool.query(
    `SELECT registro_id, nombre_hijo, hora_entrada
     FROM registro_ludoteca
     WHERE socio_padre_id = $1 AND hora_salida IS NULL
     ORDER BY hora_entrada DESC
     LIMIT 1`,
    [socioPadreId]
  );

  if (registroActivo.rowCount > 0) {
    const registro = registroActivo.rows[0];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: updated } = await client.query(
        `UPDATE registro_ludoteca
         SET hora_salida = NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}'
         WHERE registro_id = $1
         RETURNING
           hora_salida,
           ROUND(EXTRACT(EPOCH FROM (hora_salida - hora_entrada)) / 60)::int AS duracion_minutos`,
        [registro.registro_id]
      );

      const duracionMinutos = Number(updated[0].duracion_minutos) || 0;
      let sancionGenerada = false;

      if (duracionMinutos > 120) {
        const exceso = duracionMinutos - 120;
        await client.query(
          `INSERT INTO sanciones (socio_id, origen, motivo, estado, registro_ludoteca_id)
           VALUES ($1, 'Ludoteca', $2, 'Activo', $3)`,
          [socioPadreId, `Exceso de estancia: ${exceso} min sobre el límite de 2 horas`, registro.registro_id]
        );
        sancionGenerada = true;
      }

      await client.query('COMMIT');

      await logAudit(req, {
        accion: 'salida_ludoteca_qr',
        tabla_afectada: 'registro_ludoteca',
        registro_id: registro.registro_id,
        detalles: `Salida por QR. Duración: ${duracionMinutos} min. Sanción: ${sancionGenerada ? 'sí' : 'no'}`
      });

      return res.json({
        accion: 'salida',
        nombre_hijo: registro.nombre_hijo,
        hora_salida: updated[0].hora_salida,
        duracion_minutos: duracionMinutos,
        sancion_generada: sancionGenerada
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en salida QR ludoteca:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
      client.release();
    }
  }

  if (!nombre_hijo || !fecha_nacimiento) {
    return res.json({
      requiere_datos: true,
      mensaje: 'Proporciona nombre y fecha de nacimiento del niño',
      socio_padre_id: socioPadreId
    });
  }

  if (typeof nombre_hijo !== 'string' || nombre_hijo.trim() === '') {
    return res.status(400).json({ error: 'nombre_hijo no puede estar vacío' });
  }

  const nacimiento = new Date(fecha_nacimiento);
  if (isNaN(nacimiento.getTime())) {
    return res.status(400).json({ error: 'fecha_nacimiento debe tener formato YYYY-MM-DD' });
  }

  const edadAnios = (new Date() - nacimiento) / (1000 * 60 * 60 * 24 * 365.25);
  if (edadAnios < 3 || edadAnios > 7) {
    return res.status(400).json({ error: `El niño debe tener entre 3 y 7 años (edad detectada: ${Math.floor(edadAnios)} años)` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO registro_ludoteca (socio_padre_id, nombre_hijo, fecha_nacimiento, hora_entrada, observaciones)
       VALUES ($1, $2, $3, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}', $4)
       RETURNING
         registro_id,
         nombre_hijo,
         hora_entrada,
         TO_CHAR(hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
         observaciones`,
      [socioPadreId, nombre_hijo.trim(), fecha_nacimiento, String(observaciones || '').trim() || null]
    );

    const reg = result.rows[0];
    const horaEntrada = new Date(reg.hora_entrada);
    const horaLimite = new Date(horaEntrada.getTime() + 2 * 60 * 60 * 1000);

    await logAudit(req, {
      accion: 'entrada_ludoteca_qr',
      tabla_afectada: 'registro_ludoteca',
      registro_id: reg.registro_id,
      detalles: `Entrada por QR. Niño: ${nombre_hijo.trim()}`
    });

    return res.status(201).json({
      accion: 'entrada',
      nombre_hijo: reg.nombre_hijo,
      hora_entrada: reg.hora_entrada_local,
      hora_limite: horaLimite.toISOString()
    });

  } catch (error) {
    console.error('Error en entrada QR ludoteca:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
},
};
