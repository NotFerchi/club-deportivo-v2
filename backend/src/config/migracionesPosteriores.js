// Migraciones que dependen de tablas de schema.sql pero que, por su nombre, en orden alfabético quedarían
// antes que él (las mayúsculas van antes que la "s"). Todas son idempotentes.
// migrate.js las corre con --todas al final, después de schema.sql y de las de torneos, en este orden.
module.exports = [
  'Crear_evaluaciones_instructor.sql',
  // U5-05 (LUD-05): una sola entrada activa por niño en la ludoteca
  'Agregar_unico_entrada_activa_ludoteca.sql'
];
