const pool = require('../config/database');

const UsuarioInternoModel = {
  async create(data) {
    const sql = `
      INSERT INTO usuariosInternos (
        nombre,
        curp,
        email,
        contrasena,
        rol_empresa,
        fecha_nac,
        sexo,
        direccion,
        activo
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `;

    const values = [
      data.nombre,
      data.curp,
      data.email,
      data.contrasena,      // aquí debe ir el hash ya hecho
      data.rol_empresa,
      data.fecha_nac,
      data.sexo,
      data.direccion,
      data.activo ?? 1
    ];

    const { rows } = await pool.query(sql, values);
    return rows[0];
  },

  async findByEmail(email) {
    const sql = `SELECT * FROM usuariosInternos WHERE email = $1 LIMIT 1`;
    const { rows } = await pool.query(sql, [email]);
    return rows[0] || null;
  },

  async findByCurp(curp) {
    const sql = `SELECT * FROM usuariosInternos WHERE curp = $1 LIMIT 1`;
    const { rows } = await pool.query(sql, [curp]);
    return rows[0] || null;
  },

  async list(limit = 20, offset = 0) {
    const sql = `
      SELECT *
      FROM usuariosInternos
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await pool.query(sql, [limit, offset]);
    return rows;
  },

  async updateActivo(usuarioId, activo) {
    const sql = `
      UPDATE usuariosInternos
      SET activo = $1
      WHERE usuario_id = $2
      RETURNING *
    `;
    const { rows } = await pool.query(sql, [activo ? 1 : 0, usuarioId]);
    return rows[0] || null;
  }
  
};

module.exports = UsuarioInternoModel;