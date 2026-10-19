-- Periodo de inscripción de cada torneo (F-07 de docs/auditoria-torneos.md). Idempotente.
--  fecha_inicio_inscripcion y fecha_fin_inscripcion: DATE NULL, inclusivas, comparadas con "hoy" en
--  America/Mexico_City. NULL en el inicio: sin límite inicial. NULL en el fin: la inscripción cierra
--  al llegar fecha_inicio (se inscribe hasta el día anterior); sin fecha_inicio, sin límite.
--  Los CHECK repiten las reglas que la API valida con 400; NULL pasa los dos. Las filas actuales
--  quedan en NULL, así que se crean validados directamente.

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS fecha_inicio_inscripcion DATE NULL,
  ADD COLUMN IF NOT EXISTS fecha_fin_inscripcion DATE NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'torneos_periodo_inscripcion_check'
      AND conrelid = 'torneos'::regclass
  ) THEN
    ALTER TABLE torneos
      ADD CONSTRAINT torneos_periodo_inscripcion_check
      CHECK (fecha_fin_inscripcion >= fecha_inicio_inscripcion);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'torneos_inscripcion_antes_inicio_check'
      AND conrelid = 'torneos'::regclass
  ) THEN
    ALTER TABLE torneos
      ADD CONSTRAINT torneos_inscripcion_antes_inicio_check
      CHECK (fecha_inicio_inscripcion <= fecha_inicio AND fecha_fin_inscripcion <= fecha_inicio);
  END IF;
END $$;
