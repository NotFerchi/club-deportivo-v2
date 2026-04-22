const pool = require('../config/database');

const disciplinasController = {
    // ============================================
    // OBTENER TODAS LAS DISCIPLINAS
    // ============================================
    getDisciplinas: async (req, res) => {
        try {
            const query = `
                SELECT 
                    disciplina_id,
                    nombre
                FROM disciplinas
                ORDER BY nombre
            `;
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getDisciplinas:', error);
            res.status(500).json({ error: 'Error al obtener disciplinas' });
        }
    },

    // ============================================
    // OBTENER DISCIPLINA POR ID
    // ============================================
    getDisciplinaById: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query('SELECT disciplina_id, nombre FROM disciplinas WHERE disciplina_id = $1', [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Disciplina no encontrada' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error en getDisciplinaById:', error);
            res.status(500).json({ error: 'Error al obtener disciplina' });
        }
    },

    // ============================================
    // CREAR DISCIPLINA
    // ============================================
    createDisciplina: async (req, res) => {
        const { nombre } = req.body;
        
        try {
            const existe = await pool.query('SELECT disciplina_id FROM disciplinas WHERE nombre = $1', [nombre]);
            if (existe.rows.length > 0) {
                return res.status(400).json({ error: 'Ya existe una disciplina con ese nombre' });
            }
            
            const result = await pool.query(
                'INSERT INTO disciplinas (nombre) VALUES ($1) RETURNING disciplina_id',
                [nombre]
            );
            
            res.status(201).json({ 
                message: 'Disciplina creada exitosamente', 
                disciplina_id: result.rows[0].disciplina_id 
            });
        } catch (error) {
            console.error('Error en createDisciplina:', error);
            res.status(500).json({ error: 'Error al crear disciplina' });
        }
    },

    // ============================================
    // ACTUALIZAR DISCIPLINA
    // ============================================
    updateDisciplina: async (req, res) => {
        const { id } = req.params;
        const { nombre } = req.body;
        
        try {
            await pool.query('UPDATE disciplinas SET nombre = $1 WHERE disciplina_id = $2', [nombre, id]);
            res.json({ message: 'Disciplina actualizada correctamente' });
        } catch (error) {
            console.error('Error en updateDisciplina:', error);
            res.status(500).json({ error: 'Error al actualizar disciplina' });
        }
    },

    // ============================================
    // ELIMINAR DISCIPLINA
    // ============================================
    deleteDisciplina: async (req, res) => {
        const { id } = req.params;
        
        try {
            await pool.query('DELETE FROM disciplinas WHERE disciplina_id = $1', [id]);
            res.json({ message: 'Disciplina eliminada correctamente' });
        } catch (error) {
            console.error('Error en deleteDisciplina:', error);
            res.status(500).json({ error: 'Error al eliminar disciplina' });
        }
    }
};

module.exports = disciplinasController;