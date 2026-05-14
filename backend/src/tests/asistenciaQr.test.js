'use strict';

jest.mock('../config/database');
jest.mock('../helpers/qrSecurity.helper');

const pool = require('../config/database');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');
const asistenciaQrController = require('../controllers/asistenciaQrController');

// ── helpers ──────────────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (sesionId, body = {}) => ({
  params: { sesion_id: String(sesionId) },
  body
});

/**
 * Devuelve un client mock cuyo método query retorna sucesivamente los valores
 * provistos en `queryResults`. Cada llamada a query consume el primer elemento.
 */
const makeMockClient = (...queryResults) => {
  const query = jest.fn();
  queryResults.forEach((result) => query.mockResolvedValueOnce(result));
  return {
    query,
    release: jest.fn()
  };
};

// ── suite ─────────────────────────────────────────────────────────────────────

describe('POST /api/sesiones/:sesion_id/asistencia-qr', () => {

  // ── 1. QR inválido → 401 ────────────────────────────────────────────────────
  describe('QR inválido', () => {
    it('responde 401 cuando el HMAC es inválido', async () => {
      const hmacError = new Error('QR inválido o manipulado');
      hmacError.statusCode = 401;
      validarQrFirmado.mockImplementation(() => { throw hmacError; });

      const req = mockReq(1, { codigo_qr: '{"type":"socio","socio_id":1,"hash":"badhash"}' });
      const res = mockRes();

      await asistenciaQrController.registrarAsistenciaQr(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'QR inválido o HMAC inválido' });
    });

    it('responde 400 cuando codigo_qr no se envía', async () => {
      const req = mockReq(1, {});
      const res = mockRes();

      // validarQrFirmado no llega a invocarse porque la validación previa falla
      validarQrFirmado.mockImplementation(() => {
        throw Object.assign(new Error('codigo_qr es requerido'), { statusCode: 400 });
      });

      await asistenciaQrController.registrarAsistenciaQr(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── 2. Socio no inscrito → 403 ──────────────────────────────────────────────
  describe('Socio no inscrito en la sesión', () => {
    it('responde 403 con mensaje descriptivo', async () => {
      validarQrFirmado.mockReturnValue({ type: 'socio', socio_id: 5 });

      const client = makeMockClient(
        undefined,                   // BEGIN
        { rows: [] },                // inscripciones_clases → vacío
        undefined                    // ROLLBACK (se llama en catch)
      );
      pool.connect = jest.fn().mockResolvedValue(client);

      const req = mockReq(1, { codigo_qr: 'valid_qr_string' });
      const res = mockRes();

      await asistenciaQrController.registrarAsistenciaQr(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'El socio no está inscrito en esta sesión' })
      );
      expect(client.release).toHaveBeenCalled();
    });
  });

  // ── 3. Socio inscrito exitoso → 201 ─────────────────────────────────────────
  describe('Socio inscrito — registro exitoso', () => {
    it('responde 201 con los datos de asistencia', async () => {
      validarQrFirmado.mockReturnValue({ type: 'socio', socio_id: 5 });

      const client = makeMockClient(
        undefined,                                          // BEGIN
        { rows: [{ inscripcion_id: 10 }] },                // inscripciones_clases → confirmada
        { rows: [] },                                       // asistencia duplicado → vacío
        { rows: [{ asistencia_id: 42 }] },                 // INSERT asistencia
        { rows: [{ nombre: 'Ana García López' }] },         // SELECT nombre socio
        undefined                                           // COMMIT
      );
      pool.connect = jest.fn().mockResolvedValue(client);

      const req = mockReq(1, { codigo_qr: 'valid_qr_string' });
      const res = mockRes();

      await asistenciaQrController.registrarAsistenciaQr(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        asistencia_id: 42,
        nombre: 'Ana García López',
        tipo_participante: 'socio',
        sesion_id: 1,
        presente: true
      });
      expect(client.release).toHaveBeenCalled();
    });
  });

  // ── 4. Visita exitosa sin inscripción previa → 201 ───────────────────────────
  describe('Visita — registro exitoso sin inscripción', () => {
    it('responde 201 sin validar inscripción', async () => {
      const expiraFuturo = new Date(Date.now() + 3_600_000).toISOString();
      validarQrFirmado.mockReturnValue({
        type: 'visita',
        visita_id: 7,
        expira_en: expiraFuturo
      });

      const client = makeMockClient(
        undefined,                                              // BEGIN
        { rows: [] },                                           // asistencia duplicado → vacío
        { rows: [{ nombre_completo: 'Carlos Visita' }] },       // SELECT visita
        { rows: [{ asistencia_id: 99 }] },                      // INSERT asistencia
        undefined                                               // COMMIT
      );
      pool.connect = jest.fn().mockResolvedValue(client);

      const req = mockReq(1, { codigo_qr: 'valid_qr_visita' });
      const res = mockRes();

      await asistenciaQrController.registrarAsistenciaQr(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        asistencia_id: 99,
        nombre: 'Carlos Visita',
        tipo_participante: 'visita',
        sesion_id: 1,
        presente: true
      });

      // Verificar que NO se consultó inscripciones_clases
      const calls = client.query.mock.calls.map((c) => c[0]);
      const consultaInscripcion = calls.some(
        (q) => typeof q === 'string' && q.includes('inscripciones_clases')
      );
      expect(consultaInscripcion).toBe(false);
    });
  });

  // ── 5. Asistencia duplicada el mismo día → 409 ───────────────────────────────
  describe('Asistencia duplicada', () => {
    it('responde 409 para socio con asistencia ya registrada hoy', async () => {
      validarQrFirmado.mockReturnValue({ type: 'socio', socio_id: 5 });

      const client = makeMockClient(
        undefined,                                  // BEGIN
        { rows: [{ inscripcion_id: 10 }] },         // inscripciones_clases → confirmada
        { rows: [{ asistencia_id: 20 }] },          // asistencia duplicado → existe
        undefined                                   // ROLLBACK
      );
      pool.connect = jest.fn().mockResolvedValue(client);

      const req = mockReq(1, { codigo_qr: 'valid_qr_string' });
      const res = mockRes();

      await asistenciaQrController.registrarAsistenciaQr(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Asistencia ya registrada hoy' })
      );
    });

    it('responde 409 para visita con asistencia ya registrada hoy', async () => {
      const expiraFuturo = new Date(Date.now() + 3_600_000).toISOString();
      validarQrFirmado.mockReturnValue({
        type: 'visita',
        visita_id: 7,
        expira_en: expiraFuturo
      });

      const client = makeMockClient(
        undefined,                          // BEGIN
        { rows: [{ asistencia_id: 55 }] }, // asistencia duplicado → existe
        undefined                           // ROLLBACK
      );
      pool.connect = jest.fn().mockResolvedValue(client);

      const req = mockReq(1, { codigo_qr: 'valid_qr_visita' });
      const res = mockRes();

      await asistenciaQrController.registrarAsistenciaQr(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Asistencia ya registrada hoy' })
      );
    });
  });

});
