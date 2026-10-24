// Categorías de torneo (E2.6 / F-08): alta, listado, renombrar y desactivar.
// Las categorías no se borran: desactivar (activo = FALSE) conserva la fila para los torneos y
// participantes que ya la usan. Una categoría inactiva no se asigna a torneos nuevos (torneoService.js).
const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const { normalizarNombre } = require('./torneoComun');
const { ESTADOS } = require('./torneoEstados');

const ERROR_CATEGORIA_NO_ENCONTRADA = 'Categoría no encontrada';
const ERROR_CATEGORIA_DUPLICADA = 'Ya existe una categoría con ese nombre';
const ERROR_CATEGORIA_INACTIVA = 'La categoría está desactivada';
const ERROR_CATEGORIA_YA_INACTIVA = 'La categoría ya está desactivada';

// Mismo criterio que normalizarNombre (torneoComun.js), en SQL.
const NOMBRE_NORMALIZADO = "LOWER(REGEXP_REPLACE(BTRIM(nombre), '\\s+', ' ', 'g'))";

// Torneos que impiden desactivar: no eliminados y sin terminar.
const ESTADOS_TERMINADOS = [ESTADOS.FINALIZADO, ESTADOS.CANCELADO];

const conflicto = (error) => new ServiceError(409, { error });

/** Todas las categorías (activas e inactivas); con `soloActivas` solo las activas. */
async function listarCategorias({ soloActivas = false } = {}) {
  const where = soloActivas ? 'WHERE activo ' : '';
  const result = await pool.query(`SELECT categoria_id, nombre, activo FROM categorias_torneo ${where}ORDER BY nombre`);
  return result.rows;
}

/**
 * 409 si otra categoría activa tiene el mismo nombre normalizado. Corre con la tabla bloqueada
 * (SHARE ROW EXCLUSIVE choca consigo mismo): dos altas simultáneas con el mismo nombre no pasan ambas.
 * No hay índice único porque hoy existen duplicados en uso (ver la migración).
 */
async function validarNombreLibre(client, nombre, excluirId = null) {
  await client.query('LOCK TABLE categorias_torneo IN SHARE ROW EXCLUSIVE MODE');
  const { rowCount } = await client.query(
    `SELECT 1 FROM categorias_torneo
       WHERE activo AND ${NOMBRE_NORMALIZADO} = $1 AND ($2::int IS NULL OR categoria_id <> $2)
       LIMIT 1`,
    [normalizarNombre(nombre), excluirId]
  );
  if (rowCount > 0) throw conflicto(ERROR_CATEGORIA_DUPLICADA);
}

/** Categoría con su fila bloqueada; 404 si no existe. */
async function bloquearCategoria(client, categoriaId) {
  const { rows, rowCount } = await client.query(
    'SELECT categoria_id, nombre, activo FROM categorias_torneo WHERE categoria_id = $1 FOR UPDATE',
    [categoriaId]
  );
  if (rowCount === 0) throw new ServiceError(404, { error: ERROR_CATEGORIA_NO_ENCONTRADA });
  return rows[0];
}

/** nombre validado en la ruta (requerido, ≤ 50). Se guarda sin espacios en los extremos. */
async function crearCategoria(nombreBody) {
  const nombre = nombreBody.trim();
  return enTransaccion(async (client) => {
    await validarNombreLibre(client, nombre);
    const { rows } = await client.query(
      'INSERT INTO categorias_torneo (nombre) VALUES ($1) RETURNING categoria_id, nombre',
      [nombre]
    );
    return rows[0];
  });
}

/**
 * Solo cambia el nombre; se permite aunque esté en uso (torneos y participantes guardan el id).
 * Devuelve { categoria_id, nombre, nombre_anterior }. 404 si no existe, 409 si está inactiva o el
 * nombre lo tiene otra categoría activa.
 */
async function renombrarCategoria(categoriaIdParam, nombreBody) {
  const categoriaId = Number(categoriaIdParam); // entero: validado en la ruta
  const nombre = nombreBody.trim();
  return enTransaccion(async (client) => {
    const actual = await bloquearCategoria(client, categoriaId);
    if (!actual.activo) throw conflicto(ERROR_CATEGORIA_INACTIVA);
    await validarNombreLibre(client, nombre, categoriaId);
    await client.query('UPDATE categorias_torneo SET nombre = $1 WHERE categoria_id = $2', [nombre, categoriaId]);
    return { categoria_id: categoriaId, nombre, nombre_anterior: actual.nombre };
  });
}

/**
 * activo = FALSE. 404 si no existe; 409 si ya está inactiva o la usa algún torneo no eliminado
 * que no esté Finalizado ni Cancelado. Los torneos terminados la conservan.
 */
async function desactivarCategoria(categoriaIdParam) {
  const categoriaId = Number(categoriaIdParam); // entero: validado en la ruta
  return enTransaccion(async (client) => {
    const actual = await bloquearCategoria(client, categoriaId);
    if (!actual.activo) throw conflicto(ERROR_CATEGORIA_YA_INACTIVA);

    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneos
         WHERE categoria_id = $1 AND activo AND estado <> ALL($2::text[])`,
      [categoriaId, ESTADOS_TERMINADOS]
    );
    const enUso = rows[0].total;
    if (enUso > 0) {
      const torneos = enUso === 1 ? '1 torneo activo' : `${enUso} torneos activos`;
      throw conflicto(`No se puede desactivar: la categoría está en uso por ${torneos}`);
    }

    await client.query('UPDATE categorias_torneo SET activo = FALSE WHERE categoria_id = $1', [categoriaId]);
    return { categoria_id: categoriaId, nombre: actual.nombre };
  });
}

module.exports = {
  ERROR_CATEGORIA_INACTIVA,
  listarCategorias,
  crearCategoria,
  renombrarCategoria,
  desactivarCategoria
};
