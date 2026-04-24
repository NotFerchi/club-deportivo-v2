const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const socioController = {
  // Obtener todos los socios - VERSIÓN CORREGIDA (usa username en lugar de email)
  getSocios: async (req, res) => {
    try {
      console.log('Intentando consultar socios...');
      
      const result = await pool.query(`
        SELECT 
          s.socio_id,
          s.numero_socio,
          s.tipo,
          s.modalidad,
          s.es_titular,
          s.accion_id,
          u.usuario_id,
          u.nombres,
          u.apellido_paterno,
          u.apellido_materno,
          u.username as email,
          u.telefono,
          u.curp,
          u.fecha_nacimiento,
          u.genero,
          u.direccion,
          u.activo
        FROM socios s
        JOIN usuarios u ON s.usuario_id = u.usuario_id
        WHERE u.rol_id = (SELECT rol_id FROM roles WHERE nombre = 'socio')
        ORDER BY s.socio_id
      `);
      
      console.log('Socios encontrados:', result.rows.length);
      res.json(result.rows);
      
    } catch (error) {
      console.error('ERROR EN getSocios:', error.message);
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
          u.telefono,
          u.curp,
          u.fecha_nacimiento,
          u.genero,
          u.direccion,
          u.activo
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
      
      // Insertar en usuarios (usando username para el email)
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
          (usuario_id, numero_socio, tipo, modalidad, es_titular)
        VALUES ($1, $2, $3, $4, $5)
      `, [usuarioId, numero_socio, tipo, modalidad, es_titular || false]);
      
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
          numero_socio = COALESCE($4, numero_socio)
        WHERE socio_id = $5
      `, [tipo, modalidad, es_titular, numero_socio, id]);
      
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

  // Inactivar socio (soft delete en usuarios)
  deleteSocio: async (req, res) => {
    const { id } = req.params;
    try {
      const socioRes = await pool.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
      if (socioRes.rows.length === 0) {
        return res.status(404).json({ error: 'Socio no encontrado' });
      }
      const userId = socioRes.rows[0].usuario_id;
      
      await pool.query('UPDATE usuarios SET activo = false WHERE usuario_id = $1', [userId]);
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
      const socioRes = await pool.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
      if (socioRes.rows.length === 0) {
        return res.status(404).json({ error: 'Socio no encontrado' });
      }
      const userId = socioRes.rows[0].usuario_id;
      
      await pool.query('UPDATE usuarios SET activo = true WHERE usuario_id = $1', [userId]);
      res.json({ ok: true, message: 'Socio reactivado correctamente' });
    } catch (error) {
      console.error('Error en reactivar:', error);
      res.status(500).json({ error: 'Error al reactivar socio' });
    }
  }
};

module.exports = socioController;