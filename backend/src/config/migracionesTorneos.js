// Orden real de las migraciones del módulo de torneos. Todas suponen que schema.sql ya creó
// torneos, categorias_torneo, equipos, socios y visitas, y todas son idempotentes.
// migrate.js las corre en este orden (no en orden alfabético, que pondría Agregar_tipo_torneo
// antes de Crear_participantes_torneo y de schema.sql).
module.exports = [
  'Crear_participantes_torneo.sql',
  'Crear_encuentros_torneo.sql',
  'Agregar_tipo_torneo.sql',
  'Ajustar_torneos_estado_check.sql',
  'zzz_torneos_estado_check_y_cancha.sql',
  'Agregar_cupo_maximo_torneos.sql',
  'Agregar_activo_torneos.sql',
  'Agregar_fechas_inscripcion_torneos.sql',
  'Agregar_activo_categorias_torneo.sql'
];
