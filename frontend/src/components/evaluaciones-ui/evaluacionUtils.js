// Utilidades de la interfaz de evaluaciones de instructores (E5). Reglas de docs/api-evaluaciones.md §1 y §3.1.

export const COMENTARIO_MAX = 500;

export const ETIQUETAS_CALIFICACION = {
  1: 'Muy mala',
  2: 'Mala',
  3: 'Regular',
  4: 'Buena',
  5: 'Excelente',
};

// sesiones_programadas.dia_semana: Lun=1 ... Dom=7
const DIAS = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };

export const nombreDia = (n) => DIAS[Number(n)] || '';

/** Mes actual del club ("YYYY-MM", America/Mexico_City): el periodo que usa el backend para "una por mes". */
export function periodoActual(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' })
    .format(ahora)
    .slice(0, 7);
}

/** "2026-10" → "octubre de 2026" */
export function nombreMes(periodo) {
  const m = String(periodo).match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

/** "09:00:00" → "09:00" */
export const horaCorta = (valor) => String(valor ?? '').slice(0, 5);

/**
 * Validación del formulario antes de enviar (el backend vuelve a validar).
 * Devuelve el mensaje de error o null si todo está bien.
 */
export function validarEvaluacion({ calificacion, comentario }) {
  if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
    return 'Elige una calificación del 1 al 5.';
  }
  const texto = String(comentario ?? '').trim();
  if (texto.length > COMENTARIO_MAX) return `El comentario no puede pasar de ${COMENTARIO_MAX} caracteres.`;
  if (texto.includes('\u0000')) return 'El comentario contiene caracteres no válidos.';
  return null;
}

/** El backend manda 'Por asignar' cuando la clase no tiene instructor (no se puede evaluar: 409). */
export const sinInstructor = (clase) => !clase?.instructor || clase.instructor === 'Por asignar';
