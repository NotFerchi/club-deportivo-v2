const pool = require('../config/database');

const AuditLogModel = {
  async create(data) {
    const sql = `
      INSERT INTO audit_logs (
        usuario_id,
        entidad,
        entidad_id,
        tipo_evento,
        datos_antes,
        datos_despues,
        ip
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;

    const values = [
      data.usuario_id ?? null,
      data.entidad,
      data.entidad_id ?? null,
      data.tipo_evento,
      data.datos_antes ?? null,
      data.datos_despues ?? null,
      data.ip ?? null
    ];

    const { rows } = await pool.query(sql, values);
    return rows[0];
  },

  async findByEntidad(entidad, entidadId) {
    const sql = `
      SELECT *
      FROM audit_logs
      WHERE entidad = $1 AND entidad_id = $2
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(sql, [entidad, entidadId]);
    return rows;
  }
};

module.exports = AuditLogModel;