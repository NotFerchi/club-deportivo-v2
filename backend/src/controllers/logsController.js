const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');

const logsController = {
    createLog: async (req, res) => {
        const { accion, tabla_afectada, detalles, registro_id } = req.body || {};

        if (!accion) {
            return res.status(400).json({ error: 'accion es requerida' });
        }

        await logAudit(req, {
            accion,
            tabla_afectada,
            detalles,
            registro_id
        });

        res.status(201).json({ ok: true, message: 'Log registrado' });
    },

    // ============================================
    // OBTENER TODOS LOS LOGS
    // ============================================
    getLogs: async (req, res) => {
        const { limite = 100, offset = 0, tabla, usuarioId, fechaInicio, fechaFin } = req.query;
        
        try {
            let query = `
                SELECT 
                    l.log_id,
                    l.usuario_id,
                    u.nombres || ' ' || u.apellido_paterno as usuario_nombre,
                    u.username as usuario_email,
                    l.accion,
                    l.tabla_afectada,
                    l.detalles,
                    l.fecha,
                    TO_CHAR(l.fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_local,
                    l.ip_origen
                FROM logs_sistema l
                LEFT JOIN usuarios u ON l.usuario_id = u.usuario_id
                WHERE 1=1
            `;
            const params = [];
            let paramCount = 1;
            
            if (tabla) {
                query += ` AND l.tabla_afectada = $${paramCount}`;
                params.push(tabla);
                paramCount++;
            }
            
            if (usuarioId) {
                query += ` AND l.usuario_id = $${paramCount}`;
                params.push(usuarioId);
                paramCount++;
            }
            
            if (fechaInicio) {
                query += ` AND l.fecha >= $${paramCount}`;
                params.push(fechaInicio);
                paramCount++;
            }
            
            if (fechaFin) {
                query += ` AND l.fecha <= $${paramCount}`;
                params.push(fechaFin);
                paramCount++;
            }
            
            query += ` ORDER BY l.fecha DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
            params.push(limite, offset);
            
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getLogs:', error);
            res.status(500).json({ error: 'Error al obtener logs' });
        }
    },

    // ============================================
    // OBTENER LOGS POR TABLA
    // ============================================
    getLogsByTabla: async (req, res) => {
        const { tabla } = req.params;
        
        try {
            const query = `
                SELECT 
                    l.log_id,
                    l.usuario_id,
                    u.nombres || ' ' || u.apellido_paterno as usuario_nombre,
                    l.accion,
                    l.detalles,
                    l.fecha,
                    TO_CHAR(l.fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_local,
                    l.ip_origen
                FROM logs_sistema l
                LEFT JOIN usuarios u ON l.usuario_id = u.usuario_id
                WHERE l.tabla_afectada = $1
                ORDER BY l.fecha DESC
                LIMIT 100
            `;
            const result = await pool.query(query, [tabla]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getLogsByTabla:', error);
            res.status(500).json({ error: 'Error al obtener logs por tabla' });
        }
    },

    // ============================================
    // OBTENER ESTADÍSTICAS DE LOGS
    // ============================================
    getLogsEstadisticas: async (req, res) => {
        try {
            // Acciones por tipo
            const accionesQuery = await pool.query(`
                SELECT 
                    accion,
                    COUNT(*) as total
                FROM logs_sistema
                GROUP BY accion
                ORDER BY total DESC
                LIMIT 10
            `);
            
            // Logs por día (últimos 7 días)
            const porDiaQuery = await pool.query(`
                SELECT 
                    DATE(fecha) as dia,
                    COUNT(*) as total
                FROM logs_sistema
                WHERE fecha >= NOW() - INTERVAL '7 days'
                GROUP BY DATE(fecha)
                ORDER BY dia DESC
            `);
            
            // Logs por tabla
            const porTablaQuery = await pool.query(`
                SELECT 
                    tabla_afectada,
                    COUNT(*) as total
                FROM logs_sistema
                WHERE tabla_afectada IS NOT NULL
                GROUP BY tabla_afectada
                ORDER BY total DESC
            `);
            
            res.json({
                acciones: accionesQuery.rows,
                porDia: porDiaQuery.rows,
                porTabla: porTablaQuery.rows,
                total: await pool.query('SELECT COUNT(*) FROM logs_sistema').then(r => parseInt(r.rows[0].count))
            });
        } catch (error) {
            console.error('Error en getLogsEstadisticas:', error);
            res.status(500).json({ error: 'Error al obtener estadísticas de logs' });
        }
    }
};

module.exports = logsController;
