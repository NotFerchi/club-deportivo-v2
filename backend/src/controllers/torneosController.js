const pool = require('../config/database');

const ERROR_DISCIPLINA_NO_EXISTE = 'La disciplina no existe';
const ERROR_FECHAS_TORNEO = 'La fecha de fin no puede ser menor que la fecha de inicio';
const ERROR_TIPO_PARTICIPANTE = 'Debe especificar exactamente un tipo de participante';
const ERROR_SOCIO_NO_VALIDO = 'Socio no encontrado o inactivo';
const ERROR_VISITA_NO_VALIDA = 'Visita no encontrada o no vigente';
const ERROR_CATEGORIA_NO_EXISTE = 'La categoría no existe';
const ERROR_PARTICIPANTE_DUPLICADO = 'Este participante ya está inscrito en el torneo';

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

function normalizarFechaOpcional(fecha) {
  return fecha === undefined || fecha === '' ? null : fecha;
}

function tieneValor(valor) {
  return valor !== undefined && valor !== null && valor !== '';
}

function esEnteroValido(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : null;
}

const torneosController = {
  getTorneos: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          t.torneo_id,
          t.nombre,
          d.nombre AS nombre_disciplina,
          t.fecha_inicio,
          t.fecha_fin,
          t.estado
        FROM torneos t
        JOIN disciplinas d ON t.disciplina_id = d.disciplina_id
        ORDER BY t.fecha_inicio DESC NULLS LAST, t.torneo_id DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error('Error al obtener torneos:', error);
      res.status(500).json({ error: 'Error al obtener torneos' });
    }
  },

  createTorneo: async (req, res) => {
    const { nombre, disciplina_id, fecha_inicio, fecha_fin } = req.body;

    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    if (disciplina_id === undefined || disciplina_id === null || disciplina_id === '') {
      return res.status(400).json({ error: 'disciplina_id es requerido' });
    }

    const disciplinaId = Number(disciplina_id);
    if (!Number.isInteger(disciplinaId)) {
      return res.status(400).json({ error: 'disciplina_id debe ser un entero valido' });
    }

    try {
      const disciplina = await pool.query(
        'SELECT disciplina_id FROM disciplinas WHERE disciplina_id = $1',
        [disciplinaId]
      );

      if (disciplina.rowCount === 0) {
        return res.status(400).json({ error: ERROR_DISCIPLINA_NO_EXISTE });
      }

      const result = await pool.query(
        `
          INSERT INTO torneos (disciplina_id, nombre, fecha_inicio, fecha_fin, estado)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING torneo_id
        `,
        [
          disciplinaId,
          nombre.trim(),
          normalizarFechaOpcional(fecha_inicio),
          normalizarFechaOpcional(fecha_fin),
          'Abierto',
        ]
      );

      res.status(201).json({ torneo_id: result.rows[0].torneo_id });
    } catch (error) {
      console.error('Error al crear torneo:', error);

      if (error.code === '23514') {
        return res.status(400).json({ error: ERROR_FECHAS_TORNEO });
      }

      if (error.code === '23503') {
        return res.status(400).json({ error: ERROR_DISCIPLINA_NO_EXISTE });
      }

      if (error.code === '22007' || error.code === '22008') {
        return res.status(400).json({ error: 'Formato de fecha invalido' });
      }

      res.status(500).json({ error: 'Error al crear torneo' });
    }
  },

  inscribirParticipante: async (req, res) => {
    const { socio_id, visita_id, nombre_externo, categoria_id, equipo_id } = req.body;
    const socioPresente = tieneValor(socio_id);
    const visitaPresente = tieneValor(visita_id);
    const nombreExternoNormalizado = typeof nombre_externo === 'string' ? nombre_externo.trim() : null;
    const externoPresente = Boolean(nombreExternoNormalizado);
    const tiposParticipante = [socioPresente, visitaPresente, externoPresente].filter(Boolean).length;

    if (tiposParticipante !== 1) {
      return res.status(400).json({ error: ERROR_TIPO_PARTICIPANTE });
    }

    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero valido' });
    }

    const socioId = socioPresente ? esEnteroValido(socio_id) : null;
    const visitaId = visitaPresente ? esEnteroValido(visita_id) : null;

    try {
      if (socioPresente) {
        if (socioId === null) {
          return res.status(400).json({ error: ERROR_SOCIO_NO_VALIDO });
        }

        const socio = await pool.query(
          'SELECT * FROM socios WHERE socio_id = $1 AND activo = TRUE',
          [socioId]
        );

        if (socio.rowCount === 0) {
          return res.status(400).json({ error: ERROR_SOCIO_NO_VALIDO });
        }
      }

      if (visitaPresente) {
        if (visitaId === null) {
          return res.status(400).json({ error: ERROR_VISITA_NO_VALIDA });
        }

        const visita = await pool.query(
          'SELECT * FROM visitas WHERE visita_id = $1 AND vigente = TRUE',
          [visitaId]
        );

        if (visita.rowCount === 0) {
          return res.status(400).json({ error: ERROR_VISITA_NO_VALIDA });
        }
      }

      const categoriaId = esEnteroValido(categoria_id);
      if (categoriaId === null) {
        return res.status(400).json({ error: ERROR_CATEGORIA_NO_EXISTE });
      }

      const categoria = await pool.query(
        'SELECT categoria_id FROM categorias_torneo WHERE categoria_id = $1',
        [categoriaId]
      );

      if (categoria.rowCount === 0) {
        return res.status(400).json({ error: ERROR_CATEGORIA_NO_EXISTE });
      }

      if (socioPresente || visitaPresente) {
        const participanteExistente = await pool.query(
          `
            SELECT participante_id
            FROM participantes_torneo
            WHERE torneo_id = $1
              AND (
                socio_id = $2
                OR visita_id = $3
              )
            LIMIT 1
          `,
          [torneoId, socioId, visitaId]
        );

        if (participanteExistente.rowCount > 0) {
          return res.status(409).json({ error: ERROR_PARTICIPANTE_DUPLICADO });
        }
      }

      const equipoId = tieneValor(equipo_id) ? esEnteroValido(equipo_id) : null;
      if (tieneValor(equipo_id) && equipoId === null) {
        return res.status(400).json({ error: 'equipo_id debe ser un entero valido' });
      }

      const result = await pool.query(
        `
          INSERT INTO participantes_torneo (
            torneo_id,
            socio_id,
            visita_id,
            nombre_externo,
            equipo_id,
            categoria_id
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING participante_id
        `,
        [
          torneoId,
          socioId,
          visitaId,
          externoPresente ? nombreExternoNormalizado : null,
          equipoId,
          categoriaId,
        ]
      );

      res.status(201).json({ participante_id: result.rows[0].participante_id });
    } catch (error) {
      console.error('Error al inscribir participante en torneo:', error);

      if (error.code === '23505') {
        return res.status(409).json({ error: ERROR_PARTICIPANTE_DUPLICADO });
      }

      if (error.code === '23503') {
        return res.status(400).json({ error: 'Referencia no encontrada' });
      }

      res.status(500).json({ error: 'Error al inscribir participante en torneo' });
    }
  },

  cerrarInscripciones: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero válido' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar estado del torneo
      const torneo = await client.query(
        'SELECT estado FROM torneos WHERE torneo_id = $1 FOR UPDATE',
        [torneoId]
      );

      if (torneo.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Torneo no encontrado' });
      }

      if (torneo.rows[0].estado !== 'Abierto') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'El torneo no está abierto para cerrar inscripciones' });
      }

      // Contar participantes
      const participantes = await client.query(
        'SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1',
        [torneoId]
      );

      const numParticipantes = participantes.rowCount;
      if (numParticipantes < 4) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Se requieren mínimo 4 participantes' });
      }

      // Mezclar participantes
      const ids = participantes.rows.map(p => p.participante_id);
      shuffleArray(ids);

      const totalByes = siguientePotenciaDeDos(ids.length) - ids.length;
      const totalParticipantesConCruce = ids.length - totalByes;

      for (let i = 0; i < totalParticipantesConCruce; i += 2) {
        await client.query(
          `INSERT INTO encuentros_torneo (
             torneo_id,
             participante_1_id,
             participante_2_id,
             ronda,
             estado
           )
           VALUES ($1, $2, $3, 1, 'pendiente')`,
          [torneoId, ids[i], ids[i + 1]]
        );
      }

      for (let i = totalParticipantesConCruce; i < ids.length; i++) {
        await client.query(
          `INSERT INTO encuentros_torneo (
             torneo_id,
             participante_1_id,
             ronda,
             ganador_id,
             estado
           )
           VALUES ($1, $2, 1, $2, 'programado')`,
          [torneoId, ids[i]]
        );
      }

      // Actualizar estado del torneo
      await client.query(
        "UPDATE torneos SET estado = 'Inscripciones_cerradas' WHERE torneo_id = $1",
        [torneoId]
      );

      await client.query('COMMIT');
      res.json({ message: 'Inscripciones cerradas y bracket generado' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al cerrar inscripciones:', error);
      res.status(500).json({ error: 'Error al cerrar inscripciones' });
    } finally {
      client.release();
    }
  },

  confirmarBracket: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero válido' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar estado del torneo
      const torneo = await client.query(
        'SELECT estado FROM torneos WHERE torneo_id = $1 FOR UPDATE',
        [torneoId]
      );

      if (torneo.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Torneo no encontrado' });
      }

      if (torneo.rows[0].estado === 'En_curso') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'El bracket ya está confirmado' });
      }

      await client.query(
        `UPDATE encuentros_torneo
         SET estado = 'programado'
         WHERE torneo_id = $1
           AND ronda = 1
           AND estado = 'pendiente'`,
        [torneoId]
      );

      await client.query(
        "UPDATE torneos SET estado = 'En_curso' WHERE torneo_id = $1",
        [torneoId]
      );

      await client.query('COMMIT');
      res.json({ message: 'Bracket confirmado' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al confirmar bracket:', error);
      res.status(500).json({ error: 'Error al confirmar bracket' });
    } finally {
      client.release();
    }
  },
};

module.exports = torneosController;
