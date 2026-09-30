const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ServiceError = require('./serviceError');

/**
 * Verifica credenciales y firma el JWT (8h).
 * Devuelve { usuarioBD, token }; lanza ServiceError 401/403.
 * Los console.log se conservan tal cual del controlador original.
 */
async function autenticar(email, contrasena) {
  console.log(`\n--- INTENTO DE LOGIN ---`);
  console.log(`Buscando el correo: '${email}'`);

  const result = await pool.query(
    `SELECT u.usuario_id, u.username, u.password_hash, u.activo,
            u.nombres, u.apellido_paterno, u.foto_perfil,
            r.nombre AS rol
     FROM usuarios u
     JOIN roles r ON u.rol_id = r.rol_id
     WHERE u.username = $1`,
    [email]
  );

  console.log(`Usuarios encontrados en la BD: ${result.rows.length}`);

  if (result.rows.length === 0) {
    console.log('Falla: No se encontró el correo (o el rol_id está nulo y el JOIN lo ocultó)');
    throw new ServiceError(401, { error: 'Credenciales inválidas' });
  }

  const usuarioBD = result.rows[0];
  console.log(`Usuario extraído:`, { id: usuarioBD.usuario_id, email: usuarioBD.username, rol: usuarioBD.rol });

  const passwordValida = await bcrypt.compare(contrasena, usuarioBD.password_hash);
  console.log(`¿La contraseña coincide?: ${passwordValida}`);

  if (!passwordValida) {
    throw new ServiceError(401, { error: 'Credenciales inválidas' });
  }

  if (!usuarioBD.activo) {
    console.log('Falla: El usuario está inactivo');
    throw new ServiceError(403, { error: 'La cuenta está desactivada' });
  }

  const token = jwt.sign(
    { usuario_id: usuarioBD.usuario_id, email: usuarioBD.username, rol: usuarioBD.rol },
    process.env.JWT_SECRET || 'secreto_super_seguro',
    { expiresIn: '8h' }
  );

  console.log('¡Login Exitoso!');
  return { usuarioBD, token };
}

/** Para rol socio: { socio_id, numero_socio } si tiene registro de socio; si no, {}. */
async function datosExtraSocio(usuarioBD) {
  if (usuarioBD.rol !== 'socio') return {};

  const socioResult = await pool.query('SELECT socio_id, numero_socio FROM socios WHERE usuario_id = $1', [
    usuarioBD.usuario_id
  ]);
  if (socioResult.rows.length === 0) return {};

  return {
    socio_id: socioResult.rows[0].socio_id,
    numero_socio: socioResult.rows[0].numero_socio
  };
}

function usuarioRespuesta(usuarioBD, extraData) {
  return {
    id: usuarioBD.usuario_id,
    email: usuarioBD.username,
    rol: usuarioBD.rol,
    nombres: usuarioBD.nombres,
    apellido_paterno: usuarioBD.apellido_paterno,
    foto_perfil: usuarioBD.foto_perfil || null,
    ...extraData
  };
}

module.exports = { autenticar, datosExtraSocio, usuarioRespuesta };
