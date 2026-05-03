CREATE TABLE IF NOT EXISTS categorias_torneo (
  categoria_id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS participantes_torneo (
  participante_id SERIAL PRIMARY KEY,
  torneo_id INT REFERENCES torneos(torneo_id),
  socio_id INT REFERENCES socios(socio_id),
  visita_id INT REFERENCES visitas(visita_id),
  nombre_externo VARCHAR(150),
  equipo_id INT REFERENCES equipos(equipo_id),
  categoria_id INT REFERENCES categorias_torneo(categoria_id),
  resultado_final VARCHAR(100)
);

ALTER TABLE participantes_torneo
  ADD COLUMN IF NOT EXISTS equipo_id INT REFERENCES equipos(equipo_id);

ALTER TABLE participantes_torneo
  ADD COLUMN IF NOT EXISTS categoria_id INT REFERENCES categorias_torneo(categoria_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'participantes_torneo_tipo_participante_check'
      AND conrelid = 'participantes_torneo'::regclass
  ) THEN
    ALTER TABLE participantes_torneo
      ADD CONSTRAINT participantes_torneo_tipo_participante_check
      CHECK (
        (
          (socio_id IS NOT NULL)::int +
          (visita_id IS NOT NULL)::int +
          (NULLIF(BTRIM(nombre_externo), '') IS NOT NULL)::int
        ) = 1
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'participantes_torneo_categoria_id_check'
      AND conrelid = 'participantes_torneo'::regclass
  ) THEN
    ALTER TABLE participantes_torneo
      ADD CONSTRAINT participantes_torneo_categoria_id_check
      CHECK (categoria_id IS NOT NULL) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS participantes_torneo_socio_unico
  ON participantes_torneo(torneo_id, socio_id)
  WHERE socio_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS participantes_torneo_visita_unica
  ON participantes_torneo(torneo_id, visita_id)
  WHERE visita_id IS NOT NULL;
