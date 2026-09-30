const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { requireBodyOrEscalate } = require('./escalate');
const { enTransaccion } = require('./transaction');

async function listarInstructores() {
  const result = await pool.query(`
    SELECT
        i.instructor_id,
        -- TRIM quita espacios, NULLIF convierte string vacío en NULL
        COALESCE(
            NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno)), ''),
            NULLIF(TRIM(i.especialidad), ''),
            'Instructor sin nombre'
        ) as nombre,
        i.especialidad,
        i.activo,
        u.username as email,
        u.telefono,
        u.foto_perfil
    FROM instructores i
    LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
    WHERE (u.nombres IS NOT NULL OR i.especialidad IS NOT NULL)
    ORDER BY nombre
  `);
  return result.rows;
}

async function obtenerInstructor(id) {
  const result = await pool.query(
    `
    SELECT
        i.instructor_id,
        COALESCE(
            NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno)), ''),
            NULLIF(TRIM(i.especialidad), ''),
            'Información pendiente'
        ) as nombre,
        i.especialidad,
        i.activo,
        u.username as email,
        u.telefono,
        u.foto_perfil
    FROM instructores i
    LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
    WHERE i.instructor_id = $1
  `,
    [id]
  );
  if (result.rows.length === 0) {
    throw new ServiceError(404, { error: 'Instructor no encontrado' });
  }
  return result.rows[0];
}

/**
 * Crea el instructor; si llega email, lo vincula a ese usuario o crea uno
 * nuevo con rol instructor. Devuelve el instructor_id.
 */
async function crearInstructor(body) {
  requireBodyOrEscalate(body);
  const { nombre, especialidad, email } = body;

  return enTransaccion(async (client) => {
    let usuarioId = null;
    if (email) {
      const existe = await client.query('SELECT usuario_id FROM usuarios WHERE username = $1', [email]);
      if (existe.rows.length === 0) {
        const passwordDefault = 'instructor123';
        const rolResult = await client.query(`SELECT rol_id FROM roles WHERE nombre = 'instructor'`);
        const rolId = rolResult.rows[0].rol_id;
        const userResult = await client.query(
          `INSERT INTO usuarios (username, nombres, password_hash, rol_id, activo)
           VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, true) RETURNING usuario_id`,
          [email, nombre, passwordDefault, rolId]
        );
        usuarioId = userResult.rows[0].usuario_id;
      } else {
        usuarioId = existe.rows[0].usuario_id;
      }
    }
    const result = await client.query(
      `INSERT INTO instructores (especialidad, usuario_id, activo)
       VALUES ($1, $2, true) RETURNING instructor_id`,
      [especialidad || null, usuarioId]
    );
    return result.rows[0].instructor_id;
  });
}

async function actualizarInstructor(id, body) {
  requireBodyOrEscalate(body);
  const { especialidad, activo } = body;
  await pool.query(`UPDATE instructores SET especialidad = $1, activo = $2 WHERE instructor_id = $3`, [
    especialidad || null,
    activo,
    id
  ]);
}

async function eliminarInstructor(id) {
  await pool.query('DELETE FROM instructores WHERE instructor_id = $1', [id]);
}

module.exports = {
  listarInstructores,
  obtenerInstructor,
  crearInstructor,
  actualizarInstructor,
  eliminarInstructor
};
