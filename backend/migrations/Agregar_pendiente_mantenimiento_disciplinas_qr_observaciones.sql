DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'estado_reserva'
      AND e.enumlabel = 'Pendiente'
  ) THEN
    ALTER TYPE estado_reserva ADD VALUE 'Pendiente';
  END IF;
END $$;

ALTER TABLE espacios
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'Activo';

ALTER TABLE espacios
  ADD COLUMN IF NOT EXISTS disciplina_id INT REFERENCES disciplinas(disciplina_id);

ALTER TABLE espacios
  ADD COLUMN IF NOT EXISTS capacidad_maxima INT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'espacios' AND column_name = 'capacidad'
  ) THEN
    UPDATE espacios
    SET capacidad_maxima = COALESCE(capacidad_maxima, capacidad)
    WHERE capacidad_maxima IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS espacios_disciplinas (
  espacio_id INT NOT NULL REFERENCES espacios(espacio_id) ON DELETE CASCADE,
  disciplina_id INT NOT NULL REFERENCES disciplinas(disciplina_id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (espacio_id, disciplina_id)
);

INSERT INTO espacios_disciplinas (espacio_id, disciplina_id)
SELECT espacio_id, disciplina_id
FROM espacios
WHERE disciplina_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS mantenimiento_espacios (
  mant_id SERIAL PRIMARY KEY,
  espacio_id INT REFERENCES espacios(espacio_id),
  motivo TEXT,
  fecha_inicio TIMESTAMP,
  fecha_fin TIMESTAMP,
  activo BOOLEAN DEFAULT TRUE,
  usuario_id INT REFERENCES usuarios(usuario_id),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE mantenimiento_espacios
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

ALTER TABLE mantenimiento_espacios
  ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(usuario_id);

ALTER TABLE registro_ludoteca
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

CREATE TABLE IF NOT EXISTS codigos_qr_pases (
  qr_id SERIAL PRIMARY KEY,
  pase_id INT NOT NULL REFERENCES pases(pase_id) ON DELETE CASCADE,
  codigo_qr TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_codigos_qr_pases_pase
  ON codigos_qr_pases(pase_id);

CREATE INDEX IF NOT EXISTS idx_codigos_qr_pases_pase_activo
  ON codigos_qr_pases(pase_id, activo);

CREATE INDEX IF NOT EXISTS idx_codigos_qr_pases_expira_en
  ON codigos_qr_pases(expira_en);

ALTER TABLE registro_acceso
  ADD COLUMN IF NOT EXISTS pase_id INT REFERENCES pases(pase_id);

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'registro_acceso'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%socio_id%'
      AND pg_get_constraintdef(oid) LIKE '%visita_id%'
      AND pg_get_constraintdef(oid) NOT LIKE '%pase_id%'
  LOOP
    EXECUTE format('ALTER TABLE registro_acceso DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'registro_acceso'::regclass
      AND conname = 'registro_acceso_un_sujeto_check'
  ) THEN
    ALTER TABLE registro_acceso
      ADD CONSTRAINT registro_acceso_un_sujeto_check
      CHECK (
        (
          (socio_id IS NOT NULL)::int +
          (visita_id IS NOT NULL)::int +
          (pase_id IS NOT NULL)::int
        ) = 1
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registro_acceso_pase_timestamp
  ON registro_acceso(pase_id, "timestamp" DESC);
