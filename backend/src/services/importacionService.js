const bcrypt = require('bcryptjs');
const ServiceError = require('./serviceError');
const { isEscalated } = require('./escalate');
const { enTransaccion } = require('./transaction');
const { leerHojaExcel } = require('../helpers/excel.helper');
const { HOJA_DATOS } = require('./importacion/columnasSocios');
const { crearTemplateSocios } = require('./importacion/templateSocios');
const { validarEstructura, validarRegistros } = require('./importacion/validacionSocios');

// ── SCRUM-135: sincronización con la BD ──────────────────────────────────────

/**
 * Inserta usuario (contraseña temporal Club<acción><año>) y socio en la acción.
 * contarMiembros(client) devuelve cuántos miembros no titulares hay para
 * numerar al nuevo (SOC-<acción>-M<n>); el titular es SOC-<acción>-T.
 */
async function crearUsuarioYSocio(client, d, accionId, rolSocioId, contarMiembros) {
  const passwordTemporal = `Club${d.codigoAccion}${new Date().getFullYear()}`;
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  const nuevoUsuario = await client.query(
    `INSERT INTO usuarios (username, password_hash, rol_id,
      nombres, apellido_paterno, apellido_materno, genero, fecha_nacimiento,
      telefono, direccion, curp)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
     RETURNING usuario_id`,
    [
      d.email,
      passwordHash,
      rolSocioId,
      d.nombres,
      d.apellido_paterno,
      d.apellido_materno,
      d.genero,
      d.fechaNac,
      d.telefono,
      d.domicilio
    ]
  );
  const usuarioId = nuevoUsuario.rows[0].usuario_id;

  const idx = (await contarMiembros(client)) + 1;
  const numeroSocio = d.esTitular ? `SOC-${d.codigoAccion}-T` : `SOC-${d.codigoAccion}-M${idx}`;

  await client.query(
    `INSERT INTO socios (usuario_id, accion_id, tipo, modalidad,
      es_titular, numero_socio, tel_emergencia, parentesco, activo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)`,
    [usuarioId, accionId, d.tipo, d.modalidad, d.esTitular, numeroSocio, d.telEmerg, d.parentesco]
  );
}

/** Procesa una fila válida. Devuelve 'nuevo' o 'actualizado'. */
async function sincronizarFila(client, d, rolSocioId) {
  const accionRes = await client.query('SELECT accion_id FROM acciones_familiares WHERE codigo_accion = $1', [
    d.codigoAccion
  ]);

  if (accionRes.rowCount > 0) {
    const accionId = accionRes.rows[0].accion_id;
    const usuarioRes = await client.query(
      'SELECT u.usuario_id FROM usuarios u JOIN socios s ON s.usuario_id = u.usuario_id WHERE u.username = $1 AND s.accion_id = $2 LIMIT 1',
      [d.email, accionId]
    );

    if (usuarioRes.rowCount > 0) {
      // Usuario ya existe en la acción → actualizar datos
      const usuarioId = usuarioRes.rows[0].usuario_id;
      await client.query(
        `UPDATE usuarios SET nombres=$1, apellido_paterno=$2, apellido_materno=$3,
         genero=$4, fecha_nacimiento=$5, telefono=$6, direccion=$7
         WHERE usuario_id=$8`,
        [d.nombres, d.apellido_paterno, d.apellido_materno, d.genero, d.fechaNac, d.telefono, d.domicilio, usuarioId]
      );
      await client.query(
        `UPDATE socios SET tipo=$1, modalidad=$2, es_titular=$3, tel_emergencia=$4, parentesco=$5
         WHERE usuario_id=$6`,
        [d.tipo, d.modalidad, d.esTitular, d.telEmerg, d.parentesco, usuarioId]
      );
      return 'actualizado';
    }

    // Acción existe pero este miembro es nuevo
    await crearUsuarioYSocio(client, d, accionId, rolSocioId, async (c) => {
      const countRes = await c.query(
        `SELECT COUNT(*) FROM socios s
         WHERE s.accion_id = $1 AND s.es_titular = FALSE`,
        [accionId]
      );
      return Number(countRes.rows[0].count);
    });
    return 'nuevo';
  }

  // Acción nueva (si otra fila la creó antes, ON CONFLICT la reutiliza)
  const nuevaAccion = await client.query(
    'INSERT INTO acciones_familiares (codigo_accion) VALUES ($1) ON CONFLICT (codigo_accion) DO NOTHING RETURNING accion_id',
    [d.codigoAccion]
  );
  const accionId =
    nuevaAccion.rowCount > 0
      ? nuevaAccion.rows[0].accion_id
      : (await client.query('SELECT accion_id FROM acciones_familiares WHERE codigo_accion=$1', [d.codigoAccion]))
          .rows[0].accion_id;

  await crearUsuarioYSocio(client, d, accionId, rolSocioId, async (c) => {
    const countRes = await c.query(
      `SELECT COUNT(*) FROM socios s
       JOIN acciones_familiares af ON s.accion_id = af.accion_id
       WHERE af.codigo_accion = $1 AND s.es_titular = FALSE`,
      [d.codigoAccion]
    );
    return Number(countRes.rows[0].count);
  });
  return 'nuevo';
}

// ── Importación: lectura → validación → transacción todo-o-nada ──────────────

/** Mensajes legibles para los códigos de error de PostgreSQL más comunes. */
const MOTIVOS_BD = {
  23505: 'Ya existe en la base de datos (email o número de socio duplicado)',
  23502: 'Falta un dato obligatorio',
  22001: 'Un texto excede la longitud permitida',
  '22P02': 'Valor no válido para la base de datos',
  22007: 'Fecha no válida',
  22008: 'Fecha fuera de rango'
};

function errorDeBd(fila, err) {
  console.error(`Importación de socios, fila ${fila}:`, err.message);
  const esUsername = err.code === '23505' && /username/.test(`${err.constraint} ${err.detail}`);
  const motivo = esUsername
    ? 'El email ya está registrado en otra acción'
    : MOTIVOS_BD[err.code] || 'No se pudo guardar el registro';
  return { fila, columna: null, valor: '', motivo };
}

/** Rechazo 422: el archivo tiene errores y no se guardó ningún registro. */
function rechazarImportacion(totalProcesados, errores) {
  return new ServiceError(422, {
    error: `Se encontraron ${errores.length} error(es); no se importó ningún registro`,
    total_procesados: totalProcesados,
    nuevos: 0,
    actualizados: 0,
    errores
  });
}

async function leerArchivo(buffer) {
  try {
    return await leerHojaExcel(buffer, HOJA_DATOS);
  } catch {
    throw new ServiceError(400, { error: 'No se pudo leer el archivo Excel' });
  }
}

/**
 * Importa el Excel de socios. Todo o nada:
 *  - 400 si el archivo no se puede leer o le faltan columnas obligatorias;
 *  - 422 con el reporte de filas si alguna fila es inválida (no se toca la BD)
 *    o si alguna falla al guardarse (ROLLBACK de toda la importación);
 *  - 500 'Error en la transacción: …' ante un fallo general de la transacción.
 * Cada fila usa un savepoint solo para seguir revisando las demás y reportarlas juntas.
 * Devuelve { total_procesados, nuevos, actualizados, errores: [] }.
 */
async function importarSocios(buffer) {
  const estructura = validarEstructura(await leerArchivo(buffer));
  if (estructura.error) throw new ServiceError(400, estructura.error);

  const total = estructura.filas.length;
  const { registros, errores } = validarRegistros(estructura.filas);
  if (errores.length > 0) throw rechazarImportacion(total, errores);

  try {
    return await enTransaccion(async (client) => {
      const rolRes = await client.query("SELECT rol_id FROM roles WHERE nombre = 'socio' LIMIT 1");
      if (rolRes.rowCount === 0) throw new Error('Rol socio no encontrado en la BD');
      const rolSocioId = rolRes.rows[0].rol_id;

      const erroresBd = [];
      let nuevos = 0;
      let actualizados = 0;
      for (const { numFila, datos } of registros) {
        try {
          await client.query('SAVEPOINT sp_fila');
          const resultado = await sincronizarFila(client, datos, rolSocioId);
          if (resultado === 'nuevo') nuevos++;
          else actualizados++;
          await client.query('RELEASE SAVEPOINT sp_fila');
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT sp_fila');
          erroresBd.push(errorDeBd(numFila, err));
        }
      }

      // Lanzar dentro de la transacción provoca el ROLLBACK de todo lo insertado.
      if (erroresBd.length > 0) throw rechazarImportacion(total, erroresBd);
      return { total_procesados: total, nuevos, actualizados, errores: [] };
    });
  } catch (err) {
    if (err instanceof ServiceError || isEscalated(err)) throw err;
    throw new ServiceError(500, { error: 'Error en la transacción: ' + err.message });
  }
}

module.exports = { crearTemplateSocios, importarSocios };
