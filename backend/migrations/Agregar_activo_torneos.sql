-- Borrado lógico de torneos (F-01 de docs/auditoria-torneos.md; contrato en docs/api-torneos.md §3.1). Idempotente.
--  DELETE /api/torneos/:torneo_id borra la fila si el torneo no tiene participantes ni encuentros;
--  si ya tiene, lo marca activo = FALSE y conserva su historial (las FKs no tienen ON DELETE).
--  Los torneos inactivos no aparecen en ningún listado ni detalle y responden 404.
--  DEFAULT TRUE: todos los torneos existentes quedan activos.

ALTER TABLE torneos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
