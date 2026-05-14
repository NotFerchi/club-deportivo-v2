CREATE TABLE IF NOT EXISTS codigos_qr_socios (
  qr_id      SERIAL PRIMARY KEY,
  socio_id   INT NOT NULL REFERENCES socios(socio_id) ON DELETE CASCADE,
  codigo_qr  TEXT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_codigos_qr_socios_socio
  ON codigos_qr_socios(socio_id);

CREATE INDEX IF NOT EXISTS idx_codigos_qr_socios_socio_activo
  ON codigos_qr_socios(socio_id, activo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_codigos_qr_socios_activo_unico
  ON codigos_qr_socios(socio_id)
  WHERE activo = TRUE;
