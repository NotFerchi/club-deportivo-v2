'use strict';

/**
 * BD en memoria para un torneo y su bracket: implementa solo las consultas del flujo
 * cerrar inscripciones → confirmar bracket → registrar/editar resultados, con BEGIN/ROLLBACK
 * reales (ROLLBACK restaura el estado). Se conecta con recordQueries(pool, bd.route), que
 * normaliza el SQL. Cualquier otra consulta lanza, para que el test no pase por casualidad.
 */

const clonar = (valor) => JSON.parse(JSON.stringify(valor));
const resultado = (lista) => ({ rows: lista, rowCount: lista.length });

function crearBracketEnMemoria({ torneoId = 4, participantes, estado = 'Abierto' }) {
  let datos = { torneo: { torneo_id: torneoId, estado }, encuentros: [], ultimoId: 0 };
  let respaldo = null;

  const ronda = (r) =>
    datos.encuentros.filter((e) => e.ronda === Number(r)).sort((a, b) => a.encuentro_id - b.encuentro_id);
  const encuentro = (id) => datos.encuentros.find((e) => e.encuentro_id === Number(id));

  function insertar(campos) {
    const fila = {
      encuentro_id: ++datos.ultimoId,
      torneo_id: torneoId,
      ronda: null,
      estado: 'pendiente',
      participante_1_id: null,
      participante_2_id: null,
      ganador_id: null,
      marcador_1: null,
      marcador_2: null,
      cancha_asignada: null,
      ...campos
    };
    datos.encuentros.push(fila);
    return fila;
  }

  const resumen = ({ encuentro_id, ronda: r, participante_1_id, participante_2_id }) => ({
    encuentro_id,
    ronda: r,
    participante_1_id,
    participante_2_id
  });

  function route(q, p) {
    if (q === 'BEGIN') {
      respaldo = clonar(datos);
      return resultado([]);
    }
    if (q === 'COMMIT') {
      respaldo = null;
      return resultado([]);
    }
    if (q === 'ROLLBACK') {
      datos = respaldo;
      respaldo = null;
      return resultado([]);
    }

    // Torneo
    if (q === 'SELECT estado FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE') {
      return resultado([{ estado: datos.torneo.estado }]);
    }
    if (q === 'UPDATE torneos SET estado = $1 WHERE torneo_id = $2') {
      datos.torneo.estado = p[0];
      return resultado([]);
    }
    if (q === 'SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1') {
      return resultado(participantes.map((participante_id) => ({ participante_id })));
    }

    // Generación del bracket
    if (q === 'SELECT 1 FROM encuentros_torneo WHERE torneo_id = $1 LIMIT 1') {
      return resultado(datos.encuentros.length ? [{ '?column?': 1 }] : []);
    }
    if (
      q.startsWith('INSERT INTO encuentros_torneo (torneo_id, participante_1_id, participante_2_id, ronda, estado)')
    ) {
      insertar({ ronda: 1, participante_1_id: p[1], participante_2_id: p[2] });
      return resultado([]);
    }
    if (q.startsWith('INSERT INTO encuentros_torneo (torneo_id, participante_1_id, ronda, ganador_id, estado)')) {
      insertar({ ronda: 1, participante_1_id: p[1], ganador_id: p[1], estado: 'finalizado' });
      return resultado([]);
    }
    if (q.startsWith('INSERT INTO encuentros_torneo (torneo_id, ronda, estado)')) {
      const fila = insertar({ ronda: p[1] });
      return resultado([{ encuentro_id: fila.encuentro_id }]);
    }
    const programar = q.match(
      /^UPDATE encuentros_torneo SET estado = 'programado' WHERE torneo_id = \$1 AND ronda = (1|\$2) AND estado = 'pendiente'$/
    );
    if (programar) {
      const r = programar[1] === '1' ? 1 : p[1];
      for (const e of ronda(r)) if (e.estado === 'pendiente') e.estado = 'programado';
      return resultado([]);
    }
    const slot = q.match(/^UPDATE encuentros_torneo SET (participante_[12]_id) = \$1 WHERE encuentro_id = \$2/);
    if (slot) {
      const e = encuentro(p[1]);
      e[slot[1]] = p[0];
      return resultado(q.includes('RETURNING') ? [resumen(e)] : []);
    }

    // Resultados
    if (q.startsWith('SELECT t.estado FROM encuentros_torneo e JOIN torneos t')) {
      return resultado(encuentro(p[0]) ? [{ estado: datos.torneo.estado }] : []);
    }
    if (
      q.startsWith('SELECT encuentro_id, torneo_id, ronda, estado, participante_1_id, participante_2_id, ganador_id')
    ) {
      const e = encuentro(p[0]);
      return resultado(e ? [clonar(e)] : []);
    }
    if (q.startsWith('SELECT COUNT(*) FILTER (WHERE encuentro_id < $3)')) {
      const lista = ronda(p[1]);
      return resultado([{ posicion: lista.filter((e) => e.encuentro_id < p[2]).length, total: lista.length }]);
    }
    if (
      q.startsWith('SELECT encuentro_id, ronda, estado, participante_1_id, participante_2_id FROM encuentros_torneo')
    ) {
      const e = ronda(p[1])[p[2]];
      return resultado(e ? [{ ...resumen(e), estado: e.estado }] : []);
    }
    if (q.startsWith('UPDATE encuentros_torneo SET marcador_1 = $1')) {
      const [marcador1, marcador2, ganadorId, id, cancha] = p;
      const e = encuentro(id);
      Object.assign(e, { marcador_1: marcador1, marcador_2: marcador2, ganador_id: ganadorId, estado: 'finalizado' });
      if (cancha !== null) e.cancha_asignada = cancha;
      return resultado([clonar(e)]);
    }
    if (q.startsWith('SELECT COUNT(*) as total FROM encuentros_torneo WHERE torneo_id = $1 AND ronda = $2')) {
      return resultado([{ total: String(ronda(p[1]).filter((e) => e.estado !== 'finalizado').length) }]);
    }

    throw new Error(`Query no esperada en el bracket en memoria: ${q}`);
  }

  return {
    route,
    ronda,
    encuentro,
    get torneo() {
      return datos.torneo;
    }
  };
}

module.exports = { crearBracketEnMemoria };
