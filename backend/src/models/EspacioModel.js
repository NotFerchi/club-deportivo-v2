// models/espacio.model.js
const pool = require('../config/database'); 

const EspacioModel = {
  async listarTodos() {
    const query = `
      SELECT e.*
      FROM espacios e
      WHERE e.activo = TRUE
      ORDER BY e.espacio_id;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  async buscarPorId(id) {
    const query = `
      SELECT *
      FROM espacios
      WHERE espacio_id = $1;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  },

  async verificarDisponibilidad(espacioId, fecha, horaInicio, horaFin) {
    // Combinar fecha + hora para generar timestamps
    const inicio = `${fecha} ${horaInicio}`;
    const fin    = `${fecha} ${horaFin}`;

    // 1. Verificar traslape con reservaciones activas
    const reservacionesQuery = `
      SELECT COUNT(*)::int AS total
      FROM reservaciones
      WHERE espacio_id = $1
        AND estado != 'cancelada'
        AND NOT (hora_fin   <= $2 OR hora_inicio >= $3);
    `;
    const { rows: resRows } = await pool.query(reservacionesQuery, [
      espacioId,
      inicio,
      fin
    ]);

    if (resRows[0].total > 0) {
      return false; // No disponible por reservación
    }

    // 2. Verificar mantenimiento activo
    const mantenimientoQuery = `
      SELECT COUNT(*)::int AS total
      FROM mantenimiento_espacios
      WHERE espacio_id = $1
        AND activo = TRUE
        AND fecha_inicio <= $3
        AND fecha_fin    >= $2;
    `;
    const { rows: mantRows } = await pool.query(mantenimientoQuery, [
      espacioId,
      inicio,
      fin
    ]);

    if (mantRows[0].total > 0) {
      return false; // No disponible por mantenimiento
    }

    return true; // Disponible
  },

  async marcarMantenimiento(espacioId, motivo, fechaInicio, fechaFin) {
    const query = `
      INSERT INTO mantenimiento_espacios
        (espacio_id, motivo, fecha_inicio, fecha_fin, activo)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      espacioId,
      motivo,
      fechaInicio,
      fechaFin
    ]);
    return rows[0];
  }
};

module.exports = EspacioModel;