const ExcelJS = require('exceljs');

/**
 * Valor "plano" de una celda de ExcelJS: fórmulas → su resultado, hipervínculos
 * (Excel convierte los emails en links) → su texto, rich text → texto unido,
 * errores (#N/A, #REF!) y vacíos → ''. Number, Date y boolean se devuelven tal cual.
 */
function valorCelda(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor;
  if (typeof valor !== 'object') return valor;
  if (Array.isArray(valor.richText)) return valor.richText.map((t) => t.text).join('');
  if ('result' in valor) return valorCelda(valor.result);
  if ('text' in valor) return valorCelda(valor.text);
  return '';
}

/** Texto saneado: sin espacios al inicio/fin ni espacios repetidos. Date → YYYY-MM-DD. */
function textoCelda(valor) {
  const plano = valorCelda(valor);
  if (plano instanceof Date) return Number.isNaN(plano.getTime()) ? '' : plano.toISOString().slice(0, 10);
  return String(plano).replace(/\s+/g, ' ').trim();
}

/** Clave comparable: sin acentos, minúsculas y separadores unificados ('Número Acción' → 'numero_accion'). */
function normalizarClave(valor) {
  return textoCelda(valor)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s\-.]+/g, '_');
}

/**
 * Lee la hoja `nombreHoja` (o la primera si no existe) de un .xlsx.
 * Devuelve { encabezados, filas }:
 *  - encabezados: [{ columna, texto }] de la fila 1 (sin celdas vacías)
 *  - filas: [{ numFila, celdas }] con celdas[columna] = valor plano; omite filas vacías
 * Lanza si el buffer no es un .xlsx válido.
 */
async function leerHojaExcel(buffer, nombreHoja) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const hoja = workbook.getWorksheet(nombreHoja) || workbook.worksheets[0];
  if (!hoja) return { encabezados: [], filas: [] };

  const encabezados = [];
  hoja.getRow(1).eachCell((cell, columna) => {
    const texto = textoCelda(cell.value);
    if (texto) encabezados.push({ columna, texto });
  });

  const filas = [];
  hoja.eachRow((row, numFila) => {
    if (numFila === 1) return;
    const celdas = [];
    let tieneDato = false;
    encabezados.forEach(({ columna }) => {
      const valor = valorCelda(row.getCell(columna).value);
      celdas[columna] = valor;
      if (textoCelda(valor) !== '') tieneDato = true;
    });
    if (tieneDato) filas.push({ numFila, celdas });
  });

  return { encabezados, filas };
}

module.exports = { valorCelda, textoCelda, normalizarClave, leerHojaExcel };
