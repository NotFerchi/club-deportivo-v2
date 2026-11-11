// Ayudas para el calendario de la semana en Clases. sesiones_programadas.dia_semana: Lun=1 … Dom=7.

const ABREV = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

/** Día de la semana de una fecha con la convención del sistema (Lun=1 … Dom=7). */
export function diaSemanaDe(fecha) {
  const d = fecha.getDay();
  return d === 0 ? 7 : d;
}

/** Los 7 días de la semana de `hoy` (de lunes a domingo): [{ value, label, number }]. */
export function diasDeLaSemana(hoy = new Date()) {
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (diaSemanaDe(hoy) - 1));
  return ABREV.map((label, i) => {
    const f = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
    return { value: i + 1, label, number: f.getDate() };
  });
}

/** Minutos que dura una clase; null si falta algún dato. */
export function minutosDeClase(horaInicio, horaFin) {
  if (!horaInicio || !horaFin) return null;
  const [h1, m1] = String(horaInicio).split(':').map(Number);
  const [h2, m2] = String(horaFin).split(':').map(Number);
  const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  return Number.isFinite(minutos) && minutos > 0 ? minutos : null;
}

/** Para ordenar "próximas clases": días que faltan desde hoy (0 = hoy) y su hora. */
export function ordenProxima(diaSemana, hora, hoy = new Date()) {
  const dias = (Number(diaSemana) - diaSemanaDe(hoy) + 7) % 7;
  return dias * 24 * 60 + (parseInt(String(hora).slice(0, 2), 10) || 0) * 60 + (parseInt(String(hora).slice(3, 5), 10) || 0);
}
