/**
 * Middlewares de validación de entrada (presencia y formato básico de campos).
 * Las reglas de negocio (horarios, cupos, solapamientos) viven en los servicios.
 *
 * Nota: se lee req[source] sin valor por defecto a propósito, para conservar el
 * comportamiento previo de los controladores cuando no llega body.
 */

/**
 * Exige que todos los campos sean truthy en req[source]; si no, 400 { error: message }.
 */
function requireFields(fields, { source = 'body', message }) {
  return (req, res, next) => {
    const data = req[source];
    if (fields.some((field) => !data[field])) {
      return res.status(400).json({ error: message });
    }
    next();
  };
}

/**
 * Exige que Number(req[source][field]) sea un entero distinto de 0
 * (acepta negativos, igual que la validación original); si no, 400 { error: message }.
 */
function requireInteger(field, { source = 'query', message }) {
  return (req, res, next) => {
    const value = Number(req[source][field]);
    if (!value || !Number.isInteger(value)) {
      return res.status(400).json({ error: message });
    }
    next();
  };
}

/**
 * Campos obligatorios para crear una reserva. Normaliza fecha y horas igual que
 * reservaService (fecha hasta la 'T', hora a HH:MM) y responde con { error, errors }.
 */
function requireReservaFields(req, res, next) {
  const { espacio_id, socio_id, fecha, hora_inicio, hora_fin } = req.body;
  const fechaNormalizada = String(fecha || '').split('T')[0];
  const horaInicio = String(hora_inicio || '').slice(0, 5);
  const horaFin = String(hora_fin || '').slice(0, 5);

  if (!espacio_id || !socio_id || !fechaNormalizada || !horaInicio || !horaFin) {
    const error = 'Faltan campos obligatorios';
    return res.status(400).json({ error, errors: [error] });
  }
  next();
}

module.exports = {
  requireFields,
  requireInteger,
  requireReservaFields
};
