/**
 * Validación de entrada de /api/reportes: formato (xlsx/pdf) y rango de fechas.
 *
 * Usan los mismos parsers de reporteComun: si la entrada es inválida responden
 * 400 { error } con el mismo mensaje; si es válida dejan el resultado en res.locals
 * (formato, rango) para el controlador.
 */
const { resolveDateRange, resolveFormat } = require('../services/reportes/reporteComun');

function conParser(parse, guardar) {
  return (req, res, next) => {
    try {
      guardar(res.locals, parse(req.query));
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ error: error.message });
      throw error;
    }
    next();
  };
}

/** ?formato=xlsx|pdf (xlsx por defecto) → res.locals.formato */
const formatoReporte = conParser(
  (query) => resolveFormat(query.formato),
  (locals, formato) => {
    locals.formato = formato;
  }
);

/** desde/hasta (o fechaInicio/fechaFin/fecha; últimos 30 días por defecto) → res.locals.rango */
const rangoReporte = conParser(resolveDateRange, (locals, rango) => {
  locals.rango = rango;
});

module.exports = { formatoReporte, rangoReporte };
