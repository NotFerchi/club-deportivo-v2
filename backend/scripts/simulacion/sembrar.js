// Siembra los datos de la simulación (U5-07) con el cliente de una transacción ya abierta.
// Idempotente: cada fila se busca por su clave natural y solo se inserta si falta. Correrla dos veces
// deja la base igual (la segunda pasada no crea ni actualiza nada; semillaSimulacion.js lo comprueba).
// No borra nada ni cambia el esquema. Las contraseñas solo se usan para calcular su hash con bcrypt:
// nunca se imprimen ni se devuelven.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const D = require('./datosSemilla');

/** 'YYYY-MM-DD' + n días → 'YYYY-MM-DD' (aritmética en UTC: sin saltos por horario de verano). */
function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}
const marca = (fecha, hora) => `${fecha} ${hora}:00`;

/** Operaciones de una sola tabla sobre `client`, con conteo por tabla en `resumen`. */
function crearDb(client, resumen) {
  const contar = (tabla, tipo) => {
    resumen[tabla] = resumen[tabla] || { creados: 0, existentes: 0, actualizados: 0 };
    resumen[tabla][tipo]++;
  };
  // where: { columna: valor } o { columna: { like: 'patrón' } }
  const armarWhere = (where) => {
    const cols = Object.keys(where);
    const sql = cols
      .map((c, i) => (where[c] && typeof where[c] === 'object' && 'like' in where[c] ? `${c} LIKE $${i + 1}` : `${c} = $${i + 1}`))
      .join(' AND ');
    const params = cols.map((c) => (where[c] && typeof where[c] === 'object' && 'like' in where[c] ? where[c].like : where[c]));
    return { sql, params };
  };

  async function leer(tabla, columnas, where) {
    const { sql, params } = armarWhere(where);
    const { rows } = await client.query(`SELECT ${columnas.join(', ')} FROM ${tabla} WHERE ${sql}`, params);
    return rows;
  }
  async function buscar(tabla, idCol, clave) {
    const { sql, params } = armarWhere(clave);
    const { rows } = await client.query(`SELECT ${idCol} FROM ${tabla} WHERE ${sql} LIMIT 1`, params);
    return rows[0] ? rows[0][idCol] : null;
  }
  async function insertar(tabla, idCol, datos) {
    const cols = Object.keys(datos);
    const { rows } = await client.query(
      `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${idCol}`,
      cols.map((c) => datos[c])
    );
    contar(tabla, 'creados');
    return rows[0][idCol];
  }
  /** Id de la fila con esa clave; si no existe la inserta con clave + valores. */
  async function asegurar(tabla, idCol, clave, valores = {}) {
    const id = await buscar(tabla, idCol, clave);
    if (id !== null) {
      contar(tabla, 'existentes');
      return id;
    }
    return insertar(tabla, idCol, { ...clave, ...valores });
  }
  async function actualizar(tabla, idCol, id, valores) {
    const cols = Object.keys(valores);
    await client.query(
      `UPDATE ${tabla} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE ${idCol} = $${cols.length + 1}`,
      [...cols.map((c) => valores[c]), id]
    );
    contar(tabla, 'actualizados');
  }
  return { leer, buscar, insertar, asegurar, actualizar };
}

/** Hash de una contraseña aleatoria que nadie conoce: la cuenta existe pero no se puede entrar con ella. */
const hashImposible = () => bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

/** Cambios hechos (creados + actualizados), sin contar lo que ya existía. */
function totalCambios(resumen) {
  return Object.values(resumen).reduce((t, r) => t + r.creados + r.actualizados, 0);
}

/**
 * @param client       cliente pg dentro de una transacción
 * @param opciones.inicio        'YYYY-MM-DD' (--inicio)
 * @param opciones.hoy           'YYYY-MM-DD' de hoy en México (edades de la ludoteca: CHECK de 3 a 7 años)
 * @param opciones.contrasenas   { SIM_PASS_ADMIN, ... } (las que falten quedan pendientes)
 * @param opciones.importarSocios (buffer) => { nuevos, actualizados }: el importador real (o null para omitirlo)
 * @param opciones.bufferDia1    socios-dia1.xlsx
 * @returns { resumen, importacion, pendientes, ids }
 */
async function sembrar(client, { inicio, hoy, contrasenas = {}, importarSocios = null, bufferDia1 = null }) {
  const resumen = {};
  const pendientes = [];
  const db = crearDb(client, resumen);
  const dia = (n) => sumarDias(inicio, n);

  // ── Roles ──
  const rol = {};
  for (const nombre of D.ROLES) rol[nombre] = await db.asegurar('roles', 'rol_id', { nombre });

  // ── Socios: socios-dia1.xlsx con el importador real ──
  let importacion = null;
  if (importarSocios) {
    const r = await importarSocios(bufferDia1);
    importacion = { nuevos: r.nuevos, actualizados: r.actualizados };
  }
  async function socioPorEmail(email) {
    const usuarioId = await db.buscar('usuarios', 'usuario_id', { username: email });
    const socioId = usuarioId === null ? null : await db.buscar('socios', 'socio_id', { usuario_id: usuarioId });
    if (socioId === null) throw new Error(`Falta el socio ${email}: ¿se importó socios-dia1.xlsx?`);
    return socioId;
  }

  // El importador da a cada socio nuevo la contraseña predecible Club<acción><año>. En la simulación (que
  // estará en internet) se reemplaza por una imposible; la cuenta de acceso del socio recibe la suya abajo.
  const anio = new Date().getFullYear();
  for (const accion of await db.leer('acciones_familiares', ['accion_id', 'codigo_accion'], { codigo_accion: { like: 'SIM%' } })) {
    for (const { usuario_id: usuarioId } of await db.leer('socios', ['usuario_id'], { accion_id: accion.accion_id })) {
      const [usuario] = await db.leer('usuarios', ['password_hash'], { usuario_id: usuarioId });
      if (usuario && (await bcrypt.compare(`Club${accion.codigo_accion}${anio}`, usuario.password_hash))) {
        await db.actualizar('usuarios', 'usuario_id', usuarioId, { password_hash: await hashImposible() });
      }
    }
  }

  /** Pone la contraseña de la variable si la cuenta no la tiene ya. */
  async function fijarContrasena(usuarioId, variable) {
    const [usuario] = await db.leer('usuarios', ['password_hash'], { usuario_id: usuarioId });
    if (!(await bcrypt.compare(contrasenas[variable], usuario.password_hash))) {
      await db.actualizar('usuarios', 'usuario_id', usuarioId, { password_hash: await bcrypt.hash(contrasenas[variable], 10) });
    }
  }

  // ── Cuentas de acceso del personal (solo con su contraseña, U5-08) ──
  const usuarioDeRol = {};
  for (const cuenta of D.CUENTAS_ACCESO.filter((c) => !c.esDato)) {
    if (!contrasenas[cuenta.env]) {
      pendientes.push(`${cuenta.rol}: falta ${cuenta.env}, la cuenta no se crea`);
      continue;
    }
    let usuarioId = await db.buscar('usuarios', 'usuario_id', { username: cuenta.username });
    if (usuarioId === null) {
      usuarioId = await db.insertar('usuarios', 'usuario_id', {
        username: cuenta.username,
        password_hash: await bcrypt.hash(contrasenas[cuenta.env], 10),
        rol_id: rol[cuenta.rol],
        nombres: cuenta.nombres,
        apellido_paterno: cuenta.paterno,
        activo: true
      });
    } else {
      await fijarContrasena(usuarioId, cuenta.env);
    }
    usuarioDeRol[cuenta.rol] = usuarioId;
  }

  // ── Instalaciones ──
  const disciplina = {};
  for (const nombre of D.DISCIPLINAS) disciplina[nombre] = await db.asegurar('disciplinas', 'disciplina_id', { nombre });
  const espacio = {};
  for (const [nombre, principal, capacidad, otras] of D.ESPACIOS) {
    espacio[nombre] = await db.asegurar('espacios', 'espacio_id', { nombre }, {
      disciplina_id: disciplina[principal],
      capacidad_maxima: capacidad,
      estado: 'Activo',
      activo: true
    });
    for (const d of [principal, ...otras]) {
      await db.asegurar('espacios_disciplinas', 'espacio_id', { espacio_id: espacio[nombre], disciplina_id: disciplina[d] });
    }
  }

  // ── Instructores (la cuenta "instructor" es la de acceso del rol) ──
  const instructor = {};
  const cuentaInstructor = D.CUENTAS_ACCESO.find((c) => c.rol === 'instructor');
  for (const [clave, username, nombres, paterno, materno, especialidad] of D.INSTRUCTORES) {
    const conAcceso = clave === 'instructor' && Boolean(contrasenas[cuentaInstructor.env]);
    let usuarioId = await db.buscar('usuarios', 'usuario_id', { username });
    if (usuarioId === null) {
      usuarioId = await db.insertar('usuarios', 'usuario_id', {
        username,
        password_hash: conAcceso ? await bcrypt.hash(contrasenas[cuentaInstructor.env], 10) : await hashImposible(),
        rol_id: rol.instructor,
        nombres,
        apellido_paterno: paterno,
        apellido_materno: materno,
        activo: true
      });
    } else if (conAcceso) {
      await fijarContrasena(usuarioId, cuentaInstructor.env);
    }
    instructor[clave] = await db.asegurar('instructores', 'instructor_id', { usuario_id: usuarioId }, { especialidad, activo: true });
  }
  if (!contrasenas[cuentaInstructor.env]) {
    pendientes.push(`instructor: falta ${cuentaInstructor.env}, la cuenta existe (da clases) pero no se puede entrar`);
  }

  // ── Cuenta de acceso del socio (titular de SIM01, viene del Excel) ──
  const cuentaSocio = D.CUENTAS_ACCESO.find((c) => c.rol === 'socio');
  const usuarioSocio = await db.buscar('usuarios', 'usuario_id', { username: cuentaSocio.username });
  if (usuarioSocio !== null && contrasenas[cuentaSocio.env]) await fijarContrasena(usuarioSocio, cuentaSocio.env);
  else if (usuarioSocio !== null) {
    pendientes.push(`socio: falta ${cuentaSocio.env}, la cuenta existe (titular de SIM01) pero no se puede entrar`);
  }

  // ── Clases e inscripciones ──
  const sesiones = [];
  for (const [disc, esp, inst, diaSemana, horaInicio, horaFin, cupo] of D.SESIONES) {
    sesiones.push(
      await db.asegurar(
        'sesiones_programadas',
        'sesion_id',
        { disciplina_id: disciplina[disc], espacio_id: espacio[esp], dia_semana: diaSemana, hora_inicio: horaInicio },
        { hora_fin: horaFin, instructor_id: instructor[inst], cupo_maximo: cupo }
      )
    );
  }
  for (const [email, indice] of D.INSCRIPCIONES) {
    await db.asegurar(
      'inscripciones_clases',
      'inscripcion_id',
      { socio_id: await socioPorEmail(email), sesion_id: sesiones[indice] },
      { estado: 'Confirmada' }
    );
  }

  // ── Visitas (cerradas) ──
  const visita = {};
  for (const [i, [nombre, anfitrion, d, entrada, salida, mayor16]] of D.VISITAS.entries()) {
    visita[nombre] = await db.asegurar('visitas', 'visita_id', { nombre_completo: nombre, fecha_visita: dia(d) }, {
      socio_id: await socioPorEmail(anfitrion),
      identificacion_tipo: 'INE',
      telefono: `44300000${String(i + 10)}`,
      mayor_16: mayor16,
      hora_entrada: marca(dia(d), entrada),
      hora_salida: marca(dia(d), salida),
      vigente: false,
      observaciones: 'Registrada por la semilla de simulación'
    });
  }

  // ── Ludoteca (entradas cerradas). La edad se calcula contra hoy: el CHECK usa CURRENT_DATE ──
  const ludoteca = [];
  for (const [email, nombreHijo, edad, d, entrada, salida, observaciones] of D.LUDOTECA) {
    ludoteca.push(
      await db.asegurar(
        'registro_ludoteca',
        'registro_id',
        { socio_padre_id: await socioPorEmail(email), nombre_hijo: nombreHijo, hora_entrada: marca(dia(d), entrada) },
        { fecha_nacimiento: sumarDias(hoy, -(edad * 365 + 60)), hora_salida: marca(dia(d), salida), observaciones }
      )
    );
  }

  // ── Sanciones ──
  for (const [email, origen, motivo, gravedad, estado, dIni, dFin, iLudoteca] of D.SANCIONES) {
    const resuelta = estado === 'Resuelta';
    await db.asegurar('sanciones', 'sancion_id', { socio_id: await socioPorEmail(email), motivo }, {
      origen,
      gravedad,
      estado,
      fecha: marca(dia(dIni), '09:00'),
      fecha_inicio: dia(dIni),
      fecha_fin: dia(dFin),
      registro_ludoteca_id: iLudoteca === null ? null : ludoteca[iLudoteca],
      resuelto_por: resuelta ? usuarioDeRol.admin ?? null : null,
      fecha_resolucion: resuelta ? marca(dia(dFin), '12:00') : null
    });
  }

  // ── Torneos ──
  const categoria = {};
  for (const nombre of D.CATEGORIAS) categoria[nombre] = await db.asegurar('categorias_torneo', 'categoria_id', { nombre }, { activo: true });
  const ids = { torneos: {} };
  for (const t of D.TORNEOS) {
    const categoriaId = categoria[t.categoria];
    const torneoId = await db.asegurar('torneos', 'torneo_id', { nombre: t.nombre }, {
      disciplina_id: disciplina[t.disciplina],
      categoria_id: categoriaId,
      tipo_torneo: t.tipo,
      estado: t.estado,
      cupo_maximo: t.cupo,
      fecha_inicio: dia(t.inicio),
      fecha_fin: dia(t.fin),
      fecha_inicio_inscripcion: dia(t.inicioInscripcion),
      fecha_fin_inscripcion: dia(t.finInscripcion),
      activo: true
    });
    ids.torneos[t.nombre] = torneoId;
    const participantes = [];
    for (const email of t.socios) {
      participantes.push(await db.asegurar('participantes_torneo', 'participante_id',
        { torneo_id: torneoId, socio_id: await socioPorEmail(email) }, { categoria_id: categoriaId }));
    }
    for (const nombre of t.visitas) {
      participantes.push(await db.asegurar('participantes_torneo', 'participante_id',
        { torneo_id: torneoId, visita_id: visita[nombre] }, { categoria_id: categoriaId }));
    }
    for (const nombre of t.externos) {
      participantes.push(await db.asegurar('participantes_torneo', 'participante_id',
        { torneo_id: torneoId, nombre_externo: nombre }, { categoria_id: categoriaId }));
    }

    // Bracket de 4 (mismo formato que bracketService): ronda 1 con los participantes, final vacía y el
    // ganador de la semifinal en la posición 0 en participante_1_id de la final (bracketPosicion.js).
    if (t.bracket && (await db.buscar('encuentros_torneo', 'encuentro_id', { torneo_id: torneoId })) === null) {
      const arbitro = instructor[t.bracket.arbitro];
      const ganadores = [];
      for (const [i, s] of t.bracket.semifinales.entries()) {
        const [p1, p2] = [participantes[i * 2], participantes[i * 2 + 1]];
        const jugado = Boolean(s.marcador);
        const ganador = jugado ? (s.marcador[0] > s.marcador[1] ? p1 : p2) : null;
        ganadores.push(ganador);
        await db.insertar('encuentros_torneo', 'encuentro_id', {
          torneo_id: torneoId,
          ronda: 1,
          participante_1_id: p1,
          participante_2_id: p2,
          estado: jugado ? 'finalizado' : 'programado',
          cancha_asignada: s.cancha,
          hora_programada: marca(dia(s.dia), s.hora),
          arbitro_id: arbitro,
          marcador_1: jugado ? s.marcador[0] : null,
          marcador_2: jugado ? s.marcador[1] : null,
          ganador_id: ganador
        });
      }
      await db.insertar('encuentros_torneo', 'encuentro_id', {
        torneo_id: torneoId,
        ronda: 2,
        participante_1_id: ganadores[0],
        participante_2_id: ganadores[1],
        estado: 'pendiente'
      });
    } else if (t.bracket) {
      resumen.encuentros_torneo = resumen.encuentros_torneo || { creados: 0, existentes: 0, actualizados: 0 };
      resumen.encuentros_torneo.existentes++;
    }
  }

  return { resumen, importacion, pendientes, ids };
}

module.exports = { sembrar, totalCambios, sumarDias, crearDb };
