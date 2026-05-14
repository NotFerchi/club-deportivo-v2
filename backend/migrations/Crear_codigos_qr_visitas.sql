CREATE TABLE IF NOT EXISTS codigos_qr_visitas (
  qr_id      SERIAL PRIMARY KEY,
  visita_id  INT NOT NULL REFERENCES visitas(visita_id) ON DELETE CASCADE,
  codigo_qr  TEXT NOT NULL,
  expira_en  TIMESTAMPTZ NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_codigos_qr_visitas_visita
  ON codigos_qr_visitas(visita_id);

CREATE INDEX IF NOT EXISTS idx_codigos_qr_visitas_visita_activo
  ON codigos_qr_visitas(visita_id, activo);

CREATE INDEX IF NOT EXISTS idx_codigos_qr_visitas_expira_en
  ON codigos_qr_visitas(expira_en);
