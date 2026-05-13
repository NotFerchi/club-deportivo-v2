ALTER TABLE sanciones
  ADD COLUMN IF NOT EXISTS fecha_resolucion TIMESTAMP(6);

ALTER TABLE sanciones
  ADD COLUMN IF NOT EXISTS resuelto_por INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'sanciones_resuelto_por_fkey'
      AND table_name = 'sanciones'
  ) THEN
    ALTER TABLE sanciones
      ADD CONSTRAINT sanciones_resuelto_por_fkey
      FOREIGN KEY (resuelto_por) REFERENCES usuarios(usuario_id);
  END IF;
END $$;
