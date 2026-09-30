const pool = require('../config/database');

/** Roles asignables desde el formulario interno (excluye 'socio'). */
async function listarRolesInternos() {
  const result = await pool.query("SELECT rol_id, nombre FROM roles WHERE nombre != 'socio' ORDER BY rol_id");
  return result.rows;
}

module.exports = { listarRolesInternos };
