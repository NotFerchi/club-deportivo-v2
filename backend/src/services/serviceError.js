/**
 * Error de negocio lanzado por la capa de servicios.
 * `status` es el código HTTP y `body` el JSON exacto que debe responder el controlador.
 */
class ServiceError extends Error {
  constructor(status, body) {
    super(body?.error || 'Error de servicio');
    this.name = 'ServiceError';
    this.status = status;
    this.body = body;
  }
}

module.exports = ServiceError;
