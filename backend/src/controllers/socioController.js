const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { validarCURP } = require('../utils/validacionCurp');
const { logAudit } = require('../utils/auditLogger');

const normalizeTipoSocio = (tipo, tipoSocio) => {
  const value = String(tipo || tipoSocio || 'Rentista').toLowerCase();
  return value === 'accionista' ? 'Accionista' : 'Rentista';
};

const normalizeModalidad = (modalidad) => {
  const value = String(modalidad || 'Individual').toLowerCase();
  return value === 'familiar' ? 'Familiar' : 'Individual';
};

const validateSocioPayload = (data, editing = false) => {
  const errors = [];
  if (!data.nombres?.trim()) errors.push('Nombres es obligatorio');
  if (!data.apellidoPaterno?.trim()) errors.push('Apellido paterno es obligatorio');
  if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Email invalido');
  const curpValidation = validarCURP(data.curp);
  if (!curpValidation.valido) errors.push(curpValidation.mensaje);
  if (data.telefono && !/^\d{10}$/.test(String(data.telefono))) errors.push('Telefono debe tener 10 digitos');
  if (!data.direccion?.trim()) errors.push('Direccion es obligatoria');
  if (!editing && !data.password?.trim()) errors.push('Contrasena es obligatoria');
  if (data.password && data.password.length < 6) errors.push('Contrasena minima de 6 caracteres');
  return errors;
};

const socioController = {
  // Obtener todos los socios CON JOIN a usuarios
  getSocios: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          s.socio_id,
          s.usuario_id,
          s.accion_id,
          s.tipo,
          s.modalidad,
          s.es_titular,
          s.numero_socio,
          s.nombre_emergencia,
          s.tel_emergencia,
          s.parentesco,
          s.activo,
          s.fecha_alta,
          s.fecha_alta as fecha_registro,
          u.nombres,
          u.apellido_paterno,
          u.apellido_materno,
          u.username as email,
          u.curp,
          u.fecha_nacimiento,
          u.genero,
          u.telefono,
          u.direccion,
          u.activo as usuario_activo,
          COALESCE(sa.total_activas, 0)::int as num_sanciones
        FROM socios s
        JOIN usuarios u ON s.usuario_id = u.usuario_id
        LEFT JOIN (
          SELECT socio_id, COUNT(*)::int as total_activas
          FROM sanciones
          WHERE LOWER(estado::text) IN ('activo', 'activa')
          GROUP BY socio_id
        ) sa ON sa.socio_id = s.socio_id
        ORDER BY s.socio_id
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error en getSocios:', error);
      res.status(500).json({ error: 'Error al obtener socios: ' + error.message });
    }
  },

  // Obtener un socio por ID
  getSocioById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        SELECT 
          s.*,
          u.nombres,
          u.apellido_paterno,
          u.apellido_materno,
          u.username as email,
          u.curp,
          u.fecha_nacimiento,
          u.genero,
          u.telefono,
          u.direccion
        FROM socios s
        JOIN usuarios u ON s.usuario_id = u.usuario_id
        WHERE s.socio_id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Socio no encontrado' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error en getSocioById:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Crear nuevo socio
  createSocio: async (req, res) => {
    const {
      nombres,
      apellidoPaterno,
      apellidoMaterno,
      email,
      telefono,
      curp,
      fechaNacimiento,
      genero,
      direccion,
      tipo,
      tipo_socio,
      modalidad,
      es_titular,
      numero_socio,
      nombre_emergencia,
      tel_emergencia,
      password
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const validationErrors = validateSocioPayload(req.body);
      if (validationErrors.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: validationErrors[0], errors: validationErrors });
      }

      const existeUsuario = await client.query(
        'SELECT usuario_id FROM usuarios WHERE username = $1 OR curp = $2',
        [email, String(curp || '').toUpperCase()]
      );
      if (existeUsuario.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Email o CURP ya registrado' });
      }
      
      // Obtener rol_id de 'socio'
      const rolResult = await client.query('SELECT rol_id FROM roles WHERE nombre = $1', ['socio']);
      if (rolResult.rows.length === 0) {
        throw new Error('Rol "socio" no encontrado en la base de datos');
      }
      const rolId = rolResult.rows[0].rol_id;
      
      // Hash de la contraseña
      const passwordHash = bcrypt.hashSync(password, 10);
      let numeroSocioFinal = numero_socio;
      if (!numeroSocioFinal) {
        const numeroResult = await client.query(`
          SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(numero_socio, '\\D', '', 'g'), '') AS INTEGER)), 0) + 1 as siguiente
          FROM socios
        `);
        numeroSocioFinal = `SOC-${String(numeroResult.rows[0].siguiente).padStart(4, '0')}`;
      }
      
      // Insertar en usuarios
      const userResult = await client.query(`
        INSERT INTO usuarios 
          (rol_id, username, nombres, apellido_paterno, apellido_materno, 
           curp, fecha_nacimiento, genero, telefono, direccion, password_hash, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        RETURNING usuario_id
      `, [rolId, email, nombres, apellidoPaterno, apellidoMaterno, 
          String(curp || '').toUpperCase(), fechaNacimiento || null, genero || null, telefono || '', direccion, passwordHash]);
      
      const usuarioId = userResult.rows[0].usuario_id;
      
      // Insertar en socios
      const socioResult = await client.query(`
        INSERT INTO socios 
          (usuario_id, tipo, modalidad, es_titular, numero_socio, nombre_emergencia, tel_emergencia, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING socio_id
      `, [
        usuarioId,
        normalizeTipoSocio(tipo, tipo_socio),
        normalizeModalidad(modalidad),
        es_titular || false,
        numeroSocioFinal,
        nombre_emergencia || null,
        tel_emergencia || null
      ]);
      
      await client.query('COMMIT');
      await logAudit(req, {
        accion: 'crear_socio',
        tabla_afectada: 'socios',
        registro_id: socioResult.rows[0].socio_id,
        detalles: `Socio creado con numero ${numeroSocioFinal}`
      });
      res.json({ ok: true, message: 'Socio creado exitosamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en createSocio:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  },

  // Actualizar socio
  updateSocio: async (req, res) => {
    const { id } = req.params;
    const {
      nombres,
      apellidoPaterno,
      apellidoMaterno,
      email,
      telefono,
      curp,
      fechaNacimiento,
      genero,
      direccion,
      tipo,
      tipo_socio,
      modalidad,
      es_titular,
      numero_socio,
      nombre_emergencia,
      tel_emergencia,
      activo,
      password
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const validationErrors = validateSocioPayload(req.body, true);
      if (validationErrors.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: validationErrors[0], errors: validationErrors });
      }
      
      // Obtener usuario_id del socio
      const socioRes = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
      if (socioRes.rows.length === 0) {
        throw new Error('Socio no encontrado');
      }
      const userId = socioRes.rows[0].usuario_id;

      const duplicate = await client.query(
        'SELECT usuario_id FROM usuarios WHERE (username = $1 OR curp = $2) AND usuario_id <> $3',
        [email, String(curp || '').toUpperCase(), userId]
      );
      if (duplicate.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Email o CURP ya registrado en otro usuario' });
      }
      
      // Actualizar usuarios
      if (password?.trim()) {
        await client.query(`
          UPDATE usuarios SET
            nombres = COALESCE($1, nombres),
            apellido_paterno = COALESCE($2, apellido_paterno),
            apellido_materno = COALESCE($3, apellido_materno),
            username = COALESCE($4, username),
            telefono = COALESCE($5, telefono),
            curp = COALESCE($6, curp),
            fecha_nacimiento = COALESCE($7, fecha_nacimiento),
            genero = COALESCE($8, genero),
            direccion = COALESCE($9, direccion),
            activo = COALESCE($10, activo),
            password_hash = $11
          WHERE usuario_id = $12
        `, [nombres, apellidoPaterno, apellidoMaterno || '', email, telefono || '',
            String(curp || '').toUpperCase(), fechaNacimiento || null, genero || null, direccion, activo, bcrypt.hashSync(password, 10), userId]);
      } else {
        await client.query(`
          UPDATE usuarios SET
            nombres = COALESCE($1, nombres),
            apellido_paterno = COALESCE($2, apellido_paterno),
            apellido_materno = COALESCE($3, apellido_materno),
            username = COALESCE($4, username),
            telefono = COALESCE($5, telefono),
            curp = COALESCE($6, curp),
            fecha_nacimiento = COALESCE($7, fecha_nacimiento),
            genero = COALESCE($8, genero),
            direccion = COALESCE($9, direccion),
            activo = COALESCE($10, activo)
          WHERE usuario_id = $11
        `, [nombres, apellidoPaterno, apellidoMaterno || '', email, telefono || '',
            String(curp || '').toUpperCase(), fechaNacimiento || null, genero || null, direccion, activo, userId]);
      }
      
      // Actualizar socios
      const tipoFinal = (tipo || tipo_socio) ? normalizeTipoSocio(tipo, tipo_socio) : null;
      const modalidadFinal = modalidad ? normalizeModalidad(modalidad) : null;

      await client.query(`
        UPDATE socios SET
          tipo = COALESCE($1, tipo),
          modalidad = COALESCE($2, modalidad),
          es_titular = COALESCE($3, es_titular),
          numero_socio = COALESCE($4, numero_socio),
          nombre_emergencia = COALESCE($5, nombre_emergencia),
          tel_emergencia = COALESCE($6, tel_emergencia),
          activo = COALESCE($7, activo)
        WHERE socio_id = $8
      `, [
        tipoFinal,
        modalidadFinal,
        es_titular,
        numero_socio,
        nombre_emergencia,
        tel_emergencia,
        activo,
        id
      ]);
      
      await client.query('COMMIT');
      await logAudit(req, {
        accion: 'actualizar_socio',
        tabla_afectada: 'socios',
        registro_id: id,
        detalles: 'Socio actualizado'
      });
      res.json({ ok: true, message: 'Socio actualizado exitosamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en updateSocio:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  },

  // Inactivar socio
  deleteSocio: async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE socios SET activo = false WHERE socio_id = $1 RETURNING socio_id, usuario_id',
        [id]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Socio no encontrado' });
      }
      if (result.rows[0].usuario_id) {
        await client.query('UPDATE usuarios SET activo = false WHERE usuario_id = $1', [result.rows[0].usuario_id]);
      }
      await client.query('COMMIT');
      await logAudit(req, {
        accion: 'inactivar_socio',
        tabla_afectada: 'socios',
        registro_id: id,
        detalles: 'Socio inactivado'
      });
      res.json({ ok: true, message: 'Socio inactivado correctamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en deleteSocio:', error);
      res.status(500).json({ error: 'Error al inactivar socio' });
    } finally {
      client.release();
    }
  },

  // Eliminar socio permanentemente
  deletePermanente: async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const socioRes = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
      if (socioRes.rows.length === 0) {
        throw new Error('Socio no existe');
      }
      const userId = socioRes.rows[0].usuario_id;
      
      await client.query('DELETE FROM socios WHERE socio_id = $1', [id]);
      await client.query('DELETE FROM usuarios WHERE usuario_id = $1', [userId]);
      
      await client.query('COMMIT');
      await logAudit(req, {
        accion: 'eliminar_socio_permanente',
        tabla_afectada: 'socios',
        registro_id: id,
        detalles: 'Socio eliminado permanentemente'
      });
      res.json({ ok: true, message: 'Socio eliminado permanentemente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en deletePermanente:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  },

  // Reactivar socio
  reactivar: async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE socios SET activo = true WHERE socio_id = $1 RETURNING socio_id, usuario_id',
        [id]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Socio no encontrado' });
      }
      if (result.rows[0].usuario_id) {
        await client.query('UPDATE usuarios SET activo = true WHERE usuario_id = $1', [result.rows[0].usuario_id]);
      }
      await client.query('COMMIT');
      await logAudit(req, {
        accion: 'reactivar_socio',
        tabla_afectada: 'socios',
        registro_id: id,
        detalles: 'Socio reactivado'
      });
      res.json({ ok: true, message: 'Socio reactivado correctamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en reactivar:', error);
      res.status(500).json({ error: 'Error al reactivar socio' });
    } finally {
      client.release();
    }
  }
};

module.exports = socioController;
