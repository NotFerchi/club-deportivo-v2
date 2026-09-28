const pool = require('../config/database');
const { connectOrEscalate } = require('./escalate');

/**
 * Ejecuta fn(client) en una transacción: BEGIN, COMMIT si termina bien,
 * ROLLBACK ante cualquier error (y lo relanza), release siempre.
 * El fallo de conexión se escala (ver escalate.js).
 */
async function enTransaccion(fn) {
  const client = await connectOrEscalate(pool);
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { enTransaccion };
