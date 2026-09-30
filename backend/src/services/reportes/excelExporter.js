// Helpers de Excel compartidos por los reportes (libro, estilos y envío).
const ExcelJS = require('exceljs');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Club Deportivo';
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

function styleWorksheet(worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A5F' } },
      bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
      left: { style: 'thin', color: { argb: 'FF2D4A6B' } },
      right: { style: 'thin', color: { argb: 'FF2D4A6B' } }
    };
  });

  const rowCount = worksheet.rowCount;
  for (let i = 2; i <= rowCount; i++) {
    const row = worksheet.getRow(i);
    row.height = 18;
    const isEven = i % 2 === 0;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFF1F5F9' : 'FFFFFFFF' }
      };
      cell.font = { size: 10, color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        left: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        right: { style: 'hair', color: { argb: 'FFE2E8F0' } }
      };
    });
  }

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  if (worksheet.columnCount > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columnCount }
    };
  }
}

function setDateFormat(column) {
  column.eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;
    cell.numFmt = 'yyyy-mm-dd';
  });
}

function setPercentageFormat(column) {
  column.eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;
    cell.numFmt = '0.00%';
  });
}

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { createWorkbook, styleWorksheet, setDateFormat, setPercentageFormat, sendWorkbook };
