'use strict';

/**
 * E2.4: cupo_maximo en POST/PUT de torneos y en las inscripciones, y que admite_inscripcion (E2.12)
 * y la inscripción digan lo mismo para el mismo torneo.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
let mockUser;
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = mockUser;
    next();
  },
  checkRole: () => (req, res, next) => next()
}));

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/torneos', require('../routes/torneos.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const CUPO_INVALIDO = { error: 'cupo_maximo debe ser un entero entre 4 y 256' };
const CUPO_LLENO = { error: 'El torneo ya alcanzó su cupo máximo' };
const CONTEO = 'SELECT COUNT(*)::int AS total FROM participantes_torneo WHERE torneo_id = $1';

// Un solo estado del torneo para todas las consultas: listado, bloqueo e inscritos salen de aquí.
let db;
let log;

function route(q) {
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('INSERT INTO logs_sistema')) return rows([]);
  if (q.startsWith('SELECT t.torneo_id, t.nombre')) {
    return rows([
      {
        torneo_id: 45,
        estado: db.estado,
        categoria_id: 1,
        total_participantes: db.inscritos,
        cupo_maximo: db.cupo,
        periodo_fecha_inicio: '2026-11-07',
        periodo_inicio_inscripcion: null,
        periodo_fin_inscripcion: null
      }
    ]);
  }
  if (q.startsWith('SELECT estado, categoria_id, tipo_torneo,')) {
    return rows([
      {
        estado: db.estado,
        categoria_id: 1,
        tipo_torneo: 'Individual',
        fecha_inicio: '2026-11-07',
        fecha_inicio_inscripcion: null,
        fecha_fin_inscripcion: null,
        cupo_maximo: db.cupo
      }
    ]);
  }
  if (q === CONTEO) return rows([{ total: db.inscritos }]);
  if (q.startsWith('SELECT nombre_externo FROM participantes_torneo')) return rows([]);
  if (q.startsWith('SELECT socio_id FROM socios WHERE usuario_id')) return rows([{ socio_id: 10 }]);
  if (q.startsWith('SELECT participante_id FROM participantes_torneo')) return rows([]);
  if (q.startsWith('INSERT INTO participantes_torneo')) return rows([{ participante_id: 31 }]);
  // alta / edición de torneo
  if (q.startsWith('SELECT disciplina_id FROM disciplinas')) return rows([{ disciplina_id: 2 }]);
  if (q.startsWith('SELECT categoria_id, activo FROM categorias_torneo')) return rows([{ categoria_id: 1, activo: true }]);
  if (q.startsWith('INSERT INTO torneos')) return rows([{ torneo_id: 45 }]);
  if (q.startsWith('SELECT estado, disciplina_id, tipo_torneo, categoria_id,')) {
    return rows([
      {
        estado: db.estado,
        disciplina_id: 2,
        tipo_torneo: 'Individual',
        categoria_id: 1,
        fecha_inicio_inscripcion: null,
        fecha_fin_inscripcion: null,
        nombre: 'Copa',
        fecha_inicio: null,
        fecha_fin: null,
        cupo_maximo: db.cupo
      }
    ]);
  }
  if (q.startsWith('UPDATE torneos')) return rows([]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  // 2026-10-18 en México: el torneo (inicia el 2026-11-07) está en periodo de inscripción
  jest.useFakeTimers({ now: new Date('2026-10-18T18:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
  mockUser = { usuario_id: 1, rol: 'admin' };
  db = { estado: 'Abierto', cupo: 16, inscritos: 6 };
  ({ log } = recordQueries(pool, route));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const sqls = () => log.map(([, sql]) => sql);
const parametrosDe = (inicio) => log.find(([, sql]) => sql.startsWith(inicio))[2];
const base = { nombre: 'Copa', disciplina_id: 2, categoria_id: 1 };

describe('POST /api/torneos con cupo_maximo', () => {
  it.each([
    [4, 4],
    [256, 256],
    ['16', 16],
    [null, null],
    ['', null],
    [undefined, null]
  ])('cupo_maximo %j → 201 y se guarda %j', async (cupo, guardado) => {
    const res = await request(app).post('/api/torneos').send({ ...base, cupo_maximo: cupo });
    expect(res.status).toBe(201);
    expect(parametrosDe('INSERT INTO torneos').at(-1)).toBe(guardado);
  });

  it.each([3, 257, 0, -5, 4.5, '4.5', 'abc', true, [8], { n: 8 }])('cupo_maximo %j → 400 sin tocar la BD', async (cupo) => {
    const res = await request(app).post('/api/torneos').send({ ...base, cupo_maximo: cupo });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(CUPO_INVALIDO);
    expect(log).toEqual([]);
  });
});

describe('PUT /api/torneos/:id con cupo_maximo', () => {
  const editar = (extra) => request(app).put('/api/torneos/45').send({ ...base, ...extra });
  const cupoGuardado = () => parametrosDe('UPDATE torneos').at(-1);

  it('sin cupo_maximo en el body → conserva el actual sin contar inscritos', async () => {
    expect((await editar({})).status).toBe(200);
    expect(cupoGuardado()).toBe(16);
    expect(sqls()).not.toContain(CONTEO);
  });

  it('null → quita el límite', async () => {
    expect((await editar({ cupo_maximo: null })).status).toBe(200);
    expect(cupoGuardado()).toBeNull();
  });

  it('subir o igualar a los inscritos → 200 (queda lleno, nadie se da de baja)', async () => {
    expect((await editar({ cupo_maximo: 32 })).status).toBe(200);
    expect(cupoGuardado()).toBe(32);
    db.inscritos = 8;
    expect((await editar({ cupo_maximo: 8 })).status).toBe(200);
  });

  it('menor que los inscritos actuales → 409 y no se escribe nada', async () => {
    db.inscritos = 6;
    db.cupo = null;
    const res = await editar({ cupo_maximo: 4 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'El cupo no puede ser menor que los inscritos actuales (6); no se da de baja a nadie'
    });
    expect(sqls()).not.toContainEqual(expect.stringContaining('UPDATE torneos'));
    expect(sqls()).toContain('ROLLBACK');
  });

  it('con las inscripciones cerradas: cambiar el cupo → 409; enviar el mismo → 200', async () => {
    db.estado = 'Inscripciones_cerradas';
    let res = await editar({ cupo_maximo: 32 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Con las inscripciones cerradas no se puede cambiar el cupo' });
    res = await editar({ cupo_maximo: 16 });
    expect(res.status).toBe(200);
  });

  it('cupo inválido → 400', async () => {
    const res = await editar({ cupo_maximo: 300 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(CUPO_INVALIDO);
  });

  it('la auditoría registra el cambio de cupo', async () => {
    await editar({ cupo_maximo: 32 });
    const detalles = JSON.parse(parametrosDe('INSERT INTO logs_sistema')[3]);
    expect(detalles.cupo_maximo).toEqual({ antes: 16, despues: 32 });
  });
});

describe('inscripciones con cupo', () => {
  const inscribir = () => request(app).post('/api/torneos/45/inscribir').send({ nombre_externo: 'Invitado' });
  const inscribirme = () => {
    mockUser = { usuario_id: 7, rol: 'socio' };
    return request(app).post('/api/torneos/45/inscribir-me');
  };

  it.each([
    ['staff', inscribir],
    ['socio', inscribirme]
  ])('%s: torneo lleno → 409 sin INSERT', async (_, enviar) => {
    db.inscritos = 16;
    const res = await enviar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual(CUPO_LLENO);
    expect(sqls()).not.toContainEqual(expect.stringContaining('INSERT INTO participantes_torneo'));
    expect(sqls()).toContain('ROLLBACK');
  });

  it.each([
    ['staff', inscribir],
    ['socio', inscribirme]
  ])('%s: queda un lugar → 201', async (_, enviar) => {
    db.inscritos = 15;
    expect((await enviar()).status).toBe(201);
  });

  it('sin cupo → no cuenta inscritos', async () => {
    db.cupo = null;
    db.inscritos = 500;
    expect((await inscribir()).status).toBe(201);
    expect(sqls()).not.toContain(CONTEO);
  });

  it.each([
    ['staff', inscribir],
    ['socio', inscribirme]
  ])('%s: bloqueo, conteo e INSERT en la misma transacción, en ese orden', async (_, enviar) => {
    await enviar();
    const cliente = log.filter(([origen]) => origen === 'client').map(([, sql]) => sql);
    const pos = (fragmento) => cliente.findIndex((sql) => sql.includes(fragmento));
    expect(cliente[0]).toBe('BEGIN');
    expect(cliente.at(-1)).toBe('COMMIT');
    expect(pos('FOR UPDATE')).toBeGreaterThan(0);
    expect(pos(CONTEO)).toBeGreaterThan(pos('FOR UPDATE'));
    expect(pos('INSERT INTO participantes_torneo')).toBeGreaterThan(pos(CONTEO));
    // nada de esto fuera de la transacción
    expect(log.filter(([origen, sql]) => origen === 'pool' && !sql.startsWith('INSERT INTO logs_sistema'))).toEqual([]);
  });
});

describe('admite_inscripcion (E2.12) y la inscripción coinciden', () => {
  async function ambos() {
    const lista = await request(app).get('/api/torneos');
    const inscripcion = await request(app).post('/api/torneos/45/inscribir').send({ nombre_externo: 'Invitado' });
    return { admite: lista.body[0].admite_inscripcion, status: inscripcion.status, body: inscripcion.body };
  }

  it('torneo lleno: el listado dice false y la inscripción responde 409', async () => {
    db.inscritos = 16;
    const { admite, status, body } = await ambos();
    expect(admite).toBe(false);
    expect(status).toBe(409);
    expect(body).toEqual(CUPO_LLENO);
  });

  it.each([
    ['con un lugar libre', 16, 15],
    ['sin límite', null, 300]
  ])('%s: el listado dice true y la inscripción responde 201', async (_, cupo, inscritos) => {
    Object.assign(db, { cupo, inscritos });
    const { admite, status } = await ambos();
    expect(admite).toBe(true);
    expect(status).toBe(201);
  });
});
