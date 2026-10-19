// Periodo de inscripción del torneo (F-07). Todas las fechas son 'YYYY-MM-DD' (columnas DATE) y "hoy"
// es la fecha del club en America/Mexico_City, no la del servidor ni la de UTC.
//
//   fecha_inicio_inscripcion NULL → sin límite inicial.
//   fecha_fin_inscripcion    NULL → cierra al llegar fecha_inicio (se inscribe hasta el día anterior);
//                                   sin fecha_inicio, sin límite.
// Los extremos explícitos son inclusivos.

const ZONA_CLUB = 'America/Mexico_City';
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const ERROR_INSCRIPCIONES_CERRADAS = 'Las inscripciones de este torneo están cerradas';
const ERROR_INICIO_PASADO = 'La fecha de inicio no puede ser anterior a hoy';

// 'en-CA' formatea como YYYY-MM-DD
const formatoFechaClub = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_CLUB,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Fecha de hoy en la zona del club, como 'YYYY-MM-DD'. */
function hoyEnClub(ahora = new Date()) {
  return formatoFechaClub.format(ahora);
}

/** Fecha 'YYYY-MM-DD' o null (undefined, null, '' o texto con otro formato). */
const fechaIso = (valor) => (typeof valor === 'string' && FECHA_ISO.test(valor) ? valor : null);

/** true si `hoy` está dentro del periodo de inscripción del torneo. */
function enPeriodoInscripcion({ fecha_inicio, fecha_inicio_inscripcion, fecha_fin_inscripcion }, hoy = hoyEnClub()) {
  const desde = fechaIso(fecha_inicio_inscripcion);
  const hasta = fechaIso(fecha_fin_inscripcion);
  const inicioTorneo = fechaIso(fecha_inicio);

  if (desde && hoy < desde) return false;
  if (hasta) return hoy <= hasta;
  if (inicioTorneo) return hoy < inicioTorneo;
  return true;
}

/**
 * E2.5: true si fecha_inicio ('YYYY-MM-DD') es anterior a hoy en la zona del club. Hoy mismo es válido.
 * Sin fecha u otro formato → false (otros formatos los rechaza la ruta o PostgreSQL).
 */
function iniciaEnElPasado(fechaInicio, hoy = hoyEnClub()) {
  const inicio = fechaIso(fechaInicio);
  return inicio !== null && inicio < hoy;
}

/**
 * Orden de las fechas de un torneo (alta o edición). Devuelve el mensaje del 400, que nombra la fecha
 * que está mal, o null. Solo compara fechas 'YYYY-MM-DD'; otros formatos los rechaza la ruta o PostgreSQL.
 */
function validarFechasInscripcion({ fecha_inicio, fecha_inicio_inscripcion, fecha_fin_inscripcion }) {
  const desde = fechaIso(fecha_inicio_inscripcion);
  const hasta = fechaIso(fecha_fin_inscripcion);
  const inicioTorneo = fechaIso(fecha_inicio);

  if (desde && hasta && hasta < desde) {
    return `fecha_fin_inscripcion (${hasta}) no puede ser anterior a fecha_inicio_inscripcion (${desde})`;
  }
  if (hasta && inicioTorneo && hasta > inicioTorneo) {
    return `fecha_fin_inscripcion (${hasta}) no puede ser posterior a fecha_inicio del torneo (${inicioTorneo})`;
  }
  if (desde && inicioTorneo && desde > inicioTorneo) {
    return `fecha_inicio_inscripcion (${desde}) no puede ser posterior a fecha_inicio del torneo (${inicioTorneo})`;
  }
  return null;
}

/** Columnas DATE del torneo como texto 'YYYY-MM-DD', para no depender de la conversión de pg a Date. */
const COLUMNAS_FECHAS_TORNEO = [
  "to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio",
  "to_char(fecha_inicio_inscripcion, 'YYYY-MM-DD') AS fecha_inicio_inscripcion",
  "to_char(fecha_fin_inscripcion, 'YYYY-MM-DD') AS fecha_fin_inscripcion"
].join(', ');

module.exports = {
  ZONA_CLUB,
  FECHA_ISO,
  ERROR_INSCRIPCIONES_CERRADAS,
  ERROR_INICIO_PASADO,
  COLUMNAS_FECHAS_TORNEO,
  hoyEnClub,
  iniciaEnElPasado,
  enPeriodoInscripcion,
  validarFechasInscripcion
};
