// Helpers comunes de los reportes: rango de fechas, formato solicitado y formateo de valores.
const { getMexicoDateISO } = require('../../utils/mexicoDate');

const DEFAULT_RANGE_DAYS = 30;
const DAYS_ES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

function parseISODate(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

function getTodayISO() {
  // Usa México City — toISOString() devuelve fecha UTC (errónea después de las ~6pm MX)
  return getMexicoDateISO();
}

function addDaysISO(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveDateRange(query, defaultDays = DEFAULT_RANGE_DAYS) {
  const rawDesde = query.desde || query.fechaInicio || null;
  const rawHasta = query.hasta || query.fechaFin || query.fecha || null;

  if (!rawDesde && !rawHasta) {
    const hasta = getTodayISO();
    return { desde: addDaysISO(hasta, -(defaultDays - 1)), hasta, defaulted: true };
  }

  const desde = parseISODate(rawDesde || rawHasta);
  const hasta = parseISODate(rawHasta || rawDesde);

  if (!desde || !hasta) {
    const error = new Error('Las fechas deben tener formato YYYY-MM-DD');
    error.status = 400;
    throw error;
  }

  if (desde > hasta) {
    const error = new Error('La fecha desde no puede ser mayor que la fecha hasta');
    error.status = 400;
    throw error;
  }

  return { desde, hasta, defaulted: false };
}

function resolveFormat(value) {
  const format = String(value || 'xlsx').toLowerCase();
  if (format !== 'xlsx' && format !== 'pdf') {
    const error = new Error('El parametro formato debe ser xlsx o pdf');
    error.status = 400;
    throw error;
  }
  return format;
}

function formatDateValue(value) {
  if (!value) return '-';
  return String(value).split('T')[0];
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function getDatesBetween(desde, hasta) {
  const dates = [];
  let current = desde;
  while (current <= hasta) {
    dates.push(current);
    current = addDaysISO(current, 1);
  }
  return dates;
}

module.exports = {
  DAYS_ES,
  addDaysISO,
  resolveDateRange,
  resolveFormat,
  formatDateValue,
  formatNumber,
  getDatesBetween
};
