const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { connectOrEscalate, escalate } = require('./escalate');

async function listarUsuarios() {
  const result = await pool.query(`
    SELECT
        u.usuario_id,
        u.username,
        u.username AS email,           -- alias para frontend
        u.nombres,
        u.apellido_paterno,
        u.apellido_materno,
        u.curp,
        u.telefono,
        u.activo,
        u.fecha_creacion,
        u.fecha_nacimiento,
        u.genero,
        u.direccion,
        r.nombre AS rol,
        u.rol_id
    FROM usuarios u
    LEFT JOIN roles r ON u.rol_id = r.rol_id
    ORDER BY u.usuario_id
  `);
  return result.rows;
}

async function obtenerUsuario(id) {
  const result = await pool.query(
    `
    SELECT
        u.usuario_id,
        u.username,
        u.username AS email,
        u.nombres,
        u.apellido_paterno,
        u.apellido_materno,
        u.curp,
        u.telefono,
        u.activo,
        u.fecha_nacimiento,
        u.genero,
        u.direccion,
        r.nombre AS rol,
        u.rol_id
    FROM usuarios u
    LEFT JOIN roles r ON u.rol_id = r.rol_id
    WHERE u.usuario_id = $1
  `,
    [id]
  );

  if (result.rows.length === 0) {
    throw new ServiceError(404, { error: 'Usuario no encontrado' });
  }
  return result.rows[0];
}

async function listarRoles() {
  const result = await pool.query("SELECT rol_id, nombre FROM roles WHERE nombre != 'socio' ORDER BY rol_id");
  return result.rows;
}

/**
 * Campos del body usados en alta y actualización. Se llama fuera del try del
 * controlador: sin body lanza TypeError y responde el errorHandler global, como
 * cuando el controlador original desestructuraba req.body antes del try.
 */
function camposUsuario(body) {
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
    rol_id,
    activo,
    password
  } = body;
  return {
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    email,
    telefono,
    curp,
    fechaNacimiento,
    genero,
    direccion,
    rol_id,
    activo,
    password
  };
}

/** Crea el usuario en una transacción. Devuelve { usuario_id, password }. */
/** Datos validados en la ruta (middleware/usuarioValidators). */
async function crearUsuario(datos) {
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
    rol_id,
    password
  } = datos;

  const client = await connectOrEscalate(pool);

  try {
    await client.query('BEGIN');

    const existe = await client.query('SELECT usuario_id FROM usuarios WHERE username = $1', [email]);
    if (existe.rows.length > 0) {
      throw new ServiceError(400, { error: 'El email ya está registrado' });
    }

    const existeCurp = await client.query('SELECT usuario_id FROM usuarios WHERE curp = $1', [curp]);
    if (existeCurp.rows.length > 0) {
      throw new ServiceError(400, { error: 'El CURP ya está registrado' });
    }

    const passwordFinal = password || 'empleado123';

    const result = await client.query(
      `INSERT INTO usuarios
      (username, nombres, apellido_paterno, apellido_materno, curp,
       fecha_nacimiento, genero, telefono, direccion, password_hash, rol_id, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, crypt($10, gen_salt('bf')), $11, true)
      RETURNING usuario_id`,
      [
        email,
        nombres,
        apellidoPaterno,
        apellidoMaterno || '',
        curp,
        fechaNacimiento || null,
        genero || null,
        telefono || '',
        direccion || '',
        passwordFinal,
        rol_id
      ]
    );

    await client.query('COMMIT');
    return { usuario_id: result.rows[0].usuario_id, password: passwordFinal };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Actualiza el usuario. Los errores de BD al revisar duplicados se escalan
 * (en el controlador original esas consultas estaban fuera del try).
 */
/** Datos validados en la ruta (middleware/usuarioValidators). */
async function actualizarUsuario(id, datos) {
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
    rol_id,
    activo,
    password
  } = datos;

  let existeEmail;
  let existeCurp;
  try {
    existeEmail = await pool.query('SELECT usuario_id FROM usuarios WHERE username = $1 AND usuario_id <> $2', [
      email,
      id
    ]);
    if (existeEmail.rows.length === 0) {
      existeCurp = await pool.query('SELECT usuario_id FROM usuarios WHERE curp = $1 AND usuario_id <> $2', [curp, id]);
    }
  } catch (error) {
    throw escalate(error);
  }

  if (existeEmail.rows.length > 0) {
    throw new ServiceError(400, { error: 'El email ya está registrado en otro usuario' });
  }
  if (existeCurp.rows.length > 0) {
    throw new ServiceError(400, { error: 'El CURP ya está registrado en otro usuario' });
  }

  if (password && password.trim() !== '') {
    await pool.query(
      `UPDATE usuarios
       SET nombres = $1,
           apellido_paterno = $2,
           apellido_materno = $3,
           username = $4,
           telefono = $5,
           curp = $6,
           fecha_nacimiento = $7,
           genero = $8,
           direccion = $9,
           rol_id = $10,
           activo = $11,
           password_hash = crypt($12, gen_salt('bf'))
       WHERE usuario_id = $13`,
      [
        nombres,
        apellidoPaterno,
        apellidoMaterno || '',
        email,
        telefono || '',
        curp,
        fechaNacimiento || null,
        genero || null,
        direccion || '',
        rol_id,
        activo,
        password,
        id
      ]
    );
  } else {
    await pool.query(
      `UPDATE usuarios
       SET nombres = $1,
           apellido_paterno = $2,
           apellido_materno = $3,
           username = $4,
           telefono = $5,
           curp = $6,
           fecha_nacimiento = $7,
           genero = $8,
           direccion = $9,
           rol_id = $10,
           activo = $11
       WHERE usuario_id = $12`,
      [
        nombres,
        apellidoPaterno,
        apellidoMaterno || '',
        email,
        telefono || '',
        curp,
        fechaNacimiento || null,
        genero || null,
        direccion || '',
        rol_id,
        activo,
        id
      ]
    );
  }
}

async function cambiarActivo(id, activo) {
  const sql = activo
    ? 'UPDATE usuarios SET activo = true WHERE usuario_id = $1'
    : 'UPDATE usuarios SET activo = false WHERE usuario_id = $1';
  await pool.query(sql, [id]);
}

async function eliminarPermanente(id) {
  await pool.query('DELETE FROM usuarios WHERE usuario_id = $1', [id]);
}

async function obtenerPerfil(usuarioId) {
  const result = await pool.query(
    `SELECT u.usuario_id, u.username, u.nombres, u.apellido_paterno,
            u.apellido_materno, u.telefono, u.fecha_nacimiento,
            u.genero, u.direccion, u.foto_perfil,
            r.nombre as rol
     FROM usuarios u
     JOIN roles r ON u.rol_id = r.rol_id
     WHERE u.usuario_id = $1`,
    [usuarioId]
  );
  if (result.rowCount === 0) throw new ServiceError(404, { error: 'Usuario no encontrado' });
  return result.rows[0];
}

/** Guarda la imagen como data URL base64. Devuelve la foto guardada. */
async function actualizarFotoPerfil(usuarioId, file) {
  const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const result = await pool.query(
    `UPDATE usuarios SET foto_perfil = $1 WHERE usuario_id = $2
     RETURNING usuario_id, foto_perfil`,
    [base64, usuarioId]
  );

  if (result.rowCount === 0) throw new ServiceError(404, { error: 'Usuario no encontrado' });
  return result.rows[0].foto_perfil;
}

module.exports = {
  camposUsuario,
  listarUsuarios,
  obtenerUsuario,
  listarRoles,
  crearUsuario,
  actualizarUsuario,
  cambiarActivo,
  eliminarPermanente,
  obtenerPerfil,
  actualizarFotoPerfil
};
