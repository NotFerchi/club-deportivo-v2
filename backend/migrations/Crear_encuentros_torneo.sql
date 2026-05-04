CREATE TABLE IF NOT EXISTS encuentros_torneo (
  encuentro_id SERIAL PRIMARY KEY,
  torneo_id INT REFERENCES torneos(torneo_id),
  participante_1_id INT,
  participante_2_id INT,
  ronda INT DEFAULT 1,
  ganador_id INT,
  cancha_asignada VARCHAR(50),
  hora_programada TIMESTAMP,
  estado VARCHAR(20) DEFAULT 'pendiente',
  marcador_1 INT,
  marcador_2 INT
);

ALTER TABLE encuentros_torneo
  ADD COLUMN IF NOT EXISTS participante_1_id INT,
  ADD COLUMN IF NOT EXISTS participante_2_id INT,
  ADD COLUMN IF NOT EXISTS ganador_id INT,
  ADD COLUMN IF NOT EXISTS ronda INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cancha_asignada VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hora_programada TIMESTAMP,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS marcador_1 INT,
  ADD COLUMN IF NOT EXISTS marcador_2 INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'encuentros_torneo'::regclass
      AND c.contype = 'f'
      AND a.attname = 'participante_1_id'
  ) THEN
    ALTER TABLE encuentros_torneo
      ADD CONSTRAINT encuentros_torneo_participante_1_id_fk
      FOREIGN KEY (participante_1_id)
      REFERENCES participantes_torneo(participante_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'encuentros_torneo'::regclass
      AND c.contype = 'f'
      AND a.attname = 'participante_2_id'
  ) THEN
    ALTER TABLE encuentros_torneo
      ADD CONSTRAINT encuentros_torneo_participante_2_id_fk
      FOREIGN KEY (participante_2_id)
      REFERENCES participantes_torneo(participante_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'encuentros_torneo'::regclass
      AND c.contype = 'f'
      AND a.attname = 'ganador_id'
  ) THEN
    ALTER TABLE encuentros_torneo
      ADD CONSTRAINT encuentros_torneo_ganador_id_fk
      FOREIGN KEY (ganador_id)
      REFERENCES participantes_torneo(participante_id)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'encuentros_torneo'
      AND column_name = 'participante_1'
  ) THEN
    ALTER TABLE encuentros_torneo ALTER COLUMN participante_1 DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'encuentros_torneo'
      AND column_name = 'participante_2'
  ) THEN
    ALTER TABLE encuentros_torneo ALTER COLUMN participante_2 DROP NOT NULL;
  END IF;
END $$;
