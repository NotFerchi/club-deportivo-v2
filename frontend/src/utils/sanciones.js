/**
 * Criterio único de "sanción activa" en el frontend (SAN-04).
 *
 * El backend calcula el campo booleano `activa` (estado Activa/Activo y fecha_fin sin vencer) en
 * sancionService.sancionActivaSql; aquí solo se lee ese campo. Lo usan Inicio y Estado de Cuenta
 * para que las dos pantallas muestren el mismo número.
 */

export const esSancionActiva = (sancion) => sancion?.activa === true;

export const sancionesActivas = (lista) => (Array.isArray(lista) ? lista.filter(esSancionActiva) : []);

/** true si alguna de las sanciones (ya filtradas como activas) es Grave o Moderada. */
export const hayActivaGraveOModerada = (activas) =>
  activas.some((s) => ['grave', 'moderada'].includes(String(s.gravedad).toLowerCase()));
