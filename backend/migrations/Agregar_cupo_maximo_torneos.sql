-- Cupo máximo de participantes por torneo (F-02 de docs/auditoria-torneos.md; contrato en docs/api-torneos.md). Idempotente.
--  cupo_maximo INTEGER NULL: NULL significa sin límite, así que los torneos existentes no cambian.
--  CHECK (cupo_maximo > 0): NULL pasa el CHECK. Como todas las filas actuales quedan en NULL, se crea
--  validado directamente (no hace falta NOT VALID + VALIDATE).

ALTER TABLE torneos ADD COLUMN IF NOT EXISTS cupo_maximo INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'torneos_cupo_maximo_check'
      AND conrelid = 'torneos'::regclass
  ) THEN
    ALTER TABLE torneos
      ADD CONSTRAINT torneos_cupo_maximo_check
      CHECK (cupo_maximo > 0);
  END IF;
END $$;
