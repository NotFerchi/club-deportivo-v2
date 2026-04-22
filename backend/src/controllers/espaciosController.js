const pool = require('../config/database');

const espaciosController = {
    // ============================================
    // OBTENER TODOS LOS ESPACIOS
    // ============================================
    getEspacios: async (req, res) => {
        try {
            const query = `
                SELECT 
                    e.espacio_id,
                    e.nombre,
                    e.capacidad_maxima,
                    e.activo,
                    d.disciplina_id,
                    d.nombre as disciplina
                FROM espacios e
                LEFT JOIN disciplinas d ON e.disciplina_id = d.disciplina_id
                ORDER BY e.nombre
            `;
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getEspacios:', error);
            res.status(500).json({ error: 'Error al obtener espacios' });
        }
    },

    // ============================================
    // OBTENER UN ESPACIO POR ID
    // ============================================
    getEspacioById: async (req, res) => {
        const { id } = req.params;
        try {
            const query = `
                SELECT 
                    e.espacio_id,
                    e.nombre,
                    e.capacidad_maxima,
                    e.activo,
                    d.disciplina_id,
                    d.nombre as disciplina
                FROM espacios e
                LEFT JOIN disciplinas d ON e.disciplina_id = d.disciplina_id
                WHERE e.espacio_id = $1
            `;
            const result = await pool.query(query, [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Espacio no encontrado' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error en getEspacioById:', error);
            res.status(500).json({ error: 'Error al obtener espacio' });
        }
    },

    // ============================================
    // CREAR ESPACIO
    // ============================================
    createEspacio: async (req, res) => {
        const { nombre, disciplina_id, capacidad_maxima, activo } = req.body;
        
        try {
            const result = await pool.query(
                `INSERT INTO espacios (nombre, disciplina_id, capacidad_maxima, activo)
                 VALUES ($1, $2, $3, $4)
                 RETURNING espacio_id`,
                [nombre, disciplina_id || null, capacidad_maxima, activo !== undefined ? activo : true]
            );
            
            // Registrar en log
            await pool.query(
                `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.usuario.usuario_id, 'CREAR_ESPACIO', 'espacios', `Espacio creado: ${nombre}`, req.ip]
            );
            
            res.status(201).json({ 
                message: 'Espacio creado exitosamente', 
                espacio_id: result.rows[0].espacio_id 
            });
        } catch (error) {
            console.error('Error en createEspacio:', error);
            res.status(500).json({ error: 'Error al crear espacio' });
        }
    },

    // ============================================
    // ACTUALIZAR ESPACIO
    // ============================================
    updateEspacio: async (req, res) => {
        const { id } = req.params;
        const { nombre, disciplina_id, capacidad_maxima, activo } = req.body;
        
        try {
            await pool.query(
                `UPDATE espacios 
                 SET nombre = $1, disciplina_id = $2, capacidad_maxima = $3, activo = $4
                 WHERE espacio_id = $5`,
                [nombre, disciplina_id || null, capacidad_maxima, activo, id]
            );
            
            // Registrar en log
            await pool.query(
                `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.usuario.usuario_id, 'ACTUALIZAR_ESPACIO', 'espacios', `Espacio actualizado ID: ${id}`, req.ip]
            );
            
            res.json({ message: 'Espacio actualizado correctamente' });
        } catch (error) {
            console.error('Error en updateEspacio:', error);
            res.status(500).json({ error: 'Error al actualizar espacio' });
        }
    },

    // ============================================
    // ELIMINAR ESPACIO
    // ============================================
    deleteEspacio: async (req, res) => {
        const { id } = req.params;
        
        try {
            await pool.query('DELETE FROM espacios WHERE espacio_id = $1', [id]);
            
            // Registrar en log
            await pool.query(
                `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.usuario.usuario_id, 'ELIMINAR_ESPACIO', 'espacios', `Espacio eliminado ID: ${id}`, req.ip]
            );
            
            res.json({ message: 'Espacio eliminado correctamente' });
        } catch (error) {
            console.error('Error en deleteEspacio:', error);
            res.status(500).json({ error: 'Error al eliminar espacio' });
        }
    },

    // ============================================
    // OBTENER ESPACIOS CON DISPONIBILIDAD
    // ============================================
    getEspaciosDisponibles: async (req, res) => {
        const { fecha, horaInicio, horaFin } = req.query;
        
        try {
            const query = `
                SELECT 
                    e.espacio_id,
                    e.nombre,
                    d.nombre as disciplina,
                    e.capacidad_maxima,
                    e.activo,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM reservaciones r
                            WHERE r.espacio_id = e.espacio_id
                            AND r.fecha_reserva = $1
                            AND r.estado = 'Confirmada'
                            AND (r.hora_inicio, r.hora_fin) OVERLAPS ($2::time, $3::time)
                        ) THEN 'ocupado'
                        WHEN EXISTS (
                            SELECT 1 FROM mantenimiento_espacios m
                            WHERE m.espacio_id = e.espacio_id
                            AND m.fecha_inicio <= $4
                            AND m.fecha_fin >= $4
                        ) THEN 'mantenimiento'
                        ELSE 'disponible'
                    END as estado
                FROM espacios e
                LEFT JOIN disciplinas d ON e.disciplina_id = d.disciplina_id
                WHERE e.activo = true
                ORDER BY e.nombre
            `;
            const result = await pool.query(query, [fecha, horaInicio, horaFin, fecha]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getEspaciosDisponibles:', error);
            res.status(500).json({ error: 'Error al obtener espacios disponibles' });
        }
    }
};

module.exports = espaciosController;