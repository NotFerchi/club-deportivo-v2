const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const LUDOTECA_TIME_ZONE = 'America/Mexico_City';
const CLUB_CLOSE_TIME = process.env.CLUB_HORA_CIERRE || '22:00';

const getToday = () => new Date().toISOString().split('T')[0];

const isMissingPasesTable = (error) =>
    error?.code === '42P01' && String(error.message || '').includes('pases');

const normalizePositiveInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

const rollbackQuietly = async (client) => {
    try {
        await client.query('ROLLBACK');
    } catch (error) {
        console.error('Error al revertir transaccion:', error);
    }
};

const pasesSelect = `
    SELECT
        p.pase_id,
        p.pase_id as visita_id,
        p.tipo_pase,
        p.socio_id,
        p.socio_id as socio_anfitrion_id,
        p.nombre_completo,
        split_part(p.nombre_completo, ' ', 1) as nombre,
        NULLIF(BTRIM(SUBSTRING(p.nombre_completo FROM LENGTH(split_part(p.nombre_completo, ' ', 1)) + 1)), '') as apellidos,
        p.correo,
        p.telefono,
        p.mayor_16,
        p.fecha_pase,
        p.fecha_pase as fecha_visita,
        p.hora_entrada,
        p.hora_salida,
        p.estado,
        (p.estado = 'activo') as vigente,
        p.observaciones,
        p.observaciones as motivo,
        NULL::text as identificacion,
        NULL::text as identificacion_tipo,
        s.numero_socio,
        u.nombres as socio_anfitrion_nombre,
        u.apellido_paterno as socio_anfitrion_apellido,
        u.username as socio_anfitrion_email
    FROM pases p
    LEFT JOIN socios s ON p.socio_id = s.socio_id
    LEFT JOIN usuarios u ON s.usuario_id = u.usuario_id
`;

const visitasSelect = `
    SELECT
        v.visita_id,
        v.visita_id as pase_id,
        'visita' as tipo_pase,
        NULL::int as socio_id,
        NULL::int as socio_anfitrion_id,
        v.nombre_completo,
        split_part(v.nombre_completo, ' ', 1) as nombre,
        NULLIF(BTRIM(SUBSTRING(v.nombre_completo FROM LENGTH(split_part(v.nombre_completo, ' ', 1)) + 1)), '') as apellidos,
        NULL::text as correo,
        NULL::text as telefono,
        true as mayor_16,
        v.fecha_visita as fecha_pase,
        v.fecha_visita,
        v.hora_entrada,
        v.hora_salida,
        CASE WHEN v.vigente THEN 'activo' ELSE 'finalizado' END as estado,
        v.vigente,
        NULL::text as observaciones,
        NULL::text as motivo,
        v.identificacion_tipo as identificacion,
        v.identificacion_tipo,
        NULL::text as numero_socio,
        NULL::text as socio_anfitrion_nombre,
        NULL::text as socio_anfitrion_apellido,
        NULL::text as socio_anfitrion_email
    FROM visitas v
`;

const queryPasesWithFallback = async (pasesQuery, pasesParams, visitasQuery, visitasParams) => {
    try {
        return await pool.query(pasesQuery, pasesParams);
    } catch (error) {
        if (isMissingPasesTable(error)) {
            return pool.query(visitasQuery, visitasParams);
        }

        throw error;
    }
};

const cerrarVisitasVencidasDb = async () => {
    const localNow = `(NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}')`;

    try {
        const result = await pool.query(
            `UPDATE pases
             SET hora_salida = ${localNow},
                 estado = 'finalizado'
             WHERE estado = 'activo'
               AND (
                 fecha_pase < (${localNow})::date
                 OR (fecha_pase = (${localNow})::date AND (${localNow})::time >= $1::time)
               )
             RETURNING pase_id`,
            [CLUB_CLOSE_TIME]
        );

        return result.rowCount || 0;
    } catch (error) {
        if (!isMissingPasesTable(error)) throw error;

        const result = await pool.query(
            `UPDATE visitas
             SET hora_salida = ${localNow},
                 vigente = false
             WHERE vigente = true
               AND (
                 fecha_visita < (${localNow})::date
                 OR (fecha_visita = (${localNow})::date AND (${localNow})::time >= $1::time)
               )
             RETURNING visita_id`,
            [CLUB_CLOSE_TIME]
        );

        return result.rowCount || 0;
    }
};

const cerrarVisitasVencidasConAuditoria = async (req) => {
    const cerradas = await cerrarVisitasVencidasDb();
    if (cerradas > 0) {
        await logAudit(req, {
            accion: 'cierre_automatico_visitas',
            tabla_afectada: 'pases',
            detalles: `Visitas cerradas automaticamente: ${cerradas}`
        });
    }
    return cerradas;
};

const recepcionController = {
    getDashboard: async (req, res) => {
        try {
            await cerrarVisitasVencidasConAuditoria(req);
            const hoy = getToday();

            const ingresos = await pool.query(
                `SELECT COUNT(*) FROM asistencia WHERE fecha = $1`,
                [hoy]
            );

            const ludoteca = await pool.query(
                `SELECT COUNT(*) FROM registro_ludoteca WHERE hora_salida IS NULL`
            );

            const sanciones = await pool.query(
                `SELECT COUNT(*) FROM sanciones WHERE LOWER(estado::text) IN ('activo', 'activa')`
            );

            let visitasActivas = 0;

            try {
                const visitas = await pool.query(
                    `SELECT COUNT(*) FROM pases WHERE estado = 'activo' AND fecha_pase = $1`,
                    [hoy]
                );

                visitasActivas = parseInt(visitas.rows[0].count, 10);
            } catch (error) {
                if (!isMissingPasesTable(error)) {
                    throw error;
                }

                const visitas = await pool.query(
                    `SELECT COUNT(*) FROM visitas WHERE vigente = true AND fecha_visita = $1`,
                    [hoy]
                );

                visitasActivas = parseInt(visitas.rows[0].count, 10);
            }

            res.json({
                ingresosHoy: parseInt(ingresos.rows[0].count, 10),
                visitasActivas,
                ninosLudoteca: parseInt(ludoteca.rows[0].count, 10),
                sancionesActivas: parseInt(sanciones.rows[0].count, 10)
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener dashboard' });
        }
    },

    listarSocios: async (req, res) => {
    try {
        const { q } = req.query;
        
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
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar socios' });
    }
},

    crearSocio: async (req, res) => {
        const {
            nombres,
            apellidoPaterno,
            apellidoMaterno,
            email,
            telefono,
            curp,
            tipo,
            modalidad
        } = req.body;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const existe = await client.query(
                'SELECT usuario_id FROM usuarios WHERE username = $1',
                [email]
            );

            if (existe.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'El correo ya esta registrado' });
            }

            const passwordDefault = 'socio123';

            const rolResult = await client.query(
                `SELECT rol_id FROM roles WHERE nombre = 'socio'`
            );

            const rolId = rolResult.rows[0].rol_id;

            const userResult = await client.query(
                `INSERT INTO usuarios (
                    username,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    curp,
                    telefono,
                    password_hash,
                    rol_id,
                    activo
                )
                VALUES ($1, $2, $3, $4, $5, $6, crypt($7, gen_salt('bf')), $8, true)
                RETURNING usuario_id`,
                [
                    email,
                    nombres,
                    apellidoPaterno,
                    apellidoMaterno || '',
                    curp,
                    telefono,
                    passwordDefault,
                    rolId
                ]
            );

            const usuarioId = userResult.rows[0].usuario_id;

            const numSocioResult = await client.query(`
                SELECT COALESCE(MAX(CAST(SUBSTRING(numero_socio FROM 5) AS INTEGER)), 0) + 1
                FROM socios
            `);

            const numeroSocio = `SOC-${String(numSocioResult.rows[0].coalesce).padStart(4, '0')}`;

            await client.query(
                `INSERT INTO socios (
                    usuario_id,
                    tipo,
                    modalidad,
                    es_titular,
                    numero_socio,
                    activo
                )
                VALUES ($1, $2, $3, true, $4, true)`,
                [
                    usuarioId,
                    tipo || 'Rentista',
                    modalidad || 'Individual',
                    numeroSocio
                ]
            );

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Socio creado exitosamente',
                password: passwordDefault
            });
        } catch (error) {
            await rollbackQuietly(client);
            console.error(error);
            res.status(500).json({ error: 'Error al crear socio' });
        } finally {
            client.release();
        }
    },

    actualizarSocio: async (req, res) => {
        const { id } = req.params;
        const {
            nombres,
            apellidoPaterno,
            apellidoMaterno,
            email,
            telefono,
            activo
        } = req.body;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const socioResult = await client.query(
                'SELECT usuario_id FROM socios WHERE socio_id = $1',
                [id]
            );

            if (socioResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Socio no encontrado' });
            }

            const usuarioId = socioResult.rows[0].usuario_id;

            await client.query(
                `UPDATE usuarios
                 SET nombres = $1,
                     apellido_paterno = $2,
                     apellido_materno = $3,
                     username = $4,
                     telefono = $5,
                     activo = $6
                 WHERE usuario_id = $7`,
                [
                    nombres,
                    apellidoPaterno,
                    apellidoMaterno,
                    email,
                    telefono,
                    activo,
                    usuarioId
                ]
            );

            await client.query('COMMIT');

            res.json({ message: 'Socio actualizado' });
        } catch (error) {
            await rollbackQuietly(client);
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

            const socioResult = await client.query(
                'SELECT usuario_id FROM socios WHERE socio_id = $1',
                [id]
            );

            if (socioResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Socio no encontrado' });
            }

            const usuarioId = socioResult.rows[0].usuario_id;

            await client.query(
                'UPDATE socios SET activo = false WHERE socio_id = $1',
                [id]
            );

            await client.query(
                'UPDATE usuarios SET activo = false WHERE usuario_id = $1',
                [usuarioId]
            );

            await client.query('COMMIT');

            res.json({ message: 'Socio eliminado' });
        } catch (error) {
            await rollbackQuietly(client);
            console.error(error);
            res.status(500).json({ error: 'Error al eliminar socio' });
        } finally {
            client.release();
        }
    },

    getReservasCentral: async (req, res) => {
        const { fecha } = req.query;
        const fechaConsulta = fecha || getToday();

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
            const result = await pool.query(`
                SELECT espacio_id, nombre, capacidad_maxima
                FROM espacios
                ORDER BY nombre
            `);

            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener espacios' });
        }
    },

    visitasActivas: async (req, res) => {
        try {
            await cerrarVisitasVencidasConAuditoria(req);
            const result = await queryPasesWithFallback(
                `${pasesSelect}
                 WHERE p.estado = 'activo'
                 ORDER BY p.hora_entrada DESC`,
                [],
                `${visitasSelect}
                 WHERE v.vigente = true
                 ORDER BY v.hora_entrada DESC`,
                []
            );

            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener pases activos' });
        }
    },

    historialVisitas: async (req, res) => {
        const dias = normalizePositiveInt(req.query.dias, 7);

        try {
            await cerrarVisitasVencidasConAuditoria(req);
            const result = await queryPasesWithFallback(
                `${pasesSelect}
                 WHERE p.fecha_pase >= CURRENT_DATE - ($1::int - 1)
                 ORDER BY p.hora_entrada DESC`,
                [dias],
                `${visitasSelect}
                 WHERE v.fecha_visita >= CURRENT_DATE - ($1::int - 1)
                 ORDER BY v.hora_entrada DESC`,
                [dias]
            );

            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener historial de pases' });
        }
    },

    listarVisitas: async (req, res) => {
        const { fecha } = req.query;
        const fechaConsulta = fecha || getToday();

        try {
            await cerrarVisitasVencidasConAuditoria(req);
            const result = await queryPasesWithFallback(
                `${pasesSelect}
                 WHERE p.fecha_pase = $1
                 ORDER BY p.hora_entrada DESC`,
                [fechaConsulta],
                `${visitasSelect}
                 WHERE v.fecha_visita = $1
                 ORDER BY v.hora_entrada DESC`,
                [fechaConsulta]
            );

            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al listar visitas' });
        }
    },

    cerrarVisitasVencidas: async (req, res) => {
        try {
            const cerradas = await cerrarVisitasVencidasConAuditoria(req);

            res.json({
                ok: true,
                cerradas,
                hora_cierre: CLUB_CLOSE_TIME
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al cerrar visitas vencidas' });
        }
    },

    crearVisita: async (req, res) => {
        const {
            tipo_pase,
            socio_id,
            socio_anfitrion_id,
            nombre_completo,
            nombreCompleto,
            nombre,
            apellido,
            apellidos,
            correo,
            telefono,
            identificacion,
            tipoVisita,
            mayor_16,
            observaciones,
            motivo
        } = req.body;

        const socioIdEntrada = socio_id || socio_anfitrion_id || null;
        const legacyPayload = !Object.prototype.hasOwnProperty.call(req.body, 'tipo_pase');

        const tipoPaseNormalizado = String(
            tipo_pase || tipoVisita || (socioIdEntrada ? 'visita' : 'dia')
        ).trim().toLowerCase();

        const nombreNormalizado = String(
            nombre_completo ||
            nombreCompleto ||
            [nombre, apellido || apellidos].filter(Boolean).join(' ')
        ).trim();

        const correoNormalizado = String(correo || '').trim();
        const telefonoNormalizado = normalizeDigits(telefono);
        const identificacionNormalizada = String(identificacion || '').trim();
        const observacionesNormalizadas = String(observaciones || motivo || '').trim();
        const mayor16Final = typeof mayor_16 === 'boolean' ? mayor_16 : true;
        const usuarioCreador = req.user?.usuario_id || null;

        if (!['visita', 'dia'].includes(tipoPaseNormalizado)) {
            return res.status(400).json({ error: 'Tipo de pase invalido' });
        }

        if (!nombreNormalizado) {
            return res.status(400).json({ error: 'Nombre completo es requerido' });
        }

        if (!legacyPayload && (!telefonoNormalizado || telefonoNormalizado.length < 10)) {
            return res.status(400).json({ error: 'Telefono valido es requerido' });
        }

        if (!legacyPayload && typeof mayor_16 !== 'boolean') {
            return res.status(400).json({ error: 'Debe indicar si es mayor de 16 anos' });
        }

        const telefonoFinal =
            telefonoNormalizado ||
            normalizeDigits(identificacionNormalizada).slice(0, 20) ||
            '0000000000';

        const observacionesFinales = [
            identificacionNormalizada ? `Identificacion: ${identificacionNormalizada}` : '',
            observacionesNormalizadas
        ].filter(Boolean).join(' | ') || null;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            let socioIdFinal = null;

            if (tipoPaseNormalizado === 'visita') {
                if (!socioIdEntrada && !legacyPayload) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        error: 'Debe seleccionar un socio activo para una visita'
                    });
                }

                if (socioIdEntrada) {
                    const socioResult = await client.query(`
                        SELECT s.socio_id
                        FROM socios s
                        WHERE s.socio_id = $1 AND s.activo = true
                    `, [socioIdEntrada]);

                    if (socioResult.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            error: 'El socio seleccionado no esta activo o no existe'
                        });
                    }

                    socioIdFinal = socioIdEntrada;
                }
            }

            const result = await client.query(`
                INSERT INTO pases (
                    tipo_pase,
                    socio_id,
                    nombre_completo,
                    correo,
                    telefono,
                    mayor_16,
                    fecha_pase,
                    hora_entrada,
                    estado,
                    creado_por,
                    observaciones
                )
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, NOW(), 'activo', $7, $8)
                RETURNING pase_id
            `, [
                tipoPaseNormalizado,
                socioIdFinal,
                nombreNormalizado,
                correoNormalizado || null,
                telefonoFinal,
                mayor16Final,
                usuarioCreador,
                observacionesFinales
            ]);

            await client.query('COMMIT');
            await logAudit(req, {
                accion: 'crear_visita',
                tabla_afectada: 'pases',
                registro_id: result.rows[0].pase_id,
                detalles: `Pase ${tipoPaseNormalizado} registrado`
            });

            res.status(201).json({
                ok: true,
                id: result.rows[0].pase_id,
                pase_id: result.rows[0].pase_id,
                message: 'Pase registrado correctamente'
            });
        } catch (error) {
            await rollbackQuietly(client);

            if (isMissingPasesTable(error)) {
                try {
                    const legacyResult = await pool.query(
                        `INSERT INTO visitas (
                            nombre_completo,
                            identificacion_tipo,
                            fecha_visita,
                            hora_entrada,
                            vigente
                        )
                        VALUES ($1, $2, CURRENT_DATE, NOW(), true)
                        RETURNING visita_id`,
                        [
                            nombreNormalizado,
                            identificacionNormalizada || tipoVisita || tipoPaseNormalizado
                        ]
                    );

                    return res.status(201).json({
                        ok: true,
                        id: legacyResult.rows[0].visita_id,
                        visitaId: legacyResult.rows[0].visita_id,
                        message: 'Visita registrada correctamente'
                    });
                } catch (fallbackError) {
                    console.error(fallbackError);
                    return res.status(500).json({ error: 'Error al registrar visita' });
                }
            }

            console.error(error);
            res.status(500).json({ error: 'Error al registrar pase' });
        } finally {
            client.release();
        }
    },

    registrarSalida: async (req, res) => {
        const { id } = req.params;

        try {
            const result = await pool.query(`
                UPDATE pases
                SET hora_salida = NOW(), estado = 'finalizado'
                WHERE pase_id = $1 AND estado = 'activo'
                RETURNING pase_id
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Pase no encontrado o ya finalizado' });
            }

            await logAudit(req, {
                accion: 'registrar_salida_visita',
                tabla_afectada: 'pases',
                registro_id: id,
                detalles: 'Salida de visita registrada'
            });

            res.json({ ok: true, message: 'Salida registrada correctamente' });
        } catch (error) {
            if (isMissingPasesTable(error)) {
                try {
                    const result = await pool.query(
                        `UPDATE visitas
                         SET hora_salida = NOW(), vigente = false
                         WHERE visita_id = $1 AND vigente = true
                         RETURNING visita_id`,
                        [id]
                    );

                    if (result.rows.length === 0) {
                        return res.status(404).json({
                            error: 'Visita no encontrada o ya finalizada'
                        });
                    }

                    return res.json({
                        ok: true,
                        message: 'Salida registrada correctamente'
                    });
                } catch (fallbackError) {
                    console.error(fallbackError);
                    return res.status(500).json({ error: 'Error al registrar salida' });
                }
            }

            console.error(error);
            res.status(500).json({ error: 'Error al registrar salida' });
        }
    },

    registrarSalidaVisita: async (req, res) => {
        return recepcionController.registrarSalida(req, res);
    },

    listaSociosParaVisitas: async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    s.socio_id,
                    s.numero_socio,
                    u.nombres,
                    u.apellido_paterno,
                    u.username as email,
                    s.tipo as tipo_socio
                FROM socios s
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                WHERE s.activo = true
                ORDER BY u.nombres, u.apellido_paterno
            `);

            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener lista de socios' });
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
                    TO_CHAR(rl.hora_entrada, 'YYYY-MM-DD"T"HH24:MI:SS') AS hora_entrada_local,
                    u.nombres || ' ' || u.apellido_paterno as tutor_nombre,
                    GREATEST(FLOOR(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - rl.hora_entrada)))::int, 0) AS segundos_transcurridos,
                    GREATEST(FLOOR(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}') - rl.hora_entrada)) / 60)::int, 0) AS minutos_transcurridos,
                    CASE WHEN rl.hora_salida IS NULL THEN 'Activo' ELSE 'Finalizado' END as estado
                FROM registro_ludoteca rl
                JOIN socios s ON rl.socio_padre_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                WHERE rl.hora_salida IS NULL ORDER BY rl.hora_entrada
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
                `INSERT INTO registro_ludoteca (
                    socio_padre_id,
                    nombre_hijo,
                    fecha_nacimiento,
                    hora_entrada
                )
                VALUES ($1, $2, $3, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}')
                RETURNING registro_id`,
                [socioId, nombreHijo, fechaNacimiento]
            );

            res.status(201).json({
                message: 'Entrada registrada',
                registroId: result.rows[0].registro_id
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al registrar entrada' });
        }
    },

    registrarSalidaLudoteca: async (req, res) => {
        const { id } = req.params;

        try {
            const result = await pool.query(
                `UPDATE registro_ludoteca
                 SET hora_salida = NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}'
                 WHERE registro_id = $1 AND hora_salida IS NULL
                 RETURNING registro_id`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Registro no encontrado o ya finalizado'
                });
            }

            res.json({ message: 'Salida registrada' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al registrar salida' });
        }
    },

    clasesPorFecha: async (req, res) => {
        const { fecha } = req.query;
        const fechaConsulta = fecha || getToday();
        const [year, month, day] = fechaConsulta.split('-').map(Number);

        if (!year || !month || !day) {
            return res.status(400).json({ error: 'Fecha invalida' });
        }

        try {
            const diaSemana = new Date(year, month - 1, day).getDay() + 1;

            const result = await pool.query(`
                SELECT
                    sp.sesion_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    COALESCE(
                        NULLIF(TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellido_paterno, ''))), ''),
                        NULLIF(TRIM(i.especialidad), ''),
                        'Por asignar'
                    ) as instructor,
                    COUNT(r.reserva_id) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
                LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
                LEFT JOIN reservaciones r ON r.sesion_id = sp.sesion_id
                    AND r.fecha_reserva = $1
                    AND r.estado::text IN ('Confirmada', 'No-Show', 'pendiente', 'confirmada')
                WHERE sp.dia_semana = $2
                    AND e.activo = true
                    AND COALESCE((to_jsonb(sp)->>'activo')::boolean, true) = true
                GROUP BY
                    sp.sesion_id,
                    d.nombre,
                    e.nombre,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    i.especialidad,
                    u.nombres,
                    u.apellido_paterno
                ORDER BY sp.hora_inicio
            `, [fechaConsulta, diaSemana]);

            res.json(result.rows);
        } catch (error) {
            console.error('Error en clasesPorFecha:', error);
            res.status(500).json({ error: 'Error al obtener clases' });
        }
    },

    getClasesDia: async (req, res) => {
        return recepcionController.clasesPorFecha(req, res);
    },

    alumnosPorClase: async (req, res) => {
        const sesionId = req.params.sesionId || req.query.sesionId;
        const { fecha } = req.query;

        if (!sesionId || !fecha) {
            return res.status(400).json({ error: 'Sesion y fecha son requeridas' });
        }

        try {
            const result = await pool.query(`
                SELECT
                    r.reserva_id,
                    s.socio_id,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as nombre_socio,
                    u.username as contacto,
                    a.presente as asistio
                FROM reservaciones r
                JOIN socios s ON r.socio_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                LEFT JOIN asistencia a ON a.sesion_id = r.sesion_id
                    AND a.socio_id = s.socio_id
                    AND a.fecha = r.fecha_reserva
                WHERE r.sesion_id = $1
                    AND r.fecha_reserva = $2
                    AND r.estado::text IN ('Confirmada', 'No-Show', 'pendiente', 'confirmada')
                ORDER BY u.apellido_paterno, u.nombres
            `, [sesionId, fecha]);

            res.json(result.rows);
        } catch (error) {
            console.error('Error en alumnosPorClase:', error);
            res.status(500).json({ error: 'Error al obtener alumnos' });
        }
    },

    getAlumnosPorSesion: async (req, res) => {
        return recepcionController.alumnosPorClase(req, res);
    },

    registrarAsistenciaManual: async (req, res) => {
        const { sesionId, socioId, fecha, presente = true } = req.body;

        if (!sesionId || !socioId || !fecha) {
            return res.status(400).json({
                error: 'Sesion, socio y fecha son requeridos'
            });
        }

        try {
            const existente = await pool.query(`
                SELECT asistencia_id
                FROM asistencia
                WHERE sesion_id = $1 AND socio_id = $2 AND fecha = $3
            `, [sesionId, socioId, fecha]);

            if (existente.rows.length > 0) {
                await pool.query(`
                    UPDATE asistencia
                    SET presente = $1, registro = NOW()
                    WHERE asistencia_id = $2
                `, [presente, existente.rows[0].asistencia_id]);
            } else {
                await pool.query(`
                    INSERT INTO asistencia (
                        sesion_id,
                        socio_id,
                        fecha,
                        presente,
                        registro
                    )
                    VALUES ($1, $2, $3, $4, NOW())
                `, [sesionId, socioId, fecha, presente]);
            }

            res.json({
                ok: true,
                message: 'Asistencia registrada correctamente'
            });
        } catch (error) {
            console.error('Error en registrarAsistenciaManual:', error);
            res.status(500).json({ error: 'Error al registrar asistencia' });
        }
    }
};

module.exports = recepcionController;
