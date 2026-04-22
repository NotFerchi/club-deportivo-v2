const pool = require('../config/database');

const sancionesController = {
    // ============================================
    // OBTENER TODAS LAS SANCIONES
    // ============================================
    getSanciones: async (req, res) => {
        const { activas, socioId } = req.query;
        
        try {
            let query = `
                SELECT 
                    s.sancion_id,
                    s.socio_id,
                    s.motivo,
                    s.gravedad,
                    s.fecha_inicio,
                    s.fecha_fin,
                    s.activa,
                    s.created_by,
                    u_creador.nombres || ' ' || u_creador.apellido_paterno as creador_nombre,
                    soc.numero_socio,
                    us.nombres || ' ' || us.apellido_paterno as socio_nombre,
                    us.email as socio_email,
                    soc.tipo as tipo_socio
                FROM sanciones s
                JOIN socios soc ON s.socio_id = soc.socio_id
                JOIN usuarios us ON soc.usuario_id = us.usuario_id
                LEFT JOIN usuarios u_creador ON s.created_by = u_creador.usuario_id
                WHERE 1=1
            `;
            const params = [];
            let paramCount = 1;
            
            if (activas === 'true') {
                query += ` AND s.activa = true`;
            }
            
            if (socioId) {
                query += ` AND s.socio_id = $${paramCount}`;
                params.push(socioId);
                paramCount++;
            }
            
            query += ` ORDER BY s.fecha_inicio DESC`;
            
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getSanciones:', error);
            res.status(500).json({ error: 'Error al obtener sanciones' });
        }
    },

    // ============================================
    // CREAR SANCIÓN
    // ============================================
    createSancion: async (req, res) => {
        const { socioId, motivo, gravedad, fechaInicio, fechaFin } = req.body;
        const usuarioId = req.usuario.usuario_id;
        
        try {
            const result = await pool.query(
                `INSERT INTO sanciones (socio_id, motivo, gravedad, fecha_inicio, fecha_fin, activa, created_by)
                 VALUES ($1, $2, $3, $4, $5, true, $6)
                 RETURNING sancion_id`,
                [socioId, motivo, gravedad, fechaInicio, fechaFin, usuarioId]
            );
            
            // Registrar en log
            await pool.query(
                `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                 VALUES ($1, $2, $3, $4, $5)`,
                [usuarioId, 'CREAR_SANCION', 'sanciones', `Sanción creada para socio ID: ${socioId}`, req.ip]
            );
            
            res.status(201).json({ 
                message: 'Sanción creada exitosamente', 
                sancion_id: result.rows[0].sancion_id 
            });
        } catch (error) {
            console.error('Error en createSancion:', error);
            res.status(500).json({ error: 'Error al crear sanción' });
        }
    },

    // ============================================
    // PERDONAR SANCIÓN (Desactivar)
    // ============================================
    perdonarSancion: async (req, res) => {
        const { id } = req.params;
        const usuarioId = req.usuario.usuario_id;
        
        try {
            await pool.query(
                `UPDATE sanciones SET activa = false WHERE sancion_id = $1`,
                [id]
            );
            
            // Registrar en log
            await pool.query(
                `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                 VALUES ($1, $2, $3, $4, $5)`,
                [usuarioId, 'PERDONAR_SANCION', 'sanciones', `Sanción perdonada ID: ${id}`, req.ip]
            );
            
            res.json({ message: 'Sanción perdonada correctamente' });
        } catch (error) {
            console.error('Error en perdonarSancion:', error);
            res.status(500).json({ error: 'Error al perdonar sanción' });
        }
    },

    // ============================================
    // OBTENER SANCIONES ACTIVAS DE UN SOCIO
    // ============================================
    getSancionesBySocio: async (req, res) => {
        const { socioId } = req.params;
        
        try {
            const result = await pool.query(`
                SELECT 
                    sancion_id,
                    motivo,
                    gravedad,
                    fecha_inicio,
                    fecha_fin,
                    activa
                FROM sanciones
                WHERE socio_id = $1 AND activa = true
                ORDER BY fecha_inicio DESC
            `, [socioId]);
            
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getSancionesBySocio:', error);
            res.status(500).json({ error: 'Error al obtener sanciones del socio' });
        }
    },

    // ============================================
    // VERIFICAR SI UN SOCIO ESTÁ SANCIONADO
    // ============================================
    verificarSancionActiva: async (req, res) => {
        const { socioId } = req.params;
        
        try {
            const result = await pool.query(`
                SELECT COUNT(*) as total
                FROM sanciones
                WHERE socio_id = $1 
                AND activa = true 
                AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
            `, [socioId]);
            
            res.json({ 
                sancionado: parseInt(result.rows[0].total) > 0,
                total_sanciones: parseInt(result.rows[0].total)
            });
        } catch (error) {
            console.error('Error en verificarSancionActiva:', error);
            res.status(500).json({ error: 'Error al verificar sanción' });
        }
    }
};

module.exports = sancionesController;