-- Ajuste para bases existentes: torneos debe exponer estado y validar fechas en PostgreSQL.
ALTER TABLE torneos
    ADD COLUMN IF NOT EXISTS estado VARCHAR(30);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'torneos_fecha_fin_check'
          AND conrelid = 'torneos'::regclass
    ) THEN
        ALTER TABLE torneos
            ADD CONSTRAINT torneos_fecha_fin_check CHECK (fecha_fin >= fecha_inicio);
    END IF;
END $$;
