CREATE TABLE IF NOT EXISTS espacios (
  espacio_id SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  tipo        VARCHAR(50),
  capacidad   INT,
  activo      BOOLEAN DEFAULT TRUE,
  descripcion TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);