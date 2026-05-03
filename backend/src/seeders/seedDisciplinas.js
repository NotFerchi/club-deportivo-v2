const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const pool = require('../config/database');

const disciplinasOficiales = [
  { disciplina_id: 1, nombre: 'Tenis' },
  { disciplina_id: 2, nombre: 'Voleibol' },
  { disciplina_id: 3, nombre: 'Natación' },
  { disciplina_id: 4, nombre: 'Básquetbol' },
  { disciplina_id: 5, nombre: 'Fútbol' },
  { disciplina_id: 6, nombre: 'Pádel' },
  { disciplina_id: 7, nombre: 'Squash' },
  { disciplina_id: 8, nombre: 'Frontón' },
];

const tablasConDisciplina = ['espacios', 'sesiones_programadas', 'torneos'];

function buildValuesPlaceholders(items) {
  return items.map((_, index) => `($${index + 1})`).join(', ');
}

function buildMapValues(mapping) {
  const params = [];
  const placeholders = mapping.map(({ oldId, desiredId }, index) => {
    const base = index * 2;
    params.push(oldId, desiredId);
    return `($${base + 1}::int, $${base + 2}::int)`;
  });

  return {
    sql: `(VALUES ${placeholders.join(', ')}) AS m(old_id, desired_id)`,
    params,
  };
}

async function seedDisciplinas() {
  const nombresOficiales = disciplinasOficiales.map(({ nombre }) => nombre);
  const idsOficiales = disciplinasOficiales.map(({ disciplina_id }) => disciplina_id);
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO disciplinas (nombre)
        VALUES ${buildValuesPlaceholders(nombresOficiales)}
        ON CONFLICT DO NOTHING
      `,
      nombresOficiales
    );

    const actuales = await client.query(
      'SELECT disciplina_id, nombre FROM disciplinas WHERE nombre = ANY($1)',
      [nombresOficiales]
    );

    if (actuales.rowCount !== disciplinasOficiales.length) {
      throw new Error('No se pudieron preparar todas las disciplinas oficiales');
    }

    const oldIdByNombre = new Map(
      actuales.rows.map((row) => [row.nombre, row.disciplina_id])
    );

    const referenciasLimpiadas = {};
    for (const tabla of tablasConDisciplina) {
      const result = await client.query(
        `
          UPDATE ${tabla}
          SET disciplina_id = NULL
          WHERE disciplina_id IN (
            SELECT disciplina_id
            FROM disciplinas
            WHERE NOT (nombre = ANY($1))
          )
        `,
        [nombresOficiales]
      );
      referenciasLimpiadas[tabla] = result.rowCount;
    }

    for (const { disciplina_id } of disciplinasOficiales) {
      await client.query(
        `
          INSERT INTO disciplinas (disciplina_id, nombre)
          VALUES ($1, $2)
          ON CONFLICT (disciplina_id) DO NOTHING
        `,
        [disciplina_id, `__tmp_disciplina_${disciplina_id}`]
      );
    }

    const tempPrefix = `__tmp_seed_${Date.now()}_`;
    await client.query('UPDATE disciplinas SET nombre = $1 || disciplina_id::text', [tempPrefix]);

    for (const { disciplina_id, nombre } of disciplinasOficiales) {
      await client.query(
        'UPDATE disciplinas SET nombre = $1 WHERE disciplina_id = $2',
        [nombre, disciplina_id]
      );
    }

    const mapping = disciplinasOficiales.map(({ disciplina_id, nombre }) => ({
      oldId: oldIdByNombre.get(nombre),
      desiredId: disciplina_id,
    }));
    const mapValues = buildMapValues(mapping);

    const referenciasRemapeadas = {};
    for (const tabla of tablasConDisciplina) {
      const result = await client.query(
        `
          UPDATE ${tabla} ref
          SET disciplina_id = m.desired_id
          FROM ${mapValues.sql}
          WHERE ref.disciplina_id = m.old_id
            AND ref.disciplina_id IS DISTINCT FROM m.desired_id
        `,
        mapValues.params
      );
      referenciasRemapeadas[tabla] = result.rowCount;
    }

    const eliminadasResult = await client.query(
      `
        DELETE FROM disciplinas
        WHERE NOT (disciplina_id = ANY($1))
      `,
      [idsOficiales]
    );

    await client.query(
      "SELECT setval(pg_get_serial_sequence('disciplinas', 'disciplina_id'), 8, true)"
    );

    const totalResult = await client.query('SELECT COUNT(*)::int AS total FROM disciplinas');
    const finales = await client.query(
      'SELECT disciplina_id, nombre FROM disciplinas ORDER BY disciplina_id'
    );

    await client.query('COMMIT');

    console.log(`Seeder de disciplinas completado. Total actual: ${totalResult.rows[0].total}`);
    console.table(finales.rows);
    console.log('Referencias limpiadas:', referenciasLimpiadas);
    console.log('Referencias remapeadas:', referenciasRemapeadas);
    console.log(`Disciplinas fuera de 1-8 eliminadas: ${eliminadasResult.rowCount}`);
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    console.error('Error al ejecutar el seeder de disciplinas:', {
      code: error.code,
      message: error.message,
      detail: error.detail,
    });
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

seedDisciplinas();
