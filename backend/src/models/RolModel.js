const pool = require('../config/database');

const RolModel = {
  async findAll() {
    const sql = `SELECT * FROM roles ORDER BY nombre ASC`;
    const { rows } = await pool.query(sql);
    return rows;
  },

  async findById(rolId) {
    const sql = `SELECT * FROM roles WHERE rol_id = $1 LIMIT 1`;
    const { rows } = await pool.query(sql, [rolId]);
    return rows[0] || null;
  },

  async findByNombre(nombre) {
    const sql = `SELECT * FROM roles WHERE nombre = $1 LIMIT 1`;
    const { rows } = await pool.query(sql, [nombre]);
    return rows[0] || null;
  }
};

module.exports = RolModel;