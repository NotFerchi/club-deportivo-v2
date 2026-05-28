const pool = require('../config/database');
const { getMexicoDateISO, getMexicoDayOfWeek } = require('../utils/mexicoDate');

const instructorController = {

    getClasesPorFecha: async (req, res) => {
        const { fecha } = req.query;
        const usuarioId = req.user.usuario_id;

        if (!fecha) {
            return res.status(400).json({ error: 'La fecha es requerida' });
        }

        try {
            const instructorQuery = await pool.query(
                `SELECT i.instructor_id FROM instructores i WHERE i.usuario_id = $1`,
                [usuarioId]
            );

            if (instructorQuery.rows.length === 0) {
                return res.status(404).json({ error: 'Instructor no encontrado' });
            }

            const instructorId = instructorQuery.rows[0].instructor_id;
            const [y, m, d] = fecha.split('-').map(Number);
            const _js = new Date(y, m - 1, d).getDay();
            const diaSemana = _js === 0 ? 7 : _js;

            const query = `
                SELECT
                    sp.sesion_id,
                    sp.espacio_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    (
                        SELECT COUNT(DISTINCT socio_id) FROM (
                            SELECT ic.socio_id FROM inscripciones_clases ic
                            WHERE ic.sesion_id = sp.sesion_id AND ic.estado = 'Confirmada'
                            UNION
                            SELECT r2.socio_id FROM reservaciones r2
                            WHERE r2.sesion_id = sp.sesion_id AND r2.fecha_reserva = $1
                              AND r2.estado IN ('Confirmada', 'No-Show') AND r2.socio_id IS NOT NULL
                        ) sub
                    ) + (
                        SELECT COUNT(*) FROM reservaciones r3
                        WHERE r3.sesion_id = sp.sesion_id AND r3.fecha_reserva = $1
                          AND r3.estado IN ('Confirmada', 'No-Show') AND r3.visita_id IS NOT NULL
                    ) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                WHERE sp.instructor_id = $2 AND sp.dia_semana = $3
                ORDER BY sp.hora_inicio
            `;

            const result = await pool.query(query, [fecha, instructorId, diaSemana]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getClasesPorFecha:', error);
            res.status(500).json({ error: 'Error al obtener clases', detalle: error.message });
        }
    },

    getAlumnosPorClase: async (req, res) => {
        const { sesionId } = req.params;
        const { fecha } = req.query;

        try {
            const query = `
                WITH participantes AS (
                    -- Inscritos vía inscripciones_clases (recurrentes del socio)
                    SELECT
                        ic.inscripcion_id,
                        NULL::int AS reserva_id,
                        ic.socio_id,
                        NULL::int AS visita_id
                    FROM inscripciones_clases ic
                    WHERE ic.sesion_id = $1
                      AND ic.estado = 'Confirmada'

                    UNION ALL

                    -- Agregados por instructor vía reservaciones para esta fecha
                    -- (excluye socios que ya están en inscripciones_clases)
                    SELECT
                        NULL::int AS inscripcion_id,
                        r.reserva_id,
                        r.socio_id,
                        r.visita_id
                    FROM reservaciones r
                    WHERE r.sesion_id = $1
                      AND r.fecha_reserva = $2
                      AND r.estado IN ('Confirmada', 'No-Show')
                      AND (r.socio_id IS NOT NULL OR r.visita_id IS NOT NULL)
                      AND (r.socio_id IS NULL OR NOT EXISTS (
                            SELECT 1 FROM inscripciones_clases ic2
                            WHERE ic2.sesion_id = $1
                              AND ic2.socio_id = r.socio_id
                              AND ic2.estado = 'Confirmada'
                          ))
                )
                SELECT
                    p.inscripcion_id,
                    p.reserva_id,
                    p.socio_id,
                    p.visita_id,
                    COALESCE(
                        NULLIF(TRIM(u.nombres || ' ' || COALESCE(u.apellido_paterno, '')), ''),
                        v.nombre_completo,
                        'Sin nombre'
                    ) AS nombre_socio,
                    CASE WHEN p.visita_id IS NOT NULL THEN 'Visita' ELSE 'Socio' END AS tipo,
                    a.presente AS asistio
                FROM participantes p
                LEFT JOIN socios s ON s.socio_id = p.socio_id
                LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
                LEFT JOIN visitas v ON v.visita_id = p.visita_id
                LEFT JOIN asistencia a ON a.sesion_id = $1
                    AND a.socio_id = p.socio_id
                    AND a.fecha = $2::date
                ORDER BY nombre_socio
            `;
            const result = await pool.query(query, [sesionId, fecha]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getAlumnosPorClase:', error);
            res.status(500).json({ error: 'Error al obtener alumnos', detalle: error.message });
        }
    },

    registrarAsistencia: async (req, res) => {
        const { sesionId, socioId, fecha, presente } = req.body;
        const usuarioId = req.user.usuario_id;

        try {
            const existeQuery = await pool.query(
                `SELECT asistencia_id FROM asistencia 
                 WHERE sesion_id = $1 AND socio_id = $2 AND fecha = $3`,
                [sesionId, socioId, fecha]
            );

            if (existeQuery.rows.length > 0) {
                await pool.query(
                    `UPDATE asistencia SET presente = $1, registro = NOW()
                     WHERE asistencia_id = $2`,
                    [presente, existeQuery.rows[0].asistencia_id]
                );
            } else {
                await pool.query(
                    `INSERT INTO asistencia (sesion_id, socio_id, fecha, presente, registro)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [sesionId, socioId, fecha, presente]
                );
            }

            try {
                await pool.query(
                    `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [usuarioId, 'REGISTRAR_ASISTENCIA', 'asistencia',
                     `Sesión: ${sesionId}, Socio: ${socioId}, Presente: ${presente}`,
                     req.ip || '']
                );
            } catch (logError) {
                console.warn('No se pudo guardar log:', logError.message);
            }

            res.json({ message: 'Asistencia registrada correctamente' });
        } catch (error) {
            console.error('Error en registrarAsistencia:', error);
            res.status(500).json({ error: 'Error al registrar asistencia', detalle: error.message });
        }
    },

    getMisClases: async (req, res) => {
        const usuarioId = req.user.usuario_id;

        try {
            const instructorQuery = await pool.query(
                `SELECT i.instructor_id FROM instructores i WHERE i.usuario_id = $1`,
                [usuarioId]
            );

            if (instructorQuery.rows.length === 0) {
                return res.status(404).json({ error: 'Instructor no encontrado' });
            }

            const instructorId = instructorQuery.rows[0].instructor_id;

            const query = `
                SELECT 
                    sp.sesion_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    sp.dia_semana,
                    CASE sp.dia_semana
                        WHEN 1 THEN 'Lunes'
                        WHEN 2 THEN 'Martes'
                        WHEN 3 THEN 'Miércoles'
                        WHEN 4 THEN 'Jueves'
                        WHEN 5 THEN 'Viernes'
                        WHEN 6 THEN 'Sábado'
                        WHEN 7 THEN 'Domingo'
                    END as dias,
                    (
                        SELECT COUNT(*) FROM inscripciones_clases ic
                        WHERE ic.sesion_id = sp.sesion_id AND ic.estado = 'Confirmada'
                    ) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                WHERE sp.instructor_id = $1
                ORDER BY sp.dia_semana, sp.hora_inicio
            `;

            const result = await pool.query(query, [instructorId]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getMisClases:', error);
            res.status(500).json({ error: 'Error al obtener clases', detalle: error.message });
        }
    },

    getMetricas: async (req, res) => {
        const usuarioId = req.user.usuario_id;

        try {
            const instructorQuery = await pool.query(
                `SELECT i.instructor_id FROM instructores i WHERE i.usuario_id = $1`,
                [usuarioId]
            );

            if (instructorQuery.rows.length === 0) {
                return res.status(404).json({ error: 'Instructor no encontrado' });
            }

            const instructorId = instructorQuery.rows[0].instructor_id;

            const asistenciaQuery = await pool.query(`
                SELECT ROUND(AVG(CASE WHEN a.presente = true THEN 100 ELSE 0 END), 1) as promedio
                FROM asistencia a
                JOIN sesiones_programadas sp ON a.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1
            `, [instructorId]);

            const convocatoriaQuery = await pool.query(`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', r.fecha_reserva), 'Mon') as mes,
                    COUNT(DISTINCT r.reserva_id) as total
                FROM reservaciones r
                JOIN sesiones_programadas sp ON r.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1 
                    AND r.fecha_reserva >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 months')
                GROUP BY DATE_TRUNC('month', r.fecha_reserva)
                ORDER BY DATE_TRUNC('month', r.fecha_reserva)
            `, [instructorId]);

            const asistenciaMensualQuery = await pool.query(`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', a.fecha), 'Mon') as mes,
                    ROUND(AVG(CASE WHEN a.presente = true THEN 100 ELSE 0 END), 1) as porcentaje
                FROM asistencia a
                JOIN sesiones_programadas sp ON a.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1 
                    AND a.fecha >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 months')
                GROUP BY DATE_TRUNC('month', a.fecha)
                ORDER BY DATE_TRUNC('month', a.fecha)
            `, [instructorId]);

            const fechaMx = getMexicoDateISO();
            const [y, m, d] = fechaMx.split('-').map(Number);
            const rawDay = new Date(y, m - 1, d).getDay();
            const diaSemana = rawDay === 0 ? 7 : rawDay;
            const sesionesHoyQuery = await pool.query(`
                SELECT COUNT(*) as total
                FROM sesiones_programadas sp
                WHERE sp.instructor_id = $1 AND sp.dia_semana = $2
            `, [instructorId, diaSemana]);

            const totalAlumnosQuery = await pool.query(`
                SELECT COUNT(DISTINCT r.socio_id) as total
                FROM reservaciones r
                JOIN sesiones_programadas sp ON r.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1
            `, [instructorId]);

            res.json({
                asistenciaPromedio: parseFloat(asistenciaQuery.rows[0]?.promedio || 0),
                convocatoriaMensual: parseInt(convocatoriaQuery.rows[convocatoriaQuery.rows.length - 1]?.total || 0),
                sesionesHoy: parseInt(sesionesHoyQuery.rows[0]?.total || 0),
                totalAlumnos: parseInt(totalAlumnosQuery.rows[0]?.total || 0),
                asistenciaMensual: asistenciaMensualQuery.rows,
                convocatoriaMensualData: convocatoriaQuery.rows
            });
        } catch (error) {
            console.error('Error en getMetricas:', error);
            res.status(500).json({ error: 'Error al obtener métricas', detalle: error.message });
        }
    },

    getClasesGeneral: async (req, res) => {
        const { fecha } = req.query;
        const fechaConsulta = fecha || getMexicoDateISO();
        const [y, m, d] = fechaConsulta.split('-').map(Number);
        const rawDay = new Date(y, m - 1, d).getDay();
        const diaSemana = rawDay === 0 ? 7 : rawDay;

        try {
            const query = `
                SELECT
                    sp.sesion_id,
                    sp.espacio_id,
                    sp.disciplina_id,
                    sp.instructor_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    sp.dia_semana,
                    COALESCE(u.nombres || ' ' || COALESCE(u.apellido_paterno, ''), 'Sin instructor') as instructor,
                    COALESCE((
                        SELECT COUNT(*) FROM (
                            SELECT 'socio-' || ic.socio_id AS inscrito_key
                            FROM inscripciones_clases ic
                            WHERE ic.sesion_id = sp.sesion_id
                              AND ic.estado = 'Confirmada'
                            UNION
                            SELECT 'socio-' || r.socio_id AS inscrito_key
                            FROM reservaciones r
                            WHERE r.sesion_id = sp.sesion_id
                              AND r.fecha_reserva = $2::date
                              AND LOWER(r.estado::text) NOT IN ('cancelada', 'cancelado')
                              AND r.socio_id IS NOT NULL
                        ) inscritos
                    ), 0) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
                LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
                WHERE sp.dia_semana = $1
                GROUP BY sp.sesion_id, sp.espacio_id, sp.disciplina_id, sp.instructor_id,
                         d.nombre, e.nombre, sp.hora_inicio, sp.hora_fin, sp.cupo_maximo,
                         sp.dia_semana, u.nombres, u.apellido_paterno
                ORDER BY sp.hora_inicio
            `;

            const result = await pool.query(query, [diaSemana, fechaConsulta]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getClasesGeneral:', error);
            res.status(500).json({ error: 'Error al obtener clases', detalle: error.message });
        }
    },

    getInscritosPorSesion: async (req, res) => {
        const { sesionId } = req.params;
        const fecha = req.query.fecha || null;
        try {
            const result = await pool.query(`
                WITH inscritos AS (
                    SELECT
                        ic.inscripcion_id::text AS inscripcion_id,
                        ic.socio_id,
                        'Socio' AS tipo,
                        ic.fecha_inscripcion
                    FROM inscripciones_clases ic
                    WHERE ic.sesion_id = $1
                      AND ic.estado = 'Confirmada'

                    UNION ALL

                    SELECT
                        ('reserva-' || MIN(r.reserva_id))::text AS inscripcion_id,
                        r.socio_id,
                        'Socio' AS tipo,
                        MIN(r.fecha_creacion) AS fecha_inscripcion
                    FROM reservaciones r
                    WHERE r.sesion_id = $1
                      AND ($2::date IS NULL OR r.fecha_reserva = $2::date)
                      AND LOWER(r.estado::text) NOT IN ('cancelada', 'cancelado')
                      AND r.socio_id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM inscripciones_clases ic
                          WHERE ic.sesion_id = r.sesion_id
                            AND ic.socio_id = r.socio_id
                            AND ic.estado = 'Confirmada'
                      )
                    GROUP BY r.socio_id
                )
                SELECT
                    inscritos.inscripcion_id,
                    inscritos.socio_id,
                    COALESCE(
                        NULLIF(TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellido_paterno, ''))), ''),
                        'Sin nombre'
                    ) AS nombre_socio,
                    COALESCE(s.numero_socio, '') AS numero_socio,
                    inscritos.tipo,
                    inscritos.fecha_inscripcion
                FROM inscritos
                LEFT JOIN socios s ON s.socio_id = inscritos.socio_id
                LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
                ORDER BY nombre_socio
            `, [sesionId, fecha]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getInscritosPorSesion:', error);
            res.status(500).json({ error: 'Error al obtener inscritos' });
        }
    },

    getTorneos: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT t.torneo_id, t.nombre, t.fecha_inicio, t.fecha_fin, 
                       d.nombre as disciplina,
                       COUNT(p.participante_id) as total_participantes
                FROM torneos t
                JOIN disciplinas d ON t.disciplina_id = d.disciplina_id
                LEFT JOIN participantes_torneo p ON p.torneo_id = t.torneo_id
                GROUP BY t.torneo_id, t.nombre, t.fecha_inicio, t.fecha_fin, d.nombre
                ORDER BY t.fecha_inicio DESC
            `);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener torneos', detalle: error.message });
        }
    },

    getEncuentros: async (req, res) => {
        const { torneoId } = req.params;
        try {
            const result = await pool.query(`
                SELECT * FROM encuentros_torneo
                WHERE torneo_id = $1
                ORDER BY ronda, encuentro_id
            `, [torneoId]);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener encuentros', detalle: error.message });
        }
    },

    inscribirSocioClase: async (req, res) => {
        const { sesion_id, socio_id, visita_id, fecha } = req.body;
        if (!sesion_id || (!socio_id && !visita_id) || !fecha) {
            return res.status(400).json({ error: 'sesion_id, (socio_id o visita_id) y fecha son requeridos' });
        }
        try {
            const existe = await pool.query(
                `SELECT reserva_id FROM reservaciones
                 WHERE sesion_id = $1 AND socio_id = $2 AND fecha_reserva = $3
                 AND LOWER(estado::text) != 'cancelada'`,
                [sesion_id, socio_id, fecha]
            );
            if (existe.rowCount > 0) {
                return res.status(409).json({ error: 'El socio ya está inscrito en esta clase' });
            }
            // Verificar que el socio no tenga sanciones activas
            const sancion = await pool.query(
                `SELECT sancion_id FROM sanciones
                 WHERE socio_id = $1
                 AND LOWER(estado::text) IN ('activa', 'activo')
                 AND COALESCE(fecha_fin, CURRENT_DATE) >= CURRENT_DATE
                 LIMIT 1`,
                [socio_id]
            );
            if (sancion.rowCount > 0) {
                return res.status(403).json({ error: 'El socio tiene una sanción activa y no puede inscribirse' });
            }
            const sesion = await pool.query(
                `SELECT sp.cupo_maximo, sp.hora_inicio, sp.hora_fin,
                        COUNT(r.reserva_id) as inscritos
                 FROM sesiones_programadas sp
                 LEFT JOIN reservaciones r ON r.sesion_id = sp.sesion_id
                     AND r.fecha_reserva = $2
                     AND LOWER(r.estado::text) != 'cancelada'
                 WHERE sp.sesion_id = $1
                 GROUP BY sp.sesion_id, sp.cupo_maximo, sp.hora_inicio, sp.hora_fin`,
                [sesion_id, fecha]
            );
            if (sesion.rowCount === 0) {
                return res.status(404).json({ error: 'Sesión no encontrada' });
            }
            const { cupo_maximo, hora_inicio, hora_fin, inscritos } = sesion.rows[0];
            if (parseInt(inscritos) >= parseInt(cupo_maximo)) {
                return res.status(400).json({ error: 'No hay cupo disponible en esta clase' });
            }

            const result = await pool.query(
                `INSERT INTO reservaciones (sesion_id, socio_id, visita_id, fecha_reserva, hora_inicio, hora_fin, estado)
                 VALUES ($1, $2, $3, $4, $5, $6, 'Confirmada')
                 RETURNING reserva_id`,
                [sesion_id, socio_id || null, visita_id || null, fecha, hora_inicio, hora_fin]
            );

            res.status(201).json({ ok: true, reserva_id: result.rows[0].reserva_id });
        } catch (error) {
            console.error('Error en inscribirSocioClase:', error);
            res.status(500).json({ error: 'Error al inscribir socio', detalle: error.message });
        }
    },

    registrarGanador: async (req, res) => {
        const { encuentroId } = req.params;
        const { ganador } = req.body;
        try {
            await pool.query(
                `UPDATE encuentros_torneo SET ganador = $1 WHERE encuentro_id = $2`,
                [ganador, encuentroId]
            );
            res.json({ message: 'Ganador registrado correctamente' });
        } catch (error) {
            res.status(500).json({ error: 'Error al registrar ganador', detalle: error.message });
        }
    }
};

module.exports = instructorController;
