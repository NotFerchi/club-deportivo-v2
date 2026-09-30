const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const ServiceError = require('./serviceError');
const { isEscalated } = require('./escalate');
const { enTransaccion } = require('./transaction');

// ── SCRUM-134: template ──────────────────────────────────────────────────────

const COLUMNAS_TEMPLATE = [
  { header: 'Numero_Accion', key: 'Numero_Accion', width: 15 },
  { header: 'Tipo_Accion', key: 'Tipo_Accion', width: 15 },
  { header: 'Estatus_Accion', key: 'Estatus_Accion', width: 16 },
  { header: 'Rol', key: 'Rol', width: 12 },
  { header: 'Nombre_Completo', key: 'Nombre_Completo', width: 30 },
  { header: 'Genero', key: 'Genero', width: 12 },
  { header: 'Fecha_Nacimiento', key: 'Fecha_Nacimiento', width: 18 },
  { header: 'Parentesco', key: 'Parentesco', width: 15 },
  { header: 'Domicilio', key: 'Domicilio', width: 35 },
  { header: 'Email', key: 'Email', width: 30 },
  { header: 'Telefono_Celular', key: 'Telefono_Celular', width: 18 },
  { header: 'Telefono_Particular', key: 'Telefono_Particular', width: 18 }
];

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

  const hoja = workbook.addWorksheet('Datos');
  hoja.columns = COLUMNAS_TEMPLATE;

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

// ── SCRUM-135: lectura del Excel ─────────────────────────────────────────────

function normalizarNombre(nombreCompleto) {
  const partes = (nombreCompleto || '').trim().split(/\s+/);
  if (partes.length === 1) return { nombres: partes[0], apellido_paterno: '', apellido_materno: '' };
  if (partes.length === 2) return { nombres: partes[0], apellido_paterno: partes[1], apellido_materno: '' };
  return {
    nombres: partes.slice(0, partes.length - 2).join(' '),
    apellido_paterno: partes[partes.length - 2],
    apellido_materno: partes[partes.length - 1]
  };
}

function parsearFecha(valor) {
  if (!valor) return null;
  if (typeof valor === 'number') {
    const fecha = new Date(Math.round((valor - 25569) * 86400 * 1000));
    return fecha.toISOString().split('T')[0];
  }
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().split('T')[0];
  }
  const str = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

/** Filas de la primera hoja como objetos { header: valor }; omite filas vacías. */
async function leerFilasExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const hoja = workbook.worksheets[0];
  if (!hoja) return [];

  const encabezados = [];
  hoja.getRow(1).eachCell((cell, colNumber) => {
    encabezados[colNumber] = String(cell.value || '').trim();
  });

  const filas = [];
  hoja.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const fila = {};
    let tieneDato = false;

    encabezados.forEach((header, colNumber) => {
      if (!header) return;
      const cellValue = row.getCell(colNumber).value;
      const value =
        cellValue && typeof cellValue === 'object' && Object.prototype.hasOwnProperty.call(cellValue, 'result')
          ? cellValue.result
          : cellValue;
      const normalizado = value ?? '';
      if (normalizado !== '') tieneDato = true;
      fila[header] = normalizado;
    });

    if (tieneDato) filas.push(fila);
  });

  return filas;
}

/** Mensaje de error si faltan filas o columnas mínimas; null si el archivo es utilizable. */
function validarFilas(filas) {
  if (filas.length === 0) return 'El archivo no tiene filas de datos';

  const columnasMinimas = ['Numero_Accion', 'Rol', 'Nombre_Completo', 'Email'];
  const columnas = Object.keys(filas[0]);
  const faltantes = columnasMinimas.filter((c) => !columnas.includes(c));
  if (faltantes.length > 0) return `Faltan columnas requeridas: ${faltantes.join(', ')}`;

  return null;
}

// ── SCRUM-135: sincronización ────────────────────────────────────────────────

/**
 * Errores por email repetido en el archivo y el conjunto de emails a omitir.
 * El conjunto se extrae del texto del mensaje con la misma regex del original
 * (un email con espacios internos queda truncado y esas filas no se omiten).
 */
function detectarEmailsDuplicados(filas) {
  const emailsVistos = new Map();
  const errores = [];
  filas.forEach((fila, i) => {
    const email = (fila.Email || '').trim().toLowerCase();
    if (!email) return;
    if (emailsVistos.has(email)) {
      errores.push({
        fila: i + 2,
        motivo: `Email duplicado en el archivo: ${email} (ya aparece en fila ${emailsVistos.get(email)})`
      });
    } else {
      emailsVistos.set(email, i + 2);
    }
  });
  const emails = new Set(
    errores
      .map((e) => {
        const match = e.motivo.match(/Email duplicado en el archivo: ([^\s]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
  );
  return { errores, emails };
}

function datosDeFila(fila) {
  const esTitular =
    String(fila.Rol || '')
      .trim()
      .toLowerCase() === 'titular';
  return {
    codigoAccion: String(fila.Numero_Accion || '').trim(),
    email: (fila.Email || '').trim().toLowerCase(),
    esTitular,
    modalidad: String(fila.Tipo_Accion || 'Individual').trim(),
    tipo: fila.Estatus_Accion === 'Propia' ? 'Accionista' : 'Rentista',
    ...normalizarNombre(fila.Nombre_Completo),
    genero: fila.Genero || null,
    fechaNac: parsearFecha(fila.Fecha_Nacimiento),
    telefono: String(fila.Telefono_Celular || '').trim() || null,
    telEmerg: String(fila.Telefono_Particular || '').trim() || null,
    domicilio: String(fila.Domicilio || '').trim() || null,
    parentesco: String(fila.Parentesco || '').trim() || null
  };
}

/**
 * Inserta usuario (contraseña temporal Club<acción><año>) y socio en la acción.
 * contarMiembros(client) devuelve cuántos miembros no titulares hay para
 * numerar al nuevo (SOC-<acción>-M<n>); el titular es SOC-<acción>-T.
 */
async function crearUsuarioYSocio(client, d, accionId, rolSocioId, contarMiembros) {
  const passwordTemporal = `Club${d.codigoAccion}${new Date().getFullYear()}`;
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  const nuevoUsuario = await client.query(
    `INSERT INTO usuarios (username, password_hash, rol_id,
      nombres, apellido_paterno, apellido_materno, genero, fecha_nacimiento,
      telefono, direccion, curp)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
     RETURNING usuario_id`,
    [
      d.email,
      passwordHash,
      rolSocioId,
      d.nombres,
      d.apellido_paterno,
      d.apellido_materno,
      d.genero,
      d.fechaNac,
      d.telefono,
      d.domicilio
    ]
  );
  const usuarioId = nuevoUsuario.rows[0].usuario_id;

  const idx = (await contarMiembros(client)) + 1;
  const numeroSocio = d.esTitular ? `SOC-${d.codigoAccion}-T` : `SOC-${d.codigoAccion}-M${idx}`;

  await client.query(
    `INSERT INTO socios (usuario_id, accion_id, tipo, modalidad,
      es_titular, numero_socio, tel_emergencia, parentesco, activo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)`,
    [usuarioId, accionId, d.tipo, d.modalidad, d.esTitular, numeroSocio, d.telEmerg, d.parentesco]
  );
}

/** Procesa una fila válida. Devuelve 'nuevo' o 'actualizado'. */
async function sincronizarFila(client, d, rolSocioId) {
  const accionRes = await client.query('SELECT accion_id FROM acciones_familiares WHERE codigo_accion = $1', [
    d.codigoAccion
  ]);

  if (accionRes.rowCount > 0) {
    const accionId = accionRes.rows[0].accion_id;
    const usuarioRes = await client.query(
      'SELECT u.usuario_id FROM usuarios u JOIN socios s ON s.usuario_id = u.usuario_id WHERE u.username = $1 AND s.accion_id = $2 LIMIT 1',
      [d.email, accionId]
    );

    if (usuarioRes.rowCount > 0) {
      // Usuario ya existe en la acción → actualizar datos
      const usuarioId = usuarioRes.rows[0].usuario_id;
      await client.query(
        `UPDATE usuarios SET nombres=$1, apellido_paterno=$2, apellido_materno=$3,
         genero=$4, fecha_nacimiento=$5, telefono=$6, direccion=$7
         WHERE usuario_id=$8`,
        [d.nombres, d.apellido_paterno, d.apellido_materno, d.genero, d.fechaNac, d.telefono, d.domicilio, usuarioId]
      );
      await client.query(
        `UPDATE socios SET tipo=$1, modalidad=$2, es_titular=$3, tel_emergencia=$4, parentesco=$5
         WHERE usuario_id=$6`,
        [d.tipo, d.modalidad, d.esTitular, d.telEmerg, d.parentesco, usuarioId]
      );
      return 'actualizado';
    }

    // Acción existe pero este miembro es nuevo
    await crearUsuarioYSocio(client, d, accionId, rolSocioId, async (c) => {
      const countRes = await c.query(
        `SELECT COUNT(*) FROM socios s
         WHERE s.accion_id = $1 AND s.es_titular = FALSE`,
        [accionId]
      );
      return Number(countRes.rows[0].count);
    });
    return 'nuevo';
  }

  // Acción nueva (si otra fila la creó antes, ON CONFLICT la reutiliza)
  const nuevaAccion = await client.query(
    'INSERT INTO acciones_familiares (codigo_accion) VALUES ($1) ON CONFLICT (codigo_accion) DO NOTHING RETURNING accion_id',
    [d.codigoAccion]
  );
  const accionId =
    nuevaAccion.rowCount > 0
      ? nuevaAccion.rows[0].accion_id
      : (await client.query('SELECT accion_id FROM acciones_familiares WHERE codigo_accion=$1', [d.codigoAccion]))
          .rows[0].accion_id;

  await crearUsuarioYSocio(client, d, accionId, rolSocioId, async (c) => {
    const countRes = await c.query(
      `SELECT COUNT(*) FROM socios s
       JOIN acciones_familiares af ON s.accion_id = af.accion_id
       WHERE af.codigo_accion = $1 AND s.es_titular = FALSE`,
      [d.codigoAccion]
    );
    return Number(countRes.rows[0].count);
  });
  return 'nuevo';
}

/**
 * Sincroniza las filas en una transacción con un savepoint por fila: una fila
 * que falla se revierte y se reporta sin detener el resto.
 * Devuelve { nuevos, actualizados, errores }; un fallo de la transacción es
 * ServiceError 500 'Error en la transacción: …'.
 */
async function importarFilas(filas) {
  const duplicados = detectarEmailsDuplicados(filas);
  const errores = [...duplicados.errores];
  let nuevos = 0;
  let actualizados = 0;

  try {
    await enTransaccion(async (client) => {
      const rolRes = await client.query("SELECT rol_id FROM roles WHERE nombre = 'socio' LIMIT 1");
      if (rolRes.rowCount === 0) throw new Error('Rol socio no encontrado en la BD');
      const rolSocioId = rolRes.rows[0].rol_id;

      for (let i = 0; i < filas.length; i++) {
        const numFila = i + 2;
        const d = datosDeFila(filas[i]);

        if (!d.codigoAccion) {
          errores.push({ fila: numFila, motivo: 'Numero_Accion vacío' });
          continue;
        }
        if (!d.email) {
          errores.push({ fila: numFila, motivo: 'Email vacío' });
          continue;
        }
        if (duplicados.emails.has(d.email)) continue; // ya reportado

        try {
          await client.query('SAVEPOINT sp_fila');
          const resultado = await sincronizarFila(client, d, rolSocioId);
          if (resultado === 'nuevo') nuevos++;
          else actualizados++;
          await client.query('RELEASE SAVEPOINT sp_fila');
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT sp_fila');
          errores.push({ fila: numFila, motivo: err.message });
        }
      }
    });
  } catch (err) {
    if (isEscalated(err)) throw err;
    throw new ServiceError(500, { error: 'Error en la transacción: ' + err.message });
  }

  return { nuevos, actualizados, errores };
}

module.exports = { crearTemplateSocios, leerFilasExcel, validarFilas, importarFilas };
