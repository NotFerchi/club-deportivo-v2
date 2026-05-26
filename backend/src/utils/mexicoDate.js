/**
 * mexicoDate.js
 * Utilidades centralizadas para obtener fecha/hora en la zona horaria de México
 * (America/Mexico_City — UTC-6 CST / UTC-5 CDT).
 *
 * Uso:
 *   const { getMexicoDateISO, getMexicoTimeISO, getMexicoDayOfWeek } = require('./mexicoDate');
 */

const MEXICO_TZ = 'America/Mexico_City';

/**
 * Retorna la fecha actual en México como "YYYY-MM-DD".
 * Reemplaza:  new Date().toISOString().split('T')[0]  (que devuelve fecha UTC)
 */
function getMexicoDateISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MEXICO_TZ }).format(new Date());
}

/**
 * Retorna la hora actual en México como "HH:MM".
 * Reemplaza:  new Date().toLocaleTimeString(...)  (que usa TZ del servidor)
 */
function getMexicoTimeISO() {
  const str = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MEXICO_TZ,
  }).format(new Date());
  // Algunos entornos devuelven "24:xx" a la medianoche; normalizamos a "00:xx"
  return str.replace(/^24:/, '00:');
}

/**
 * Retorna el día de la semana actual en México City.
 * Convención: 1 = Lunes, 2 = Martes, ..., 6 = Sábado, 7 = Domingo (ISO 8601)
 *
 * Reemplaza:  new Date().getDay() + 1  (que usa TZ del servidor y tiene Sun=1)
 */
function getMexicoDayOfWeek() {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: MEXICO_TZ,
  }).format(new Date());
  // ISO 8601: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=7
  const MAP = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return MAP[dayStr] ?? 1;
}

module.exports = { getMexicoDateISO, getMexicoTimeISO, getMexicoDayOfWeek };
