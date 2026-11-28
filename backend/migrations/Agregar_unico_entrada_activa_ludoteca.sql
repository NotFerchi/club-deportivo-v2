-- Una sola entrada activa por niño en la ludoteca (U5-05, LUD-05). Idempotente.
--  El backend ya responde 409 "Este niño ya tiene una entrada activa en la ludoteca" antes de insertar
--  (ludotecaService.exigirSinEntradaActiva), pero dos peticiones al mismo tiempo pueden pasar las dos
--  esa revisión. Este índice único parcial rechaza la segunda (23505) y el backend la traduce al mismo 409.
--  Mismo criterio que la revisión: socio padre + nombre sin distinguir mayúsculas ni espacios, solo
--  mientras no haya salida (hora_salida IS NULL). Un niño puede volver a entrar después de salir.
--  Antes de correrlo, no debe haber duplicados activos (si los hay, CREATE UNIQUE INDEX falla y no se crea):
--    SELECT socio_padre_id, LOWER(TRIM(nombre_hijo)), COUNT(*) FROM registro_ludoteca
--     WHERE hora_salida IS NULL GROUP BY 1, 2 HAVING COUNT(*) > 1;
--  Depende de schema.sql (registro_ludoteca): migrate.js la corre al final con --todas
--  (ver src/config/migracionesPosteriores.js).

CREATE UNIQUE INDEX IF NOT EXISTS uq_registro_ludoteca_entrada_activa
  ON registro_ludoteca (socio_padre_id, LOWER(TRIM(nombre_hijo)))
  WHERE hora_salida IS NULL;
