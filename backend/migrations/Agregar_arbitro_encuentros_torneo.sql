-- Árbitro de cada encuentro (E2.8; contrato en docs/api-torneos.md §3.11). Idempotente.
--  arbitro_id INT NULL → instructores(instructor_id). NULL = sin árbitro asignado: cualquier instructor
--  puede registrar el resultado, como hasta ahora, así que los encuentros existentes no cambian.
--  Con árbitro asignado, solo ese instructor (o el staff) registra el resultado.
--  Sin ON DELETE: un instructor con encuentros arbitrados no se borra físicamente.

ALTER TABLE encuentros_torneo
  ADD COLUMN IF NOT EXISTS arbitro_id INT NULL REFERENCES instructores(instructor_id);

CREATE INDEX IF NOT EXISTS idx_encuentros_torneo_arbitro ON encuentros_torneo(arbitro_id);
