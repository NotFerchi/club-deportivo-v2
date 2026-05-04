const pool = require('../config/database'); 

const EspacioModel = {

  async listarTodos() {
    const query = `
      SELECT * FROM espacios 
      WHERE activo = TRUE 
      ORDER BY espacio_id;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  async verificarEstadoCompleto(espacioId, fecha, horaInicio, horaFin) {

    const inicio = `${fecha} ${horaInicio}`;
    const fin = `${fecha} ${horaFin}`;

    // Mantenimiento
    const mantQuery = `
      SELECT motivo FROM mantenimiento_espacios
      WHERE espacio_id = $1 
      AND activo = TRUE
      AND fecha_inicio <= $3 
      AND fecha_fin >= $2
      LIMIT 1;
    `;
    const { rows: mantRows } = await pool.query(mantQuery, [espacioId, inicio, fin]);

    if (mantRows.length > 0) {
      return { estado: 'mantenimiento', motivo: mantRows[0].motivo };
    }

    // Reservas
    const resQuery = `
      SELECT COUNT(*)::int AS total FROM reservaciones
      WHERE espacio_id = $1 
      AND estado != 'cancelada'
      AND NOT (hora_fin <= $2 OR hora_inicio >= $3);
    `;
    const { rows: resRows } = await pool.query(resQuery, [espacioId, inicio, fin]);

    if (resRows[0].total > 0) {
      return { estado: 'ocupado', motivo: 'Espacio reservado' };
    }

    // Disponible
    return { estado: 'disponible', motivo: '' };
  }
};

module.exports = EspacioModel;
