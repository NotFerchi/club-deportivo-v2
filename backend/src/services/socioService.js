const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const ServiceError = require('./serviceError');
const { requireBodyOrEscalate } = require('./escalate');
const { enTransaccion } = require('./transaction');
const { validarCURP } = require('../utils/validacionCurp');

// Lock advisory fijo y arbitrario para serializar la asignación de
// numero_socio entre crearSocio y crearSocioRecepcion (bug #13/#21: el
// siguiente numero_socio se calculaba con MAX+1 sin ningún bloqueo, así que
// dos altas concurrentes podían calcular el mismo número antes de que
// cualquiera insertara, generando numero_socio duplicados).
const NUMERO_SOCIO_LOCK_KEY = 918273645;
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

function lanzarSiInvalido(body, editing) {
  const validationErrors = validateSocioPayload(body, editing);
  if (validationErrors.length > 0) {
    throw new ServiceError(400, { error: validationErrors[0], errors: validationErrors });
  }
}

async function listarSocios() {
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
  return result.rows;
}

async function obtenerSocio(id) {
  const result = await pool.query(
    `
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
  `,
    [id]
  );

  if (result.rows.length === 0) {
    throw new ServiceError(404, { error: 'Socio no encontrado' });
  }
  return result.rows[0];
}

/** Crea usuario + socio. Devuelve { socioId, numeroSocio }. */
async function crearSocio(body) {
  requireBodyOrEscalate(body);
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
  } = body;

  return enTransaccion(async (client) => {
    lanzarSiInvalido(body, false);

    const existeUsuario = await client.query('SELECT usuario_id FROM usuarios WHERE username = $1 OR curp = $2', [
      email,
      String(curp || '').toUpperCase()
    ]);
    if (existeUsuario.rows.length > 0) {
      throw new ServiceError(400, { error: 'Email o CURP ya registrado' });
    }

    // Obtener rol_id de 'socio'
    const rolResult = await client.query('SELECT rol_id FROM roles WHERE nombre = $1', ['socio']);
    if (rolResult.rows.length === 0) {
      throw new Error('Rol "socio" no encontrado en la base de datos');
    }
    const rolId = rolResult.rows[0].rol_id;

    const passwordHash = bcrypt.hashSync(password, 10);
    let numeroSocioFinal = numero_socio;
    if (!numeroSocioFinal) {
      await client.query('SELECT pg_advisory_xact_lock($1)', [NUMERO_SOCIO_LOCK_KEY]);
      const numeroResult = await client.query(`
        SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(numero_socio, '\\D', '', 'g'), '') AS INTEGER)), 0) + 1 as siguiente
        FROM socios
      `);
      numeroSocioFinal = `SOC-${String(numeroResult.rows[0].siguiente).padStart(4, '0')}`;
    }

    const userResult = await client.query(
      `
      INSERT INTO usuarios
        (rol_id, username, nombres, apellido_paterno, apellido_materno,
         curp, fecha_nacimiento, genero, telefono, direccion, password_hash, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING usuario_id
    `,
      [
        rolId,
        email,
        nombres,
        apellidoPaterno,
        apellidoMaterno,
        String(curp || '').toUpperCase(),
        fechaNacimiento || null,
        genero || null,
        telefono || '',
        direccion,
        passwordHash
      ]
    );
    const usuarioId = userResult.rows[0].usuario_id;

    const socioResult = await client.query(
      `
      INSERT INTO socios
        (usuario_id, tipo, modalidad, es_titular, numero_socio, nombre_emergencia, tel_emergencia, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING socio_id
    `,
      [
        usuarioId,
        normalizeTipoSocio(tipo, tipo_socio),
        normalizeModalidad(modalidad),
        es_titular || false,
        numeroSocioFinal,
        nombre_emergencia || null,
        tel_emergencia || null
      ]
    );

    return { socioId: socioResult.rows[0].socio_id, numeroSocio: numeroSocioFinal };
  });
}

async function actualizarSocio(id, body) {
  requireBodyOrEscalate(body);
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
  } = body;

  await enTransaccion(async (client) => {
    lanzarSiInvalido(body, true);

    const socioRes = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
    if (socioRes.rows.length === 0) {
      // Se conserva: un socio inexistente responde 500 con este mensaje.
      throw new Error('Socio no encontrado');
    }
    const userId = socioRes.rows[0].usuario_id;

    const duplicate = await client.query(
      'SELECT usuario_id FROM usuarios WHERE (username = $1 OR curp = $2) AND usuario_id <> $3',
      [email, String(curp || '').toUpperCase(), userId]
    );
    if (duplicate.rows.length > 0) {
      throw new ServiceError(400, { error: 'Email o CURP ya registrado en otro usuario' });
    }

    if (password?.trim()) {
      await client.query(
        `
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
      `,
        [
          nombres,
          apellidoPaterno,
          apellidoMaterno || '',
          email,
          telefono || '',
          String(curp || '').toUpperCase(),
          fechaNacimiento || null,
          genero || null,
          direccion,
          activo,
          bcrypt.hashSync(password, 10),
          userId
        ]
      );
    } else {
      await client.query(
        `
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
      `,
        [
          nombres,
          apellidoPaterno,
          apellidoMaterno || '',
          email,
          telefono || '',
          String(curp || '').toUpperCase(),
          fechaNacimiento || null,
          genero || null,
          direccion,
          activo,
          userId
        ]
      );
    }

    const tipoFinal = tipo || tipo_socio ? normalizeTipoSocio(tipo, tipo_socio) : null;
    const modalidadFinal = modalidad ? normalizeModalidad(modalidad) : null;

    await client.query(
      `
      UPDATE socios SET
        tipo = COALESCE($1, tipo),
        modalidad = COALESCE($2, modalidad),
        es_titular = COALESCE($3, es_titular),
        numero_socio = COALESCE($4, numero_socio),
        nombre_emergencia = COALESCE($5, nombre_emergencia),
        tel_emergencia = COALESCE($6, tel_emergencia),
        activo = COALESCE($7, activo)
      WHERE socio_id = $8
    `,
      [tipoFinal, modalidadFinal, es_titular, numero_socio, nombre_emergencia, tel_emergencia, activo, id]
    );
  });
}

/** Activa o inactiva el socio y su usuario. 404 si no existe. */
async function cambiarActivoSocio(id, activo) {
  await enTransaccion(async (client) => {
    const result = await client.query(
      activo
        ? 'UPDATE socios SET activo = true WHERE socio_id = $1 RETURNING socio_id, usuario_id'
        : 'UPDATE socios SET activo = false WHERE socio_id = $1 RETURNING socio_id, usuario_id',
      [id]
    );
    if (result.rows.length === 0) {
      throw new ServiceError(404, { error: 'Socio no encontrado' });
    }
    if (result.rows[0].usuario_id) {
      await client.query(
        activo
          ? 'UPDATE usuarios SET activo = true WHERE usuario_id = $1'
          : 'UPDATE usuarios SET activo = false WHERE usuario_id = $1',
        [result.rows[0].usuario_id]
      );
    }
  });
}

async function eliminarSocioPermanente(id) {
  await enTransaccion(async (client) => {
    const socioRes = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
    if (socioRes.rows.length === 0) {
      // Se conserva: un socio inexistente responde 500 con este mensaje.
      throw new Error('Socio no existe');
    }
    const userId = socioRes.rows[0].usuario_id;

    await client.query('DELETE FROM socios WHERE socio_id = $1', [id]);
    await client.query('DELETE FROM usuarios WHERE usuario_id = $1', [userId]);
  });
}

// ── Variante de recepción (/api/recepcion/socios) ─────────────────────────────
// Flujo heredado distinto del de arriba: sin validaciones de payload, contraseña
// fija 'socio123' y numeración por SUBSTRING (ver fuera de alcance). ROLLBACK
// silencioso como en el controlador original.

/** Alta de socio desde recepción. Devuelve la contraseña asignada. */
async function crearSocioRecepcion(body) {
  requireBodyOrEscalate(body);
  const { nombres, apellidoPaterno, apellidoMaterno, email, telefono, curp, tipo, modalidad } = body;

  return enTransaccion(
    async (client) => {
      const existe = await client.query('SELECT usuario_id FROM usuarios WHERE username = $1', [email]);
      if (existe.rows.length > 0) {
        throw new ServiceError(400, { error: 'El correo ya esta registrado' });
      }

      const passwordDefault = 'socio123';
      const rolResult = await client.query(`SELECT rol_id FROM roles WHERE nombre = 'socio'`);
      const rolId = rolResult.rows[0].rol_id;

      const userResult = await client.query(
        `INSERT INTO usuarios (
                    username,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    curp,
                    telefono,
                    password_hash,
                    rol_id,
                    activo
                )
                VALUES ($1, $2, $3, $4, $5, $6, crypt($7, gen_salt('bf')), $8, true)
                RETURNING usuario_id`,
        [email, nombres, apellidoPaterno, apellidoMaterno || '', curp, telefono, passwordDefault, rolId]
      );
      const usuarioId = userResult.rows[0].usuario_id;

      await client.query('SELECT pg_advisory_xact_lock($1)', [NUMERO_SOCIO_LOCK_KEY]);
      const numSocioResult = await client.query(`
                SELECT COALESCE(MAX(CAST(SUBSTRING(numero_socio FROM 5) AS INTEGER)), 0) + 1
                FROM socios
            `);
      const numeroSocio = `SOC-${String(numSocioResult.rows[0].coalesce).padStart(4, '0')}`;

      await client.query(
        `INSERT INTO socios (
                    usuario_id,
                    tipo,
                    modalidad,
                    es_titular,
                    numero_socio,
                    activo
                )
                VALUES ($1, $2, $3, true, $4, true)`,
        [usuarioId, tipo || 'Rentista', modalidad || 'Individual', numeroSocio]
      );

      return passwordDefault;
    },
    { quietRollback: true }
  );
}

async function actualizarSocioRecepcion(id, body) {
  requireBodyOrEscalate(body);
  const { nombres, apellidoPaterno, apellidoMaterno, email, telefono, activo } = body;

  await enTransaccion(
    async (client) => {
      const socioResult = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
      if (socioResult.rows.length === 0) {
        throw new ServiceError(404, { error: 'Socio no encontrado' });
      }

      await client.query(
        `UPDATE usuarios
                 SET nombres = $1,
                     apellido_paterno = $2,
                     apellido_materno = $3,
                     username = $4,
                     telefono = $5,
                     activo = $6
                 WHERE usuario_id = $7`,
        [nombres, apellidoPaterno, apellidoMaterno, email, telefono, activo, socioResult.rows[0].usuario_id]
      );
    },
    { quietRollback: true }
  );
}

/** Inactiva socio y usuario (la ruta se llama "eliminar"). */
async function inactivarSocioRecepcion(id) {
  await enTransaccion(
    async (client) => {
      const socioResult = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
      if (socioResult.rows.length === 0) {
        throw new ServiceError(404, { error: 'Socio no encontrado' });
      }

      await client.query('UPDATE socios SET activo = false WHERE socio_id = $1', [id]);
      await client.query('UPDATE usuarios SET activo = false WHERE usuario_id = $1', [socioResult.rows[0].usuario_id]);
    },
    { quietRollback: true }
  );
}

module.exports = {
  listarSocios,
  obtenerSocio,
  crearSocio,
  actualizarSocio,
  cambiarActivoSocio,
  eliminarSocioPermanente,
  crearSocioRecepcion,
  actualizarSocioRecepcion,
  inactivarSocioRecepcion
};
