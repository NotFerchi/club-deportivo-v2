// Genera los Excel de socios de la simulación (U5-07) y los valida con el importador real, sin tocar la BD:
//
//   node scripts/generarExcelSocios.js [--salida <carpeta>]      (por defecto docs/simulacion)
//
//  - socios-dia1.xlsx: 54 filas (20 acciones). La semilla (semillaSimulacion.js) lo importa.
//  - socios-dia3.xlsx: 12 filas, la carga diaria que sube el Director durante la semana.
// Cada archivo se vuelve a leer con leerHojaExcel y pasa por validarEstructura + validarRegistros, las
// mismas funciones de POST /api/importacion/socios. Además se revisa que el día 3, aplicado después del
// día 1, no choque en la BD: email en otra acción o un segundo titular (numero_socio SOC-<acción>-T).
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { leerHojaExcel } = require('../src/helpers/excel.helper');
const { COLUMNAS_SOCIOS, HOJA_DATOS } = require('../src/services/importacion/columnasSocios');
const { validarEstructura, validarRegistros } = require('../src/services/importacion/validacionSocios');
const { sociosDia1, sociosDia3 } = require('./simulacion/sociosSimulacion');

/** .xlsx con la hoja "Datos" y el mismo formato de encabezado que la plantilla del importador. */
async function crearLibro(filas) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(HOJA_DATOS);
  hoja.columns = COLUMNAS_SOCIOS.map((c) => ({ header: c.nombre, key: c.nombre, width: c.ancho }));
  hoja.getRow(1).eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FF1e3a5f' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFbfdbfe' } };
  });
  filas.forEach((fila) => hoja.addRow(fila));
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** Lo mismo que hace el importador antes de tocar la BD. Devuelve { registros, errores }. */
async function validarConImportador(buffer) {
  const estructura = validarEstructura(await leerHojaExcel(buffer, HOJA_DATOS));
  if (estructura.error) return { registros: [], errores: [estructura.error] };
  return validarRegistros(estructura.filas);
}

/**
 * Qué haría sincronizarFila con el día 3 después del día 1 (importacionService.js): 'actualizado' si el
 * email ya está en esa acción, 'nuevo' si no. Errores si el email ya está en otra acción (23505 en
 * usuarios.username) o si llega un titular para una acción que ya tiene uno (23505 en numero_socio).
 */
function clasificarDia3(dia1, dia3) {
  const accionDeEmail = new Map(dia1.map((f) => [f.Email, f.Numero_Accion]));
  const accionesConTitular = new Set(dia1.filter((f) => f.Rol === 'Titular').map((f) => f.Numero_Accion));
  const resultado = { actualizados: 0, nuevos: 0, errores: [] };
  dia3.forEach((fila, i) => {
    const accionPrevia = accionDeEmail.get(fila.Email);
    if (accionPrevia === fila.Numero_Accion) {
      resultado.actualizados++;
      return;
    }
    if (accionPrevia) resultado.errores.push(`fila ${i + 2}: ${fila.Email} ya está en la acción ${accionPrevia}`);
    else if (fila.Rol === 'Titular' && accionesConTitular.has(fila.Numero_Accion)) {
      resultado.errores.push(`fila ${i + 2}: la acción ${fila.Numero_Accion} ya tiene titular`);
    } else resultado.nuevos++;
  });
  return resultado;
}

async function main() {
  const i = process.argv.indexOf('--salida');
  const salida = path.resolve(i > 0 ? process.argv[i + 1] : path.join(__dirname, '..', '..', 'docs', 'simulacion'));
  fs.mkdirSync(salida, { recursive: true });

  const dia1 = sociosDia1();
  const dia3 = sociosDia3();
  let fallas = 0;
  for (const [nombre, filas] of [['socios-dia1.xlsx', dia1], ['socios-dia3.xlsx', dia3]]) {
    const buffer = await crearLibro(filas);
    const { registros, errores } = await validarConImportador(buffer);
    const dominios = new Set(filas.map((f) => f.Email.split('@')[1]));
    console.log(`${nombre}: ${filas.length} filas · ${registros.length} válidas para el importador · dominios ${[...dominios].join(', ')}`);
    if (errores.length > 0) {
      fallas++;
      errores.forEach((e) => console.log('  ✘', JSON.stringify(e)));
      continue;
    }
    fs.writeFileSync(path.join(salida, nombre), buffer);
  }
  const dia3EnBd = clasificarDia3(dia1, dia3);
  console.log(`día 3 después del día 1: ${dia3EnBd.actualizados} actualizados, ${dia3EnBd.nuevos} nuevos`);
  dia3EnBd.errores.forEach((e) => console.log('  ✘', e));
  if (fallas > 0 || dia3EnBd.errores.length > 0) process.exit(1);
  console.log(`Archivos en ${path.relative(process.cwd(), salida) || '.'}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { crearLibro, validarConImportador, clasificarDia3 };
