'use strict';

const pool = require('../config/database');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const accesoMetricasController = {
  getMetricas: async (req, res) => {
    const { desde, hasta, tipo } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Los parámetros desde y hasta son requeridos' });
    }

    if (!DATE_REGEX.test(desde) || !DATE_REGEX.test(hasta)) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
    }

    if (tipo !== undefined && tipo !== 'socio' && tipo !== 'visita') {
      return res.status(400).json({ error: 'El parámetro tipo debe ser "socio" o "visita"' });
    }

    // tipo filtra por persona (socio vs visita), no por tipo de movimiento (entrada/salida)
    let tipoFilter = '';
    let topSociosTipoFilter = '';
    if (tipo === 'socio') {
      tipoFilter = 'AND socio_id IS NOT NULL';
      topSociosTipoFilter = 'AND ra.socio_id IS NOT NULL';
    } else if (tipo === 'visita') {
      tipoFilter = 'AND visita_id IS NOT NULL';
      topSociosTipoFilter = 'AND ra.visita_id IS NOT NULL';
    }

    const params = [desde, hasta];

    // hasta incluye todo el día indicado
    const whereBase = `"timestamp" >= $1::date AND "timestamp" < ($2::date + INTERVAL '1 day') ${tipoFilter}`;
    const topSociosWhere = `ra."timestamp" >= $1::date AND ra."timestamp" < ($2::date + INTERVAL '1 day') ${topSociosTipoFilter}`;

    try {
      const [totalesRes, horariosPicoRes, accesosDiaRes, topSociosRes] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(*) AS total_accesos,
             COUNT(*) FILTER (WHERE tipo = 'entrada') AS total_entradas,
             COUNT(*) FILTER (WHERE tipo = 'salida') AS total_salidas
           FROM registro_acceso
           WHERE ${whereBase}`,
          params
        ),
        pool.query(
          `SELECT EXTRACT(HOUR FROM "timestamp")::int AS hora, COUNT(*)::int AS total
           FROM registro_acceso
           WHERE ${whereBase}
           GROUP BY hora
           ORDER BY total DESC`,
          params
        ),
        pool.query(
          `SELECT DATE("timestamp") AS fecha, COUNT(*)::int AS total
           FROM registro_acceso
           WHERE ${whereBase}
           GROUP BY fecha
           ORDER BY fecha ASC`,
          params
        ),
        pool.query(
          `SELECT
             ra.socio_id,
             COALESCE(
               NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), ''),
               CONCAT('Socio ', ra.socio_id)
             ) AS nombre,
             COUNT(*)::int AS total_accesos
           FROM registro_acceso ra
           LEFT JOIN socios s ON s.socio_id = ra.socio_id
           LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
           WHERE ${topSociosWhere}
             AND ra.socio_id IS NOT NULL
           GROUP BY ra.socio_id, u.nombres, u.apellido_paterno, u.apellido_materno
           ORDER BY total_accesos DESC
           LIMIT 10`,
          params
        )
      ]);

      const totalesRow = totalesRes.rows[0];
      const totalAccesos = parseInt(totalesRow.total_accesos, 10);
      const totalEntradas = parseInt(totalesRow.total_entradas, 10);
      const totalSalidas = parseInt(totalesRow.total_salidas, 10);

      const fechaDesde = new Date(desde + 'T00:00:00Z');
      const fechaHasta = new Date(hasta + 'T00:00:00Z');
      const dias = Math.max(1, Math.round((fechaHasta - fechaDesde) / (1000 * 60 * 60 * 24)) + 1);
      const promedioDiario = totalAccesos === 0 ? 0 : parseFloat((totalAccesos / dias).toFixed(2));

      const horariosPico = horariosPicoRes.rows.map(r => ({
        hora: r.hora,
        total: r.total
      }));

      const accesosPorDia = accesosDiaRes.rows.map(r => ({
        fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha),
        total: r.total
      }));

      const topSocios = topSociosRes.rows.map(r => ({
        socio_id: r.socio_id,
        nombre: r.nombre,
        total_accesos: r.total_accesos
      }));

      return res.status(200).json({
        total_accesos: totalAccesos,
        total_entradas: totalEntradas,
        total_salidas: totalSalidas,
        promedio_diario: promedioDiario,
        horarios_pico: horariosPico,
        accesos_por_dia: accesosPorDia,
        top_socios: topSocios
      });
    } catch (error) {
      console.error('Error en getMetricas:', error);
      return res.status(500).json({ error: 'Error al obtener métricas de acceso' });
    }
  }
};

module.exports = accesoMetricasController;
