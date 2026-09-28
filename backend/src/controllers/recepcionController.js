const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { resolveReservaEstado } = require('../utils/adminRules');
const { getMexicoTodayLocale } = require('../utils/mexicoDate');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');
const paseService = require('../services/paseService');
const visitaService = require('../services/visitaService');
const qrService = require('../services/qrService');
const recepcionDashboardService = require('../services/recepcionDashboardService');
const paseListaService = require('../services/paseListaService');
const socioService = require('../services/socioService');
const ludotecaService = require('../services/ludotecaService');

/**
 * Errores escalados → errorHandler global; ServiceError → su status/cuerpo;
 * el resto se registra (con `etiqueta` si la hay) y responde 500 con `mensaje`.
 */
function responderError(res, error, mensaje, etiqueta) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  if (etiqueta) console.error(etiqueta, error);
  else console.error(error);
  return res.status(500).json({ error: mensaje });
}

/** Cierra visitas vencidas y audita si cerró alguna. */
async function cerrarVisitasVencidasConAuditoria(req) {
  const cerradas = await paseService.cerrarVisitasVencidas();
  if (cerradas > 0) {
    await logAudit(req, {
      accion: 'cierre_automatico_visitas',
      tabla_afectada: 'pases',
      detalles: `Visitas cerradas automaticamente: ${cerradas}`
    });
  }
  return cerradas;
}

const recepcionController = {
  getDashboard: async (req, res) => {
    try {
      await cerrarVisitasVencidasConAuditoria(req);
      res.json(await recepcionDashboardService.resumenDelDia());
    } catch (error) {
      responderError(res, error, 'Error al obtener dashboard');
    }
  },

  // ── Socios ──

  listarSocios: async (req, res) => {
    try {
      res.json(await recepcionDashboardService.buscarSocios(req.query.q));
    } catch (error) {
      responderError(res, error, 'Error al listar socios');
    }
  },

  crearSocio: async (req, res) => {
    try {
      const password = await socioService.crearSocioRecepcion(req.body);
      res.status(201).json({ message: 'Socio creado exitosamente', password });
    } catch (error) {
      responderError(res, error, 'Error al crear socio');
    }
  },

  actualizarSocio: async (req, res) => {
    try {
      await socioService.actualizarSocioRecepcion(req.params.id, req.body);
      res.json({ message: 'Socio actualizado' });
    } catch (error) {
      responderError(res, error, 'Error al actualizar socio');
    }
  },

  eliminarSocio: async (req, res) => {
    try {
      await socioService.inactivarSocioRecepcion(req.params.id);
      res.json({ message: 'Socio eliminado' });
    } catch (error) {
      responderError(res, error, 'Error al eliminar socio');
    }
  },

  listaSociosParaVisitas: async (req, res) => {
    try {
      res.json(await recepcionDashboardService.sociosActivosParaVisitas());
    } catch (error) {
      responderError(res, error, 'Error al obtener lista de socios');
    }
  },

  // ── Reservas y espacios ──

  getReservasCentral: async (req, res) => {
    try {
      res.json(await recepcionDashboardService.reservasDelDia(req.query.fecha));
    } catch (error) {
      responderError(res, error, 'Error al obtener reservas');
    }
  },

  getEspacios: async (req, res) => {
    try {
      res.json(await recepcionDashboardService.listarEspacios());
    } catch (error) {
      responderError(res, error, 'Error al obtener espacios');
    }
  },

  // ── Visitas / pases ──

  visitasActivas: async (req, res) => {
    try {
      await cerrarVisitasVencidasConAuditoria(req);
      res.json(await paseService.listarActivos());
    } catch (error) {
      responderError(res, error, 'Error al obtener pases activos');
    }
  },

  historialVisitas: async (req, res) => {
    try {
      await cerrarVisitasVencidasConAuditoria(req);
      res.json(await paseService.listarHistorial(req.query.dias));
    } catch (error) {
      responderError(res, error, 'Error al obtener historial de pases');
    }
  },

  listarVisitas: async (req, res) => {
    const fechaConsulta = req.query.fecha || getMexicoTodayLocale();
    try {
      await cerrarVisitasVencidasConAuditoria(req);
      res.json(await paseService.listarPorFecha(fechaConsulta));
    } catch (error) {
      responderError(res, error, 'Error al listar visitas');
    }
  },

  cerrarVisitasVencidas: async (req, res) => {
    try {
      const cerradas = await cerrarVisitasVencidasConAuditoria(req);
      res.json({ ok: true, cerradas, hora_cierre: paseService.CLUB_CLOSE_TIME });
    } catch (error) {
      responderError(res, error, 'Error al cerrar visitas vencidas');
    }
  },

  crearVisita: async (req, res) => {
    try {
      const { legacy, id, qr, tipoPase } = await visitaService.crearVisita(req.body, req.user?.usuario_id);
      const qrCampos = { qr, qr_image: qr.qr_image, codigo_qr: qr.codigo_qr, expira_en: qr.expira_en };

      if (legacy) {
        return res.status(201).json({
          ok: true,
          id,
          visitaId: id,
          ...qrCampos,
          message: 'Visita registrada correctamente'
        });
      }

      // logAudit fuera del bloque transaccional — no debe abortar la respuesta
      logAudit(req, {
        accion: 'crear_visita',
        tabla_afectada: 'pases',
        registro_id: id,
        detalles: `Pase ${tipoPase} registrado`
      }).catch((err) => console.error('logAudit crear_visita:', err));

      return res.status(201).json({
        ok: true,
        id,
        pase_id: id,
        ...qrCampos,
        message: 'Pase registrado correctamente'
      });
    } catch (error) {
      return responderError(res, error, 'Error al registrar pase');
    }
  },

  registrarSalida: async (req, res) => {
    const { id } = req.params;
    try {
      const { legacy } = await visitaService.registrarSalida(id);
      if (!legacy) {
        await logAudit(req, {
          accion: 'registrar_salida_visita',
          tabla_afectada: 'pases',
          registro_id: id,
          detalles: 'Salida de visita registrada'
        });
      }
      res.json({ ok: true, message: 'Salida registrada correctamente' });
    } catch (error) {
      responderError(res, error, 'Error al registrar salida');
    }
  },

  registrarSalidaVisita: async (req, res) => {
    return recepcionController.registrarSalida(req, res);
  },

  actualizarVisita: async (req, res) => {
    const { id } = req.params;
    try {
      await visitaService.actualizarVisita(id, req.body);

      logAudit(req, {
        accion: 'actualizar_visita',
        tabla_afectada: 'pases',
        registro_id: id,
        detalles: 'Visita editada manualmente'
      }).catch(() => null);

      return res.json({ ok: true, message: 'Visita actualizada correctamente' });
    } catch (error) {
      return responderError(res, error, 'Error al actualizar visita');
    }
  },

  obtenerQrPase: async (req, res) => {
    try {
      const { qr_image, expira_en } = await qrService.obtenerQrPase(req.params.id);
      return res.json({ ok: true, qr_image, expira_en });
    } catch (error) {
      return responderError(res, error, 'Error al generar QR');
    }
  },

  // ── Ludoteca ──

  getLudotecaActivos: async (req, res) => {
    try {
      res.json(await ludotecaService.activosRecepcion());
    } catch (error) {
      responderError(res, error, 'Error al obtener ludoteca');
    }
  },

  registrarEntradaLudoteca: async (req, res) => {
    try {
      const registroId = await ludotecaService.entradaRecepcion(req.body);
      res.status(201).json({ message: 'Entrada registrada', registroId });
    } catch (error) {
      responderError(res, error, 'Error al registrar entrada');
    }
  },

  registrarSalidaLudoteca: async (req, res) => {
    try {
      await ludotecaService.salidaRecepcion(req.params.id);
      res.json({ message: 'Salida registrada' });
    } catch (error) {
      responderError(res, error, 'Error al registrar salida');
    }
  },

  // ── Pase de lista ──

  clasesPorFecha: async (req, res) => {
    try {
      res.json(await paseListaService.clasesPorFecha(req.query.fecha));
    } catch (error) {
      responderError(res, error, 'Error al obtener clases', 'Error en clasesPorFecha:');
    }
  },

  getClasesDia: async (req, res) => {
    return recepcionController.clasesPorFecha(req, res);
  },

  alumnosPorClase: async (req, res) => {
    const sesionId = req.params.sesionId || req.query.sesionId;
    try {
      res.json(await paseListaService.alumnosPorClase(sesionId, req.query.fecha));
    } catch (error) {
      responderError(res, error, 'Error al obtener alumnos', 'Error en alumnosPorClase:');
    }
  },

  getAlumnosPorSesion: async (req, res) => {
    return recepcionController.alumnosPorClase(req, res);
  },

  // ── Métodos sin extraer: BUGS HEREDADOS (fuera de alcance) ──────────────────
  // Se dejan tal cual para no cambiar su comportamiento actual:
  // - registrarAsistenciaManual usa getMexicoDateISO/getMexicoTimeISO sin importarlos:
  //   con una reserva válida siempre responde 500 (ReferenceError).
  // - enviarQrVisita usa sendQrVisita sin importarlo: siempre responde 503.

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

      const reservaResult = await client.query(
        `
                SELECT reserva_id, estado::text as estado, hora_fin, no_show
                FROM reservaciones
                WHERE sesion_id = $1 AND socio_id = $2 AND fecha_reserva = $3
                ORDER BY reserva_id DESC
                LIMIT 1
                FOR UPDATE
            `,
        [sesionId, socioId, fecha]
      );

      if (reservaResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No existe una reserva para este alumno en la fecha seleccionada' });
      }

      const reserva = reservaResult.rows[0];
      const estadoReserva = String(reserva.estado || '').toLowerCase();
      if (reserva.no_show === true || ['no-show', 'no show'].includes(estadoReserva)) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'La reserva ya fue marcada como No Show y no permite pase de lista posterior' });
      }

      // Usa México City — getTimezoneOffset() refleja la TZ del servidor (USA), no México
      // eslint-disable-next-line no-undef -- bug heredado: no importado (fuera de alcance)
      const hoyLocal = getMexicoDateISO();
      // eslint-disable-next-line no-undef -- bug heredado: no importado (fuera de alcance)
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

      const existente = await client.query(
        `
                SELECT asistencia_id
                FROM asistencia
                WHERE sesion_id = $1 AND socio_id = $2 AND fecha = $3
            `,
        [sesionId, socioId, fecha]
      );

      if (existente.rows.length > 0) {
        await client.query(
          `
                    UPDATE asistencia
                    SET presente = $1, registro = NOW()
                    WHERE asistencia_id = $2
                `,
          [presente, existente.rows[0].asistencia_id]
        );
      } else {
        await client.query(
          `
                    INSERT INTO asistencia (
                        sesion_id,
                        socio_id,
                        fecha,
                        presente,
                        registro
                    )
                    VALUES ($1, $2, $3, $4, NOW())
                `,
          [sesionId, socioId, fecha, presente]
        );
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
    const { correo, qr_image, nombre, expira_en } = req.body;

    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }
    if (!qr_image) {
      return res.status(400).json({ error: 'Imagen QR requerida' });
    }

    try {
      // eslint-disable-next-line no-undef -- bug heredado: no importado (fuera de alcance)
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
