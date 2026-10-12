-- Esquema del módulo de torneos (B-17, paso 7 de docs/auditoria-torneos.md). Idempotente.
--  (a) CHECK de torneos.estado con los 5 estados de la máquina de estados (PR #9):
--      primero NOT VALID (no bloquea la tabla revisando filas) y luego VALIDATE.
--      Además, DEFAULT 'Abierto', igual que en Neon (las migraciones no lo creaban).
--  (b) encuentros_torneo.cancha_asignada pasa a VARCHAR(100): los espacios admiten nombres de hasta 100.
-- Las columnas heredadas ganador, participante_1 y participante_2 de encuentros_torneo NO se borran:
-- el código ya no las lee ni las escribe.

ALTER TABLE torneos ALTER COLUMN estado SET DEFAULT 'Abierto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'torneos_estado_check'
      AND conrelid = 'torneos'::regclass
  ) THEN
    ALTER TABLE torneos
      ADD CONSTRAINT torneos_estado_check
      CHECK (estado IN ('Abierto', 'Inscripciones_cerradas', 'En_curso', 'Finalizado', 'Cancelado'))
      NOT VALID;
  END IF;
END $$;

-- Validar una restricción ya validada no hace nada, así que esto también es idempotente.
ALTER TABLE torneos VALIDATE CONSTRAINT torneos_estado_check;

DO $$
BEGIN
  IF (
    SELECT character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'encuentros_torneo'
      AND column_name = 'cancha_asignada'
  ) < 100 THEN
    ALTER TABLE encuentros_torneo ALTER COLUMN cancha_asignada TYPE VARCHAR(100);
  END IF;
END $$;
