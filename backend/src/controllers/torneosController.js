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
    const { disciplina_id, estado } = req.query;
    const condiciones = [];
    const valores = [];

    if (tieneValor(disciplina_id)) {
      const disciplinaId = esEnteroValido(disciplina_id);
      if (disciplinaId === null) {
        return res.status(400).json({ error: 'disciplina_id debe ser un entero valido' });
      }
      valores.push(disciplinaId);
      condiciones.push(`t.disciplina_id = $${valores.length}`);
    }

    if (tieneValor(estado)) {
      valores.push(estado);
      condiciones.push(`LOWER(t.estado) = LOWER($${valores.length})`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    try {
      const result = await pool.query(`
        SELECT
          t.torneo_id,
          t.nombre,
          t.disciplina_id,
          d.nombre AS nombre_disciplina,
          t.fecha_inicio,
          t.fecha_fin,
          t.estado,
          t.tipo_torneo,
          t.categoria_id,
          ct.nombre AS nombre_categoria,
          COUNT(pt.participante_id)::int AS total_participantes,
          (COUNT(pt.participante_id) >= 4) AS se_realiza
        FROM torneos t
        JOIN disciplinas d ON t.disciplina_id = d.disciplina_id
        LEFT JOIN categorias_torneo ct ON ct.categoria_id = t.categoria_id
        LEFT JOIN participantes_torneo pt ON pt.torneo_id = t.torneo_id
        ${where}
        GROUP BY t.torneo_id, t.disciplina_id, d.nombre, t.tipo_torneo, t.categoria_id, ct.nombre
        ORDER BY t.fecha_inicio DESC NULLS LAST, t.torneo_id DESC
      `, valores);

      res.json(result.rows);
    } catch (error) {
      console.error('Error al obtener torneos:', error);
      res.status(500).json({ error: 'Error al obtener torneos' });
    }
  },

  createTorneo: async (req, res) => {
    const { nombre, disciplina_id, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo } = req.body;

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

      const categoriaId = tieneValor(categoria_id) ? esEnteroValido(categoria_id) : null;

      const result = await pool.query(
        `INSERT INTO torneos (disciplina_id, nombre, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING torneo_id`,
        [
          disciplinaId,
          nombre.trim(),
          normalizarFechaOpcional(fecha_inicio),
          normalizarFechaOpcional(fecha_fin),
          estado || 'Abierto',
          categoriaId,
          tipo_torneo || 'Individual',
        ]
      );

      res.status(201).json({ torneo_id: result.rows[0].torneo_id });
    } catch (error) {
      console.error('Error al crear torneo:', error);

      if (error.code === '23514') return res.status(400).json({ error: ERROR_FECHAS_TORNEO });
      if (error.code === '23503') return res.status(400).json({ error: ERROR_DISCIPLINA_NO_EXISTE });
      if (error.code === '22007' || error.code === '22008') return res.status(400).json({ error: 'Formato de fecha invalido' });

      res.status(500).json({ error: 'Error al crear torneo' });
    }
  },

  updateTorneo: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    const { nombre, disciplina_id, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo } = req.body;

    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero valido' });
    }

    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const disciplinaId = esEnteroValido(disciplina_id);
    if (disciplinaId === null) {
      return res.status(400).json({ error: 'disciplina_id debe ser un entero valido' });
    }

    const categoriaId = tieneValor(categoria_id) ? esEnteroValido(categoria_id) : null;

    try {
      const result = await pool.query(
        `UPDATE torneos
         SET disciplina_id = $1,
             nombre        = $2,
             fecha_inicio  = $3,
             fecha_fin     = $4,
             estado        = COALESCE($5, estado),
             categoria_id  = $6,
             tipo_torneo   = COALESCE($7, tipo_torneo)
         WHERE torneo_id = $8
         RETURNING torneo_id`,
        [
          disciplinaId,
          nombre.trim(),
          normalizarFechaOpcional(fecha_inicio),
          normalizarFechaOpcional(fecha_fin),
          estado || null,
          categoriaId,
          tipo_torneo || null,
          torneoId
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Torneo no encontrado' });
      }

      res.json({ ok: true, torneo_id: torneoId, message: 'Torneo actualizado correctamente' });
    } catch (error) {
      console.error('Error al actualizar torneo:', error);
      if (error.code === '23514') return res.status(400).json({ error: ERROR_FECHAS_TORNEO });
      if (error.code === '23503') return res.status(400).json({ error: ERROR_DISCIPLINA_NO_EXISTE });
      if (error.code === '22007' || error.code === '22008') return res.status(400).json({ error: 'Formato de fecha invalido' });
      res.status(500).json({ error: 'Error al actualizar torneo' });
    }
  },

  getParticipantes: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero valido' });
    }

    try {
      const result = await pool.query(
        `SELECT
           pt.participante_id,
           pt.torneo_id,
           pt.socio_id,
           pt.visita_id,
           pt.nombre_externo,
           pt.resultado_final,
           c.nombre AS categoria,
           COALESCE(
             NULLIF(TRIM(eq.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellido_paterno, ''), ' ', COALESCE(u.apellido_materno, ''))), ''),
             NULLIF(TRIM(v.nombre_completo), ''),
             NULLIF(TRIM(pt.nombre_externo), ''),
             'Participante sin nombre'
           ) AS nombre_participante,
           CASE
             WHEN pt.socio_id IS NOT NULL THEN 'Socio'
             WHEN pt.visita_id IS NOT NULL THEN 'Visita'
             ELSE 'Externo'
           END AS tipo_participante
         FROM participantes_torneo pt
         LEFT JOIN categorias_torneo c ON c.categoria_id = pt.categoria_id
         LEFT JOIN socios s ON s.socio_id = pt.socio_id
         LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
         LEFT JOIN visitas v ON v.visita_id = pt.visita_id
         LEFT JOIN equipos eq ON eq.equipo_id = pt.equipo_id
         WHERE pt.torneo_id = $1
         ORDER BY c.nombre, nombre_participante`,
        [torneoId]
      );

      res.json({
        data: result.rows,
        participantes: result.rows,
        total: result.rowCount,
        se_realiza: result.rowCount >= 4,
        minimo_participantes: 4
      });
    } catch (error) {
      console.error('Error al obtener participantes:', error);
      res.status(500).json({ error: 'Error al obtener participantes del torneo' });
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
        if (socioId === null) return res.status(400).json({ error: ERROR_SOCIO_NO_VALIDO });
        const socio = await pool.query(
          'SELECT * FROM socios WHERE socio_id = $1 AND activo IS NOT FALSE',
          [socioId]
        );
        if (socio.rowCount === 0) return res.status(400).json({ error: ERROR_SOCIO_NO_VALIDO });
      }

      if (visitaPresente) {
        if (visitaId === null) return res.status(400).json({ error: ERROR_VISITA_NO_VALIDA });
        const visita = await pool.query(
          'SELECT * FROM visitas WHERE visita_id = $1 AND vigente = TRUE',
          [visitaId]
        );
        if (visita.rowCount === 0) return res.status(400).json({ error: ERROR_VISITA_NO_VALIDA });
      }

      const categoriaId = esEnteroValido(categoria_id);
      if (categoriaId === null) return res.status(400).json({ error: ERROR_CATEGORIA_NO_EXISTE });

      const categoria = await pool.query(
        'SELECT categoria_id FROM categorias_torneo WHERE categoria_id = $1',
        [categoriaId]
      );
      if (categoria.rowCount === 0) return res.status(400).json({ error: ERROR_CATEGORIA_NO_EXISTE });

      if (socioPresente || visitaPresente) {
        const participanteExistente = await pool.query(
          `SELECT participante_id FROM participantes_torneo
           WHERE torneo_id = $1 AND (socio_id = $2 OR visita_id = $3)
           LIMIT 1`,
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
        `INSERT INTO participantes_torneo (torneo_id, socio_id, visita_id, nombre_externo, equipo_id, categoria_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING participante_id`,
        [torneoId, socioId, visitaId, externoPresente ? nombreExternoNormalizado : null, equipoId, categoriaId]
      );

      res.status(201).json({ participante_id: result.rows[0].participante_id });
    } catch (error) {
      console.error('Error al inscribir participante en torneo:', error);
      if (error.code === '23505') return res.status(409).json({ error: ERROR_PARTICIPANTE_DUPLICADO });
      if (error.code === '23503') return res.status(400).json({ error: 'Referencia no encontrada' });
      res.status(500).json({ error: 'Error al inscribir participante en torneo' });
    }
  },

  // ← FUNCIÓN CORREGIDA: ahora genera todas las rondas futuras vacías
  cerrarInscripciones: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero válido' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

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

      const participantes = await client.query(
        'SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1',
        [torneoId]
      );

      const numParticipantes = participantes.rowCount;
      if (numParticipantes < 4) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Se requieren mínimo 4 participantes' });
      }

      const ids = participantes.rows.map(p => p.participante_id);
      shuffleArray(ids);

      const totalSlots    = siguientePotenciaDeDos(ids.length);
      const totalByes     = totalSlots - ids.length;
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
         WHERE torneo_id = $1 AND ronda = 1 AND estado = 'pendiente'`,
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

  getReporte: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero válido' });
    }

    try {
      const torneo = await pool.query(
        `SELECT t.torneo_id, t.nombre, t.estado, d.nombre AS disciplina
         FROM torneos t
         JOIN disciplinas d ON d.disciplina_id = t.disciplina_id
         WHERE t.torneo_id = $1`,
        [torneoId]
      );

      if (torneo.rowCount === 0) {
        return res.status(404).json({ error: 'Torneo no encontrado' });
      }

      const encuentros = await pool.query(
        `SELECT
           e.encuentro_id, e.ronda, e.estado, e.marcador_1, e.marcador_2,
           e.cancha_asignada, e.hora_programada,
           p1.participante_id AS p1_id,
           COALESCE(
             NULLIF(TRIM(eq1.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(u1.nombres, ' ', COALESCE(u1.apellido_paterno,''), ' ', COALESCE(u1.apellido_materno,''))), ''),
             NULLIF(TRIM(v1.nombre_completo), ''),
             NULLIF(TRIM(p1.nombre_externo), ''),
             'Por definir'
           ) AS p1_nombre,
           p2.participante_id AS p2_id,
           COALESCE(
             NULLIF(TRIM(eq2.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(u2.nombres, ' ', COALESCE(u2.apellido_paterno,''), ' ', COALESCE(u2.apellido_materno,''))), ''),
             NULLIF(TRIM(v2.nombre_completo), ''),
             NULLIF(TRIM(p2.nombre_externo), ''),
             'Por definir'
           ) AS p2_nombre,
           e.ganador_id,
           COALESCE(
             NULLIF(TRIM(eqg.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(ug.nombres, ' ', COALESCE(ug.apellido_paterno,''), ' ', COALESCE(ug.apellido_materno,''))), ''),
             NULLIF(TRIM(vg.nombre_completo), ''),
             NULLIF(TRIM(pg.nombre_externo), ''),
             NULL
           ) AS ganador_nombre
         FROM encuentros_torneo e
         LEFT JOIN participantes_torneo p1 ON p1.participante_id = e.participante_1_id
         LEFT JOIN socios s1   ON s1.socio_id   = p1.socio_id
         LEFT JOIN usuarios u1 ON u1.usuario_id = s1.usuario_id
         LEFT JOIN visitas v1  ON v1.visita_id  = p1.visita_id
         LEFT JOIN equipos eq1 ON eq1.equipo_id = p1.equipo_id
         LEFT JOIN participantes_torneo p2 ON p2.participante_id = e.participante_2_id
         LEFT JOIN socios s2   ON s2.socio_id   = p2.socio_id
         LEFT JOIN usuarios u2 ON u2.usuario_id = s2.usuario_id
         LEFT JOIN visitas v2  ON v2.visita_id  = p2.visita_id
         LEFT JOIN equipos eq2 ON eq2.equipo_id = p2.equipo_id
         LEFT JOIN participantes_torneo pg ON pg.participante_id = e.ganador_id
         LEFT JOIN socios sg   ON sg.socio_id   = pg.socio_id
         LEFT JOIN usuarios ug ON ug.usuario_id = sg.usuario_id
         LEFT JOIN visitas vg  ON vg.visita_id  = pg.visita_id
         LEFT JOIN equipos eqg ON eqg.equipo_id = pg.equipo_id
         WHERE e.torneo_id = $1
         ORDER BY e.ronda ASC, e.encuentro_id ASC`,
        [torneoId]
      );

      return res.json({
        torneo: torneo.rows[0],
        encuentros: encuentros.rows.map(row => ({
          encuentro_id:    row.encuentro_id,
          ronda:           row.ronda,
          estado:          row.estado,
          marcador_1:      row.marcador_1,
          marcador_2:      row.marcador_2,
          cancha_asignada: row.cancha_asignada,
          hora_programada: row.hora_programada,
          participante_1:  { id: row.p1_id, nombre: row.p1_nombre },
          participante_2:  { id: row.p2_id, nombre: row.p2_nombre },
          ganador: row.ganador_id ? { id: row.ganador_id, nombre: row.ganador_nombre } : null
        }))
      });

    } catch (err) {
      console.error('Error al obtener reporte de torneo:', err);
      return res.status(500).json({ error: 'Error al obtener el reporte' });
    }
  },

  getCategorias: async (req, res) => {
    try {
      const result = await pool.query('SELECT categoria_id, nombre FROM categorias_torneo ORDER BY nombre');
      res.json(result.rows);
    } catch (error) {
      console.error('Error al obtener categorías:', error);
      res.status(500).json({ error: 'Error al obtener categorías' });
    }
  },

  // Auto-inscripción del socio autenticado (sin requerir rol staff)
  // La categoría la decide el administrador al crear el torneo (torneo.categoria_id)
  inscribirSocioPropio: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero valido' });
    }

    try {
      // Obtener socio_id a partir del usuario autenticado (no se confía en el body)
      const socioResult = await pool.query(
        'SELECT socio_id FROM socios WHERE usuario_id = $1 AND activo IS NOT FALSE',
        [req.user.usuario_id]
      );
      if (socioResult.rowCount === 0) {
        return res.status(400).json({ error: ERROR_SOCIO_NO_VALIDO });
      }
      const socioId = socioResult.rows[0].socio_id;

      // El torneo debe existir y estar abierto; se obtiene su categoria_id
      const torneo = await pool.query(
        'SELECT torneo_id, estado, categoria_id FROM torneos WHERE torneo_id = $1',
        [torneoId]
      );
      if (torneo.rowCount === 0) {
        return res.status(404).json({ error: 'Torneo no encontrado' });
      }
      if (torneo.rows[0].estado !== 'Abierto') {
        return res.status(409).json({ error: 'El torneo no está abierto para inscripciones' });
      }

      // Usar la categoría del torneo; si no tiene, devolver error indicativo
      const categoriaId = torneo.rows[0].categoria_id;
      if (!categoriaId) {
        return res.status(400).json({ error: 'Este torneo no tiene categoría asignada. Contacta al administrador.' });
      }

      // Verificar que no esté ya inscrito
      const existente = await pool.query(
        'SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1 AND socio_id = $2 LIMIT 1',
        [torneoId, socioId]
      );
      if (existente.rowCount > 0) {
        return res.status(409).json({ error: ERROR_PARTICIPANTE_DUPLICADO });
      }

      const result = await pool.query(
        `INSERT INTO participantes_torneo (torneo_id, socio_id, categoria_id)
         VALUES ($1, $2, $3)
         RETURNING participante_id`,
        [torneoId, socioId, categoriaId]
      );

      res.status(201).json({ participante_id: result.rows[0].participante_id });
    } catch (error) {
      console.error('Error al inscribir socio en torneo:', error);
      if (error.code === '23505') return res.status(409).json({ error: ERROR_PARTICIPANTE_DUPLICADO });
      if (error.code === '23503') return res.status(400).json({ error: 'Referencia no encontrada' });
      res.status(500).json({ error: 'Error al inscribirse en el torneo' });
    }
  },

  // Desinscribir a un participante (solo staff: admin, gerente, coordinador)
  desinscribirParticipante: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    const participanteId = esEnteroValido(req.params.participante_id);

    if (torneoId === null || participanteId === null) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }

    try {
      // Solo se puede desinscribir si el torneo aún está abierto
      const torneo = await pool.query(
        'SELECT estado FROM torneos WHERE torneo_id = $1',
        [torneoId]
      );
      if (torneo.rowCount === 0) {
        return res.status(404).json({ error: 'Torneo no encontrado' });
      }
      if (torneo.rows[0].estado !== 'Abierto') {
        return res.status(409).json({ error: 'No se puede desinscribir participantes una vez cerradas las inscripciones' });
      }

      const result = await pool.query(
        'DELETE FROM participantes_torneo WHERE participante_id = $1 AND torneo_id = $2 RETURNING participante_id',
        [participanteId, torneoId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Participante no encontrado en este torneo' });
      }

      res.json({ ok: true, message: 'Participante desinscrito correctamente' });
    } catch (error) {
      console.error('Error al desinscribir participante:', error);
      res.status(500).json({ error: 'Error al desinscribir participante' });
    }
  },

  getMisParticipaciones: async (req, res) => {
    try {
      const socioResult = await pool.query(
        'SELECT socio_id FROM socios WHERE usuario_id = $1',
        [req.user.usuario_id]
      );
      if (socioResult.rowCount === 0) {
        return res.status(404).json({ error: 'Socio no encontrado' });
      }
      const socioId = socioResult.rows[0].socio_id;

      const result = await pool.query(`
        SELECT
          pt.participante_id,
          t.torneo_id,
          t.nombre,
          t.estado,
          t.fecha_inicio,
          t.fecha_fin,
          d.nombre AS nombre_disciplina,
          c.nombre AS categoria
        FROM participantes_torneo pt
        JOIN torneos t ON t.torneo_id = pt.torneo_id
        JOIN disciplinas d ON d.disciplina_id = t.disciplina_id
        LEFT JOIN categorias_torneo c ON c.categoria_id = pt.categoria_id
        WHERE pt.socio_id = $1
        ORDER BY t.fecha_inicio DESC NULLS LAST
      `, [socioId]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error al obtener participaciones:', error);
      res.status(500).json({ error: 'Error al obtener participaciones' });
    }
  },

  getBracket: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero valido' });
    }

    try {
      const torneo = await pool.query(
        'SELECT torneo_id FROM torneos WHERE torneo_id = $1',
        [torneoId]
      );

      if (torneo.rowCount === 0) {
        return res.status(404).json({ error: 'Torneo no encontrado' });
      }

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
          encuentro_id:    row.encuentro_id,
          estado:          row.estado,
          cancha_asignada: row.cancha_asignada,
          hora_programada: row.hora_programada,
          marcador_1:      row.marcador_1,
          marcador_2:      row.marcador_2,
          ganador_id:      row.ganador_id,
          ganador_nombre:  row.ganador_nombre,
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

      res.json(Object.values(bracketPorRonda));

    } catch (error) {
      console.error('Error al obtener bracket:', error);
      res.status(500).json({ error: 'Error al obtener bracket' });
    }
  },


  finalizarTorneo: async (req, res) => {
  const torneoId = esEnteroValido(req.params.torneo_id);
  if (torneoId === null) {
    return res.status(400).json({ error: 'torneo_id debe ser un entero válido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const torneo = await client.query(
      'SELECT estado FROM torneos WHERE torneo_id = $1 FOR UPDATE',
      [torneoId]
    );

    if (torneo.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Torneo no encontrado' });
    }

    if (torneo.rows[0].estado === 'Finalizado') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El torneo ya está finalizado' });
    }

    // Verificar que todos los encuentros estén finalizados
    const pendientes = await client.query(
      `SELECT COUNT(*) as total FROM encuentros_torneo
       WHERE torneo_id = $1 AND estado != 'finalizado'
       AND participante_1_id IS NOT NULL AND participante_2_id IS NOT NULL`,
      [torneoId]
    );

    if (parseInt(pendientes.rows[0].total) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Aún hay ${pendientes.rows[0].total} encuentros sin finalizar` });
    }

    await client.query(
      "UPDATE torneos SET estado = 'Finalizado' WHERE torneo_id = $1",
      [torneoId]
    );

    await client.query('COMMIT');
    res.json({ ok: true, message: 'Torneo finalizado correctamente' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al finalizar torneo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
},

  cancelarTorneo: async (req, res) => {
    const torneoId = esEnteroValido(req.params.torneo_id);
    if (torneoId === null) {
      return res.status(400).json({ error: 'torneo_id debe ser un entero válido' });
    }

    try {
      const result = await pool.query(
        `UPDATE torneos SET estado = 'Cancelado'
         WHERE torneo_id = $1 AND estado NOT IN ('Cancelado', 'Finalizado')
         RETURNING torneo_id`,
        [torneoId]
      );

      if (result.rowCount === 0) {
        const exists = await pool.query('SELECT estado FROM torneos WHERE torneo_id = $1', [torneoId]);
        if (exists.rowCount === 0) return res.status(404).json({ error: 'Torneo no encontrado' });
        return res.status(409).json({ error: `El torneo ya está ${exists.rows[0].estado.toLowerCase()}` });
      }

      res.json({ ok: true, message: 'Torneo cancelado correctamente' });
    } catch (error) {
      console.error('Error al cancelar torneo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

};

module.exports = torneosController;
