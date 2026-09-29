const { logAudit } = require('../utils/auditLogger');
const ludotecaService = require('../services/ludotecaService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

/**
 * Respuesta de error común: los errores escalados siguen al errorHandler,
 * ServiceError responde su status/cuerpo y el resto se registra con `logLabel`.
 */
function handleError(res, error, logLabel, body = { error: 'Error interno del servidor' }) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  if (logLabel) console.error(logLabel, error);
  return res.status(500).json(body);
}

module.exports = {
  // ── Existentes ──
  registrosActivos: async (req, res) => {
    try {
      res.json(await ludotecaService.registrosActivos());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Alias antiguos: normalizan la entrada y la ruta sigue con la validación y el handler principal.
  aliasEntrada: (req, res, next) => {
    req.body = {
      ...req.body,
      socio_padre_id: req.body.socio_padre_id || req.body.socio_id,
      nombre_hijo: req.body.nombre_hijo || req.body.nombre_nino
    };
    next();
  },

  aliasSalida: (req, res, next) => {
    req.params.registro_id = req.params.registro_id || req.params.id;
    next();
  },

  historial: async (req, res) => {
    try {
      const rows = await ludotecaService.historial(req.query.dias);
      res.setHeader('Cache-Control', 'no-store');
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ── SCRUM-108: POST /api/ludoteca/entrada ──
  registrarEntradaLudoteca: async (req, res) => {
    const { socio_padre_id, nombre_hijo, fecha_nacimiento, observaciones } = req.body;

    try {
      const socioPadreId = Number(socio_padre_id); // datos de entrada: validados en la ruta
      const registro = await ludotecaService.registrarEntradaStaff(socioPadreId, {
        nombre_hijo,
        fecha_nacimiento,
        observaciones
      });

      await logAudit(req, {
        accion: 'entrada_ludoteca',
        tabla_afectada: 'registro_ludoteca',
        registro_id: registro.registro_id,
        detalles: 'Entrada de ludoteca registrada'
      });

      return res.status(201).json({ ok: true, message: 'Entrada registrada correctamente', registro });
    } catch (error) {
      if (error instanceof ServiceError) return res.status(error.status).json(error.body);
      console.error('Error al registrar entrada a ludoteca:', error);
      if (error.code === '23503') {
        return res.status(400).json({ error: 'El socio padre no existe' });
      }
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── SCRUM-109: PATCH /api/ludoteca/salida/:registro_id ──
  registrarSalidaLudoteca: async (req, res) => {
    try {
      const registroId = Number(req.params.registro_id); // entero positivo: validado en la ruta
      const { horaSalida, duracionMinutos, sancionGenerada } = await ludotecaService.registrarSalidaStaff(registroId);

      await logAudit(req, {
        accion: 'salida_ludoteca',
        tabla_afectada: 'registro_ludoteca',
        registro_id: registroId,
        detalles: `Salida de ludoteca. Duracion ${duracionMinutos} min. Sancion: ${sancionGenerada ? 'si' : 'no'}`
      });

      return res.json({
        ok: true,
        registro_id: registroId,
        hora_salida: horaSalida,
        duracion_minutos: duracionMinutos,
        sancion_generada: sancionGenerada
      });
    } catch (error) {
      return handleError(res, error, 'Error al registrar salida de ludoteca:');
    }
  },

  // ── SCRUM-110: GET /api/ludoteca/mis-registros ──
  misRegistros: async (req, res) => {
    try {
      res.json(await ludotecaService.misRegistros(req.user.usuario_id));
    } catch (error) {
      handleError(res, error, 'Error al obtener registros de ludoteca:');
    }
  },

  // ── Entrada autoservicio del socio ──
  socioEntradaLudoteca: async (req, res) => {
    const { nombre_hijo, fecha_nacimiento, observaciones } = req.body;

    try {
      // nombre_hijo y fecha_nacimiento: validados en la ruta
      const registro = await ludotecaService.registrarEntradaSocio(req.user.usuario_id, {
        nombre_hijo,
        fecha_nacimiento,
        observaciones
      });
      return res.status(201).json({ ok: true, message: 'Entrada registrada', registro });
    } catch (error) {
      return handleError(res, error, 'Error socioEntradaLudoteca:');
    }
  },

  // ── Salida autoservicio del socio ──
  socioSalidaLudoteca: async (req, res) => {
    try {
      const { registroId, duracionMinutos, sancionGenerada } = await ludotecaService.registrarSalidaSocio(
        req.params.registro_id,
        req.user
      );
      return res.json({
        ok: true,
        registro_id: registroId,
        duracion_minutos: duracionMinutos,
        sancion_generada: sancionGenerada
      });
    } catch (error) {
      return handleError(res, error, 'Error socioSalidaLudoteca:');
    }
  },

  getAforo: async (req, res) => {
    try {
      res.json(await ludotecaService.aforo());
    } catch (error) {
      handleError(res, error, 'Error al obtener aforo:', { error: 'Error al obtener aforo' });
    }
  },

  accesoQrLudoteca: async (req, res) => {
    const { codigo_qr, nombre_hijo, fecha_nacimiento, observaciones } = req.body;

    let acceso;
    try {
      acceso = await ludotecaService.prepararAccesoQr(codigo_qr);
    } catch (error) {
      return handleError(res, error);
    }
    const { socioPadreId, registroActivo } = acceso;

    if (registroActivo) {
      try {
        const { horaSalida, duracionMinutos, sancionGenerada } = await ludotecaService.salidaPorQr(
          socioPadreId,
          registroActivo
        );

        await logAudit(req, {
          accion: 'salida_ludoteca_qr',
          tabla_afectada: 'registro_ludoteca',
          registro_id: registroActivo.registro_id,
          detalles: `Salida por QR. Duración: ${duracionMinutos} min. Sanción: ${sancionGenerada ? 'sí' : 'no'}`
        });

        return res.json({
          accion: 'salida',
          nombre_hijo: registroActivo.nombre_hijo,
          hora_salida: horaSalida,
          duracion_minutos: duracionMinutos,
          sancion_generada: sancionGenerada
        });
      } catch (error) {
        return handleError(res, error, 'Error en salida QR ludoteca:');
      }
    }

    if (!nombre_hijo || !fecha_nacimiento) {
      return res.json({
        requiere_datos: true,
        mensaje: 'Proporciona nombre y fecha de nacimiento del niño',
        socio_padre_id: socioPadreId
      });
    }

    try {
      ludotecaService.validarEntradaQr(nombre_hijo, fecha_nacimiento);
      const { registro, horaLimite } = await ludotecaService.entradaPorQr(socioPadreId, {
        nombre_hijo,
        fecha_nacimiento,
        observaciones
      });

      await logAudit(req, {
        accion: 'entrada_ludoteca_qr',
        tabla_afectada: 'registro_ludoteca',
        registro_id: registro.registro_id,
        detalles: `Entrada por QR. Niño: ${nombre_hijo.trim()}`
      });

      return res.status(201).json({
        accion: 'entrada',
        nombre_hijo: registro.nombre_hijo,
        hora_entrada: registro.hora_entrada_local,
        hora_limite: horaLimite
      });
    } catch (error) {
      return handleError(res, error, 'Error en entrada QR ludoteca:');
    }
  }
};
