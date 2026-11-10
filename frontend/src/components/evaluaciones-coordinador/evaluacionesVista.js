// Cálculos de la vista de evaluaciones del coordinador (U4-20). Todo sale de la lista anónima de
// cada instructor (GET /evaluaciones/instructor/:id?periodo): el promedio es el mismo AVG que hace
// el backend en /promedio, redondeado a 2 decimales, y así también funciona el filtro por disciplina.

export const SIN_DISCIPLINA = 'Sin disciplina';

/** '2026-11' → '2026-10'; '2026-01' → '2025-12'. */
export function periodoAnterior(periodo) {
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(anio, mes - 2, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

const redondear2 = (n) => Math.round(n * 100) / 100;

/** Una decimal para mostrar: 4.666 → "4.7". */
export const unaDecimal = (n) => (n === null || n === undefined ? '—' : Number(n).toFixed(1));

/** { total, suma, promedio (2 decimales o null), distribucion { 1..5 } } de una lista de evaluaciones. */
export function resumen(lista) {
  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let suma = 0;
  for (const e of lista) {
    const c = Number(e.calificacion);
    if (c >= 1 && c <= 5) {
      distribucion[c] += 1;
      suma += c;
    }
  }
  const total = Object.values(distribucion).reduce((a, n) => a + n, 0);
  return { total, suma, promedio: total > 0 ? redondear2(suma / total) : null, distribucion };
}

const disciplinaDe = (e) => (e.disciplina && String(e.disciplina).trim()) || SIN_DISCIPLINA;

/** Solo las evaluaciones de la disciplina elegida ('' = todas). */
export function filtrar(lista, disciplina) {
  if (!disciplina) return lista;
  return lista.filter((e) => disciplinaDe(e) === disciplina);
}

/** Disciplinas que aparecen en las evaluaciones del mes, en orden alfabético. */
export function disciplinasDelMes(listas) {
  const set = new Set();
  for (const lista of listas.values()) for (const e of lista) set.add(disciplinaDe(e));
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Filas del ranking. Con evaluaciones primero (promedio, luego más evaluaciones, luego nombre) con su
 * posición; después los activos sin evaluaciones ("Sin evaluaciones"), por nombre. Un inactivo solo
 * aparece si tiene evaluaciones. Con filtro de disciplina, solo quien tiene evaluaciones de ella.
 */
export function ranking(instructores, listas, disciplina) {
  const filas = instructores.map((i) => {
    const lista = filtrar(listas.get(String(i.instructor_id)) || [], disciplina);
    const r = resumen(lista);
    const disciplinas = [...new Set(lista.map(disciplinaDe))].filter((d) => d !== SIN_DISCIPLINA);
    return {
      instructor_id: i.instructor_id,
      nombre: i.nombre,
      foto: i.foto_perfil || null,
      activo: i.activo !== false,
      detalle: disciplinas.length ? disciplinas.join(' · ') : i.especialidad || '',
      lista,
      ...r
    };
  });
  const evaluados = filas
    .filter((f) => f.total > 0)
    .sort((a, b) => b.suma / b.total - a.suma / a.total || b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
    .map((f, i) => ({ ...f, posicion: i + 1 }));
  const sinEvaluar = disciplina
    ? []
    : filas
        .filter((f) => f.total === 0 && f.activo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((f) => ({ ...f, posicion: null }));
  return [...evaluados, ...sinEvaluar];
}

/** Promedio ponderado por número de evaluaciones de todo el mes (con el filtro), o null sin datos. */
function ponderado(instructores, listas, disciplina) {
  let suma = 0;
  let total = 0;
  for (const i of instructores) {
    const r = resumen(filtrar(listas.get(String(i.instructor_id)) || [], disciplina));
    suma += r.suma;
    total += r.total;
  }
  return { total, promedio: total > 0 ? suma / total : null };
}

/**
 * KPI del mes: promedio general (ponderado) y su diferencia con el mes anterior (null si el mes
 * anterior no tiene datos), evaluaciones del mes y el mejor calificado (mayor promedio; en empate,
 * más evaluaciones).
 */
export function kpis(instructores, listasMes, listasPrevio, disciplina, filas) {
  const mes = ponderado(instructores, listasMes, disciplina);
  const previo = listasPrevio ? ponderado(instructores, listasPrevio, disciplina) : { promedio: null };
  const diferencia = mes.promedio !== null && previo.promedio !== null ? redondear2(mes.promedio - previo.promedio) : null;
  return {
    promedio: mes.promedio === null ? null : redondear2(mes.promedio),
    diferencia,
    total: mes.total,
    mejor: filas.find((f) => f.total > 0) || null
  };
}

/** "+0.2 vs mes anterior", "−0.3 vs mes anterior" o "Igual que el mes anterior". */
export function textoDiferencia(diferencia) {
  if (diferencia === null) return null;
  // Redondeo del valor absoluto (−0.25 → −0.3), igual que el promedio (4.25 → 4.3)
  const abs = Math.round(Math.abs(diferencia) * 10) / 10;
  if (abs === 0) return 'Igual que el mes anterior';
  return `${diferencia > 0 ? '+' : '−'}${abs.toFixed(1)} vs mes anterior`;
}
