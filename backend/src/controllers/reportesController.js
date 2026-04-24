const pool = require('../config/database');

const reportesController = {
    // ============================================
    // REPORTE DE ASISTENCIA POR INSTRUCTOR
    // ============================================
    getReporteAsistencia: async (req, res) => {
        const { fechaInicio, fechaFin, instructorId } = req.query;
        
        try {
            let query = `
                SELECT 
                    i.instructor_id,
                    i.nombre as instructor_nombre,
                    d.nombre as disciplina,
                    COUNT(DISTINCT sp.sesion_id) as total_clases,
                    COUNT(a.asistencia_id) as total_asistentes,
                    ROUND(COUNT(a.asistencia_id)::decimal / NULLIF(COUNT(DISTINCT sp.sesion_id) * sp.cupo_maximo, 0) * 100, 1) as asistencia_promedio
                FROM instructores i
                JOIN sesiones_programadas sp ON i.instructor_id = sp.instructor_id
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                LEFT JOIN asistencia a ON sp.sesion_id = a.sesion_id 
                    AND a.fecha BETWEEN $1 AND $2
                WHERE sp.activo = true
            `;
            const params = [fechaInicio, fechaFin];
            let paramCount = 3;
            
            if (instructorId) {
                query += ` AND i.instructor_id = $${paramCount}`;
                params.push(instructorId);
                paramCount++;
            }
            
            query += ` GROUP BY i.instructor_id, i.nombre, d.nombre, sp.cupo_maximo
                       ORDER BY asistencia_promedio DESC`;
            
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getReporteAsistencia:', error);
            res.status(500).json({ error: 'Error al obtener reporte de asistencia' });
        }
    },

    // ============================================
    // REPORTE DE OCUPACIÓN DE ESPACIOS
    // ============================================
    getReporteOcupacion: async (req, res) => {
        const { fecha } = req.query;
        
        try {
            const query = `
                SELECT 
                    e.nombre as espacio,
                    COUNT(r.reserva_id) as total_reservas,
                    COUNT(CASE WHEN r.estado = 'Confirmada' THEN 1 END) as confirmadas,
                    COUNT(CASE WHEN r.estado = 'Cancelada' THEN 1 END) as canceladas,
                    COUNT(CASE WHEN r.estado = 'No-Show' THEN 1 END) as no_shows
                FROM espacios e
                LEFT JOIN reservaciones r ON e.espacio_id = r.espacio_id
                    AND r.fecha_reserva = $1
                GROUP BY e.espacio_id, e.nombre
                ORDER BY total_reservas DESC
            `;
            const result = await pool.query(query, [fecha]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getReporteOcupacion:', error);
            res.status(500).json({ error: 'Error al obtener reporte de ocupación' });
        }
    },

    // ============================================
    // REPORTE DE SANCIONES
    // ============================================
    getReporteSanciones: async (req, res) => {
        const { activas } = req.query;
        
        try {
            let query = `
                SELECT 
                    s.sancion_id,
                    us.nombres || ' ' || us.apellido_paterno as socio_nombre,
                    s.motivo,
                    s.gravedad,
                    s.fecha_inicio,
                    s.fecha_fin,
                    s.activa
                FROM sanciones s
                JOIN socios soc ON s.socio_id = soc.socio_id
                JOIN usuarios us ON soc.usuario_id = us.usuario_id
                WHERE 1=1
            `;
            
            if (activas === 'true') {
                query += ` AND s.activa = true`;
            }
            
            query += ` ORDER BY s.fecha_inicio DESC`;
            
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getReporteSanciones:', error);
            res.status(500).json({ error: 'Error al obtener reporte de sanciones' });
        }
    }
};
sanciones: async (req, res) => {
  const result = await pool.query(`
    SELECT s.*, soc.nombres, soc.apellido_paterno, soc.email
    FROM sanciones s
    JOIN socios soc ON s.socio_id = soc.socio_id
    WHERE s.fecha_fin >= CURRENT_DATE OR s.fecha_fin IS NULL
    ORDER BY s.fecha_inicio DESC
  `);
  res.json(result.rows);
}
module.exports = reportesController;