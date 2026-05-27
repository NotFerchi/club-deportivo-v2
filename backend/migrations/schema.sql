-- ==========================================
-- 1. TIPOS ENUMERADOS (ENUMS)
-- ==========================================
CREATE TYPE estado_reserva AS ENUM ('Confirmada', 'Cancelada', 'No-Show', 'Sancionada');
CREATE TYPE modalidad_socio AS ENUM ('Individual', 'Familiar');
CREATE TYPE tipo_socio AS ENUM ('Accionista', 'Rentista');

-- ==========================================
-- 2. SEGURIDAD Y USUARIOS
-- ==========================================
CREATE TABLE roles (
    rol_id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE permisos (
    permiso_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE roles_permisos (
    rol_id INT REFERENCES roles(rol_id),
    permiso_id INT REFERENCES permisos(permiso_id),
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE usuarios (
    usuario_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol_id INT REFERENCES roles(rol_id),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    nombres VARCHAR(100),
    apellido_paterno VARCHAR(100),
    apellido_materno VARCHAR(100),
    curp VARCHAR(18) UNIQUE,
    telefono VARCHAR(20),
    fecha_nacimiento DATE,
    genero VARCHAR(20),
    direccion TEXT
);

-- ==========================================
-- 3. GESTIÓN DE SOCIOS Y ACCIONES
-- ==========================================
CREATE TABLE acciones_familiares (
    accion_id SERIAL PRIMARY KEY,
    codigo_accion VARCHAR(20) UNIQUE NOT NULL,
    fecha_registro TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE socios (
    socio_id SERIAL PRIMARY KEY,
    accion_id INT REFERENCES acciones_familiares(accion_id),
    tipo tipo_socio NOT NULL,
    modalidad modalidad_socio NOT NULL,
    es_titular BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    numero_socio VARCHAR(20) UNIQUE,
    usuario_id INT REFERENCES usuarios(usuario_id),
    nombre_emergencia VARCHAR(150),
    tel_emergencia VARCHAR(20)
);

CREATE TABLE codigos_qr_socios (
    qr_id SERIAL PRIMARY KEY,
    socio_id INT NOT NULL REFERENCES socios(socio_id) ON DELETE CASCADE,
    codigo_qr TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_codigos_qr_socios_socio
    ON codigos_qr_socios(socio_id);

CREATE INDEX idx_codigos_qr_socios_socio_activo
    ON codigos_qr_socios(socio_id, activo);

CREATE UNIQUE INDEX idx_codigos_qr_socios_activo_unico
    ON codigos_qr_socios(socio_id)
    WHERE activo = TRUE;

CREATE TABLE visitas (
    visita_id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    identificacion_tipo VARCHAR(50),
    socio_id INT REFERENCES socios(socio_id),
    correo VARCHAR(150),
    telefono VARCHAR(20),
    mayor_16 BOOLEAN DEFAULT TRUE,
    observaciones TEXT,
    fecha_visita DATE DEFAULT CURRENT_DATE,
    hora_entrada TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    hora_salida TIMESTAMP(6),
    vigente BOOLEAN DEFAULT TRUE
);

CREATE TABLE pases (
    pase_id SERIAL PRIMARY KEY,
    tipo_pase VARCHAR(20) NOT NULL CHECK (tipo_pase IN ('visita', 'dia')),
    socio_id INT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    identificacion VARCHAR(100),
    correo VARCHAR(150),
    telefono VARCHAR(20) NOT NULL,
    mayor_16 BOOLEAN NOT NULL,
    fecha_pase DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_entrada TIMESTAMP NOT NULL DEFAULT NOW(),
    hora_salida TIMESTAMP NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'cancelado')),
    creado_por INT NULL,
    observaciones TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pases_fecha
    ON pases(fecha_pase);

CREATE INDEX idx_pases_estado
    ON pases(estado);

CREATE INDEX idx_pases_tipo
    ON pases(tipo_pase);

CREATE TABLE codigos_qr_visitas (
    qr_id SERIAL PRIMARY KEY,
    visita_id INT NOT NULL REFERENCES visitas(visita_id) ON DELETE CASCADE,
    codigo_qr TEXT NOT NULL,
    expira_en TIMESTAMPTZ NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_codigos_qr_visitas_visita
    ON codigos_qr_visitas(visita_id);

CREATE INDEX idx_codigos_qr_visitas_visita_activo
    ON codigos_qr_visitas(visita_id, activo);

CREATE INDEX idx_codigos_qr_visitas_expira_en
    ON codigos_qr_visitas(expira_en);

-- ==========================================
-- 4. INFRAESTRUCTURA Y DEPORTES
-- ==========================================
CREATE TABLE disciplinas (
    disciplina_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE espacios (
    espacio_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    capacidad_maxima INT CHECK (capacidad_maxima > 0),
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE instructores (
    instructor_id SERIAL PRIMARY KEY,
    especialidad VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    usuario_id INT REFERENCES usuarios(usuario_id)
);

-- ==========================================
-- 5. SESIONES Y RESERVACIONES
-- ==========================================
CREATE TABLE sesiones_programadas (
    sesion_id SERIAL PRIMARY KEY,
    disciplina_id INT REFERENCES disciplinas(disciplina_id),
    espacio_id INT REFERENCES espacios(espacio_id),
    instructor_id INT REFERENCES instructores(instructor_id),
    dia_semana INT CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME(6) NOT NULL,
    hora_fin TIME(6) NOT NULL,
    cupo_maximo INT
);

CREATE TABLE reservaciones (
    reserva_id SERIAL PRIMARY KEY,
    espacio_id INT REFERENCES espacios(espacio_id),
    socio_id INT NOT NULL REFERENCES socios(socio_id),
    fecha_reserva DATE NOT NULL,
    hora_inicio TIME(6) NOT NULL,
    hora_fin TIME(6) NOT NULL,
    estado estado_reserva DEFAULT 'Confirmada',
    no_show BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES usuarios(usuario_id),
    sesion_id INT REFERENCES sesiones_programadas(sesion_id)
);

CREATE TABLE asistencia (
    asistencia_id SERIAL PRIMARY KEY,
    sesion_id INT REFERENCES sesiones_programadas(sesion_id),
    socio_id INT REFERENCES socios(socio_id),
    visita_id INT REFERENCES visitas(visita_id),
    fecha DATE DEFAULT CURRENT_DATE,
    presente BOOLEAN DEFAULT TRUE,
    registro TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 6. TORNEOS Y EQUIPOS
-- ==========================================
CREATE TABLE categorias_torneo (
    categoria_id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE torneos (
    torneo_id SERIAL PRIMARY KEY,
    disciplina_id INT REFERENCES disciplinas(disciplina_id),
    nombre VARCHAR(150) NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(30),
    categoria_id INT REFERENCES categorias_torneo(categoria_id),
    CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE equipos (
    equipo_id SERIAL PRIMARY KEY,
    nombre_equipo VARCHAR(100) NOT NULL,
    capitan_id INT REFERENCES socios(socio_id),
    fecha_registro DATE DEFAULT CURRENT_DATE
);

CREATE TABLE participantes_torneo (
    participante_id SERIAL PRIMARY KEY,
    torneo_id INT NOT NULL REFERENCES torneos(torneo_id),
    socio_id INT REFERENCES socios(socio_id),
    visita_id INT REFERENCES visitas(visita_id),
    nombre_externo VARCHAR(150),
    equipo_id INT REFERENCES equipos(equipo_id),
    categoria_id INT NOT NULL REFERENCES categorias_torneo(categoria_id),
    resultado_final VARCHAR(100),
    CHECK (
        (
            (socio_id IS NOT NULL)::int +
            (visita_id IS NOT NULL)::int +
            (NULLIF(BTRIM(nombre_externo), '') IS NOT NULL)::int
        ) = 1
    )
);

CREATE UNIQUE INDEX participantes_torneo_socio_unico
    ON participantes_torneo(torneo_id, socio_id)
    WHERE socio_id IS NOT NULL;

CREATE UNIQUE INDEX participantes_torneo_visita_unica
    ON participantes_torneo(torneo_id, visita_id)
    WHERE visita_id IS NOT NULL;

CREATE TABLE miembros_equipo (
    miembro_id SERIAL PRIMARY KEY,
    equipo_id INT REFERENCES equipos(equipo_id),
    socio_id INT REFERENCES socios(socio_id),
    visita_id INT REFERENCES visitas(visita_id)
);

-- ==========================================
-- 7. ADMINISTRACIÓN Y LUDOTECA
-- ==========================================
CREATE TABLE registro_ludoteca (
    registro_id SERIAL PRIMARY KEY,
    socio_padre_id INT REFERENCES socios(socio_id),
    nombre_hijo VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    hora_entrada TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    hora_salida TIMESTAMP(6)
);

CREATE TABLE sanciones (
    sancion_id SERIAL PRIMARY KEY,
    socio_id INT NOT NULL REFERENCES socios(socio_id),
    origen VARCHAR(50) NOT NULL,
    motivo TEXT NOT NULL,
    fecha TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'Activo',
    resuelto_por INT REFERENCES usuarios(usuario_id),
    fecha_resolucion TIMESTAMP(6),
    registro_ludoteca_id INT REFERENCES registro_ludoteca(registro_id)
);

-- ==========================================
-- 8. INSCRIPCIONES A CLASES
-- ==========================================
CREATE TABLE inscripciones_clases (
    inscripcion_id SERIAL PRIMARY KEY,
    sesion_id INT REFERENCES sesiones_programadas(sesion_id),
    socio_id INT REFERENCES socios(socio_id),
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'Confirmada', -- Para manejar cancelaciones después
    UNIQUE(sesion_id, socio_id)
);
