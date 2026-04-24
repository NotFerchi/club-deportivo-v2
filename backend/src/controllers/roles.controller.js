const pool = require('../config/database');

const obtenerRoles = async (req, res) => {
    try {
        // actulizamos la consulta pa q no traiga al socio en el form interno
        const result = await pool.query(
        "SELECT rol_id, nombre FROM roles WHERE nombre != 'socio' ORDER BY rol_id"
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener roles:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = { obtenerRoles };
