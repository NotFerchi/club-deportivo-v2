const pool = require('../config/database');
const bcrypt = require('bcryptjs');

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
          s.activo,
          u.nombres,
          u.apellido_paterno,
          u.apellido_materno,
          u.username as email,
          u.curp,
          u.fecha_nacimiento,
          u.genero,
          u.telefono,
          u.direccion,
          u.activo as usuario_activo
        FROM socios s
        JOIN usuarios u ON s.usuario_id = u.usuario_id
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
      
      // Obtener rol_id de 'socio'
      const rolResult = await client.query('SELECT rol_id FROM roles WHERE nombre = $1', ['socio']);
      if (rolResult.rows.length === 0) {
        throw new Error('Rol "socio" no encontrado en la base de datos');
      }
      const rolId = rolResult.rows[0].rol_id;
      
      // Hash de la contraseña
      const passwordHash = bcrypt.hashSync(password, 10);
      
      // Insertar en usuarios
      const userResult = await client.query(`
        INSERT INTO usuarios 
          (rol_id, username, nombres, apellido_paterno, apellido_materno, 
           curp, fecha_nacimiento, genero, telefono, direccion, password_hash, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        RETURNING usuario_id
      `, [rolId, email, nombres, apellidoPaterno, apellidoMaterno, 
          curp, fechaNacimiento, genero, telefono, direccion, passwordHash]);
      
      const usuarioId = userResult.rows[0].usuario_id;
      
      // Insertar en socios
      await client.query(`
        INSERT INTO socios 
          (usuario_id, tipo, modalidad, es_titular, numero_socio, nombre_emergencia, tel_emergencia, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `, [usuarioId, tipo, modalidad, es_titular || false, numero_socio, nombre_emergencia, tel_emergencia]);
      
      await client.query('COMMIT');
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
      modalidad,
      es_titular,
      numero_socio,
      nombre_emergencia,
      tel_emergencia,
      activo
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Obtener usuario_id del socio
      const socioRes = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
      if (socioRes.rows.length === 0) {
        throw new Error('Socio no encontrado');
      }
      const userId = socioRes.rows[0].usuario_id;
      
      // Actualizar usuarios
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
      `, [nombres, apellidoPaterno, apellidoMaterno, email, telefono, 
          curp, fechaNacimiento, genero, direccion, activo, userId]);
      
      // Actualizar socios
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
      `, [tipo, modalidad, es_titular, numero_socio, nombre_emergencia, tel_emergencia, activo, id]);
      
      await client.query('COMMIT');
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
    try {
      const result = await pool.query(
        'UPDATE socios SET activo = false WHERE socio_id = $1 RETURNING socio_id',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Socio no encontrado' });
      }
      res.json({ ok: true, message: 'Socio inactivado correctamente' });
    } catch (error) {
      console.error('Error en deleteSocio:', error);
      res.status(500).json({ error: 'Error al inactivar socio' });
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
    try {
      const result = await pool.query(
        'UPDATE socios SET activo = true WHERE socio_id = $1 RETURNING socio_id',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Socio no encontrado' });
      }
      res.json({ ok: true, message: 'Socio reactivado correctamente' });
    } catch (error) {
      console.error('Error en reactivar:', error);
      res.status(500).json({ error: 'Error al reactivar socio' });
    }
  }
};

module.exports = socioController;