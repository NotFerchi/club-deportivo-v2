const pool = require('../config/database');

const tableColumnsCache = new Map();
let reservaEstadosCache = null;

const gravedadDias = {
  Leve: 1,
  Moderada: 7,
  Grave: 30
};

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeReservaEstado(value = '') {
  const estado = normalizeText(value).replace(/\s+/g, '-');
  if (estado === 'confirmada' || estado === 'confirmado') return 'confirmada';
  if (estado === 'cancelada' || estado === 'cancelado') return 'cancelada';
  if (estado === 'no-show' || estado === 'noshow') return 'no-show';
  if (estado === 'sancionada' || estado === 'sancionado') return 'sancionada';
  if (estado === 'pendiente') return 'pendiente';
  return estado || 'confirmada';
}

function normalizeGravedad(value = '') {
  const gravedad = normalizeText(value);
  if (gravedad === 'grave') return 'Grave';
  if (gravedad === 'moderada' || gravedad === 'moderado') return 'Moderada';
  return 'Leve';
}

function localTodayISO() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().split('T')[0];
}

function addDaysISO(dateValue, days) {
  const date = new Date(`${dateValue || localTodayISO()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function minutesBetween(start, end) {
  const [startHour, startMinute] = String(start || '').slice(0, 5).split(':').map(Number);
  const [endHour, endMinute] = String(end || '').slice(0, 5).split(':').map(Number);

  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function getDiaSemana(fecha) {
  const [year, month, day] = String(fecha || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getDay() + 1;
}

async function getTableColumns(tableName) {
  if (tableColumnsCache.has(tableName)) return tableColumnsCache.get(tableName);

  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  const columns = new Set(result.rows.map(row => row.column_name));
  tableColumnsCache.set(tableName, columns);
  return columns;
}

async function getReservaEstadoLabels() {
  if (reservaEstadosCache) return reservaEstadosCache;

  const result = await pool.query(`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'estado_reserva'
    ORDER BY e.enumsortorder
  `);
  reservaEstadosCache = result.rows.map(row => row.enumlabel);
  return reservaEstadosCache;
}

async function resolveReservaEstado(value) {
  const normalized = normalizeReservaEstado(value);
  const labels = await getReservaEstadoLabels();

  if (labels.length === 0) {
    return normalized;
  }

  const exact = labels.find(label => normalizeReservaEstado(label) === normalized);
  if (exact) return exact;

  if (normalized === 'pendiente') {
    const confirmada = labels.find(label => normalizeReservaEstado(label) === 'confirmada');
    if (confirmada) return confirmada;
  }

  throw new Error(`Estado de reserva invalido: ${value}`);
}

module.exports = {
  addDaysISO,
  getDiaSemana,
  getTableColumns,
  gravedadDias,
  localTodayISO,
  minutesBetween,
  normalizeGravedad,
  normalizeReservaEstado,
  normalizeText,
  resolveReservaEstado
};
