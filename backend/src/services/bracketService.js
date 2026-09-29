const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');

const MINIMO_PARTICIPANTES = 4;

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function siguientePotenciaDeDos(numero) {
  let potencia = 1;
  while (potencia < numero) {
    potencia *= 2;
  }
  return potencia;
}

/**
 * Cierra inscripciones y genera el bracket: ronda 1 (cruces + byes) y todas las
 * rondas futuras vacías para que los ganadores tengan a dónde avanzar.
 */
async function cerrarInscripciones(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  await enTransaccion(async (client) => {
    const torneo = await client.query('SELECT estado FROM torneos WHERE torneo_id = $1 FOR UPDATE', [torneoId]);

    if (torneo.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });

    if (torneo.rows[0].estado !== 'Abierto') {
      throw new ServiceError(409, { error: 'El torneo no está abierto para cerrar inscripciones' });
    }

    const participantes = await client.query('SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1', [
      torneoId
    ]);

    const numParticipantes = participantes.rowCount;
    if (numParticipantes < MINIMO_PARTICIPANTES) {
      throw new ServiceError(400, { error: 'Se requieren mínimo 4 participantes' });
    }

    const ids = participantes.rows.map((p) => p.participante_id);
    shuffleArray(ids);

    const totalSlots = siguientePotenciaDeDos(ids.length);
    const totalByes = totalSlots - ids.length;
    const totalConCruce = ids.length - totalByes;

    // Ronda 1 — encuentros reales
    let encuentrosEnRonda = 0;
    for (let i = 0; i < totalConCruce; i += 2) {
      await client.query(
        `INSERT INTO encuentros_torneo (torneo_id, participante_1_id, participante_2_id, ronda, estado)
           VALUES ($1, $2, $3, 1, 'pendiente')`,
        [torneoId, ids[i], ids[i + 1]]
      );
      encuentrosEnRonda++;
    }

    // Ronda 1 — byes (pasan directo)
    for (let i = totalConCruce; i < ids.length; i++) {
      await client.query(
        `INSERT INTO encuentros_torneo (torneo_id, participante_1_id, ronda, ganador_id, estado)
           VALUES ($1, $2, 1, $2, 'programado')`,
        [torneoId, ids[i]]
      );
      encuentrosEnRonda++;
    }

    // Rondas futuras — slots vacíos para que los ganadores tengan a dónde avanzar
    const totalRondas = Math.log2(totalSlots);
    let encuentrosPrevios = encuentrosEnRonda;

    for (let ronda = 2; ronda <= totalRondas; ronda++) {
      const encuentrosEstaRonda = Math.ceil(encuentrosPrevios / 2);
      for (let i = 0; i < encuentrosEstaRonda; i++) {
        await client.query(
          `INSERT INTO encuentros_torneo (torneo_id, ronda, estado)
             VALUES ($1, $2, 'pendiente')`,
          [torneoId, ronda]
        );
      }
      encuentrosPrevios = encuentrosEstaRonda;
    }

    await client.query("UPDATE torneos SET estado = 'Inscripciones_cerradas' WHERE torneo_id = $1", [torneoId]);
  });
}

/** Confirma el bracket: programa la ronda 1 y pone el torneo En_curso. */
async function confirmarBracket(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  await enTransaccion(async (client) => {
    const torneo = await client.query('SELECT estado FROM torneos WHERE torneo_id = $1 FOR UPDATE', [torneoId]);

    if (torneo.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });

    if (torneo.rows[0].estado === 'En_curso') {
      throw new ServiceError(409, { error: 'El bracket ya está confirmado' });
    }

    await client.query(
      `UPDATE encuentros_torneo
         SET estado = 'programado'
         WHERE torneo_id = $1 AND ronda = 1 AND estado = 'pendiente'`,
      [torneoId]
    );

    await client.query("UPDATE torneos SET estado = 'En_curso' WHERE torneo_id = $1", [torneoId]);
  });
}

/** Encuentros del torneo agrupados por ronda. */
async function obtenerBracket(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  const torneo = await pool.query('SELECT torneo_id FROM torneos WHERE torneo_id = $1', [torneoId]);

  if (torneo.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });

  const result = await pool.query(
    `SELECT
           e.encuentro_id, e.ronda, e.estado, e.cancha_asignada, e.hora_programada,
           e.marcador_1, e.marcador_2, e.ganador_id, e.ganador AS ganador_nombre,
           p1.participante_id AS participante_1_id,
           COALESCE(
             NULLIF(TRIM(eq1.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(u1.nombres, ' ', COALESCE(u1.apellido_paterno, ''), ' ', COALESCE(u1.apellido_materno, ''))), ''),
             NULLIF(TRIM(v1.nombre_completo), ''),
             NULLIF(TRIM(p1.nombre_externo), ''),
             NULLIF(TRIM(e.participante_1), ''),
             'Por definir'
           ) AS participante_1_nombre,
           p2.participante_id AS participante_2_id,
           COALESCE(
             NULLIF(TRIM(eq2.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(u2.nombres, ' ', COALESCE(u2.apellido_paterno, ''), ' ', COALESCE(u2.apellido_materno, ''))), ''),
             NULLIF(TRIM(v2.nombre_completo), ''),
             NULLIF(TRIM(p2.nombre_externo), ''),
             NULLIF(TRIM(e.participante_2), ''),
             'Por definir'
           ) AS participante_2_nombre
         FROM encuentros_torneo e
         LEFT JOIN participantes_torneo p1 ON p1.participante_id = e.participante_1_id
         LEFT JOIN socios s1 ON s1.socio_id = p1.socio_id
         LEFT JOIN usuarios u1 ON u1.usuario_id = s1.usuario_id
         LEFT JOIN visitas v1 ON v1.visita_id = p1.visita_id
         LEFT JOIN equipos eq1 ON eq1.equipo_id = p1.equipo_id
         LEFT JOIN participantes_torneo p2 ON p2.participante_id = e.participante_2_id
         LEFT JOIN socios s2 ON s2.socio_id = p2.socio_id
         LEFT JOIN usuarios u2 ON u2.usuario_id = s2.usuario_id
         LEFT JOIN visitas v2 ON v2.visita_id = p2.visita_id
         LEFT JOIN equipos eq2 ON eq2.equipo_id = p2.equipo_id
         WHERE e.torneo_id = $1
         ORDER BY e.ronda ASC, e.encuentro_id ASC`,
    [torneoId]
  );

  const bracketPorRonda = result.rows.reduce((acc, row) => {
    const ronda = row.ronda || 1;
    if (!acc[ronda]) acc[ronda] = { ronda, encuentros: [] };
    acc[ronda].encuentros.push({
      encuentro_id: row.encuentro_id,
      estado: row.estado,
      cancha_asignada: row.cancha_asignada,
      hora_programada: row.hora_programada,
      marcador_1: row.marcador_1,
      marcador_2: row.marcador_2,
      ganador_id: row.ganador_id,
      ganador_nombre: row.ganador_nombre,
      participante_1: {
        participante_id: row.participante_1_id,
        nombre: row.participante_1_nombre || 'Por definir'
      },
      participante_2: {
        participante_id: row.participante_2_id,
        nombre: row.participante_2_nombre || 'Por definir'
      }
    });
    return acc;
  }, {});

  return Object.values(bracketPorRonda);
}

module.exports = { cerrarInscripciones, confirmarBracket, obtenerBracket };
