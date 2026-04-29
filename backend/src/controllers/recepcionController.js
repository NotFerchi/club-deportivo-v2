const pool = require('../config/database');

const recepcionController = {

    getDashboard: async (req, res) => {
        try {
            const hoy = new Date().toISOString().split('T')[0];
            const ingresos = await pool.query(`SELECT COUNT(*) FROM asistencia WHERE fecha = $1`, [hoy]);
            const visitas = await pool.query(`SELECT COUNT(*) FROM visitas WHERE vigente = true AND fecha_visita = $1`, [hoy]);
            const ludoteca = await pool.query(`SELECT COUNT(*) FROM registro_ludoteca WHERE hora_salida IS NULL`);
            res.json({
                ingresosHoy: parseInt(ingresos.rows[0].count),
                visitasActivas: parseInt(visitas.rows[0].count),
                ninosLudoteca: parseInt(ludoteca.rows[0].count)
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener dashboard' });
        }
    },

    listarSocios: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    s.socio_id,
                    u.usuario_id,
                    u.nombres,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.username as email,
                    u.telefono,
                    u.activo,
                    s.tipo,
                    s.modalidad,
                    s.numero_socio,
                    s.activo as socio_activo
                FROM socios s
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                ORDER BY u.apellido_paterno
            `);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al listar socios' });
        }
    },

    crearSocio: async (req, res) => {
        const { nombres, apellidoPaterno, apellidoMaterno, email, telefono, curp, tipo, modalidad } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const existe = await client.query('SELECT usuario_id FROM usuarios WHERE username = $1', [email]);
            if (existe.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'El correo ya está registrado' });
            }
            const passwordDefault = 'socio123';
            const rolResult = await client.query(`SELECT rol_id FROM roles WHERE nombre = 'socio'`);
            const rolId = rolResult.rows[0].rol_id;
            const userResult = await client.query(
                `INSERT INTO usuarios (username, nombres, apellido_paterno, apellido_materno, curp, telefono, password_hash, rol_id, activo)
                 VALUES ($1, $2, $3, $4, $5, $6, crypt($7, gen_salt('bf')), $8, true) RETURNING usuario_id`,
                [email, nombres, apellidoPaterno, apellidoMaterno || '', curp, telefono, passwordDefault, rolId]
            );
            const usuarioId = userResult.rows[0].usuario_id;
            const numSocioResult = await client.query("SELECT COALESCE(MAX(CAST(SUBSTRING(numero_socio FROM 5) AS INTEGER)), 0) + 1 FROM socios");
            const numeroSocio = `SOC-${String(numSocioResult.rows[0].coalesce).padStart(4, '0')}`;
            await client.query(
                `INSERT INTO socios (usuario_id, tipo, modalidad, es_titular, numero_socio, activo) VALUES ($1, $2, $3, true, $4, true)`,
                [usuarioId, tipo || 'Rentista', modalidad || 'Individual', numeroSocio]
            );
            await client.query('COMMIT');
            res.status(201).json({ message: 'Socio creado exitosamente', password: passwordDefault });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            res.status(500).json({ error: 'Error al crear socio' });
        } finally {
            client.release();
        }
    },

    actualizarSocio: async (req, res) => {
        const { id } = req.params;
        const { nombres, apellidoPaterno, apellidoMaterno, email, telefono, activo } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const socioResult = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
            if (socioResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Socio no encontrado' });
            }
            const usuarioId = socioResult.rows[0].usuario_id;
            await client.query(
                `UPDATE usuarios SET nombres = $1, apellido_paterno = $2, apellido_materno = $3, username = $4, telefono = $5, activo = $6 WHERE usuario_id = $7`,
                [nombres, apellidoPaterno, apellidoMaterno, email, telefono, activo, usuarioId]
            );
            await client.query('COMMIT');
            res.json({ message: 'Socio actualizado' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            res.status(500).json({ error: 'Error al actualizar socio' });
        } finally {
            client.release();
        }
    },

    eliminarSocio: async (req, res) => {
        const { id } = req.params;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const socioResult = await client.query('SELECT usuario_id FROM socios WHERE socio_id = $1', [id]);
            if (socioResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Socio no encontrado' });
            }
            const usuarioId = socioResult.rows[0].usuario_id;
            await client.query('UPDATE socios SET activo = false WHERE socio_id = $1', [id]);
            await client.query('UPDATE usuarios SET activo = false WHERE usuario_id = $1', [usuarioId]);
            await client.query('COMMIT');
            res.json({ message: 'Socio eliminado' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            res.status(500).json({ error: 'Error al eliminar socio' });
        } finally {
            client.release();
        }
    },

    getReservasCentral: async (req, res) => {
        const { fecha } = req.query;
        const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
        try {
            const result = await pool.query(`
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
            `, [fechaConsulta]);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener reservas' });
        }
    },

    getEspacios: async (req, res) => {
        try {
            const result = await pool.query(`SELECT espacio_id, nombre, capacidad_maxima FROM espacios ORDER BY nombre`);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener espacios' });
        }
    },

    listarVisitas: async (req, res) => {
        const { fecha } = req.query;
        const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
        try {
            const result = await pool.query(`
                SELECT 
                    v.visita_id,
                    v.nombre_completo,
                    v.identificacion_tipo,
                    v.fecha_visita,
                    v.hora_entrada,
                    v.hora_salida,
                    v.vigente
                FROM visitas v
                WHERE v.fecha_visita = $1
                ORDER BY v.hora_entrada DESC
            `, [fechaConsulta]);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al listar visitas' });
        }
    },

    crearVisita: async (req, res) => {
        const { nombreCompleto, tipoVisita } = req.body;
        try {
            const result = await pool.query(
                `INSERT INTO visitas (nombre_completo, identificacion_tipo, fecha_visita, hora_entrada, vigente)
                 VALUES ($1, $2, CURRENT_DATE, NOW(), true) RETURNING visita_id`,
                [nombreCompleto, tipoVisita]
            );
            res.status(201).json({ message: 'Visita registrada', visitaId: result.rows[0].visita_id });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al registrar visita' });
        }
    },

    registrarSalidaVisita: async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query(
                `UPDATE visitas SET hora_salida = NOW(), vigente = false WHERE visita_id = $1 AND vigente = true`,
                [id]
            );
            res.json({ message: 'Salida registrada' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al registrar salida' });
        }
    },

    getLudotecaActivos: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    rl.registro_id,
                    rl.nombre_hijo,
                    rl.fecha_nacimiento,
                    rl.hora_entrada,
                    rl.hora_salida,
                    u.nombres || ' ' || u.apellido_paterno as tutor_nombre,
                    EXTRACT(EPOCH FROM (NOW() - rl.hora_entrada)) / 60 as minutos_transcurridos,
                    CASE WHEN rl.hora_salida IS NULL THEN 'Activo' ELSE 'Finalizado' END as estado
                FROM registro_ludoteca rl
                JOIN socios s ON rl.socio_padre_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                ORDER BY rl.hora_entrada
            `);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener ludoteca' });
        }
    },

    registrarEntradaLudoteca: async (req, res) => {
        const { socioId, nombreHijo, fechaNacimiento } = req.body;
        try {
            const result = await pool.query(
                `INSERT INTO registro_ludoteca (socio_padre_id, nombre_hijo, fecha_nacimiento, hora_entrada)
                 VALUES ($1, $2, $3, NOW()) RETURNING registro_id`,
                [socioId, nombreHijo, fechaNacimiento]
            );
            res.status(201).json({ message: 'Entrada registrada', registroId: result.rows[0].registro_id });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al registrar entrada' });
        }
    },

    registrarSalidaLudoteca: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query(
                `UPDATE registro_ludoteca SET hora_salida = NOW() WHERE registro_id = $1 AND hora_salida IS NULL RETURNING registro_id`,
                [id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Registro no encontrado o ya finalizado' });
            }
            res.json({ message: 'Salida registrada' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al registrar salida' });
        }
    },

    getClasesDia: async (req, res) => {
        const { fecha } = req.query;
        const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
        const [y, m, d] = fechaConsulta.split('-').map(Number);
        const diaSemana = new Date(y, m - 1, d).getDay() + 1;
        try {
            const result = await pool.query(`
                SELECT 
                    sp.sesion_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                WHERE sp.dia_semana = $1
                ORDER BY sp.hora_inicio
            `, [diaSemana]);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener clases' });
        }
    },

    getAlumnosPorSesion: async (req, res) => {
        const { sesionId, fecha } = req.query;
        try {
            const result = await pool.query(`
                SELECT 
                    r.reserva_id,
                    s.socio_id,
                    u.nombres || ' ' || u.apellido_paterno as nombre_socio,
                    a.presente as asistio
                FROM reservaciones r
                JOIN socios s ON r.socio_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                LEFT JOIN asistencia a ON a.sesion_id = r.sesion_id AND a.socio_id = s.socio_id AND a.fecha = r.fecha_reserva
                WHERE r.sesion_id = $1 AND r.fecha_reserva = $2 AND r.estado = 'Confirmada'
            `, [sesionId, fecha]);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener alumnos' });
        }
    },

    registrarAsistenciaManual: async (req, res) => {
        const { sesionId, socioId, fecha } = req.body;
        try {
            const existe = await pool.query(
                `SELECT asistencia_id FROM asistencia WHERE sesion_id = $1 AND socio_id = $2 AND fecha = $3`,
                [sesionId, socioId, fecha]
            );
            if (existe.rows.length > 0) {
                return res.status(400).json({ error: 'La asistencia ya fue registrada' });
            }
            await pool.query(
                `INSERT INTO asistencia (sesion_id, socio_id, fecha, presente) VALUES ($1, $2, $3, true)`,
                [sesionId, socioId, fecha]
            );
            res.json({ message: 'Asistencia registrada' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al registrar asistencia' });
        }
    }
};

module.exports = recepcionController;