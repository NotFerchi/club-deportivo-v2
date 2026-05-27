/**
 * mexicoDate.js
 * Utilidades centralizadas para obtener fecha/hora en la zona horaria de México
 */

const TIME_ZONE = 'America/Mexico_City';

function getMexicoParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  return Object.fromEntries(
    formatter.formatToParts(date).map(part => [part.type, part.value])
  );
}

function getMexicoDateISO(date = new Date()) {
  const parts = getMexicoParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getMexicoTimeISO(date = new Date()) {
  const parts = getMexicoParts(date);
  return `${parts.hour}:${parts.minute}`;
}

function getMexicoDayOfWeek(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: TIME_ZONE,
    weekday: 'long'
  }).format(date);
}

module.exports = {
  getMexicoDateISO,
  getMexicoTimeISO,
  getMexicoDayOfWeek,
  TIME_ZONE
};