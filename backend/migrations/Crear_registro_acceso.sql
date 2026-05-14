CREATE TABLE IF NOT EXISTS registro_acceso (
  acceso_id   SERIAL PRIMARY KEY,
  socio_id    INT REFERENCES socios(socio_id),
  visita_id   INT REFERENCES visitas(visita_id),
  tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  metodo      VARCHAR(20) NOT NULL CHECK (metodo IN ('qr', 'manual')),
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (socio_id IS NOT NULL AND visita_id IS NULL)
    OR (socio_id IS NULL AND visita_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_registro_acceso_socio_timestamp
  ON registro_acceso(socio_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_registro_acceso_visita_timestamp
  ON registro_acceso(visita_id, "timestamp" DESC);
