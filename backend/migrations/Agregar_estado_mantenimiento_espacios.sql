-- Agregar columna estado a espacios (si no existe)
ALTER TABLE espacios
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'Activo';

-- Actualizar estados basados en activo actual
UPDATE espacios
  SET estado = CASE WHEN activo THEN 'Activo' ELSE 'Inactivo' END
  WHERE estado = 'Activo' AND NOT activo;

-- Crear tabla de junction espacios <-> disciplinas (si no existe)
CREATE TABLE IF NOT EXISTS espacios_disciplinas (
  espacio_id INT NOT NULL REFERENCES espacios(espacio_id) ON DELETE CASCADE,
  disciplina_id INT NOT NULL REFERENCES disciplinas(disciplina_id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (espacio_id, disciplina_id)
);

-- Migrar disciplina_id existente a la tabla de junction
INSERT INTO espacios_disciplinas (espacio_id, disciplina_id)
SELECT espacio_id, disciplina_id
FROM espacios
WHERE disciplina_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Crear tabla de historial de mantenimiento (si no existe)
CREATE TABLE IF NOT EXISTS mantenimiento_espacios (
  mant_id SERIAL PRIMARY KEY,
  espacio_id INT REFERENCES espacios(espacio_id) ON DELETE CASCADE,
  motivo TEXT,
  fecha_inicio TIMESTAMP DEFAULT NOW(),
  fecha_fin TIMESTAMP,
  activo BOOLEAN DEFAULT TRUE,
  usuario_id INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agregar Pendiente al enum estado_reserva si no existe
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
