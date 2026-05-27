CREATE TABLE IF NOT EXISTS pases (
  pase_id SERIAL PRIMARY KEY,
  tipo_pase VARCHAR(20) NOT NULL CHECK (tipo_pase IN ('visita', 'dia')),
  socio_id INT NULL,
  nombre_completo VARCHAR(150) NOT NULL,
  identificacion VARCHAR(100),
  correo VARCHAR(150),
  telefono VARCHAR(20) NOT NULL,
  mayor_16 BOOLEAN NOT NULL,
  fecha_pase DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada TIMESTAMP NOT NULL DEFAULT NOW(),
  hora_salida TIMESTAMP NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'cancelado')),
  creado_por INT NULL,
  observaciones TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pases_fecha ON pases(fecha_pase);
CREATE INDEX IF NOT EXISTS idx_pases_estado ON pases(estado);
CREATE INDEX IF NOT EXISTS idx_pases_tipo ON pases(tipo_pase);
