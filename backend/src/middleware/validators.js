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
 * Exige que Number(req[source][field]) sea un entero > 0; si no, responde 400 con `body`
 * tal cual (cada endpoint conserva su mensaje y forma: { error } o { ok: false, error }).
 * Tolera que req[source] no exista (lo trata como valor ausente → 400).
 */
function requirePositiveInt(field, { source = 'params', body }) {
  return (req, res, next) => {
    const value = Number(req[source]?.[field]);
    if (!Number.isInteger(value) || value <= 0) {
      return res.status(400).json(body);
    }
    next();
  };
}

/**
 * Cadena no vacía en req[source][field]: ausente (undefined o null) → 400 `missingBody`;
 * presente pero no string o solo espacios → 400 `invalidBody`. Tolera que req[source] no exista.
 */
function requireNonEmptyString(field, { source = 'body', missingBody, invalidBody }) {
  return (req, res, next) => {
    const value = req[source]?.[field];
    if (value === undefined || value === null) return res.status(400).json(missingBody);
    if (typeof value !== 'string' || !value.trim()) return res.status(400).json(invalidBody);
    next();
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fechas YYYY-MM-DD requeridas: si alguna falta (falsy) → 400 `missingBody`;
 * si alguna no cumple el formato → 400 `invalidBody`.
 */
function requireIsoDates(fields, { source = 'query', missingBody, invalidBody }) {
  return (req, res, next) => {
    const data = req[source];
    if (fields.some((field) => !data[field])) return res.status(400).json(missingBody);
    if (fields.some((field) => !ISO_DATE.test(data[field]))) return res.status(400).json(invalidBody);
    next();
  };
}

/** Parámetro opcional: si viene (≠ undefined) debe ser uno de `values`; si no, 400 `body`. */
function optionalOneOf(field, values, { source = 'query', body }) {
  return (req, res, next) => {
    const value = req[source][field];
    if (value !== undefined && !values.includes(value)) return res.status(400).json(body);
    next();
  };
}

/**
 * Middleware a partir de una regla: `rule(req)` devuelve [status, body] si la entrada
 * es inválida (o nada si es válida). Si la regla lanza (p. ej. al desestructurar un body
 * ausente), el error llega al errorHandler global, igual que cuando pasaba en el controlador.
 */
function validateInput(rule) {
  return (req, res, next) => {
    const fail = rule(req);
    if (fail) return res.status(fail[0]).json(fail[1]);
    next();
  };
}

/**
 * Validación de body en dos pasos, para conservar cómo respondía el endpoint original:
 *  - `leer(req)` corre sin protección: si lanza (p. ej. sin body), el error llega al
 *    errorHandler global, igual que cuando el controlador desestructuraba req.body.
 *  - `regla(datos)` devuelve [status, body] si la entrada es inválida. Si lanza algo
 *    inesperado (p. ej. .trim() sobre un número), se responde como el catch del endpoint:
 *    se registra `Error en ${fnName}:` y 500 { error: mensaje }.
 */
function validateBody({ leer, regla, fnName, mensaje }) {
  return (req, res, next) => {
    const datos = leer(req);
    let fail;
    try {
      fail = regla(datos);
    } catch (error) {
      console.error(`Error en ${fnName}:`, error);
      return res.status(500).json({ error: mensaje });
    }
    if (fail) return res.status(fail[0]).json(fail[1]);
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
  requirePositiveInt,
  requireNonEmptyString,
  requireIsoDates,
  optionalOneOf,
  validateInput,
  validateBody,
  requireReservaFields
};
