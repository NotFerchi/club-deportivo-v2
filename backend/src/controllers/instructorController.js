const pool = require('../config/database');

const instructorController = {
    // ============================================
    // OBTENER CLASES DEL INSTRUCTOR POR FECHA
    // ============================================
   getClasesPorFecha: async (req, res) => {
    const { fecha } = req.query;
    const usuarioId = req.usuario.usuario_id;
    
    console.log('=== getClasesPorFecha ===');
    console.log('Fecha:', fecha);
    console.log('Usuario ID:', usuarioId);
    
    if (!fecha) {
        console.log('Error: Fecha no proporcionada');
        return res.status(400).json({ error: 'La fecha es requerida' });
    }
    
    try {
        // Obtener instructor_id
        const instructorQuery = await pool.query(
            `SELECT i.instructor_id FROM instructores i
             JOIN usuarios u ON i.usuario_id = u.usuario_id
             WHERE u.usuario_id = $1`,
            [usuarioId]
        );
        
        console.log('Instructor query result:', instructorQuery.rows);
        
        if (instructorQuery.rows.length === 0) {
            console.log('Error: Instructor no encontrado para usuario:', usuarioId);
            return res.status(404).json({ error: 'Instructor no encontrado' });
        }
        
        const instructorId = instructorQuery.rows[0].instructor_id;
        const diaSemana = new Date(fecha).getDay() + 1;
        
        console.log('Instructor ID:', instructorId);
        console.log('Día semana:', diaSemana);
        
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
                AND r.estado = 'Confirmada'
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
    
    // ============================================
    // OBTENER ALUMNOS DE UNA CLASE ESPECÍFICA
    // ============================================
    getAlumnosPorClase: async (req, res) => {
        const { sesionId } = req.params;
        const { fecha } = req.query;
        
        try {
            const query = `
                SELECT 
                    r.reserva_id,
                    s.socio_id,
                    u.nombres || ' ' || u.apellido_paterno as nombre_socio,
                    u.telefono,
                    u.email,
                    CASE 
                        WHEN r.socio_id IS NOT NULL THEN 'Socio'
                        ELSE 'Visita'
                    END as tipo,
                    a.presente as asistio
                FROM reservaciones r
                JOIN socios s ON r.socio_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                LEFT JOIN asistencia a ON a.sesion_id = r.sesion_id 
                    AND a.socio_id = s.socio_id 
                    AND a.fecha = r.fecha_reserva
                WHERE r.sesion_id = $1 AND r.fecha_reserva = $2 AND r.estado = 'Confirmada'
                ORDER BY u.apellido_paterno
            `;
            
            const result = await pool.query(query, [sesionId, fecha]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getAlumnosPorClase:', error);
            res.status(500).json({ error: 'Error al obtener alumnos' });
        }
    },
    
    // ============================================
    // REGISTRAR ASISTENCIA MANUAL
    // ============================================
    registrarAsistencia: async (req, res) => {
        const { sesionId, socioId, fecha, presente } = req.body;
        const usuarioId = req.usuario.usuario_id;
        
        try {
            // Verificar si ya existe registro de asistencia
            const existeQuery = await pool.query(
                `SELECT asistencia_id FROM asistencia 
                 WHERE sesion_id = $1 AND socio_id = $2 AND fecha = $3`,
                [sesionId, socioId, fecha]
            );
            
            if (existeQuery.rows.length > 0) {
                // Actualizar asistencia existente
                await pool.query(
                    `UPDATE asistencia SET presente = $1, registro = NOW()
                     WHERE asistencia_id = $2`,
                    [presente, existeQuery.rows[0].asistencia_id]
                );
            } else {
                // Crear nuevo registro de asistencia
                await pool.query(
                    `INSERT INTO asistencia (sesion_id, socio_id, fecha, presente, registro)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [sesionId, socioId, fecha, presente]
                );
            }
            
            // Si es No-Show, actualizar la reserva
            if (!presente) {
                await pool.query(
                    `UPDATE reservaciones SET no_show = TRUE, estado = 'No-Show'
                     WHERE sesion_id = $1 AND socio_id = $2 AND fecha_reserva = $3`,
                    [sesionId, socioId, fecha]
                );
            }
            
            // Registrar en log del sistema
            await pool.query(
                `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                 VALUES ($1, $2, $3, $4, $5)`,
                [usuarioId, 'REGISTRAR_ASISTENCIA', 'asistencia', 
                 `Sesión: ${sesionId}, Socio: ${socioId}, Presente: ${presente}`, 
                 req.ip || req.connection.remoteAddress]
            );
            
            res.json({ message: 'Asistencia registrada correctamente' });
        } catch (error) {
            console.error('Error en registrarAsistencia:', error);
            res.status(500).json({ error: 'Error al registrar asistencia' });
        }
    },
    
    // ============================================
    // OBTENER TODAS LAS CLASES DEL INSTRUCTOR
    // ============================================
    getMisClases: async (req, res) => {
        const usuarioId = req.usuario.usuario_id;
        
        try {
            const instructorQuery = await pool.query(
                `SELECT i.instructor_id FROM instructores i
                 JOIN usuarios u ON i.usuario_id = u.usuario_id
                 WHERE u.usuario_id = $1`,
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
                    COALESCE((
                        SELECT COUNT(*) FROM reservaciones r 
                        WHERE r.sesion_id = sp.sesion_id 
                        AND r.fecha_reserva >= CURRENT_DATE
                        AND r.estado = 'Confirmada'
                    ), 0) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                WHERE sp.instructor_id = $1 AND sp.activo = true
                ORDER BY sp.dia_semana, sp.hora_inicio
            `;
            
            const result = await pool.query(query, [instructorId]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getMisClases:', error);
            res.status(500).json({ error: 'Error al obtener clases' });
        }
    },
    
    // ============================================
    // OBTENER MÉTRICAS DEL INSTRUCTOR
    // ============================================
    getMetricas: async (req, res) => {
        const usuarioId = req.usuario.usuario_id;
        
        try {
            const instructorQuery = await pool.query(
                `SELECT i.instructor_id FROM instructores i
                 JOIN usuarios u ON i.usuario_id = u.usuario_id
                 WHERE u.usuario_id = $1`,
                [usuarioId]
            );
            
            if (instructorQuery.rows.length === 0) {
                return res.status(404).json({ error: 'Instructor no encontrado' });
            }
            
            const instructorId = instructorQuery.rows[0].instructor_id;
            
            // Asistencia promedio general
            const asistenciaQuery = await pool.query(`
                SELECT 
                    ROUND(AVG(CASE WHEN a.presente = true THEN 100 ELSE 0 END), 1) as promedio
                FROM asistencia a
                JOIN sesiones_programadas sp ON a.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1
            `, [instructorId]);
            
            // Convocatoria mensual (últimos 5 meses)
            const convocatoriaQuery = await pool.query(`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', r.fecha_reserva), 'Mon') as mes,
                    COUNT(DISTINCT r.reserva_id) as total
                FROM reservaciones r
                JOIN sesiones_programadas sp ON r.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1 
                    AND r.fecha_reserva >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 months')
                GROUP BY DATE_TRUNC('month', r.fecha_reserva)
                ORDER BY DATE_TRUNC('month', r.fecha_reserva) DESC
            `, [instructorId]);
            
            // Asistencia mensual
            const asistenciaMensualQuery = await pool.query(`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', a.fecha), 'Mon') as mes,
                    ROUND(AVG(CASE WHEN a.presente = true THEN 100 ELSE 0 END), 1) as porcentaje
                FROM asistencia a
                JOIN sesiones_programadas sp ON a.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1 
                    AND a.fecha >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 months')
                GROUP BY DATE_TRUNC('month', a.fecha)
                ORDER BY DATE_TRUNC('month', a.fecha) DESC
            `, [instructorId]);
            
            // Sesiones de hoy
            const hoy = new Date().toISOString().split('T')[0];
            const diaSemana = new Date().getDay() + 1;
            const sesionesHoyQuery = await pool.query(`
                SELECT COUNT(*) as total
                FROM sesiones_programadas sp
                WHERE sp.instructor_id = $1 AND sp.dia_semana = $2
            `, [instructorId, diaSemana]);
            
            // Total de alumnos únicos
            const totalAlumnosQuery = await pool.query(`
                SELECT COUNT(DISTINCT r.socio_id) as total
                FROM reservaciones r
                JOIN sesiones_programadas sp ON r.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1
            `, [instructorId]);
            
            res.json({
                asistenciaPromedio: parseFloat(asistenciaQuery.rows[0]?.promedio || 0),
                convocatoriaMensual: parseInt(convocatoriaQuery.rows[0]?.total || 0),
                sesionesHoy: parseInt(sesionesHoyQuery.rows[0]?.total || 0),
                totalAlumnos: parseInt(totalAlumnosQuery.rows[0]?.total || 0),
                asistenciaMensual: asistenciaMensualQuery.rows.reverse(),
                convocatoriaMensualData: convocatoriaQuery.rows.reverse()
            });
        } catch (error) {
            console.error('Error en getMetricas:', error);
            res.status(500).json({ error: 'Error al obtener métricas' });
        }
    },
    
    // ============================================
    // VER CLASES (para Recepción - vista general)
    // ============================================
    getClasesGeneral: async (req, res) => {
        const { fecha } = req.query;
        const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
        const diaSemana = new Date(fechaConsulta).getDay() + 1;
        
        try {
            const query = `
                SELECT 
                    sp.sesion_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    i.nombre as instructor,
                    COUNT(r.reserva_id) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                JOIN instructores i ON sp.instructor_id = i.instructor_id
                LEFT JOIN reservaciones r ON r.sesion_id = sp.sesion_id 
                    AND r.fecha_reserva = $1
                    AND r.estado = 'Confirmada'
                WHERE sp.dia_semana = $2 AND sp.activo = true
                GROUP BY sp.sesion_id, d.nombre, e.nombre, sp.hora_inicio, sp.hora_fin, sp.cupo_maximo, i.nombre
                ORDER BY sp.hora_inicio
            `;
            
            const result = await pool.query(query, [fechaConsulta, diaSemana]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getClasesGeneral:', error);
            res.status(500).json({ error: 'Error al obtener clases' });
        }
    }
};

module.exports = instructorController;