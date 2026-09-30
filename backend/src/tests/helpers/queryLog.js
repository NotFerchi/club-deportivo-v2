'use strict';

/**
 * Registro de consultas para tests de caracterización.
 *
 * Normaliza el SQL (sin comentarios `--` y con espacios colapsados) y guarda,
 * en orden, cada consulta con sus parámetros, tanto de pool.query como del
 * cliente de transacción. Comparar este registro con un snapshot fija el SQL
 * exacto que produce cada endpoint.
 */

function normSql(sql) {
  return String(sql)
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Conecta pool.query y pool.connect (mocks de jest) a `route(sql, params)`,
 * registrando cada llamada. Devuelve { log, client }.
 */
function recordQueries(pool, route) {
  const log = [];
  const run = (origen) => async (sql, params) => {
    log.push([origen, normSql(sql), params === undefined ? [] : params]);
    return route(normSql(sql), params || []);
  };
  pool.query.mockImplementation(run('pool'));
  const client = { query: jest.fn(run('client')), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  return { log, client };
}

module.exports = { normSql, recordQueries };
