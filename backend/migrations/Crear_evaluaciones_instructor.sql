-- Evaluación de instructores (E4, SC-01; contrato en docs/api-evaluaciones.md). Idempotente.
--  Una fila por socio, por sesión y por mes: el socio califica (1 a 5) al instructor de una sesión
--  en la que tiene inscripción Confirmada. instructor_id se guarda en la fila (el de la sesión al evaluar),
--  así el historial no cambia si después la sesión pasa a otro instructor.
--  periodo DATE: el día 1 del mes en America/Mexico_City; lo calcula el backend con
--  date_trunc('month', now() AT TIME ZONE 'America/Mexico_City'). El CHECK impide guardar otro día.
--  UNIQUE (socio_id, sesion_id, periodo): una evaluación por socio, sesión y mes. El backend responde
--  409 "Ya evaluaste esta clase este mes" cuando choca (23505), también con dos envíos simultáneos.
--  Las FKs no llevan ON DELETE: no se borra historial en cascada.
--  Índice (instructor_id, periodo): el listado y el promedio filtran por instructor y, opcionalmente, por mes.
--  La tabla es nueva, así que no hay versiones a medias: con IF NOT EXISTS basta para correrlo varias veces.
--  Depende de schema.sql (instructores, sesiones_programadas, socios): migrate.js lo corre al final con
--  --todas (ver config/migracionesPosteriores.js).

CREATE TABLE IF NOT EXISTS evaluaciones_instructor (
  evaluacion_id  SERIAL PRIMARY KEY,
  instructor_id  INT NOT NULL,
  sesion_id      INT NOT NULL,
  socio_id       INT NOT NULL,
  calificacion   SMALLINT NOT NULL,
  comentario     VARCHAR(500) NULL,
  periodo        DATE NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT evaluaciones_instructor_instructor_fk
    FOREIGN KEY (instructor_id) REFERENCES instructores (instructor_id),
  CONSTRAINT evaluaciones_instructor_sesion_fk
    FOREIGN KEY (sesion_id) REFERENCES sesiones_programadas (sesion_id),
  CONSTRAINT evaluaciones_instructor_socio_fk
    FOREIGN KEY (socio_id) REFERENCES socios (socio_id),
  CONSTRAINT evaluaciones_instructor_calificacion_check
    CHECK (calificacion BETWEEN 1 AND 5),
  CONSTRAINT evaluaciones_instructor_periodo_check
    CHECK (EXTRACT(DAY FROM periodo) = 1),
  CONSTRAINT evaluaciones_instructor_socio_sesion_periodo_key
    UNIQUE (socio_id, sesion_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_instructor_instructor_periodo
  ON evaluaciones_instructor (instructor_id, periodo);
