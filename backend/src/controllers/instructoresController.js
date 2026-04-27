const pool = require('../config/database');

const instructoresController = {

    getInstructores: async (req, res) => {
        try {
            const query = `
                SELECT 
                    i.instructor_id,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as nombre,
                    i.especialidad,
                    i.activo,
                    u.username as email,
                    u.telefono
                FROM instructores i
                LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
                ORDER BY u.nombres
            `;
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getInstructores:', error);
            res.status(500).json({ error: 'Error al obtener instructores' });
        }
    },

    getInstructorById: async (req, res) => {
        const { id } = req.params;
        try {
            const query = `
                SELECT 
                    i.instructor_id,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as nombre,
                    i.especialidad,
                    i.activo,
                    u.username as email,
                    u.telefono
                FROM instructores i
                LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
                WHERE i.instructor_id = $1
            `;
            const result = await pool.query(query, [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Instructor no encontrado' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error en getInstructorById:', error);
            res.status(500).json({ error: 'Error al obtener instructor' });
        }
    },

    createInstructor: async (req, res) => {
        const { nombre, especialidad, email, telefono } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let usuarioId = null;
            if (email) {
                const existe = await client.query('SELECT usuario_id FROM usuarios WHERE username = $1', [email]);
                if (existe.rows.length === 0) {
                    const passwordDefault = 'instructor123';
                    const rolResult = await client.query(`SELECT rol_id FROM roles WHERE nombre = 'instructor'`);
                    const rolId = rolResult.rows[0].rol_id;
                    const userResult = await client.query(
                        `INSERT INTO usuarios (username, nombres, password_hash, rol_id, activo)
                         VALUES ($1, $2, $3, $4, true) RETURNING usuario_id`,
                        [email, nombre, passwordDefault, rolId]
                    );
                    usuarioId = userResult.rows[0].usuario_id;
                } else {
                    usuarioId = existe.rows[0].usuario_id;
                }
            }
            const result = await client.query(
                `INSERT INTO instructores (especialidad, usuario_id, activo)
                 VALUES ($1, $2, true) RETURNING instructor_id`,
                [especialidad || null, usuarioId]
            );
            await client.query('COMMIT');
            res.status(201).json({ message: 'Instructor creado', instructor_id: result.rows[0].instructor_id });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error en createInstructor:', error);
            res.status(500).json({ error: 'Error al crear instructor' });
        } finally {
            client.release();
        }
    },

    updateInstructor: async (req, res) => {
        const { id } = req.params;
        const { especialidad, activo } = req.body;
        try {
            await pool.query(
                `UPDATE instructores SET especialidad = $1, activo = $2 WHERE instructor_id = $3`,
                [especialidad || null, activo, id]
            );
            res.json({ message: 'Instructor actualizado correctamente' });
        } catch (error) {
            console.error('Error en updateInstructor:', error);
            res.status(500).json({ error: 'Error al actualizar instructor' });
        }
    },

    deleteInstructor: async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query('DELETE FROM instructores WHERE instructor_id = $1', [id]);
            res.json({ message: 'Instructor eliminado correctamente' });
        } catch (error) {
            console.error('Error en deleteInstructor:', error);
            res.status(500).json({ error: 'Error al eliminar instructor' });
        }
    }
};

module.exports = instructoresController;