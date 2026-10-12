-- Paso 7 de docs/auditoria-torneos.md (B-06, B-21). Script de datos, idempotente: correrlo dos veces
-- no cambia nada. No borra torneos, participantes ni encuentros.
--  1) Los torneos 1, 2, 3, 26, 33, 41, 42 y 43 (abril-junio de 2026) son datos de prueba: pasan a
--     'Cancelado'. Así sus brackets rotos (1 y 42), el campeón del 33, el doble bracket del 2 y sus
--     participantes sin categoria_id dejan de afectar: un torneo cancelado no admite inscripciones,
--     resultados, cancha ni cambios de estado.
--  2) Torneo 44 (Abierto, real): sus participantes pasan a la categoría del torneo (regla del PR #12).
-- Uso: node scripts/aplicarSql.js scripts/datos/2026-10-12_torneos_prueba.sql

BEGIN;

-- ── Antes ────────────────────────────────────────────────────────────────────
SELECT 'antes' AS momento, torneo_id, nombre, estado
  FROM torneos
 WHERE torneo_id IN (1, 2, 3, 26, 33, 41, 42, 43)
 ORDER BY torneo_id;

SELECT 'antes' AS momento, p.participante_id, p.categoria_id AS categoria_participante, t.categoria_id AS categoria_torneo
  FROM participantes_torneo p
  JOIN torneos t ON t.torneo_id = p.torneo_id
 WHERE t.torneo_id = 44
 ORDER BY p.participante_id;

SELECT 'antes' AS momento,
       (SELECT COUNT(*) FROM torneos)::int AS torneos,
       (SELECT COUNT(*) FROM participantes_torneo)::int AS participantes,
       (SELECT COUNT(*) FROM encuentros_torneo)::int AS encuentros;

-- ── Cambios ──────────────────────────────────────────────────────────────────
UPDATE torneos
   SET estado = 'Cancelado'
 WHERE torneo_id IN (1, 2, 3, 26, 33, 41, 42, 43)
   AND estado IS DISTINCT FROM 'Cancelado';

UPDATE participantes_torneo p
   SET categoria_id = t.categoria_id
  FROM torneos t
 WHERE t.torneo_id = p.torneo_id
   AND t.torneo_id = 44
   AND t.categoria_id IS NOT NULL
   AND p.categoria_id IS DISTINCT FROM t.categoria_id;

-- ── Después ──────────────────────────────────────────────────────────────────
SELECT 'después' AS momento, torneo_id, nombre, estado
  FROM torneos
 WHERE torneo_id IN (1, 2, 3, 26, 33, 41, 42, 43)
 ORDER BY torneo_id;

SELECT 'después' AS momento, p.participante_id, p.categoria_id AS categoria_participante, t.categoria_id AS categoria_torneo
  FROM participantes_torneo p
  JOIN torneos t ON t.torneo_id = p.torneo_id
 WHERE t.torneo_id = 44
 ORDER BY p.participante_id;

SELECT 'después' AS momento,
       (SELECT COUNT(*) FROM torneos)::int AS torneos,
       (SELECT COUNT(*) FROM participantes_torneo)::int AS participantes,
       (SELECT COUNT(*) FROM encuentros_torneo)::int AS encuentros;

COMMIT;
