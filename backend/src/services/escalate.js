/**
 * Errores "escalados": fallos que en los controladores originales ocurrían fuera
 * de su try/catch (p. ej. pool.connect() antes del try) y por eso llegaban al
 * errorHandler global en vez de convertirse en la respuesta de error del endpoint.
 *
 * Los servicios los marcan con escalate(); los controladores relanzan los errores
 * marcados (isEscalated) para conservar ese comportamiento.
 */
function escalate(error) {
  if (error && typeof error === 'object') error.escalate = true;
  return error;
}

function isEscalated(error) {
  return Boolean(error?.escalate);
}

/** pool.connect() cuyo fallo se escala, como cuando se llamaba antes del try. */
async function connectOrEscalate(pool) {
  try {
    return await pool.connect();
  } catch (error) {
    throw escalate(error);
  }
}

/**
 * Sin body, los controladores originales fallaban al desestructurar req.body
 * antes del try (TypeError → errorHandler global). Se reproduce escalando.
 */
function requireBodyOrEscalate(body) {
  if (body === undefined || body === null) {
    throw escalate(new TypeError('Cannot destructure properties of undefined (req.body)'));
  }
  return body;
}

module.exports = { escalate, isEscalated, connectOrEscalate, requireBodyOrEscalate };
