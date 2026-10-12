// Mensajes y helpers compartidos por los servicios de torneos (torneo, participante, bracket).
const ServiceError = require('./serviceError');

const ERROR_DISCIPLINA_NO_EXISTE = 'La disciplina no existe';
const ERROR_FECHAS_TORNEO = 'La fecha de fin no puede ser menor que la fecha de inicio';
const ERROR_TIPO_PARTICIPANTE = 'Debe especificar exactamente un tipo de participante';
const ERROR_SOCIO_NO_VALIDO = 'Socio no encontrado o inactivo';
const ERROR_VISITA_NO_VALIDA = 'Visita no encontrada o no vigente';
const ERROR_CATEGORIA_NO_EXISTE = 'La categoría no existe';
const ERROR_PARTICIPANTE_DUPLICADO = 'Este participante ya está inscrito en el torneo';

// Mayor valor de una columna INTEGER (int4) de PostgreSQL.
const MAX_INT4 = 2147483647;

function normalizarFechaOpcional(fecha) {
  return fecha === undefined || fecha === '' ? null : fecha;
}

function tieneValor(valor) {
  return valor !== undefined && valor !== null && valor !== '';
}

/**
 * Id de la BD: entero entre 1 y 2147483647, como número o como texto de solo dígitos.
 * Devuelve el número, o null si es '', texto, decimal, negativo, 0 o está fuera de int4.
 */
function esIdValido(valor) {
  let numero = NaN;
  if (typeof valor === 'number') numero = valor;
  else if (typeof valor === 'string' && /^\s*\d+\s*$/.test(valor)) numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= MAX_INT4 ? numero : null;
}

/** Nombre para comparar duplicados: sin espacios en los extremos, internos colapsados y en minúsculas. */
function normalizarNombre(nombre) {
  return String(nombre).trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Dentro de una transacción: bloquea la fila del torneo (FOR UPDATE) y devuelve `columnas`.
 * Serializa los cambios de estado con las inscripciones y los resultados. 404 si no existe.
 */
async function bloquearTorneo(client, torneoId, columnas = 'estado') {
  const { rows, rowCount } = await client.query(`SELECT ${columnas} FROM torneos WHERE torneo_id = $1 FOR UPDATE`, [
    torneoId
  ]);
  if (rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });
  return rows[0];
}

module.exports = {
  ERROR_DISCIPLINA_NO_EXISTE,
  ERROR_FECHAS_TORNEO,
  ERROR_TIPO_PARTICIPANTE,
  ERROR_SOCIO_NO_VALIDO,
  ERROR_VISITA_NO_VALIDA,
  ERROR_CATEGORIA_NO_EXISTE,
  ERROR_PARTICIPANTE_DUPLICADO,
  normalizarFechaOpcional,
  tieneValor,
  esIdValido,
  normalizarNombre,
  bloquearTorneo
};
