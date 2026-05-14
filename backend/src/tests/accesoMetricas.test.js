'use strict';

jest.mock('../config/database');

const pool = require('../config/database');
const accesoMetricasController = require('../controllers/accesoMetricasController');
const { checkRole } = require('../middleware/auth.middleware');

// ── helpers ──────────────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (query = {}) => ({ query });

/**
 * Registra las 4 respuestas que emite pool.query en el orden en que Promise.all
 * las consume: totales, horarios_pico, accesos_por_dia, top_socios.
 */
const mockPoolQueries = ({ totales, horariosPico, accesosDia, topSocios }) => {
  pool.query = jest.fn()
    .mockResolvedValueOnce({ rows: [totales] })
    .mockResolvedValueOnce({ rows: horariosPico })
    .mockResolvedValueOnce({ rows: accesosDia })
    .mockResolvedValueOnce({ rows: topSocios });
};

const emptyTotales = { total_accesos: '0', total_entradas: '0', total_salidas: '0' };

const mockPoolEmpty = () =>
  mockPoolQueries({ totales: emptyTotales, horariosPico: [], accesosDia: [], topSocios: [] });

// ── suite ─────────────────────────────────────────────────────────────────────

describe('GET /api/acceso/metricas', () => {

  beforeEach(() => jest.clearAllMocks());

  // ── 1-3. Autorización por rol ──────────────────────────────────────────────
  describe('Autorización de roles (checkRole middleware)', () => {
    const rolesPermitidos = ['admin', 'gerente', 'coordinador'];
    const rolesNegados = ['recepcion', 'socio'];

    rolesPermitidos.forEach((rol) => {
      it(`permite al rol "${rol}" (llama next)`, () => {
        const guard = checkRole(rolesPermitidos);
        const req = { user: { rol } };
        const res = mockRes();
        const next = jest.fn();

        guard(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    rolesNegados.forEach((rol) => {
      it(`deniega al rol "${rol}" con HTTP 403`, () => {
        const guard = checkRole(rolesPermitidos);
        const req = { user: { rol } };
        const res = mockRes();
        const next = jest.fn();

        guard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Sin permisos' });
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  // ── 6. Filtros desde/hasta correctos ──────────────────────────────────────
  describe('Filtros desde/hasta', () => {
    it('pasa desde y hasta como $1 y $2 a todas las queries', async () => {
      mockPoolEmpty();

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-07' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      pool.query.mock.calls.forEach(([, params]) => {
        expect(params[0]).toBe('2024-01-01');
        expect(params[1]).toBe('2024-01-07');
      });
    });

    it('responde 400 si falta desde', async () => {
      const req = mockReq({ hasta: '2024-01-07' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si falta hasta', async () => {
      const req = mockReq({ desde: '2024-01-01' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 con formato de fecha inválido', async () => {
      const req = mockReq({ desde: 'not-a-date', hasta: '2024-01-07' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('el SQL de hasta incluye todo el día (< día+1)', async () => {
      mockPoolEmpty();

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-07' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      const sqlTotales = pool.query.mock.calls[0][0];
      expect(sqlTotales).toMatch(/\$2::date \+ INTERVAL '1 day'/i);
    });
  });

  // ── 7. Filtro tipo=socio ───────────────────────────────────────────────────
  describe('Filtro tipo=socio', () => {
    it('agrega AND socio_id IS NOT NULL en el WHERE', async () => {
      mockPoolEmpty();

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-31', tipo: 'socio' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const sqlTotales = pool.query.mock.calls[0][0];
      expect(sqlTotales).toMatch(/socio_id IS NOT NULL/i);
    });
  });

  // ── 8. Filtro tipo=visita ──────────────────────────────────────────────────
  describe('Filtro tipo=visita', () => {
    it('agrega AND visita_id IS NOT NULL en el WHERE', async () => {
      mockPoolEmpty();

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-31', tipo: 'visita' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const sqlTotales = pool.query.mock.calls[0][0];
      expect(sqlTotales).toMatch(/visita_id IS NOT NULL/i);
    });

    it('responde 400 si tipo tiene valor desconocido', async () => {
      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-31', tipo: 'otro' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── 9. Período sin datos → ceros y arreglos vacíos ────────────────────────
  describe('Período sin datos', () => {
    it('devuelve estructura válida con ceros y arreglos vacíos, no error 500', async () => {
      mockPoolEmpty();

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-07' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        total_accesos: 0,
        total_entradas: 0,
        total_salidas: 0,
        promedio_diario: 0,
        horarios_pico: [],
        accesos_por_dia: [],
        top_socios: []
      });
    });
  });

  // ── 10. horarios_pico usa EXTRACT(HOUR FROM timestamp) ────────────────────
  describe('horarios_pico agrupado por EXTRACT(HOUR FROM timestamp)', () => {
    it('el SQL contiene EXTRACT(HOUR FROM "timestamp") y GROUP BY hora', async () => {
      mockPoolEmpty();

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-31' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      const sqlHorarios = pool.query.mock.calls[1][0]; // 2da query = horarios_pico
      expect(sqlHorarios).toMatch(/EXTRACT\(HOUR FROM/i);
      expect(sqlHorarios).toMatch(/GROUP BY hora/i);
    });

    it('mapea correctamente los resultados a { hora, total }', async () => {
      mockPoolQueries({
        totales: { total_accesos: '20', total_entradas: '12', total_salidas: '8' },
        horariosPico: [
          { hora: 10, total: 8 },
          { hora: 18, total: 6 },
          { hora: 8, total: 4 }
        ],
        accesosDia: [],
        topSocios: []
      });

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-31' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      const { horarios_pico } = res.json.mock.calls[0][0];
      expect(horarios_pico).toEqual([
        { hora: 10, total: 8 },
        { hora: 18, total: 6 },
        { hora: 8, total: 4 }
      ]);
    });
  });

  // ── 11. top_socios: nombre resuelto desde usuarios, máximo 10 ─────────────
  describe('top_socios con nombre resuelto y máximo 10 resultados', () => {
    it('el SQL hace JOIN con socios y usuarios para resolver nombre', async () => {
      mockPoolEmpty();

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-31' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      const sqlTopSocios = pool.query.mock.calls[3][0]; // 4ta query = top_socios
      expect(sqlTopSocios).toMatch(/JOIN socios/i);
      expect(sqlTopSocios).toMatch(/JOIN usuarios/i);
      expect(sqlTopSocios).toMatch(/LIMIT 10/i);
    });

    it('devuelve hasta 10 socios con socio_id, nombre y total_accesos', async () => {
      const sociosData = Array.from({ length: 10 }, (_, i) => ({
        socio_id: i + 1,
        nombre: `Socio Nombre ${i + 1}`,
        total_accesos: 10 - i
      }));

      mockPoolQueries({
        totales: { total_accesos: '55', total_entradas: '30', total_salidas: '25' },
        horariosPico: [],
        accesosDia: [],
        topSocios: sociosData
      });

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-31' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      const { top_socios } = res.json.mock.calls[0][0];
      expect(top_socios).toHaveLength(10);
      expect(top_socios[0]).toEqual({ socio_id: 1, nombre: 'Socio Nombre 1', total_accesos: 10 });
      top_socios.forEach((s) => {
        expect(s).toHaveProperty('socio_id');
        expect(s).toHaveProperty('nombre');
        expect(s).toHaveProperty('total_accesos');
      });
    });
  });

  // ── Campos completos del response ─────────────────────────────────────────
  describe('Estructura completa del response', () => {
    it('incluye todos los campos requeridos con datos reales', async () => {
      mockPoolQueries({
        totales: { total_accesos: '21', total_entradas: '13', total_salidas: '8' },
        horariosPico: [{ hora: 9, total: 7 }],
        accesosDia: [{ fecha: new Date('2024-01-15'), total: 21 }],
        topSocios: [{ socio_id: 3, nombre: 'Ana García López', total_accesos: 8 }]
      });

      const req = mockReq({ desde: '2024-01-01', hasta: '2024-01-21' });
      const res = mockRes();

      await accesoMetricasController.getMetricas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toMatchObject({
        total_accesos: 21,
        total_entradas: 13,
        total_salidas: 8,
        promedio_diario: expect.any(Number),
        horarios_pico: [{ hora: 9, total: 7 }],
        accesos_por_dia: [{ fecha: '2024-01-15', total: 21 }],
        top_socios: [{ socio_id: 3, nombre: 'Ana García López', total_accesos: 8 }]
      });
      // promedio_diario = 21 / 21 días = 1
      expect(body.promedio_diario).toBe(1);
    });
  });

});
