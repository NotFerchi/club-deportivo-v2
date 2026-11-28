// Protecciones de la semilla de simulación (U5-07). Funciones puras: devuelven un mensaje de error o null.
// Ninguna incluye en sus mensajes la cadena de conexión ni contraseñas.

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** --simulacion obligatorio, --inicio=YYYY-MM-DD obligatorio y válido, --ensayo opcional. */
function leerArgumentos(argv) {
  const simulacion = argv.includes('--simulacion');
  const ensayo = argv.includes('--ensayo');
  const conInicio = argv.find((a) => a.startsWith('--inicio='));
  const inicio = conInicio ? conInicio.slice('--inicio='.length) : null;
  const conocidos = ['--simulacion', '--ensayo'];
  const desconocido = argv.find((a) => !conocidos.includes(a) && !a.startsWith('--inicio='));

  if (desconocido) return { error: `Argumento no reconocido: ${desconocido}` };
  if (!simulacion) return { error: 'Falta --simulacion: confirma que el destino es la base de la simulación' };
  if (!inicio) return { error: 'Falta --inicio=YYYY-MM-DD (primer día de la semana de simulación)' };
  if (!FECHA_ISO.test(inicio)) return { error: '--inicio debe tener el formato YYYY-MM-DD' };
  const [anio, mes, dia] = inicio.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return { error: `--inicio no es una fecha que exista: ${inicio}` };
  }
  return { simulacion, ensayo, inicio };
}

const hostDe = (url) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/**
 * La URL de la simulación debe existir y apuntar a un host distinto del de production (DATABASE_URL).
 * Sin la URL de production no hay con qué comparar: se rechaza (falla cerrado).
 */
function validarDestino({ urlSimulacion, urlProduccion }) {
  if (!urlSimulacion) return 'Falta SIMULACION_DATABASE_URL (backend/.env.simulacion)';
  if (!urlProduccion) return 'Falta DATABASE_URL de production (backend/.env): no puedo comprobar que el destino sea otro';
  const hostSimulacion = hostDe(urlSimulacion);
  const hostProduccion = hostDe(urlProduccion);
  if (!hostSimulacion) return 'SIMULACION_DATABASE_URL no es una URL válida';
  if (!hostProduccion) return 'DATABASE_URL no es una URL válida: no puedo comprobar que el destino sea otro';
  if (hostSimulacion === hostProduccion) {
    return 'SIMULACION_DATABASE_URL apunta al mismo host que production: me niego a escribir';
  }
  return null;
}

/**
 * La base debe estar vacía (un branch "solo esquema" recién creado: 0 usuarios) o ser ya la simulación
 * (tiene la acción SIM01 y el torneo "SIM Copa de Tenis Otoño"). Cualquier otra base con datos se rechaza:
 * así la semilla no escribe en production ni en un branch copiado de ella aunque fallara la revisión del host.
 */
function validarContenido({ usuarios, accionSim01, torneoSim }) {
  if (usuarios === 0) return null;
  if (accionSim01 && torneoSim) return null;
  return `La base tiene ${usuarios} usuarios y no es la de la simulación (sin acción SIM01 ni torneo SIM): me niego a escribir`;
}

module.exports = { leerArgumentos, validarDestino, validarContenido, hostDe };
