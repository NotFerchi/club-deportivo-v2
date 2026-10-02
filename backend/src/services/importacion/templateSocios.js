const ExcelJS = require('exceljs');
const { COLUMNAS_SOCIOS, HOJA_DATOS } = require('./columnasSocios');

// ── SCRUM-134: plantilla descargable ─────────────────────────────────────────

const EJEMPLOS_TEMPLATE = [
  {
    Numero_Accion: '1013',
    Tipo_Accion: 'Familiar',
    Estatus_Accion: 'Propia',
    Rol: 'Titular',
    Nombre_Completo: 'Carlos Mendoza Ruiz',
    Genero: 'Masculino',
    Fecha_Nacimiento: '1975-04-12',
    Parentesco: '',
    Domicilio: 'Av. Acueducto 123, Morelia',
    Email: 'carlos.mendoza@gmail.com',
    Telefono_Celular: '4431234567',
    Telefono_Particular: '4439876543'
  },
  {
    Numero_Accion: '1013',
    Tipo_Accion: 'Familiar',
    Estatus_Accion: 'Propia',
    Rol: 'Miembro',
    Nombre_Completo: 'Ana López de Mendoza',
    Genero: 'Femenino',
    Fecha_Nacimiento: '1978-09-25',
    Parentesco: 'Esposa',
    Domicilio: 'Av. Acueducto 123, Morelia',
    Email: 'ana.lopez@gmail.com',
    Telefono_Celular: '4437654321',
    Telefono_Particular: ''
  },
  {
    Numero_Accion: '2047',
    Tipo_Accion: 'Individual',
    Estatus_Accion: 'Rentada',
    Rol: 'Titular',
    Nombre_Completo: 'Sandra Torres Sánchez',
    Genero: 'Femenino',
    Fecha_Nacimiento: '1990-11-03',
    Parentesco: '',
    Domicilio: 'Calle Hidalgo 88, Morelia',
    Email: 'sandra.torres@outlook.com',
    Telefono_Celular: '4439998877',
    Telefono_Particular: ''
  }
];

const GUIA_TEMPLATE = [
  ['Numero_Accion', 'Número de la acción familiar. Socios de la misma familia comparten este número.'],
  ['Tipo_Accion', 'Individual | Familiar'],
  ['Estatus_Accion', 'Propia | Rentada'],
  ['Rol', 'Titular | Miembro'],
  ['Nombre_Completo', 'Nombre completo en un campo. Ej: María García López'],
  ['Genero', 'Masculino | Femenino'],
  ['Fecha_Nacimiento', 'Formato YYYY-MM-DD. Ej: 1985-03-22'],
  ['Parentesco', 'Solo Miembros: Esposo/a | Hijo/a. Vacío para Titular.'],
  ['Email', 'Se usará para generar el username de acceso al sistema'],
  ['Telefono_Celular', '10 dígitos sin guiones ni espacios'],
  ['Telefono_Particular', 'Se usa como teléfono de emergencia']
];

/** Workbook de la plantilla: hoja "Datos" (headers + 3 ejemplos) e "Instrucciones". */
function crearTemplateSocios() {
  const workbook = new ExcelJS.Workbook();

  const hoja = workbook.addWorksheet(HOJA_DATOS);
  hoja.columns = COLUMNAS_SOCIOS.map((c) => ({ header: c.nombre, key: c.nombre, width: c.ancho }));

  // Estilo headers — negrita con fondo azul claro
  hoja.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF1e3a5f' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFbfdbfe' } };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  EJEMPLOS_TEMPLATE.forEach((e) => hoja.addRow(e));

  const instrucciones = workbook.addWorksheet('Instrucciones');
  instrucciones.columns = [
    { key: 'campo', width: 22 },
    { key: 'descripcion', width: 80 }
  ];
  instrucciones.addRow({ campo: 'Campo', descripcion: 'Descripción' });
  instrucciones.getRow(1).font = { bold: true };
  GUIA_TEMPLATE.forEach(([campo, descripcion]) => instrucciones.addRow({ campo, descripcion }));

  return workbook;
}

module.exports = { crearTemplateSocios };
