export const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Usa métodos locales — toISOString() retorna fecha UTC (errónea después de ~6 pm MX)
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isActiveValue = (value) => value === true || value === 'true' || value === 'Activo';

export const getSocioTipo = (socio) =>
  normalizeText(socio?.tipo_socio || socio?.tipo || socio?.modalidad) === 'accionista'
    ? 'accionista'
    : 'rentista';

export const getSocioNumero = (socio) => socio?.numero_socio || socio?.socio_numero || '';

export const getFullName = (item) =>
  [item?.nombres, item?.apellido_paterno, item?.apellido_materno].filter(Boolean).join(' ').trim();

export const normalizeEstadoReserva = (estado) => {
  const value = normalizeText(estado).replace(/\s+/g, '-');
  if (value === 'confirmada' || value === 'confirmado') return 'confirmada';
  if (value === 'cancelada' || value === 'cancelado') return 'cancelada';
  if (value === 'no-show' || value === 'noshow') return 'no-show';
  if (value === 'sancionada' || value === 'sancionado') return 'sancionada';
  if (value === 'pendiente') return 'pendiente';
  return value || 'confirmada';
};

export const estadoReservaLabel = (estado) => {
  const normalized = normalizeEstadoReserva(estado);
  const labels = {
    confirmada: 'Confirmada',
    pendiente: 'Pendiente',
    cancelada: 'Cancelada',
    'no-show': 'No-show',
    sancionada: 'Sancionada'
  };
  return labels[normalized] || 'Confirmada';
};

export const toDateInputValue = (dateValue) => {
  if (!dateValue) return '';
  return String(dateValue).split('T')[0];
};

export const toTimeInputValue = (timeValue) => {
  if (!timeValue) return '';
  return String(timeValue).slice(0, 5);
};

export const addMinutesToTime = (timeValue, minutesToAdd) => {
  if (!timeValue) return '';
  const [hours, minutes] = timeValue.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';

  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(normalized / 60);
  const nextMinutes = normalized % 60;

  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

export const minutesBetween = (start, end) => {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
};

export const timesOverlap = (startA, endA, startB, endB) =>
  toTimeInputValue(startA) < toTimeInputValue(endB) && toTimeInputValue(endA) > toTimeInputValue(startB);

const MX_TZ = 'America/Mexico_City';

export const formatDate = (value) => {
  if (!value) return '-';
  const str = String(value);
  // Valor solo-fecha "YYYY-MM-DD": parseamos como medianoche local para no cambiar el día.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    return Number.isNaN(d.getTime()) ? str : d.toLocaleDateString('es-MX');
  }
  // Timestamp completo de la BD (UTC): forzamos visualización en México City.
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleDateString('es-MX', { timeZone: MX_TZ });
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    return Number.isNaN(d.getTime()) ? str : d.toLocaleDateString('es-MX');
  }
  // Timestamp completo de la BD (UTC): forzamos visualización en México City.
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleString('es-MX', { timeZone: MX_TZ });
};

// Para timestamps ya convertidos a hora local por el servidor (sin sufijo Z/timezone).
// Formatea el string directamente sin aplicar ninguna conversión de zona horaria.
export const formatLocalDateTime = (value) => {
  if (!value) return '-';
  const str = String(value);
  // "2024-01-15T10:30:00" → "15/1/2024, 10:30 a. m."
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return str;
  const [, y, mo, d, h, mi] = match;
  const hn = parseInt(h, 10);
  const suffix = hn >= 12 ? 'p. m.' : 'a. m.';
  const h12 = hn === 0 ? 12 : hn > 12 ? hn - 12 : hn;
  return `${parseInt(d, 10)}/${parseInt(mo, 10)}/${y}, ${h12}:${mi} ${suffix}`;
};

export const normalizeGravedad = (value) => {
  const normalized = normalizeText(value);
  if (normalized === 'grave') return 'Grave';
  if (normalized === 'moderada' || normalized === 'moderado') return 'Moderada';
  return 'Leve';
};

export const gravedadDias = {
  Leve: 1,
  Moderada: 7,
  Grave: 30
};

export const fechaFinPorGravedad = (fechaInicio, gravedad) => {
  if (!fechaInicio) return '';
  const days = gravedadDias[normalizeGravedad(gravedad)] || gravedadDias.Leve;
  const date = new Date(`${fechaInicio}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};
