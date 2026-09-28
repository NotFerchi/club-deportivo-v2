/**
 * Alta, salida y edición de visitas / pases de día (tabla `pases`, con
 * respaldo a `visitas` legacy cuando `pases` no existe).
 */
const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { connectOrEscalate, requireBodyOrEscalate } = require('./escalate');
const { rollbackQuietly } = require('./transaction');
const { isMissingPasesTable, getVisitasLegacyColumns } = require('./paseService');
const { generarQrPase, generarQrVisitaLegacy } = require('./qrService');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

/** Normaliza y valida el body de alta (acepta el formato legacy sin tipo_pase). */
function normalizarVisita(body, usuarioId) {
  const {
    tipo_pase,
    socio_id,
    socio_anfitrion_id,
    nombre_completo,
    nombreCompleto,
    nombre,
    apellido,
    apellidos,
    correo,
    telefono,
    identificacion,
    tipoVisita,
    mayor_16,
    observaciones,
    motivo
  } = body;

  const socioIdEntrada = socio_id || socio_anfitrion_id || null;
  const legacyPayload = !Object.prototype.hasOwnProperty.call(body, 'tipo_pase');

  const tipoPase = String(tipo_pase || tipoVisita || (socioIdEntrada ? 'visita' : 'dia'))
    .trim()
    .toLowerCase();

  const nombreNormalizado = String(
    nombre_completo || nombreCompleto || [nombre, apellido || apellidos].filter(Boolean).join(' ')
  ).trim();

  const telefonoNormalizado = normalizeDigits(telefono);
  const identificacionNormalizada = String(identificacion || '').trim();
  const observacionesNormalizadas = String(observaciones || motivo || '').trim();

  if (!['visita', 'dia'].includes(tipoPase)) {
    throw new ServiceError(400, { error: 'Tipo de pase invalido' });
  }
  if (!nombreNormalizado) {
    throw new ServiceError(400, { error: 'Nombre completo es requerido' });
  }
  if (!legacyPayload && (!telefonoNormalizado || telefonoNormalizado.length < 10)) {
    throw new ServiceError(400, { error: 'Telefono valido es requerido' });
  }
  if (!legacyPayload && typeof mayor_16 !== 'boolean') {
    throw new ServiceError(400, { error: 'Debe indicar si es mayor de 16 anos' });
  }

  return {
    socioIdEntrada,
    legacyPayload,
    tipoPase,
    tipoVisita,
    nombre: nombreNormalizado,
    correo: String(correo || '').trim(),
    identificacion: identificacionNormalizada,
    telefonoFinal: telefonoNormalizado || normalizeDigits(identificacionNormalizada).slice(0, 20) || '0000000000',
    mayor16: typeof mayor_16 === 'boolean' ? mayor_16 : true,
    observaciones: observacionesNormalizadas || null,
    observacionesLegacy:
      [identificacionNormalizada ? `Identificacion: ${identificacionNormalizada}` : '', observacionesNormalizadas]
        .filter(Boolean)
        .join(' | ') || null,
    usuarioCreador: usuarioId || null
  };
}

/** Alta en la tabla legacy `visitas` con las columnas opcionales que existan. */
async function crearVisitaLegacy(v, socioIdFinal) {
  const legacyColumns = await getVisitasLegacyColumns();
  const insertColumns = ['nombre_completo', 'identificacion_tipo', 'fecha_visita', 'hora_entrada', 'vigente'];
  const placeholders = ['$1', '$2', 'CURRENT_DATE', 'NOW()', 'true'];
  const values = [v.nombre, v.identificacion || v.tipoVisita || v.tipoPase];

  const agregar = (presente, columna, valor) => {
    if (!presente) return;
    values.push(valor);
    insertColumns.push(columna);
    placeholders.push(`$${values.length}`);
  };
  agregar(legacyColumns.socioId, 'socio_id', socioIdFinal || null);
  agregar(legacyColumns.correo, 'correo', v.correo || null);
  agregar(legacyColumns.telefono, 'telefono', v.telefonoFinal);
  agregar(legacyColumns.mayor16, 'mayor_16', v.mayor16);
  agregar(legacyColumns.observaciones, 'observaciones', v.observacionesLegacy);

  const legacyResult = await pool.query(
    `INSERT INTO visitas (${insertColumns.join(', ')})
                         VALUES (${placeholders.join(', ')})
                         RETURNING visita_id`,
    values
  );

  const visitaId = legacyResult.rows[0].visita_id;
  const qr = await generarQrVisitaLegacy(visitaId);
  return { legacy: true, id: visitaId, qr };
}

/**
 * Registra el pase y genera su QR. Devuelve { legacy, id, qr, tipoPase }
 * (legacy = true si se guardó en `visitas`). Los errores de validación
 * posteriores a BEGIN hacen ROLLBACK explícito antes de lanzar.
 */
async function crearVisita(body, usuarioId) {
  requireBodyOrEscalate(body);
  const v = normalizarVisita(body, usuarioId);

  const client = await connectOrEscalate(pool);
  let socioIdFinal = null;

  try {
    await client.query('BEGIN');

    if (v.tipoPase === 'visita') {
      if (!v.socioIdEntrada && !v.legacyPayload) {
        await client.query('ROLLBACK');
        throw new ServiceError(400, { error: 'Debe seleccionar un socio activo para una visita' });
      }

      if (v.socioIdEntrada) {
        const socioResult = await client.query(
          `
                        SELECT s.socio_id
                        FROM socios s
                        WHERE s.socio_id = $1 AND s.activo = true
                    `,
          [v.socioIdEntrada]
        );

        if (socioResult.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new ServiceError(400, { error: 'El socio seleccionado no esta activo o no existe' });
        }

        socioIdFinal = v.socioIdEntrada;
      }
    }

    const result = await client.query(
      `
                INSERT INTO pases (
                    tipo_pase,
                    socio_id,
                    nombre_completo,
                    identificacion,
                    correo,
                    telefono,
                    mayor_16,
                    fecha_pase,
                    hora_entrada,
                    estado,
                    creado_por,
                    observaciones
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, NOW(), 'activo', $8, $9)
                RETURNING pase_id
            `,
      [
        v.tipoPase,
        socioIdFinal,
        v.nombre,
        v.identificacion || null,
        v.correo || null,
        v.telefonoFinal,
        v.mayor16,
        v.usuarioCreador,
        v.observaciones
      ]
    );
    const paseId = result.rows[0].pase_id;
    const qr = await generarQrPase(client, paseId);

    await client.query('COMMIT');
    return { legacy: false, id: paseId, qr, tipoPase: v.tipoPase };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    await rollbackQuietly(client);

    if (isMissingPasesTable(error)) {
      try {
        return await crearVisitaLegacy(v, socioIdFinal);
      } catch (fallbackError) {
        console.error(fallbackError);
        throw new ServiceError(500, { error: 'Error al registrar visita' });
      }
    }

    console.error(error);
    throw new ServiceError(500, { error: 'Error al registrar pase' });
  } finally {
    client.release();
  }
}

/** Marca la salida del pase (o visita legacy). Devuelve { legacy }. */
async function registrarSalida(id) {
  try {
    const result = await pool.query(
      `
                UPDATE pases
                SET hora_salida = NOW(), estado = 'finalizado'
                WHERE pase_id = $1 AND estado = 'activo'
                RETURNING pase_id
            `,
      [id]
    );

    if (result.rows.length === 0) {
      throw new ServiceError(404, { error: 'Pase no encontrado o ya finalizado' });
    }
    return { legacy: false };
  } catch (error) {
    if (error instanceof ServiceError) throw error;

    if (isMissingPasesTable(error)) {
      let result;
      try {
        result = await pool.query(
          `UPDATE visitas
                         SET hora_salida = NOW(), vigente = false
                         WHERE visita_id = $1 AND vigente = true
                         RETURNING visita_id`,
          [id]
        );
      } catch (fallbackError) {
        console.error(fallbackError);
        throw new ServiceError(500, { error: 'Error al registrar salida' });
      }

      if (result.rows.length === 0) {
        throw new ServiceError(404, { error: 'Visita no encontrada o ya finalizada' });
      }
      return { legacy: true };
    }

    console.error(error);
    throw new ServiceError(500, { error: 'Error al registrar salida' });
  }
}

/** Edición manual de un pase (o visita legacy). */
async function actualizarVisita(id, body) {
  requireBodyOrEscalate(body);
  const { nombre_completo, telefono, correo, identificacion, observaciones, tipo_pase, socio_id } = body;

  const client = await connectOrEscalate(pool);
  try {
    await client.query('BEGIN');

    const nombreNorm = String(nombre_completo || '').trim();
    if (!nombreNorm) {
      await client.query('ROLLBACK');
      throw new ServiceError(400, { error: 'El nombre es requerido' });
    }

    const tipoPaseNorm = tipo_pase ? String(tipo_pase).trim().toLowerCase() : null;
    if (tipoPaseNorm && !['visita', 'dia'].includes(tipoPaseNorm)) {
      await client.query('ROLLBACK');
      throw new ServiceError(400, { error: 'Tipo de pase inválido' });
    }

    let socioIdFinal = socio_id ? Number(socio_id) : null;
    if (tipoPaseNorm === 'dia') socioIdFinal = null;

    const telefonoNorm = normalizeDigits(telefono) || null;
    const correoNorm = String(correo || '').trim() || null;
    const identificacionNorm = String(identificacion || '').trim() || null;
    const observacionesNorm = String(observaciones || '').trim() || null;

    let updated = false;

    try {
      const result = await client.query(
        `UPDATE pases SET
                        nombre_completo = COALESCE($1, nombre_completo),
                        telefono = COALESCE($2, telefono),
                        correo = $3,
                        identificacion = $4,
                        observaciones = $5,
                        tipo_pase = COALESCE($6, tipo_pase),
                        socio_id = $7
                     WHERE pase_id = $8
                     RETURNING pase_id`,
        [nombreNorm, telefonoNorm, correoNorm, identificacionNorm, observacionesNorm, tipoPaseNorm, socioIdFinal, id]
      );
      updated = result.rows.length > 0;
    } catch (e) {
      if (!isMissingPasesTable(e)) throw e;
      // Nota: en PostgreSQL la transacción ya quedó abortada (ver fuera de alcance).
      const result = await client.query(
        `UPDATE visitas SET
                        nombre_completo = COALESCE($1, nombre_completo),
                        observaciones = $2
                     WHERE visita_id = $3
                     RETURNING visita_id`,
        [nombreNorm, observacionesNorm, id]
      );
      updated = result.rows.length > 0;
    }

    if (!updated) {
      await client.query('ROLLBACK');
      throw new ServiceError(404, { error: 'Visita no encontrada' });
    }

    await client.query('COMMIT');
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    await rollbackQuietly(client);
    console.error('actualizarVisita:', error);
    throw new ServiceError(500, { error: 'Error al actualizar visita' });
  } finally {
    client.release();
  }
}

module.exports = { crearVisita, registrarSalida, actualizarVisita };
