/**
 * Catálogo único de columnas del Excel de socios. Lo usan la plantilla
 * descargable (nombre, ancho) y el parser de importación (nombre, alias,
 * obligatoria). Los encabezados se comparan normalizados (sin acentos,
 * mayúsculas ni separadores), así que 'Número Acción' equivale a 'Numero_Accion'.
 */
const COLUMNAS_SOCIOS = [
  { nombre: 'Numero_Accion', ancho: 15, obligatoria: true, alias: ['accion', 'no_accion', 'num_accion'] },
  { nombre: 'Tipo_Accion', ancho: 15, obligatoria: true, alias: ['modalidad'] },
  { nombre: 'Estatus_Accion', ancho: 16, obligatoria: true, alias: ['estado_accion'] },
  { nombre: 'Rol', ancho: 12, obligatoria: true, alias: [] },
  { nombre: 'Nombre_Completo', ancho: 30, obligatoria: true, alias: ['nombre'] },
  { nombre: 'Genero', ancho: 12, obligatoria: false, alias: ['sexo'] },
  { nombre: 'Fecha_Nacimiento', ancho: 18, obligatoria: false, alias: ['fecha_de_nacimiento'] },
  { nombre: 'Parentesco', ancho: 15, obligatoria: false, alias: [] },
  { nombre: 'Domicilio', ancho: 35, obligatoria: false, alias: ['direccion'] },
  { nombre: 'Email', ancho: 30, obligatoria: true, alias: ['correo', 'correo_electronico', 'e_mail'] },
  { nombre: 'Telefono_Celular', ancho: 18, obligatoria: false, alias: ['celular'] },
  { nombre: 'Telefono_Particular', ancho: 18, obligatoria: false, alias: ['telefono_emergencia'] }
];

/** Hoja de datos que se busca primero al importar (la de la plantilla). */
const HOJA_DATOS = 'Datos';

/** Límite de filas por archivo para no bloquear el servidor. */
const MAX_FILAS = 5000;

module.exports = { COLUMNAS_SOCIOS, HOJA_DATOS, MAX_FILAS };
