const pool = require('../config/database');
const { getMexicoDateISO, getMexicoDayOfWeek } = require('../utils/mexicoDate');

const instructorController = {

    getClasesPorFecha: async (req, res) => {
        const { fecha } = req.query;
        const usuarioId = req.user.usuario_id;

        console.log('=== getClasesPorFecha ===');
        console.log('Fecha:', fecha);
        console.log('Usuario ID:', usuarioId);

        if (!fecha) {
            return res.status(400).json({ error: 'La fecha es requerida' });
        }

        try {
            const instructorQuery = await pool.query(
                `SELECT i.instructor_id FROM instructores i WHERE i.usuario_id = $1`,
                [usuarioId]
            );

            console.log('Instructor query result:', instructorQuery.rows);

            if (instructorQuery.rows.length === 0) {
                return res.status(404).json({ error: 'Instructor no encontrado' });
            }

            const instructorId = instructorQuery.rows[0].instructor_id;
            const [y, m, d] = fecha.split('-').map(Number);
            const diaSemana = new Date(y, m - 1, d).getDay() + 1;

            console.log('Instructor ID:', instructorId);
            console.log('Día semana calculado:', diaSemana);

            const query = `
                SELECT 
                    sp.sesion_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    COUNT(r.reserva_id) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                LEFT JOIN reservaciones r ON r.sesion_id = sp.sesion_id 
                    AND r.fecha_reserva = $1
                    AND r.estado IN ('Confirmada', 'No-Show')
                WHERE sp.instructor_id = $2 AND sp.dia_semana = $3
                GROUP BY sp.sesion_id, d.nombre, e.nombre, sp.hora_inicio, sp.hora_fin, sp.cupo_maximo
                ORDER BY sp.hora_inicio
            `;

            const result = await pool.query(query, [fecha, instructorId, diaSemana]);
            console.log('Clases encontradas:', result.rows.length);
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
                SELECT 
                    r.reserva_id,
                    s.socio_id,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as nombre_socio,
                    u.username as contacto,
                    'Socio' as tipo,
                    a.presente as asistio
                FROM reservaciones r
                JOIN socios s ON r.socio_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                LEFT JOIN asistencia a ON a.sesion_id = r.sesion_id 
                    AND a.socio_id = s.socio_id 
                    AND a.fecha = r.fecha_reserva
                WHERE r.sesion_id = $1 AND r.fecha_reserva = $2 
                    AND r.estado IN ('Confirmada', 'No-Show')
                ORDER BY u.apellido_paterno
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
                        WHEN 1 THEN 'Domingo'
                        WHEN 2 THEN 'Lunes'
                        WHEN 3 THEN 'Martes'
                        WHEN 4 THEN 'Miércoles'
                        WHEN 5 THEN 'Jueves'
                        WHEN 6 THEN 'Viernes'
                        WHEN 7 THEN 'Sábado'
                    END as dias,
                    COALESCE((
                        SELECT COUNT(*) FROM reservaciones r 
                        WHERE r.sesion_id = sp.sesion_id 
                        AND r.fecha_reserva >= CURRENT_DATE
                        AND r.estado = 'Confirmada'
                    ), 0) as cupo_actual
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

            // Usa México City — new Date().getDay() usa TZ del servidor (USA)
            const diaSemana = getMexicoDayOfWeek();
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
    // getMexicoDateISO() evita que toISOString() devuelva fecha UTC en vez de fecha MX
    const fechaConsulta = fecha || getMexicoDateISO();
    const [y, m, d] = fechaConsulta.split('-').map(Number);
    const diaSemana = new Date(y, m - 1, d).getDay() + 1;

    try {
        const query = `
            SELECT 
                sp.sesion_id,
                d.nombre as disciplina,
                e.nombre as espacio,
                sp.hora_inicio,
                sp.hora_fin,
                sp.cupo_maximo,
                sp.dia_semana,
                COALESCE(u.nombres || ' ' || COALESCE(u.apellido_paterno, ''), 'Sin instructor') as instructor,
                COUNT(r.reserva_id) as cupo_actual
            FROM sesiones_programadas sp
            JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
            JOIN espacios e ON sp.espacio_id = e.espacio_id
            LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
            LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
            LEFT JOIN reservaciones r ON r.sesion_id = sp.sesion_id 
                AND r.fecha_reserva = $1
                AND r.estado = 'Confirmada'
            WHERE sp.dia_semana = $2
            GROUP BY sp.sesion_id, d.nombre, e.nombre, sp.hora_inicio, sp.hora_fin, sp.cupo_maximo, sp.dia_semana, u.nombres, u.apellido_paterno
            ORDER BY sp.hora_inicio
        `;

        const result = await pool.query(query, [fechaConsulta, diaSemana]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en getClasesGeneral:', error);
        res.status(500).json({ error: 'Error al obtener clases', detalle: error.message });
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