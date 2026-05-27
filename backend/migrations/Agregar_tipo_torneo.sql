-- Agrega campo tipo_torneo a torneos (Individual o Equipos)
ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS tipo_torneo VARCHAR(20) NOT NULL DEFAULT 'Individual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'torneos' AND constraint_name = 'torneos_tipo_torneo_check'
  ) THEN
    ALTER TABLE torneos
      ADD CONSTRAINT torneos_tipo_torneo_check
      CHECK (tipo_torneo IN ('Individual', 'Equipos'));
  END IF;
END $$;
