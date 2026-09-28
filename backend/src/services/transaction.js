const pool = require('../config/database');
const { connectOrEscalate } = require('./escalate');

/** ROLLBACK que no lanza: registra el fallo y sigue (usado por recepción). */
async function rollbackQuietly(client) {
  try {
    await client.query('ROLLBACK');
  } catch (error) {
    console.error('Error al revertir transaccion:', error);
  }
}

/**
 * Ejecuta fn(client) en una transacción: BEGIN, COMMIT si termina bien,
 * ROLLBACK ante cualquier error (y lo relanza), release siempre.
 * El fallo de conexión se escala (ver escalate.js).
 * Con { quietRollback: true } un fallo del propio ROLLBACK solo se registra.
 */
async function enTransaccion(fn, { quietRollback = false } = {}) {
  const client = await connectOrEscalate(pool);
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (quietRollback) await rollbackQuietly(client);
    else await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { enTransaccion, rollbackQuietly };
