const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { escalate, requireBodyOrEscalate } = require('./escalate');
const { enTransaccion } = require('./transaction');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');

const LUDOTECA_TIME_ZONE = 'America/Mexico_City';
const LIMITE_MINUTOS = 120;
const AFORO_MAXIMO = 15;

const RETURNING_ENTRADA = `
         RETURNING
           registro_id,
           socio_padre_id,
           nombre_hijo,
           fecha_nacimiento,
           hora_entrada,
           TO_CHAR(hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
           observaciones`;

const RETURNING_ENTRADA_QR = `
       RETURNING
         registro_id,
         nombre_hijo,
         hora_entrada,
         TO_CHAR(hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
         observaciones`;

// ── Validaciones ─────────────────────────────────────────────────────────────

function edadEnAnios(nacimiento) {
  return (new Date() - nacimiento) / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Valida nombre (string no vacío), formato de fecha y edad 3–7 años, en ese
 * orden. mensajeEdad(edad) permite el texto propio de cada flujo.
 */
function validarNino(nombreHijo, fechaNacimiento, mensajeEdad = () => 'El niño debe tener entre 3 y 7 años') {
  if (typeof nombreHijo !== 'string' || nombreHijo.trim() === '') {
    throw new ServiceError(400, { error: 'nombre_hijo no puede estar vacío' });
  }
  const nacimiento = new Date(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) {
    throw new ServiceError(400, { error: 'fecha_nacimiento debe tener formato YYYY-MM-DD' });
  }
  const edad = edadEnAnios(nacimiento);
  if (edad < 3 || edad > 7) {
    throw new ServiceError(400, { error: mensajeEdad(edad) });
  }
}

function registroIdValido(valor) {
  const registroId = Number(valor);
  if (!Number.isInteger(registroId) || registroId <= 0) {
    throw new ServiceError(400, { error: 'registro_id debe ser un entero válido' });
  }
  return registroId;
}

async function insertarRegistro(
  socioPadreId,
  nombreHijo,
  fechaNacimiento,
  observaciones,
  returning = RETURNING_ENTRADA
) {
  const result = await pool.query(
    `INSERT INTO registro_ludoteca (socio_padre_id, nombre_hijo, fecha_nacimiento, hora_entrada, observaciones)
         VALUES ($1, $2, $3, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}', $4)${returning}`,
    [socioPadreId, nombreHijo.trim(), fechaNacimiento, String(observaciones || '').trim() || null]
  );
  return result.rows[0];
}

/**
 * Registra la hora de salida y, si la estancia supera 2 horas, crea la sanción
 * "Exceso de estancia". Devuelve { horaSalida, duracionMinutos, sancionGenerada }.
 */
async function cerrarRegistro(client, registroId, socioPadreId) {
  const { rows: updated } = await client.query(
    `UPDATE registro_ludoteca
         SET hora_salida = NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}'
         WHERE registro_id = $1
         RETURNING
           hora_salida,
           ROUND(EXTRACT(EPOCH FROM (hora_salida - hora_entrada)) / 60)::int AS duracion_minutos`,
    [registroId]
  );

  const duracionMinutos = Number(updated[0].duracion_minutos) || 0;
  let sancionGenerada = false;

  if (duracionMinutos > LIMITE_MINUTOS) {
    const exceso = duracionMinutos - LIMITE_MINUTOS;
    await client.query(
      `INSERT INTO sanciones (socio_id, origen, motivo, estado, registro_ludoteca_id)
           VALUES ($1, 'Ludoteca', $2, 'Activo', $3)`,
      [socioPadreId, `Exceso de estancia: ${exceso} min sobre el límite de 2 horas`, registroId]
    );
    sancionGenerada = true;
  }

  return { horaSalida: updated[0].hora_salida, duracionMinutos, sancionGenerada };
}

async function bloquearRegistro(client, registroId) {
  const { rows, rowCount } = await client.query(
    `SELECT registro_id, socio_padre_id, hora_entrada, hora_salida
         FROM registro_ludoteca
         WHERE registro_id = $1
         FOR UPDATE`,
    [registroId]
  );
  if (rowCount === 0) throw new ServiceError(404, { error: 'Registro no encontrado' });
  return rows[0];
}

function exigirSinSalida(registro) {
  if (registro.hora_salida !== null) {
    throw new ServiceError(409, { error: 'Este niño ya tiene salida registrada' });
  }
}

async function socioDelUsuario(usuarioId) {
  const result = await pool.query('SELECT socio_id FROM socios WHERE usuario_id = $1', [usuarioId]);
  return result.rowCount === 0 ? null : result.rows[0].socio_id;
}

// ── Consultas ────────────────────────────────────────────────────────────────

async function registrosActivos() {
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
  return result.rows;
}

/** Registros de los últimos `diasParam` días (7 si no es un entero positivo), máx. 100. */
async function historial(diasParam) {
  const dias = Number.parseInt(diasParam || '7', 10);
  const result = await pool.query(
    `
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
      `,
    [Number.isFinite(dias) && dias > 0 ? dias : 7]
  );
  return result.rows;
}

async function aforo() {
  const result = await pool.query('SELECT COUNT(*) AS activos FROM registro_ludoteca WHERE hora_salida IS NULL');
  return { activos: parseInt(result.rows[0].activos), maximo: AFORO_MAXIMO };
}

/** Últimos 10 registros del socio del usuario; [] si el usuario no es socio. */
async function misRegistros(usuarioId) {
  const socioPadreId = await socioDelUsuario(usuarioId);
  if (socioPadreId === null) return [];

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
  return result.rows;
}

// ── Entrada / salida por staff ───────────────────────────────────────────────

/**
 * Validaciones de la entrada registrada por staff (sin tocar la BD).
 * Devuelve el socioPadreId numérico.
 */
function validarEntradaStaff({ socio_padre_id, nombre_hijo, fecha_nacimiento }) {
  if (!socio_padre_id || !nombre_hijo || !fecha_nacimiento) {
    throw new ServiceError(400, { error: 'socio_padre_id, nombre_hijo y fecha_nacimiento son requeridos' });
  }
  validarNino(nombre_hijo, fecha_nacimiento);

  const socioPadreId = Number(socio_padre_id);
  if (!Number.isInteger(socioPadreId) || socioPadreId <= 0) {
    throw new ServiceError(400, { error: 'socio_padre_id debe ser un entero válido' });
  }
  return socioPadreId;
}

async function registrarEntradaStaff(socioPadreId, { nombre_hijo, fecha_nacimiento, observaciones }) {
  const socio = await pool.query('SELECT socio_id FROM socios WHERE socio_id = $1', [socioPadreId]);
  if (socio.rowCount === 0) {
    throw new ServiceError(400, { error: 'El socio padre no existe' });
  }
  return insertarRegistro(socioPadreId, nombre_hijo, fecha_nacimiento, observaciones);
}

/** Salida registrada por staff. Devuelve { horaSalida, duracionMinutos, sancionGenerada }. */
async function registrarSalidaStaff(registroId) {
  return enTransaccion(async (client) => {
    const registro = await bloquearRegistro(client, registroId);
    exigirSinSalida(registro);
    return cerrarRegistro(client, registroId, registro.socio_padre_id);
  });
}

// ── Autoservicio del socio ───────────────────────────────────────────────────

function validarEntradaSocio({ nombre_hijo, fecha_nacimiento }) {
  if (!nombre_hijo || !fecha_nacimiento) {
    throw new ServiceError(400, { error: 'nombre_hijo y fecha_nacimiento son requeridos' });
  }
  validarNino(nombre_hijo, fecha_nacimiento);
}

async function registrarEntradaSocio(usuarioId, { nombre_hijo, fecha_nacimiento, observaciones }) {
  const socioPadreId = await socioDelUsuario(usuarioId);
  if (socioPadreId === null) {
    throw new ServiceError(403, { error: 'Solo los socios pueden registrar entradas' });
  }

  const activo = await pool.query(
    `SELECT registro_id FROM registro_ludoteca
         WHERE socio_padre_id = $1 AND LOWER(nombre_hijo) = LOWER($2) AND hora_salida IS NULL`,
    [socioPadreId, nombre_hijo.trim()]
  );
  if (activo.rowCount > 0) {
    throw new ServiceError(409, { error: 'Este niño ya tiene una entrada activa en la ludoteca' });
  }

  return insertarRegistro(socioPadreId, nombre_hijo, fecha_nacimiento, observaciones);
}

/**
 * Salida registrada por el propio socio. La lectura del usuario y la búsqueda
 * del socio ocurrían fuera del try en el original: sus errores se escalan.
 */
async function registrarSalidaSocio(registroIdParam, user) {
  const registroId = registroIdValido(registroIdParam);

  let socioPadreId;
  try {
    socioPadreId = await socioDelUsuario(user.usuario_id);
  } catch (error) {
    throw escalate(error);
  }
  if (socioPadreId === null) {
    throw new ServiceError(403, { error: 'Solo los socios pueden registrar salidas' });
  }

  const { duracionMinutos, sancionGenerada } = await enTransaccion(async (client) => {
    const registro = await bloquearRegistro(client, registroId);
    if (registro.socio_padre_id !== socioPadreId) {
      throw new ServiceError(403, { error: 'No tienes permiso para registrar esta salida' });
    }
    exigirSinSalida(registro);
    return cerrarRegistro(client, registroId, socioPadreId);
  });

  return { registroId, duracionMinutos, sancionGenerada };
}

// ── Acceso por QR ────────────────────────────────────────────────────────────

/**
 * Valida el QR firmado y el socio. Errores de firma → 400/statusCode del
 * helper. Las consultas ocurrían fuera del try: sus errores se escalan.
 * Devuelve { socioPadreId, registroActivo | null }.
 */
async function prepararAccesoQr(codigoQr) {
  if (!codigoQr) throw new ServiceError(400, { error: 'codigo_qr es requerido' });

  let payload;
  try {
    payload = validarQrFirmado(codigoQr);
  } catch (err) {
    throw new ServiceError(err.statusCode || 400, { error: err.message });
  }

  if (payload.type !== 'socio') {
    throw new ServiceError(400, { error: 'Solo socios pueden registrar niños en ludoteca' });
  }

  const socioPadreId = Number(payload.socio_id);
  if (!Number.isInteger(socioPadreId) || socioPadreId <= 0) {
    throw new ServiceError(400, { error: 'QR inválido: socio_id no válido' });
  }

  let socioResult;
  let registroActivo;
  try {
    socioResult = await pool.query('SELECT socio_id, activo FROM socios WHERE socio_id = $1', [socioPadreId]);
    if (socioResult.rowCount > 0 && socioResult.rows[0].activo) {
      registroActivo = await pool.query(
        `SELECT registro_id, nombre_hijo, hora_entrada
     FROM registro_ludoteca
     WHERE socio_padre_id = $1 AND hora_salida IS NULL
     ORDER BY hora_entrada DESC
     LIMIT 1`,
        [socioPadreId]
      );
    }
  } catch (error) {
    throw escalate(error);
  }

  if (socioResult.rowCount === 0) throw new ServiceError(404, { error: 'Socio no encontrado' });
  if (!socioResult.rows[0].activo) throw new ServiceError(403, { error: 'El socio no está activo' });

  return { socioPadreId, registroActivo: registroActivo.rowCount > 0 ? registroActivo.rows[0] : null };
}

async function salidaPorQr(socioPadreId, registro) {
  return enTransaccion((client) => cerrarRegistro(client, registro.registro_id, socioPadreId));
}

function validarEntradaQr(nombreHijo, fechaNacimiento) {
  validarNino(
    nombreHijo,
    fechaNacimiento,
    (edad) => `El niño debe tener entre 3 y 7 años (edad detectada: ${Math.floor(edad)} años)`
  );
}

/** Entrada por QR. Devuelve { registro, horaLimite } (límite = entrada + 2 h). */
async function entradaPorQr(socioPadreId, { nombre_hijo, fecha_nacimiento, observaciones }) {
  const registro = await insertarRegistro(
    socioPadreId,
    nombre_hijo,
    fecha_nacimiento,
    observaciones,
    RETURNING_ENTRADA_QR
  );
  const horaEntrada = new Date(registro.hora_entrada);
  const horaLimite = new Date(horaEntrada.getTime() + 2 * 60 * 60 * 1000);
  return { registro, horaLimite: horaLimite.toISOString() };
}

// ── Variante de recepción (/api/recepcion/ludoteca) ──────────────────────────
// Flujo heredado más simple: sin validar edad ni generar sanciones.

async function activosRecepcion() {
  const result = await pool.query(`
                SELECT
                    rl.registro_id,
                    rl.nombre_hijo,
                    rl.fecha_nacimiento,
                    rl.hora_entrada,
                    rl.hora_salida,
                    rl.observaciones,
                    TO_CHAR(rl.hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
                    u.nombres || ' ' || u.apellido_paterno as tutor_nombre,
                    GREATEST(FLOOR(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - rl.hora_entrada)))::int, 0) AS segundos_transcurridos,
                    GREATEST(FLOOR(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - rl.hora_entrada)) / 60)::int, 0) AS minutos_transcurridos,
                    CASE WHEN rl.hora_salida IS NULL THEN 'Activo' ELSE 'Finalizado' END as estado
                FROM registro_ludoteca rl
                JOIN socios s ON rl.socio_padre_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                WHERE rl.hora_salida IS NULL ORDER BY rl.hora_entrada
            `);
  return result.rows;
}

/** Devuelve el registro_id creado. */
async function entradaRecepcion(body) {
  requireBodyOrEscalate(body);
  const { socioId, nombreHijo, fechaNacimiento, observaciones } = body;
  const result = await pool.query(
    `INSERT INTO registro_ludoteca (
                    socio_padre_id,
                    nombre_hijo,
                    fecha_nacimiento,
                    hora_entrada,
                    observaciones
                )
                VALUES ($1, $2, $3, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}', $4)
                RETURNING registro_id`,
    [socioId, nombreHijo, fechaNacimiento, String(observaciones || '').trim() || null]
  );
  return result.rows[0].registro_id;
}

async function salidaRecepcion(id) {
  const result = await pool.query(
    `UPDATE registro_ludoteca
                 SET hora_salida = NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}'
                 WHERE registro_id = $1 AND hora_salida IS NULL
                 RETURNING registro_id`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new ServiceError(404, { error: 'Registro no encontrado o ya finalizado' });
  }
}

module.exports = {
  activosRecepcion,
  entradaRecepcion,
  salidaRecepcion,
  registrosActivos,
  historial,
  aforo,
  misRegistros,
  registroIdValido,
  validarEntradaStaff,
  registrarEntradaStaff,
  registrarSalidaStaff,
  validarEntradaSocio,
  registrarEntradaSocio,
  registrarSalidaSocio,
  prepararAccesoQr,
  salidaPorQr,
  validarEntradaQr,
  entradaPorQr
};
