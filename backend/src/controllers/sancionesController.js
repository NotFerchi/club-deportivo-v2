const pool = require('../config/database');

const sancionesController = {

    getSanciones: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    s.sancion_id,
                    s.socio_id,
                    s.motivo,
                    s.origen,
                    s.estado,
                    s.fecha,
                    s.fecha_resolucion,
                    soc.numero_socio,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as socio_nombre,
                    u.username as socio_email
                FROM sanciones s
                JOIN socios soc ON s.socio_id = soc.socio_id
                JOIN usuarios u ON soc.usuario_id = u.usuario_id
                ORDER BY s.fecha DESC
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getSanciones:', error);
            res.status(500).json({ error: 'Error al obtener sanciones' });
        }
    },

    getSancionById: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query(`
                SELECT s.*, soc.numero_socio,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as socio_nombre
                FROM sanciones s
                JOIN socios soc ON s.socio_id = soc.socio_id
                JOIN usuarios u ON soc.usuario_id = u.usuario_id
                WHERE s.sancion_id = $1
            `, [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Sanción no encontrada' });
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error en getSancionById:', error);
            res.status(500).json({ error: 'Error al obtener sanción' });
        }
    },

    getSancionesBySocio: async (req, res) => {
        const { socioId } = req.params;
        try {
            const result = await pool.query(
                `SELECT s.*, soc.numero_socio,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as socio_nombre
                 FROM sanciones s
                 JOIN socios soc ON s.socio_id = soc.socio_id
                 JOIN usuarios u ON soc.usuario_id = u.usuario_id
                 WHERE s.socio_id = $1 ORDER BY s.fecha DESC`,
                [socioId]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getSancionesBySocio:', error);
            res.status(500).json({ error: 'Error al obtener sanciones' });
        }
    },

    verificarSancionActiva: async (req, res) => {
        const { socioId } = req.params;
        try {
            const result = await pool.query(
                `SELECT COUNT(*) as total FROM sanciones WHERE socio_id = $1 AND estado = 'Activa'`,
                [socioId]
            );
            res.json({ tiene_sancion: parseInt(result.rows[0].total) > 0 });
        } catch (error) {
            console.error('Error en verificarSancionActiva:', error);
            res.status(500).json({ error: 'Error al verificar sanción' });
        }
    },

    createSancion: async (req, res) => {
        const { socioId, socio_id, motivo, origen } = req.body;
        const id = socioId || socio_id;
        try {
            const result = await pool.query(
                `INSERT INTO sanciones (socio_id, motivo, origen, estado, fecha)
                 VALUES ($1, $2, $3, 'Activa', CURRENT_DATE) RETURNING sancion_id`,
                [id, motivo, origen || 'Administración']
            );
            res.status(201).json({ message: 'Sanción creada', sancion_id: result.rows[0].sancion_id });
        } catch (error) {
            console.error('Error en createSancion:', error);
            res.status(500).json({ error: 'Error al crear sanción' });
        }
    },

    updateSancion: async (req, res) => {
        const { id } = req.params;
        const { motivo, origen, estado } = req.body;
        try {
            await pool.query(
                `UPDATE sanciones SET motivo = COALESCE($1, motivo), origen = COALESCE($2, origen), estado = COALESCE($3, estado) WHERE sancion_id = $4`,
                [motivo, origen, estado, id]
            );
            res.json({ message: 'Sanción actualizada' });
        } catch (error) {
            console.error('Error en updateSancion:', error);
            res.status(500).json({ error: 'Error al actualizar sanción' });
        }
    },

    deleteSancion: async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query('DELETE FROM sanciones WHERE sancion_id = $1', [id]);
            res.json({ message: 'Sanción eliminada' });
        } catch (error) {
            console.error('Error en deleteSancion:', error);
            res.status(500).json({ error: 'Error al eliminar sanción' });
        }
    },

    perdonarSancion: async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query(
                `UPDATE sanciones SET estado = 'Resuelta', fecha_resolucion = CURRENT_DATE WHERE sancion_id = $1`,
                [id]
            );
            res.json({ message: 'Sanción resuelta' });
        } catch (error) {
            console.error('Error en perdonarSancion:', error);
            res.status(500).json({ error: 'Error al resolver sanción' });
        }
    },

    levantarSancion: async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query(
                `UPDATE sanciones SET estado = 'Resuelta', fecha_resolucion = CURRENT_DATE WHERE sancion_id = $1 AND estado = 'Activa'`,
                [id]
            );
            res.json({ message: 'Sanción levantada' });
        } catch (error) {
            console.error('Error en levantarSancion:', error);
            res.status(500).json({ error: 'Error al levantar sanción' });
        }
    }
};

module.exports = sancionesController;