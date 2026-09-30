const pool = require('../config/database');
const ServiceError = require('./serviceError');

const noEncontrada = () => new ServiceError(404, { error: 'Disciplina no encontrada' });

async function listarDisciplinas() {
  const result = await pool.query(`
        SELECT disciplina_id, nombre
        FROM disciplinas
        ORDER BY nombre
      `);
  return result.rows;
}

async function obtenerDisciplina(id) {
  const result = await pool.query('SELECT disciplina_id, nombre FROM disciplinas WHERE disciplina_id = $1', [id]);
  if (result.rows.length === 0) throw noEncontrada();
  return result.rows[0];
}

/** Devuelve el id creado. */
async function crearDisciplina(nombre) {
  const result = await pool.query('INSERT INTO disciplinas (nombre) VALUES ($1) RETURNING disciplina_id', [nombre]);
  return result.rows[0].disciplina_id;
}

async function actualizarDisciplina(id, nombre) {
  const result = await pool.query(
    'UPDATE disciplinas SET nombre = $1 WHERE disciplina_id = $2 RETURNING disciplina_id',
    [nombre, id]
  );
  if (result.rows.length === 0) throw noEncontrada();
}

/** Elimina si ningún espacio la usa. */
async function eliminarDisciplina(id) {
  const checkResult = await pool.query('SELECT COUNT(*) FROM espacios WHERE disciplina_id = $1', [id]);

  if (parseInt(checkResult.rows[0].count) > 0) {
    throw new ServiceError(400, {
      error: 'No se puede eliminar la disciplina porque está siendo usada por uno o más espacios'
    });
  }

  const result = await pool.query('DELETE FROM disciplinas WHERE disciplina_id = $1 RETURNING disciplina_id', [id]);
  if (result.rows.length === 0) throw noEncontrada();
}

module.exports = {
  listarDisciplinas,
  obtenerDisciplina,
  crearDisciplina,
  actualizarDisciplina,
  eliminarDisciplina
};
