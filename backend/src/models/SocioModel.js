const pool = require('../config/database');

const SocioModel = {
  async create(data) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const insertSql = `
        INSERT INTO socios (
          usuario_id,
          curp,
          nombre,
          apellido,
          fecha_nacimiento,
          genero,
          tipo_socio,
          modalidad,
          estado,
          telefono,
          email_contacto,
          direccion,
          nombre_emergencia,
          tel_emergencia
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
      `;

      const insertValues = [
        data.usuario_id ?? null,
        data.curp,
        data.nombre,
        data.apellido,
        data.fecha_nacimiento,
        data.genero,
        data.tipo_socio,
        data.modalidad,
        data.estado ?? 'activo',
        data.telefono ?? null,
        data.email_contacto ?? null,
        data.direccion ?? null,
        data.nombre_emergencia ?? null,
        data.tel_emergencia ?? null
      ];

      const inserted = await client.query(insertSql, insertValues);
      const socio = inserted.rows[0];

      const numeroSocio = `SOC-${String(socio.socio_id).padStart(4, '0')}`;

      const updateSql = `
        UPDATE socios
        SET numero_socio = $1
        WHERE socio_id = $2
        RETURNING *
      `;

      const updated = await client.query(updateSql, [numeroSocio, socio.socio_id]);

      await client.query('COMMIT');
      return updated.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async findByCurp(curp) {
    const sql = `SELECT * FROM socios WHERE curp = $1 LIMIT 1`;
    const { rows } = await pool.query(sql, [curp]);
    return rows[0] || null;
  },

  async findByNumeroSocio(numeroSocio) {
    const sql = `SELECT * FROM socios WHERE numero_socio = $1 LIMIT 1`;
    const { rows } = await pool.query(sql, [numeroSocio]);
    return rows[0] || null;
  },

  async list(limit = 20, offset = 0) {
    const sql = `
      SELECT *
      FROM socios
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await pool.query(sql, [limit, offset]);
    return rows;
  },

  async updateEstado(socioId, estado) {
    const sql = `
      UPDATE socios
      SET estado = $1
      WHERE socio_id = $2
      RETURNING *
    `;
    const { rows } = await pool.query(sql, [estado, socioId]);
    return rows[0] || null;
  }
};

module.exports = SocioModel;