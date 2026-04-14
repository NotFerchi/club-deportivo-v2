CREATE TABLE IF NOT EXISTS mantenimiento_espacios (
  mant_id      SERIAL PRIMARY KEY,
  espacio_id   INT REFERENCES espacios(espacio_id),
  motivo       TEXT,
  fecha_inicio TIMESTAMP,
  fecha_fin    TIMESTAMP,
  activo       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW()
);