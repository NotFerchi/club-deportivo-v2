// Genera la hoja de acceso y la guía rápida del Director de Operaciones para la simulación (U5-07),
// en Markdown y en PDF de una página, desde el mismo contenido:
//
//   node scripts/generarDocsSimulacion.js [--url-app=https://...] [--inicio=YYYY-MM-DD] [--salida <carpeta>]
//
// Sin --url-app o sin --inicio esos datos quedan "por confirmar"; se vuelve a correr cuando se tengan.
// Nunca lleva contraseñas: se entregan aparte (U5-08).
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { CUENTAS_ACCESO, TORNEOS, ESPACIOS, SESIONES, INSTRUCTORES, SANCIONES } = require('./simulacion/datosSemilla');
const { sociosDia1, sociosDia3 } = require('./simulacion/sociosSimulacion');
const { sumarDias } = require('./simulacion/sembrar');

const arg = (nombre) => {
  const conValor = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  if (conValor) return conValor.slice(nombre.length + 3);
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : null;
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};

const PARA_QUE = {
  admin: 'Todo el sistema, incluida la Auditoría',
  gerente: 'Operación y Reportes; importar socios',
  coordinador: 'Clases, Torneos, Ludoteca y Sanciones',
  recepcion: 'Visitas, Ludoteca y accesos del día',
  instructor: 'Su agenda y clases de tenis; arbitrar',
  socio: 'Reservar, inscribirse a clases y torneos'
};
const NOMBRE_ROL = {
  admin: 'Administrador',
  gerente: 'Gerente',
  coordinador: 'Coordinador',
  recepcion: 'Recepción',
  instructor: 'Instructor',
  socio: 'Socio'
};

/** Contenido común: bloques { tipo: 'parrafo' | 'titulo' | 'lista' | 'tabla', ... }. */
function contenido({ urlApp, inicio }) {
  const direccion = urlApp || 'por confirmar (se envía cuando quede publicada)';
  const semana = inicio ? `del ${fechaLarga(inicio)} al ${fechaLarga(sumarDias(inicio, 6))}` : 'por confirmar';
  const acciones = new Set(sociosDia1().map((f) => f.Numero_Accion)).size;

  const hoja = {
    archivo: 'hoja-acceso',
    titulo: 'Simulación del sistema del club: hoja de acceso',
    subtitulo: 'Para el Director de Operaciones · sin contraseñas',
    bloques: [
      { tipo: 'tabla', columnas: ['', ''], anchos: [130, 365], filas: [
        ['Dirección', direccion],
        ['Semana de simulación', semana],
        ['Primera carga', 'Puede tardar hasta un minuto: el servidor gratuito se "duerme" si nadie lo usa. Después responde normal.']
      ] },
      { tipo: 'titulo', texto: 'Usuarios (uno por rol)' },
      { tipo: 'tabla', columnas: ['Rol', 'Usuario', 'Para qué sirve'], anchos: [85, 170, 240], filas:
        CUENTAS_ACCESO.map((c) => [NOMBRE_ROL[c.rol], c.username, PARA_QUE[c.rol]]) },
      { tipo: 'titulo', texto: 'Contraseñas' },
      { tipo: 'parrafo', texto: 'Se entregan por separado y en persona. No las escriba en esta hoja ni las comparta por chat o correo. Si una no funciona, avise al equipo de desarrollo: no intente adivinarla.' },
      { tipo: 'titulo', texto: 'Antes de empezar' },
      { tipo: 'lista', items: [
        'Todos los datos son ficticios. No capture datos reales de socios ni de visitas.',
        'Los correos de prueba terminan en .test y no reciben mensajes; la simulación no envía correos.',
        'Nada de lo que haga aquí afecta la operación real del club.',
        'Para cambiar de rol, cierre sesión y entre con el otro usuario.'
      ] },
      { tipo: 'titulo', texto: 'Si algo falla' },
      { tipo: 'parrafo', texto: `Anote el rol, la hora, qué hizo, qué esperaba y qué pasó, con una captura de pantalla, y envíelo al equipo de desarrollo. La guía rápida tiene lo que conviene probar cada día. Datos cargados: ${sociosDia1().length} socios en ${acciones} acciones, ${ESPACIOS.length} instalaciones, ${SESIONES.length} clases semanales y 2 torneos.` }
    ]
  };

  const [copa, padel] = TORNEOS;
  const guia = {
    archivo: 'guia-rapida',
    titulo: 'Simulación del sistema del club: guía rápida',
    subtitulo: `Semana ${semana} · Dirección: ${direccion}`,
    bloques: [
      { tipo: 'titulo', texto: 'Lo que ya está cargado' },
      { tipo: 'lista', items: [
        `${sociosDia1().length} socios en ${acciones} acciones (familiares e individuales), ${INSTRUCTORES.length} instructores, ${ESPACIOS.length} instalaciones y ${SESIONES.length} clases por semana.`,
        `${copa.nombre.replace('SIM ', '')}: inscripciones abiertas, con socios, visitas y un externo.`,
        `${padel.nombre.replace('SIM ', '')}: en curso, una semifinal jugada y otra por jugar.`,
        `Historial de visitas y de ludoteca de los días previos, y ${SANCIONES.length} sanciones (activas y una resuelta).`
      ] },
      { tipo: 'titulo', texto: 'Qué probar, por rol' },
      { tipo: 'tabla', columnas: ['Rol', 'Tareas sugeridas'], anchos: [85, 410], filas: [
        ['Recepción', 'Registrar visitas (con su socio anfitrión) y su salida. Registrar entradas y salidas de la ludoteca. Consultar las clases del día.'],
        ['Socio', 'Reservar una cancha. Inscribirse a una clase (Clases, Catálogo) y a la Copa de Tenis (Torneos). Revisar su Ludoteca y sus Sanciones.'],
        ['Instructor', 'Revisar su Agenda y Mis Clases. Consultar los torneos y las sanciones.'],
        ['Coordinador', 'Torneos: en la Copa de Tenis, inscribir una visita registrada HOY en recepción; luego cerrar inscripciones y confirmar el cuadro. En el torneo de pádel, registrar el resultado de la semifinal pendiente. Revisar Clases y Sanciones.'],
        ['Gerente', `Carga diaria: Socios, Importar, archivo socios-dia3.xlsx (${sociosDia3().length} filas: actualiza 4 socios y da de alta 8). Revisar Reportes.`],
        ['Administrador', 'Gestión de Usuarios, Configuración de Espacios y Auditoría: comprobar que quedan registradas las acciones de la semana.']
      ] },
      { tipo: 'titulo', texto: 'Reglas que conviene observar' },
      { tipo: 'lista', items: [
        'Una visita solo se puede inscribir en un torneo el mismo día en que se registró en recepción.',
        'Una estancia de más de 2 horas en la ludoteca genera una sanción al socio.',
        'Un torneo necesita al menos 4 participantes para realizarse.',
        'El archivo de socios se importa completo o nada: si una fila tiene un error, el sistema muestra el reporte y no guarda ninguna.'
      ] },
      { tipo: 'titulo', texto: 'Al terminar cada día' },
      { tipo: 'parrafo', texto: 'Envíe al equipo de desarrollo lo que encontró (rol, hora, qué hizo, qué esperaba y qué pasó, con captura). Las contraseñas no van en ningún reporte.' }
    ]
  };
  return [hoja, guia];
}

// ── Markdown ─────────────────────────────────────────────────────────────────

function aMarkdown(doc) {
  const lineas = [`# ${doc.titulo}`, '', `*${doc.subtitulo}*`, ''];
  for (const b of doc.bloques) {
    if (b.tipo === 'titulo') lineas.push(`## ${b.texto}`, '');
    if (b.tipo === 'parrafo') lineas.push(b.texto, '');
    if (b.tipo === 'lista') lineas.push(...b.items.map((i) => `- ${i}`), '');
    if (b.tipo === 'tabla') {
      const encabezado = b.columnas.every((c) => !c) ? ['Dato', 'Valor'] : b.columnas;
      lineas.push(`| ${encabezado.join(' | ')} |`, `|${encabezado.map(() => '---').join('|')}|`);
      b.filas.forEach((f) => lineas.push(`| ${f.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`));
      lineas.push('');
    }
  }
  return `${lineas.join('\n').trim()}\n`;
}

// ── PDF de una página ────────────────────────────────────────────────────────

const AZUL = '#1e3a5f';
const GRIS = '#555555';

function aPdf(doc) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margins: { top: 48, bottom: 40, left: 58, right: 58 }, bufferPages: true });
    const partes = [];
    pdf.on('data', (p) => partes.push(p));
    pdf.on('error', reject);
    pdf.on('end', () => resolve({ buffer: Buffer.concat(partes), paginas: paginas }));
    const x0 = pdf.page.margins.left;
    const ancho = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;

    pdf.font('Helvetica-Bold').fontSize(16).fillColor(AZUL).text(doc.titulo, { width: ancho });
    pdf.moveDown(0.2).font('Helvetica').fontSize(9.5).fillColor(GRIS).text(doc.subtitulo, { width: ancho });
    pdf.moveDown(0.6);

    for (const b of doc.bloques) {
      if (b.tipo === 'titulo') {
        pdf.moveDown(0.4).font('Helvetica-Bold').fontSize(11.5).fillColor(AZUL).text(b.texto, x0, pdf.y, { width: ancho });
        pdf.moveDown(0.25);
      }
      if (b.tipo === 'parrafo') {
        pdf.font('Helvetica').fontSize(9.5).fillColor('black').text(b.texto, x0, pdf.y, { width: ancho, lineGap: 1.5 });
        pdf.moveDown(0.2);
      }
      if (b.tipo === 'lista') {
        for (const item of b.items) {
          pdf.font('Helvetica').fontSize(9.5).fillColor('black').text(`•  ${item}`, x0 + 6, pdf.y, { width: ancho - 6, lineGap: 1.5, indent: 0 });
          pdf.moveDown(0.15);
        }
      }
      if (b.tipo === 'tabla') {
        const conEncabezado = b.columnas.some(Boolean);
        const filas = conEncabezado ? [b.columnas, ...b.filas] : b.filas;
        filas.forEach((fila, i) => {
          const esEncabezado = conEncabezado && i === 0;
          const fuente = (j) => (esEncabezado || (!conEncabezado && j === 0) ? 'Helvetica-Bold' : 'Helvetica');
          const alto = Math.max(...fila.map((c, j) => pdf.font(fuente(j)).fontSize(9).heightOfString(String(c), { width: b.anchos[j] - 10 }))) + 8;
          const y = pdf.y;
          if (esEncabezado) pdf.rect(x0, y, ancho, alto).fill('#dbeafe');
          else pdf.moveTo(x0, y + alto).lineTo(x0 + ancho, y + alto).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
          let x = x0;
          fila.forEach((celda, j) => {
            pdf.font(fuente(j)).fontSize(9).fillColor(esEncabezado ? AZUL : 'black').text(String(celda), x + 5, y + 4, { width: b.anchos[j] - 10 });
            x += b.anchos[j];
          });
          pdf.y = y + alto;
        });
        pdf.x = x0;
        pdf.moveDown(0.3);
      }
    }
    // El pie va debajo del margen inferior: sin margen, pdfkit no abre otra página para él
    const margenInferior = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf.font('Helvetica').fontSize(8).fillColor(GRIS)
      .text('Simulación U5-07 · datos ficticios · documento sin contraseñas', x0, pdf.page.height - 32, { width: ancho, align: 'center', lineBreak: false });
    pdf.page.margins.bottom = margenInferior;
    const paginas = pdf.bufferedPageRange().count;
    pdf.end();
  });
}

async function main() {
  const urlApp = arg('url-app');
  const inicio = arg('inicio');
  if (inicio && !/^\d{4}-\d{2}-\d{2}$/.test(inicio)) throw new Error('--inicio debe tener el formato YYYY-MM-DD');
  if (urlApp && !/^https:\/\//.test(urlApp)) throw new Error('--url-app debe empezar con https://');
  const salida = path.resolve(arg('salida') || path.join(__dirname, '..', '..', 'docs', 'simulacion'));
  fs.mkdirSync(salida, { recursive: true });

  let fallas = 0;
  for (const doc of contenido({ urlApp, inicio })) {
    fs.writeFileSync(path.join(salida, `${doc.archivo}.md`), aMarkdown(doc));
    const { buffer, paginas } = await aPdf(doc);
    fs.writeFileSync(path.join(salida, `${doc.archivo}.pdf`), buffer);
    console.log(`${doc.archivo}: .md y .pdf (${paginas} página${paginas === 1 ? '' : 's'})`);
    if (paginas !== 1) fallas++;
  }
  if (fallas) throw new Error('Algún PDF ocupa más de una página: acorta el contenido');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`✘ ${error.message}`);
    process.exit(1);
  });
}

module.exports = { contenido, aMarkdown, aPdf };
