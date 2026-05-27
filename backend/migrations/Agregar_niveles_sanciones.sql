-- Agrega columnas para niveles de sanción: gravedad, fecha_inicio, fecha_fin
-- Los valores de gravedad son: Leve, Moderada, Grave

ALTER TABLE sanciones
  ADD COLUMN IF NOT EXISTS gravedad VARCHAR(20) DEFAULT 'Leve';

ALTER TABLE sanciones
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE;

ALTER TABLE sanciones
  ADD COLUMN IF NOT EXISTS fecha_fin DATE;

-- Poblar fecha_inicio desde fecha existente para registros ya creados
UPDATE sanciones
SET fecha_inicio = fecha::date
WHERE fecha_inicio IS NULL AND fecha IS NOT NULL;

-- Calcular fecha_fin según gravedad para registros ya creados
UPDATE sanciones
SET fecha_fin = CASE
    WHEN gravedad = 'Grave'    THEN fecha_inicio + INTERVAL '30 days'
    WHEN gravedad = 'Moderada' THEN fecha_inicio + INTERVAL '7 days'
    ELSE fecha_inicio + INTERVAL '1 day'
END
WHERE fecha_fin IS NULL AND fecha_inicio IS NOT NULL;

-- Agregar restricción CHECK para gravedad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'sanciones' AND constraint_name = 'sanciones_gravedad_check'
  ) THEN
    ALTER TABLE sanciones
      ADD CONSTRAINT sanciones_gravedad_check
      CHECK (gravedad IN ('Leve', 'Moderada', 'Grave'));
  END IF;
END $$;
