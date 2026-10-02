const { valorCelda, textoCelda, normalizarClave } = require('../../helpers/excel.helper');
const { COLUMNAS_SOCIOS, MAX_FILAS } = require('./columnasSocios');

/**
 * Validación del Excel de socios, en dos niveles y sin tocar la BD:
 *  1. validarEstructura: encabezados obligatorios / repetidos y tamaño del archivo.
 *  2. validarRegistros: reglas por celda (formato + saneamiento) y consistencia
 *     entre filas (emails repetidos, un titular por acción, misma modalidad).
 * Cada error de fila tiene la forma { fila, columna, valor, motivo }.
 */

// ── 1. Estructura del archivo ────────────────────────────────────────────────

/** clave normalizada (nombre o alias) → nombre canónico de la columna. */
const COLUMNA_POR_CLAVE = new Map(
  COLUMNAS_SOCIOS.flatMap((c) => [c.nombre, ...c.alias].map((clave) => [normalizarClave(clave), c.nombre]))
);

/**
 * Recibe la hoja leída ({ encabezados, filas } de leerHojaExcel). El orden de las
 * columnas no importa: se ubican por encabezado; las columnas desconocidas se ignoran.
 * Devuelve { error } (cuerpo de la respuesta 400) o { filas: [{ numFila, valores }] }
 * con valores = { Numero_Accion: …, Email: …, … }.
 */
function validarEstructura({ encabezados, filas }) {
  const columnaDe = {};
  const repetidas = new Set();
  encabezados.forEach(({ columna, texto }) => {
    const nombre = COLUMNA_POR_CLAVE.get(normalizarClave(texto));
    if (!nombre) return;
    if (nombre in columnaDe) repetidas.add(nombre);
    else columnaDe[nombre] = columna;
  });

  const faltantes = COLUMNAS_SOCIOS.filter((c) => c.obligatoria && !(c.nombre in columnaDe)).map((c) => c.nombre);
  if (faltantes.length > 0) {
    return {
      error: {
        error: `Faltan columnas obligatorias: ${faltantes.join(', ')}`,
        columnas_faltantes: faltantes,
        columnas_encontradas: encabezados.map((e) => e.texto)
      }
    };
  }
  if (repetidas.size > 0) {
    const lista = [...repetidas];
    return { error: { error: `Columnas repetidas: ${lista.join(', ')}`, columnas_repetidas: lista } };
  }
  if (filas.length === 0) return { error: { error: 'El archivo no tiene filas de datos' } };
  if (filas.length > MAX_FILAS) {
    return { error: { error: `El archivo tiene ${filas.length} filas; el máximo permitido es ${MAX_FILAS}` } };
  }

  const columnas = Object.entries(columnaDe);
  return {
    filas: filas.map(({ numFila, celdas }) => ({
      numFila,
      valores: Object.fromEntries(columnas.map(([nombre, columna]) => [nombre, celdas[columna]]))
    }))
  };
}

// ── 2a. Reglas por celda ─────────────────────────────────────────────────────
// Cada regla recibe el valor crudo y devuelve { valor } (saneado) o { motivo }.

const ok = (valor) => ({ valor });
const falla = (motivo) => ({ motivo });

const obligatorio = (regla) => (v) => (textoCelda(v) === '' ? falla('Es obligatorio') : regla(v));
const opcional = (regla) => (v) => (textoCelda(v) === '' ? ok(null) : regla(v));

/** Valor de una lista cerrada; compara sin acentos ni mayúsculas. */
const deCatalogo = (opciones, catalogo) => (v) => {
  const clave = normalizarClave(v);
  return Object.hasOwn(catalogo, clave) ? ok(catalogo[clave]) : falla(`Valor no válido. Usa: ${opciones}`);
};

/** Texto que debe cumplir `regex` después de sanearlo con `sanear`. */
const conFormato =
  (regex, motivo, sanear = textoCelda) =>
  (v) => {
    const texto = sanear(v);
    return regex.test(texto) ? ok(texto) : falla(motivo);
  };

const textoLibre = (max) => (v) => {
  const texto = textoCelda(v);
  return texto.length <= max ? ok(texto) : falla(`Máximo ${max} caracteres`);
};

const nombreCompleto = (v) => {
  const texto = textoCelda(v);
  if (!/^[\p{L}\s.'-]+$/u.test(texto)) return falla('Solo se permiten letras');
  if (texto.split(' ').length < 2) return falla('Debe incluir al menos nombre y apellido');
  if (texto.length > 100) return falla('Máximo 100 caracteres');
  return ok(texto);
};

const telefono = conFormato(/^\d{10}$/, 'Debe tener 10 dígitos', (v) => textoCelda(v).replace(/[\s\-().]/g, ''));

// username es VARCHAR(50)
const email = conFormato(/^(?=.{3,50}$)[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email no válido (nombre@dominio, máx. 50)', (v) =>
  textoCelda(v).toLowerCase()
);

const DIA_MS = 86400 * 1000;
const EPOCH_EXCEL = 25569; // días entre 1899-12-30 (serial 0 de Excel) y 1970-01-01

/** 'YYYY-MM-DD' o 'DD/MM/YYYY' (también con '-') → Date UTC; null si no existe (p. ej. 2023-02-30). */
function fechaDeTexto(texto) {
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const latina = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!iso && !latina) return null;
  const [anio, mes, dia] = (iso ? [iso[1], iso[2], iso[3]] : [latina[3], latina[2], latina[1]]).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const existe = fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  return existe ? fecha : null;
}

/** Acepta celda de fecha, número serial de Excel o texto. Devuelve YYYY-MM-DD entre 1900 y hoy. */
const fechaNacimiento = (v) => {
  const plano = valorCelda(v);
  let fecha;
  if (plano instanceof Date) fecha = plano;
  else if (typeof plano === 'number') fecha = new Date(Math.round((plano - EPOCH_EXCEL) * DIA_MS));
  else fecha = fechaDeTexto(textoCelda(plano));

  if (!fecha || Number.isNaN(fecha.getTime())) return falla('Fecha no válida. Usa YYYY-MM-DD o DD/MM/YYYY');
  const iso = fecha.toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);
  if (iso < '1900-01-01' || iso > hoy) return falla('Fecha fuera de rango (1900 a hoy)');
  return ok(iso);
};

const GENEROS = {
  masculino: 'Masculino',
  hombre: 'Masculino',
  m: 'Masculino',
  femenino: 'Femenino',
  mujer: 'Femenino',
  f: 'Femenino'
};

/** Una regla por columna del catálogo (columnasSocios.js). */
const REGLAS = {
  Numero_Accion: obligatorio(
    conFormato(/^[A-Za-z0-9-]{1,12}$/, 'Solo letras, números o guiones (máximo 12 caracteres)')
  ),
  Tipo_Accion: obligatorio(deCatalogo('Individual, Familiar', { individual: 'Individual', familiar: 'Familiar' })),
  Estatus_Accion: obligatorio(deCatalogo('Propia, Rentada', { propia: 'Accionista', rentada: 'Rentista' })),
  Rol: obligatorio(deCatalogo('Titular, Miembro', { titular: 'Titular', miembro: 'Miembro' })),
  Nombre_Completo: obligatorio(nombreCompleto),
  Genero: opcional(deCatalogo('Masculino, Femenino', GENEROS)),
  Fecha_Nacimiento: opcional(fechaNacimiento),
  Parentesco: opcional(textoLibre(50)),
  Domicilio: opcional(textoLibre(255)),
  Email: obligatorio(email),
  Telefono_Celular: opcional(telefono),
  Telefono_Particular: opcional(telefono)
};

const errorDeFila = (fila, columna, valor, motivo) => ({
  fila,
  columna,
  valor: textoCelda(valor).slice(0, 60),
  motivo
});

/** 'Ana María López Ruiz' → nombres 'Ana María', paterno 'López', materno 'Ruiz'. */
function separarNombre(nombreCompleto) {
  const partes = nombreCompleto.split(' ');
  if (partes.length === 2) return { nombres: partes[0], apellido_paterno: partes[1], apellido_materno: '' };
  return {
    nombres: partes.slice(0, -2).join(' '),
    apellido_paterno: partes[partes.length - 2],
    apellido_materno: partes[partes.length - 1]
  };
}

/** Valores saneados → datos que usa la sincronización con la BD. */
function aDatos(l) {
  const esTitular = l.Rol === 'Titular';
  return {
    codigoAccion: l.Numero_Accion,
    email: l.Email,
    esTitular,
    modalidad: l.Tipo_Accion,
    tipo: l.Estatus_Accion,
    ...separarNombre(l.Nombre_Completo),
    genero: l.Genero,
    fechaNac: l.Fecha_Nacimiento,
    telefono: l.Telefono_Celular,
    telEmerg: l.Telefono_Particular,
    domicilio: l.Domicilio,
    parentesco: esTitular ? null : l.Parentesco
  };
}

function validarFila({ numFila, valores }) {
  const limpio = {};
  const errores = [];
  Object.entries(REGLAS).forEach(([columna, regla]) => {
    const resultado = regla(valores[columna]);
    if ('motivo' in resultado) errores.push(errorDeFila(numFila, columna, valores[columna], resultado.motivo));
    else limpio[columna] = resultado.valor;
  });

  if (limpio.Rol === 'Miembro' && limpio.Parentesco === null) {
    errores.push(errorDeFila(numFila, 'Parentesco', '', 'Es obligatorio para Miembros'));
  }
  return errores.length > 0 ? { errores } : { datos: aDatos(limpio), errores };
}

// ── 2b. Consistencia entre filas ─────────────────────────────────────────────

/** Guarda `valor` la primera vez que aparece `clave`; devuelve el valor previo si ya existía. */
function primeraAparicion(mapa, clave, valor) {
  if (mapa.has(clave)) return mapa.get(clave);
  mapa.set(clave, valor);
  return null;
}

/** Columnas que deben coincidir entre todas las filas de una misma acción. */
const COLUMNAS_DE_ACCION = [
  ['Tipo_Accion', 'modalidad'],
  ['Estatus_Accion', 'tipo']
];

function validarConsistencia(registros) {
  const errores = [];
  const emails = new Map();
  const titulares = new Map();
  const acciones = new Map();

  registros.forEach((registro) => {
    const { numFila, valores, datos } = registro;

    const filaEmail = primeraAparicion(emails, datos.email, numFila);
    if (filaEmail) {
      errores.push(errorDeFila(numFila, 'Email', datos.email, `Email repetido en el archivo (fila ${filaEmail})`));
    }

    if (datos.esTitular) {
      const filaTitular = primeraAparicion(titulares, datos.codigoAccion, numFila);
      if (filaTitular) {
        const motivo = `La acción ${datos.codigoAccion} ya tiene titular en la fila ${filaTitular}`;
        errores.push(errorDeFila(numFila, 'Rol', valores.Rol, motivo));
      }
    }

    const primera = primeraAparicion(acciones, datos.codigoAccion, registro);
    if (!primera) return;
    COLUMNAS_DE_ACCION.forEach(([columna, campo]) => {
      if (datos[campo] === primera.datos[campo]) return;
      const motivo = `No coincide con la fila ${primera.numFila} de la acción ${datos.codigoAccion}`;
      errores.push(errorDeFila(numFila, columna, valores[columna], motivo));
    });
  });

  return errores;
}

/**
 * Valida todas las filas. Devuelve { registros: [{ numFila, datos }], errores }
 * con los errores ordenados por fila. Si hay errores no debe importarse nada.
 */
function validarRegistros(filas) {
  const validos = [];
  const errores = [];
  filas.forEach((fila) => {
    const resultado = validarFila(fila);
    if (resultado.datos) validos.push({ ...fila, datos: resultado.datos });
    else errores.push(...resultado.errores);
  });
  errores.push(...validarConsistencia(validos));
  errores.sort((a, b) => a.fila - b.fila);

  return { registros: validos.map(({ numFila, datos }) => ({ numFila, datos })), errores };
}

module.exports = { validarEstructura, validarRegistros };
