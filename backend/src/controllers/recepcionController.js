const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const QRCode = require('qrcode');
const { generarHmacSha256 } = require('../utils/qrCrypto');
const { resolveReservaEstado } = require('../utils/adminRules');
const LUDOTECA_TIME_ZONE = 'America/Mexico_City';
const CLUB_CLOSE_TIME = process.env.CLUB_HORA_CIERRE || '22:00';
const VISITA_QR_TTL_MS = 24 * 60 * 60 * 1000;

const getToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

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
        p.identificacion,
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
        NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), '') as socio_nombre,
        u.nombres as socio_anfitrion_nombre,
        u.apellido_paterno as socio_anfitrion_apellido,
        u.apellido_materno as socio_anfitrion_apellido_materno,
        u.username as socio_anfitrion_email
    FROM pases p
    LEFT JOIN socios s ON p.socio_id = s.socio_id
    LEFT JOIN usuarios u ON s.usuario_id = u.usuario_id
`;

const getVisitasLegacyColumns = async () => {
    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'visitas'
           AND column_name = ANY($1::text[])`,
        [['socio_id', 'correo', 'telefono', 'mayor_16', 'observaciones']]
    );

    const columns = new Set(result.rows.map((row) => row.column_name));

    return {
        socioId: columns.has('socio_id'),
        correo: columns.has('correo'),
        telefono: columns.has('telefono'),
        mayor16: columns.has('mayor_16'),
        observaciones: columns.has('observaciones')
    };
};

const buildVisitasLegacySelect = (columns = {}) => `
    SELECT
        v.visita_id,
        v.visita_id as pase_id,
        CASE
            WHEN ${columns.socioId ? 'v.socio_id IS NOT NULL' : 'false'} THEN 'visita'
            WHEN LOWER(COALESCE(v.identificacion_tipo, '')) IN ('dia', 'pase dia', 'pase de dia', 'pase de un dia') THEN 'dia'
            ELSE 'visita'
        END as tipo_pase,
        ${columns.socioId ? 'v.socio_id' : 'NULL::int'} as socio_id,
        ${columns.socioId ? 'v.socio_id' : 'NULL::int'} as socio_anfitrion_id,
        v.nombre_completo,
        split_part(v.nombre_completo, ' ', 1) as nombre,
        NULLIF(BTRIM(SUBSTRING(v.nombre_completo FROM LENGTH(split_part(v.nombre_completo, ' ', 1)) + 1)), '') as apellidos,
        ${columns.correo ? 'v.correo' : 'NULL::text'} as correo,
        ${columns.telefono ? 'v.telefono' : 'NULL::text'} as telefono,
        ${columns.mayor16 ? 'COALESCE(v.mayor_16, true)' : 'true'} as mayor_16,
        v.fecha_visita as fecha_pase,
        v.fecha_visita,
        v.hora_entrada,
        v.hora_salida,
        CASE WHEN v.vigente THEN 'activo' ELSE 'finalizado' END as estado,
        v.vigente,
        ${columns.observaciones ? 'v.observaciones' : 'NULL::text'} as observaciones,
        ${columns.observaciones ? 'v.observaciones' : 'NULL::text'} as motivo,
        v.identificacion_tipo as identificacion,
        v.identificacion_tipo,
        ${columns.socioId ? 's.numero_socio' : 'NULL::text'} as numero_socio,
        ${columns.socioId ? "NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), '')" : 'NULL::text'} as socio_nombre,
        ${columns.socioId ? 'u.nombres' : 'NULL::text'} as socio_anfitrion_nombre,
        ${columns.socioId ? 'u.apellido_paterno' : 'NULL::text'} as socio_anfitrion_apellido,
        ${columns.socioId ? 'u.apellido_materno' : 'NULL::text'} as socio_anfitrion_apellido_materno,
        ${columns.socioId ? 'u.username' : 'NULL::text'} as socio_anfitrion_email
    FROM visitas v
    ${columns.socioId ? 'LEFT JOIN socios s ON v.socio_id = s.socio_id LEFT JOIN usuarios u ON s.usuario_id = u.usuario_id' : ''}
`;

const getVisitasLegacySelect = async () => buildVisitasLegacySelect(await getVisitasLegacyColumns());

const queryPasesWithFallback = async (pasesQuery, pasesParams, visitasQuery, visitasParams) => {
    try {
        return await pool.query(pasesQuery, pasesParams);
    } catch (error) {
        if (isMissingPasesTable(error)) {
            const fallbackQuery = typeof visitasQuery === 'function'
                ? await visitasQuery()
                : visitasQuery;

            return pool.query(fallbackQuery, visitasParams);
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

const generarQrPase = async (client, paseId) => {
    const expiraEn = new Date(Date.now() + VISITA_QR_TTL_MS);
    const expiraEnIso = expiraEn.toISOString();
    const payload = {
        type: 'pase',
        pase_id: Number(paseId),
        expira_en: expiraEnIso
    };
    const hash = generarHmacSha256(payload);
    const codigoQr = JSON.stringify({ ...payload, hash });
    const qrImage = await QRCode.toDataURL(codigoQr);

    try {
        // SAVEPOINT protects the outer transaction if the INSERT fails
        // (e.g. table missing, unique constraint on re-generation)
        await client.query('SAVEPOINT before_qr_pase');
        const qrResult = await client.query(
            `INSERT INTO codigos_qr_pases (pase_id, codigo_qr, expira_en, activo)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (pase_id) DO UPDATE
               SET codigo_qr = EXCLUDED.codigo_qr,
                   expira_en = EXCLUDED.expira_en,
                   activo    = TRUE
             RETURNING qr_id`,
            [paseId, qrImage, expiraEn]
        );

        return {
            qr_id: qrResult.rows[0].qr_id,
            qr_image: qrImage,
            codigo_qr: codigoQr,
            expira_en: expiraEnIso
        };
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT before_qr_pase').catch(() => null);
        console.warn('No se pudo persistir QR de pase:', error.message);
        return {
            qr_id: null,
            qr_image: qrImage,
            codigo_qr: codigoQr,
            expira_en: expiraEnIso
        };
    }
};

const generarQrVisitaLegacy = async (visitaId) => {
    const expiraEn = new Date(Date.now() + VISITA_QR_TTL_MS);
    const expiraEnIso = expiraEn.toISOString();
    const payload = {
        type: 'visita',
        visita_id: Number(visitaId),
        expira_en: expiraEnIso
    };
    const hash = generarHmacSha256(payload);
    const codigoQr = JSON.stringify({ ...payload, hash });
    const qrImage = await QRCode.toDataURL(codigoQr);

    try {
        const qrResult = await pool.query(
            `INSERT INTO codigos_qr_visitas (visita_id, codigo_qr, expira_en, activo)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (visita_id) DO UPDATE
               SET codigo_qr = EXCLUDED.codigo_qr,
                   expira_en = EXCLUDED.expira_en,
                   activo    = TRUE
             RETURNING qr_id`,
            [visitaId, qrImage, expiraEn]
        );
        return {
            qr_id: qrResult.rows[0].qr_id,
            qr_image: qrImage,
            codigo_qr: codigoQr,
            expira_en: expiraEnIso
        };
    } catch (error) {
        console.warn('No se pudo persistir QR de visita legacy:', error.message);
        return {
            qr_id: null,
            qr_image: qrImage,
            codigo_qr: codigoQr,
            expira_en: expiraEnIso
        };
    }
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

            let visitasActivas = 0;
            let pasesDiaActivos = 0;
            let visitasInvitadosActivas = 0;

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

                visitasActivas = parseInt(visitas.rows[0].total, 10);
                pasesDiaActivos = parseInt(visitas.rows[0].pases_dia, 10);
                visitasInvitadosActivas = parseInt(visitas.rows[0].visitas, 10);
            } catch (error) {
                if (!isMissingPasesTable(error)) {
                    throw error;
                }

                const visitas = await pool.query(
                    `SELECT COUNT(*) FROM visitas WHERE vigente = true AND fecha_visita = $1`,
                    [hoy]
                );

                visitasActivas = parseInt(visitas.rows[0].count, 10);
                visitasInvitadosActivas = visitasActivas;
            }

            res.json({
                ingresosHoy: parseInt(ingresos.rows[0].count, 10),
                visitasActivas,
                visitasInvitadosActivas,
                pasesDiaActivos,
                ninosLudoteca: parseInt(ludoteca.rows[0].count, 10),
                capacidadLudoteca: 15,
                sancionesActivas: parseInt(sanciones.rows[0].count, 10),
                sociosDentro: sociosDentro.rows[0]?.total || 0,
                accionistasDentro: sociosDentro.rows[0]?.accionistas || 0,
                rentistasDentro: sociosDentro.rows[0]?.rentistas || 0,
                reservasHoy: reservasHoy.rows[0]?.total || 0,
                reservasActivasHoy: reservasHoy.rows[0]?.activas || 0,
                reservasCanceladasHoy: reservasHoy.rows[0]?.canceladas || 0,
                noShowsHoy: reservasHoy.rows[0]?.no_shows || 0
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
                async () => `${await getVisitasLegacySelect()}
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
                async () => `${await getVisitasLegacySelect()}
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
                async () => `${await getVisitasLegacySelect()}
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

        const observacionesLegacy = [
            identificacionNormalizada ? `Identificacion: ${identificacionNormalizada}` : '',
            observacionesNormalizadas
        ].filter(Boolean).join(' | ') || null;
        const observacionesFinales = observacionesNormalizadas || null;

        const client = await pool.connect();
        let socioIdFinal = null;

        try {
            await client.query('BEGIN');

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
                    identificacion,
                    correo,
                    telefono,
                    mayor_16,
                    fecha_pase,
                    hora_entrada,
                    estado,
                    creado_por,
                    observaciones
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, NOW(), 'activo', $8, $9)
                RETURNING pase_id
            `, [
                tipoPaseNormalizado,
                socioIdFinal,
                nombreNormalizado,
                identificacionNormalizada || null,
                correoNormalizado || null,
                telefonoFinal,
                mayor16Final,
                usuarioCreador,
                observacionesFinales
            ]);
            const paseId = result.rows[0].pase_id;
            const qr = await generarQrPase(client, paseId);

            await client.query('COMMIT');

            // logAudit fuera del bloque transaccional — no debe abortar la respuesta
            logAudit(req, {
                accion: 'crear_visita',
                tabla_afectada: 'pases',
                registro_id: paseId,
                detalles: `Pase ${tipoPaseNormalizado} registrado`
            }).catch(err => console.error('logAudit crear_visita:', err));

            return res.status(201).json({
                ok: true,
                id: paseId,
                pase_id: paseId,
                qr,
                qr_image: qr.qr_image,
                codigo_qr: qr.codigo_qr,
                expira_en: qr.expira_en,
                message: 'Pase registrado correctamente'
            });
        } catch (error) {
            await rollbackQuietly(client);

            if (isMissingPasesTable(error)) {
                try {
                    const legacyColumns = await getVisitasLegacyColumns();
                    const insertColumns = ['nombre_completo', 'identificacion_tipo', 'fecha_visita', 'hora_entrada', 'vigente'];
                    const placeholders = ['$1', '$2', 'CURRENT_DATE', 'NOW()', 'true'];
                    const values = [
                        nombreNormalizado,
                        identificacionNormalizada || tipoVisita || tipoPaseNormalizado
                    ];

                    if (legacyColumns.socioId) {
                        values.push(socioIdFinal || null);
                        insertColumns.push('socio_id');
                        placeholders.push(`$${values.length}`);
                    }

                    if (legacyColumns.correo) {
                        values.push(correoNormalizado || null);
                        insertColumns.push('correo');
                        placeholders.push(`$${values.length}`);
                    }

                    if (legacyColumns.telefono) {
                        values.push(telefonoFinal);
                        insertColumns.push('telefono');
                        placeholders.push(`$${values.length}`);
                    }

                    if (legacyColumns.mayor16) {
                        values.push(mayor16Final);
                        insertColumns.push('mayor_16');
                        placeholders.push(`$${values.length}`);
                    }

                    if (legacyColumns.observaciones) {
                        values.push(observacionesLegacy);
                        insertColumns.push('observaciones');
                        placeholders.push(`$${values.length}`);
                    }

                    const legacyResult = await pool.query(
                        `INSERT INTO visitas (${insertColumns.join(', ')})
                         VALUES (${placeholders.join(', ')})
                         RETURNING visita_id`,
                        values
                    );

                    const visitaId = legacyResult.rows[0].visita_id;
                    const qr = await generarQrVisitaLegacy(visitaId);

                    return res.status(201).json({
                        ok: true,
                        id: visitaId,
                        visitaId,
                        qr,
                        qr_image: qr.qr_image,
                        codigo_qr: qr.codigo_qr,
                        expira_en: qr.expira_en,
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

    actualizarVisita: async (req, res) => {
        const { id } = req.params;
        const {
            nombre_completo,
            telefono,
            correo,
            identificacion,
            observaciones,
            tipo_pase,
            socio_id
        } = req.body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const nombreNorm = String(nombre_completo || '').trim();
            if (!nombreNorm) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'El nombre es requerido' });
            }

            const tipoPaseNorm = tipo_pase ? String(tipo_pase).trim().toLowerCase() : null;
            if (tipoPaseNorm && !['visita', 'dia'].includes(tipoPaseNorm)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Tipo de pase inválido' });
            }

            let socioIdFinal = socio_id ? Number(socio_id) : null;
            if (tipoPaseNorm === 'dia') socioIdFinal = null;

            const telefonoNorm = normalizeDigits(telefono) || null;
            const correoNorm = String(correo || '').trim() || null;
            const identificacionNorm = String(identificacion || '').trim() || null;
            const observacionesNorm = String(observaciones || '').trim() || null;

            let updated = false;

            try {
                const result = await client.query(
                    `UPDATE pases SET
                        nombre_completo = COALESCE($1, nombre_completo),
                        telefono = COALESCE($2, telefono),
                        correo = $3,
                        identificacion = $4,
                        observaciones = $5,
                        tipo_pase = COALESCE($6, tipo_pase),
                        socio_id = $7
                     WHERE pase_id = $8
                     RETURNING pase_id`,
                    [nombreNorm, telefonoNorm, correoNorm, identificacionNorm, observacionesNorm, tipoPaseNorm, socioIdFinal, id]
                );
                updated = result.rows.length > 0;
            } catch (e) {
                if (!isMissingPasesTable(e)) throw e;
                const result = await client.query(
                    `UPDATE visitas SET
                        nombre_completo = COALESCE($1, nombre_completo),
                        observaciones = $2
                     WHERE visita_id = $3
                     RETURNING visita_id`,
                    [nombreNorm, observacionesNorm, id]
                );
                updated = result.rows.length > 0;
            }

            if (!updated) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Visita no encontrada' });
            }

            await client.query('COMMIT');

            logAudit(req, {
                accion: 'actualizar_visita',
                tabla_afectada: 'pases',
                registro_id: id,
                detalles: 'Visita editada manualmente'
            }).catch(() => null);

            return res.json({ ok: true, message: 'Visita actualizada correctamente' });
        } catch (error) {
            await rollbackQuietly(client);
            console.error('actualizarVisita:', error);
            return res.status(500).json({ error: 'Error al actualizar visita' });
        } finally {
            client.release();
        }
    },

    obtenerQrPase: async (req, res) => {
        const { id } = req.params;

        // ── Intento 1: tabla pases (nueva) ─────────────────────────────────
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let paseIdFinal = null;
            let paseActivo  = false;

            try {
                const r = await client.query(
                    `SELECT pase_id, estado FROM pases WHERE pase_id = $1`, [id]
                );
                if (r.rows.length > 0) {
                    paseIdFinal = r.rows[0].pase_id;
                    paseActivo  = r.rows[0].estado === 'activo';
                }
            } catch (e) {
                if (!isMissingPasesTable(e)) throw e;
            }

            if (paseIdFinal) {
                if (!paseActivo) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'El pase ya no está activo' });
                }
                const qr = await generarQrPase(client, paseIdFinal);
                await client.query('COMMIT');
                return res.json({ ok: true, qr_image: qr.qr_image, expira_en: qr.expira_en });
            }

            await rollbackQuietly(client);
        } catch (error) {
            await rollbackQuietly(client);
            console.error('obtenerQrPase (pases):', error);
            return res.status(500).json({ error: 'Error al generar QR' });
        } finally {
            client.release();
        }

        // ── Intento 2: tabla visitas (legacy) ──────────────────────────────
        try {
            const rv = await pool.query(
                `SELECT visita_id, vigente FROM visitas WHERE visita_id = $1`, [id]
            );

            if (rv.rows.length === 0) {
                return res.status(404).json({ error: 'Pase no encontrado' });
            }

            if (rv.rows[0].vigente === false) {
                return res.status(400).json({ error: 'El pase ya no está activo' });
            }

            const qr = await generarQrVisitaLegacy(id);
            return res.json({ ok: true, qr_image: qr.qr_image, expira_en: qr.expira_en });
        } catch (error) {
            console.error('obtenerQrPase (visitas):', error);
            return res.status(404).json({ error: 'Pase no encontrado' });
        }
    },

    listaSociosParaVisitas: async (req, res) => {
        try {
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
                    rl.observaciones,
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
        const { socioId, nombreHijo, fechaNacimiento, observaciones } = req.body;

        try {
            const result = await pool.query(
                `INSERT INTO registro_ludoteca (
                    socio_padre_id,
                    nombre_hijo,
                    fecha_nacimiento,
                    hora_entrada,
                    observaciones
                )
                VALUES ($1, $2, $3, NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}', $4)
                RETURNING registro_id`,
                [socioId, nombreHijo, fechaNacimiento, String(observaciones || '').trim() || null]
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
            const _js = new Date(year, month - 1, day).getDay();
            const diaSemana = _js === 0 ? 7 : _js;

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
                    r.estado::text as reserva_estado,
                    r.no_show,
                    r.hora_fin,
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

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const reservaResult = await client.query(`
                SELECT reserva_id, estado::text as estado, hora_fin, no_show
                FROM reservaciones
                WHERE sesion_id = $1 AND socio_id = $2 AND fecha_reserva = $3
                ORDER BY reserva_id DESC
                LIMIT 1
                FOR UPDATE
            `, [sesionId, socioId, fecha]);

            if (reservaResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'No existe una reserva para este alumno en la fecha seleccionada' });
            }

            const reserva = reservaResult.rows[0];
            const estadoReserva = String(reserva.estado || '').toLowerCase();
            if (reserva.no_show === true || ['no-show', 'no show'].includes(estadoReserva)) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'La reserva ya fue marcada como No Show y no permite pase de lista posterior' });
            }

            // Usa México City — getTimezoneOffset() refleja la TZ del servidor (USA), no México
            const hoyLocal  = getMexicoDateISO();
            const horaLocal = getMexicoTimeISO();
            const horaFin = String(reserva.hora_fin || '').slice(0, 5);
            if (fecha < hoyLocal || (fecha === hoyLocal && horaFin && horaFin < horaLocal)) {
                const estadoNoShow = await resolveReservaEstado('no-show');
                await client.query(
                    `UPDATE reservaciones
                     SET estado = $1, no_show = TRUE
                     WHERE reserva_id = $2`,
                    [estadoNoShow, reserva.reserva_id]
                );
                await client.query('COMMIT');
                return res.status(409).json({
                    error: 'La reserva ya caduco sin pase de lista. Se marco automaticamente como No Show.'
                });
            }

            const existente = await client.query(`
                SELECT asistencia_id
                FROM asistencia
                WHERE sesion_id = $1 AND socio_id = $2 AND fecha = $3
            `, [sesionId, socioId, fecha]);

            if (existente.rows.length > 0) {
                await client.query(`
                    UPDATE asistencia
                    SET presente = $1, registro = NOW()
                    WHERE asistencia_id = $2
                `, [presente, existente.rows[0].asistencia_id]);
            } else {
                await client.query(`
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

            await client.query('COMMIT');
            res.json({
                ok: true,
                message: 'Asistencia registrada correctamente'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error en registrarAsistenciaManual:', error);
            res.status(500).json({ error: 'Error al registrar asistencia' });
        } finally {
            client.release();
        }
    },

    enviarQrVisita: async (req, res) => {
        const paseId = req.params.id;
        const { correo, qr_image, nombre, expira_en } = req.body;

        if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            return res.status(400).json({ error: 'Correo electrónico inválido' });
        }
        if (!qr_image) {
            return res.status(400).json({ error: 'Imagen QR requerida' });
        }

        try {
            await sendQrVisita({
                to: correo,
                nombre: nombre || 'Visitante',
                qrBase64: qr_image,
                expiraEn: expira_en || null
            });
            res.json({ ok: true, message: `QR enviado a ${correo}` });
        } catch (error) {
            console.error('Error al enviar QR por correo:', error);
            res.status(503).json({ error: error.message || 'Error al enviar el correo' });
        }
    }
};

module.exports = recepcionController;