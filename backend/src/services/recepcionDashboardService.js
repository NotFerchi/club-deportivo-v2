/**
 * Lecturas del tablero de recepción: resumen del día, socios, reservas y espacios.
 */
const pool = require('../config/database');
const { getMexicoTodayLocale } = require('../utils/mexicoDate');
const { isMissingPasesTable } = require('./paseService');

const CAPACIDAD_LUDOTECA = 15;

/** Pases activos hoy; si falta la tabla pases, cuenta visitas legacy vigentes. */
async function contarPasesActivos(hoy) {
  try {
    const visitas = await pool.query(
      `SELECT
                        COUNT(*)::int as total,
                        COUNT(*) FILTER (WHERE tipo_pase = 'dia')::int as pases_dia,
                        COUNT(*) FILTER (WHERE tipo_pase = 'visita')::int as visitas
                     FROM pases
                     WHERE estado = 'activo' AND fecha_pase = $1`,
      [hoy]
    );

    return {
      visitasActivas: parseInt(visitas.rows[0].total, 10),
      pasesDiaActivos: parseInt(visitas.rows[0].pases_dia, 10),
      visitasInvitadosActivas: parseInt(visitas.rows[0].visitas, 10)
    };
  } catch (error) {
    if (!isMissingPasesTable(error)) throw error;

    const visitas = await pool.query(`SELECT COUNT(*) FROM visitas WHERE vigente = true AND fecha_visita = $1`, [hoy]);
    const total = parseInt(visitas.rows[0].count, 10);
    return { visitasActivas: total, pasesDiaActivos: 0, visitasInvitadosActivas: total };
  }
}

async function resumenDelDia() {
  const hoy = getMexicoTodayLocale();

  const ingresos = await pool.query(`SELECT COUNT(*) FROM asistencia WHERE fecha = $1`, [hoy]);
  const ludoteca = await pool.query(`SELECT COUNT(*) FROM registro_ludoteca WHERE hora_salida IS NULL`);
  const sanciones = await pool.query(
    `SELECT COUNT(*) FROM sanciones WHERE LOWER(estado::text) IN ('activo', 'activa')`
  );

  const sociosDentro = await pool.query(
    `SELECT
                    COUNT(DISTINCT a.socio_id)::int as total,
                    COUNT(DISTINCT a.socio_id) FILTER (WHERE LOWER(COALESCE(s.tipo::text, s.modalidad::text, '')) = 'accionista')::int as accionistas,
                    COUNT(DISTINCT a.socio_id) FILTER (WHERE LOWER(COALESCE(s.tipo::text, s.modalidad::text, '')) <> 'accionista')::int as rentistas
                 FROM asistencia a
                 JOIN socios s ON a.socio_id = s.socio_id
                 WHERE a.fecha = $1
                   AND a.presente = true
                   AND a.socio_id IS NOT NULL`,
    [hoy]
  );

  const reservasHoy = await pool.query(
    `SELECT
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE LOWER(estado::text) IN ('confirmada', 'confirmado', 'pendiente'))::int as activas,
                    COUNT(*) FILTER (WHERE LOWER(estado::text) IN ('cancelada', 'cancelado'))::int as canceladas,
                    COUNT(*) FILTER (WHERE COALESCE(no_show, false) = true OR LOWER(estado::text) IN ('no-show', 'no show'))::int as no_shows
                 FROM reservaciones
                 WHERE fecha_reserva = $1`,
    [hoy]
  );

  const { visitasActivas, pasesDiaActivos, visitasInvitadosActivas } = await contarPasesActivos(hoy);
  const socios = sociosDentro.rows[0];
  const reservas = reservasHoy.rows[0];

  return {
    ingresosHoy: parseInt(ingresos.rows[0].count, 10),
    visitasActivas,
    visitasInvitadosActivas,
    pasesDiaActivos,
    ninosLudoteca: parseInt(ludoteca.rows[0].count, 10),
    capacidadLudoteca: CAPACIDAD_LUDOTECA,
    sancionesActivas: parseInt(sanciones.rows[0].count, 10),
    sociosDentro: socios?.total || 0,
    accionistasDentro: socios?.accionistas || 0,
    rentistasDentro: socios?.rentistas || 0,
    reservasHoy: reservas?.total || 0,
    reservasActivasHoy: reservas?.activas || 0,
    reservasCanceladasHoy: reservas?.canceladas || 0,
    noShowsHoy: reservas?.no_shows || 0
  };
}

/** Hasta 20 socios; con `q`, solo activos que coincidan por nombre o número. */
async function buscarSocios(q) {
  let query = `
            SELECT
    s.socio_id,
    u.usuario_id,
    u.nombres,
    u.apellido_paterno,
    u.apellido_materno,
    NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), '') as nombre_completo,
    u.username as email,
    u.telefono,
    u.activo,
    u.foto_perfil,
    s.tipo,
    s.modalidad,
    s.numero_socio,
    s.activo as socio_activo
FROM socios s
JOIN usuarios u ON s.usuario_id = u.usuario_id
        `;

  const valores = [];

  if (q && q.trim() !== '') {
    valores.push(`%${q.trim().toLowerCase()}%`);
    query += `
                WHERE s.activo = true
                AND (
                    LOWER(u.nombres) LIKE $1
                    OR LOWER(u.apellido_paterno) LIKE $1
                    OR LOWER(u.apellido_materno) LIKE $1
                    OR LOWER(CONCAT(u.nombres, ' ', u.apellido_paterno)) LIKE $1
                    OR LOWER(s.numero_socio::text) LIKE $1
                )
            `;
  }

  query += ` ORDER BY u.apellido_paterno, u.nombres LIMIT 20`;

  const result = await pool.query(query, valores);
  return result.rows;
}

async function sociosActivosParaVisitas() {
  const result = await pool.query(`
                SELECT
                    s.socio_id,
                    s.numero_socio,
                    u.nombres,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.username as email,
                    s.tipo as tipo_socio,
                    s.tipo
                FROM socios s
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                WHERE s.activo = true
                ORDER BY u.apellido_paterno, u.nombres
            `);
  return result.rows;
}

/** Reservas de la fecha (hoy si no se indica). */
async function reservasDelDia(fecha) {
  const result = await pool.query(
    `
                SELECT
                    r.reserva_id,
                    e.nombre as espacio_nombre,
                    r.hora_inicio,
                    r.hora_fin,
                    u.nombres || ' ' || u.apellido_paterno as socio_nombre,
                    r.estado
                FROM reservaciones r
                JOIN espacios e ON r.espacio_id = e.espacio_id
                JOIN socios s ON r.socio_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                WHERE r.fecha_reserva = $1
                ORDER BY r.hora_inicio
            `,
    [fecha || getMexicoTodayLocale()]
  );
  return result.rows;
}

async function listarEspacios() {
  const result = await pool.query(`
                SELECT espacio_id, nombre, capacidad_maxima
                FROM espacios
                ORDER BY nombre
            `);
  return result.rows;
}

module.exports = { resumenDelDia, buscarSocios, sociosActivosParaVisitas, reservasDelDia, listarEspacios };
