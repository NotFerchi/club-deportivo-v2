-- Desactivar categorías de torneo (E2.6 / F-08; contrato en docs/api-torneos.md §3.7–§3.9). Idempotente.
--  PATCH /api/torneos/categorias/:categoria_id/desactivar marca activo = FALSE; la fila no se borra,
--  así que torneos y participantes que ya la usan conservan su categoria_id y su nombre.
--  Una categoría inactiva no se asigna a torneos nuevos ni se cambia a ella en una edición.
--  DEFAULT TRUE: todas las categorías existentes quedan activas.
--  No se agrega índice único por nombre: hoy hay duplicados en uso (p. ej. "Libre", ids 3 y 5) y el índice
--  fallaría. La unicidad la comprueba el servicio con la tabla bloqueada (categoriaService.js).

ALTER TABLE categorias_torneo ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
