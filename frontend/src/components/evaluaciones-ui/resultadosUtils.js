// Utilidades de la vista de resultados por instructor (E5.2).

export const ESTRELLAS = [5, 4, 3, 2, 1];

/** Periodo actual "YYYY-MM" en la zona horaria del club (así lo calcula el backend). */
export function periodoActual() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7);
}

/** "2026-10" → "Octubre de 2026". */
export function nombreMes(periodo) {
  const m = String(periodo ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(periodo ?? '');
  const texto = new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Últimos `cantidad` meses (el actual primero) como opciones de Select: [{ value: '2026-10', label: 'Octubre de 2026' }]. */
export function opcionesDePeriodo(cantidad = 12, desde = periodoActual()) {
  const [anio, mes] = desde.split('-').map(Number);
  return Array.from({ length: cantidad }, (_, i) => {
    const fecha = new Date(anio, mes - 1 - i, 1);
    const value = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: nombreMes(value) };
  });
}

/** Mensaje para el error de una consulta; el 403 lleva un texto claro en lugar del técnico del backend. */
export function mensajeDeError(err) {
  if (err?.status === 403) return 'No tienes permisos para ver las evaluaciones de este instructor.';
  return err?.message || 'No se pudieron cargar las evaluaciones.';
}
