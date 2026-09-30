// Mensajes y helpers compartidos por los servicios de torneos (torneo, participante, bracket).

const ERROR_DISCIPLINA_NO_EXISTE = 'La disciplina no existe';
const ERROR_FECHAS_TORNEO = 'La fecha de fin no puede ser menor que la fecha de inicio';
const ERROR_TIPO_PARTICIPANTE = 'Debe especificar exactamente un tipo de participante';
const ERROR_SOCIO_NO_VALIDO = 'Socio no encontrado o inactivo';
const ERROR_VISITA_NO_VALIDA = 'Visita no encontrada o no vigente';
const ERROR_CATEGORIA_NO_EXISTE = 'La categoría no existe';
const ERROR_PARTICIPANTE_DUPLICADO = 'Este participante ya está inscrito en el torneo';

function normalizarFechaOpcional(fecha) {
  return fecha === undefined || fecha === '' ? null : fecha;
}

function tieneValor(valor) {
  return valor !== undefined && valor !== null && valor !== '';
}

function esEnteroValido(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : null;
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
  esEnteroValido
};
