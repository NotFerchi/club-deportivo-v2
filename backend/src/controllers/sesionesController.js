const pool = require('../config/database');

const sesionesController = {
    // ============================================
    // OBTENER TODAS LAS SESIONES (CON FILTROS)
    // ============================================
    getSesiones: async (req, res) => {
        try {
            const { disciplina, dia, instructor } = req.query;
            
            // Construir condiciones dinámicamente
            const condiciones = ['e.activo = true'];
            const params = [];
            let paramIndex = 1;
            
            if (disciplina) {
                condiciones.push(`d.nombre ILIKE $${paramIndex}`);
                params.push(`%${disciplina}%`);
                paramIndex++;
            }
            
            if (dia) {
                condiciones.push(`sp.dia_semana = $${paramIndex}`);
                params.push(dia);
                paramIndex++;
            }
            
            if (instructor) {
                condiciones.push(`(u.nombres ILIKE $${paramIndex} OR u.apellido_paterno ILIKE $${paramIndex} OR CONCAT(u.nombres, ' ', u.apellido_paterno) ILIKE $${paramIndex})`);
                params.push(`%${instructor}%`);
                paramIndex++;
            }
           
            const whereClause = 'WHERE ' + condiciones.join(' AND ');
            
            const query = `
                SELECT 
                    sp.sesion_id,
                    sp.espacio_id,
                    sp.disciplina_id,
                    sp.instructor_id,
                    sp.dia_semana,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    (SELECT COUNT(*) FROM inscripciones_clases
                    WHERE sesion_id = sp.sesion_id AND estado = 'Confirmada') as inscritos_actuales,
                    COALESCE(NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno)), ''), 'Por asignar') as instructor,
                    u.foto_perfil as instructor_foto
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
                LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
                ${whereClause}
                ORDER BY sp.dia_semana, sp.hora_inicio
            `;
            
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getSesiones:', error);
            res.status(500).json({ error: 'Error al obtener sesiones' });
        }
    },

    // ============================================
    // OBTENER SESIONES POR DÍA
    // ============================================
    getSesionesPorDia: async (req, res) => {
        const { dia } = req.params;
        try {
            const query = `
                SELECT 
                    sp.sesion_id,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    i.nombre as instructor,
                    COALESCE(r.total_reservas, 0) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
                LEFT JOIN (
                    SELECT sesion_id, COUNT(*) as total_reservas
                    FROM reservaciones
                    WHERE estado = 'Confirmada'
                    GROUP BY sesion_id
                ) r ON sp.sesion_id = r.sesion_id
                WHERE sp.dia_semana = $1 AND e.activo = true
                ORDER BY sp.hora_inicio
            `;
            const result = await pool.query(query, [dia]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getSesionesPorDia:', error);
            res.status(500).json({ error: 'Error al obtener sesiones por día' });
        }
    },

    // ============================================
    // CREAR SESIÓN
    // ============================================
    createSesion: async (req, res) => {
    const { disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo } = req.body;
    
    try {
        // Verificar conflicto de horario
        const conflicto = await pool.query(`
            SELECT sesion_id FROM sesiones_programadas
            WHERE espacio_id = $1 AND dia_semana = $2
            AND (hora_inicio, hora_fin) OVERLAPS ($3::time, $4::time)
        `, [espacio_id, dia_semana, hora_inicio, hora_fin]);
        
        if (conflicto.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe una sesión en este espacio y horario' });
        }
        
        const result = await pool.query(
            `INSERT INTO sesiones_programadas 
             (disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING sesion_id`,
            [disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo]
        );
        
        res.status(201).json({ 
            message: 'Sesión creada exitosamente', 
            sesion_id: result.rows[0].sesion_id 
        });
    } catch (error) {
        console.error('Error en createSesion:', error);
        res.status(500).json({ error: 'Error al crear sesión' });
    }
    },

    // ============================================
    // ACTUALIZAR SESIÓN
    // ============================================
    updateSesion: async (req, res) => {
        const { id } = req.params;
        const { disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo, activo } = req.body;
        
        try {
            await pool.query(
                `UPDATE sesiones_programadas 
                 SET disciplina_id = $1, espacio_id = $2, instructor_id = $3, 
                     dia_semana = $4, hora_inicio = $5, hora_fin = $6, 
                     cupo_maximo = $7, activo = $8
                 WHERE sesion_id = $9`,
                [disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo, activo, id]
            );
            
            res.json({ message: 'Sesión actualizada correctamente' });
        } catch (error) {
            console.error('Error en updateSesion:', error);
            res.status(500).json({ error: 'Error al actualizar sesión' });
        }
    },

    // ============================================
    // ELIMINAR SESIÓN
    // ============================================
    deleteSesion: async (req, res) => {
        const { id } = req.params;
        
        try {
            await pool.query('DELETE FROM sesiones_programadas WHERE sesion_id = $1', [id]);
            res.json({ message: 'Sesión eliminada correctamente' });
        } catch (error) {
            console.error('Error en deleteSesion:', error);
            res.status(500).json({ error: 'Error al eliminar sesión' });
        }
    }
};

module.exports = sesionesController;
