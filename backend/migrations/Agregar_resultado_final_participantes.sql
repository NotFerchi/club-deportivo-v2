-- participantes_torneo.resultado_final (U5-05, bug extra de GET /torneos/:id/participantes). Idempotente.
--  participanteService.listarParticipantes lee pt.resultado_final, pero la columna solo estaba en los
--  CREATE TABLE (schema.sql y Crear_participantes_torneo.sql): una base creada antes no la tiene y el
--  endpoint responde 500 ("column pt.resultado_final does not exist").
--  Production ya la tiene (se agregó sin migración): character varying(100), nullable, sin default.
--  Aquí se registra con el mismo tipo; con IF NOT EXISTS no cambia nada donde ya existe.
--  Depende de schema.sql (participantes_torneo): migrate.js la corre al final con --todas
--  (ver src/config/migracionesPosteriores.js).

ALTER TABLE participantes_torneo ADD COLUMN IF NOT EXISTS resultado_final VARCHAR(100);
