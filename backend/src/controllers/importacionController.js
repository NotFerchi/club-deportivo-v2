const ExcelJS = require('exceljs');
const bcrypt  = require('bcryptjs');
const pool    = require('../config/database');

// ── SCRUM-134: GET /api/importacion/template ─────────────────────────────────
const descargarTemplate = async (req, res) => {
  const tipo = req.query.tipo;
  if (tipo && tipo !== 'socios') {
    return res.status(400).json({ error: `Tipo '${tipo}' no válido. Usa ?tipo=socios` });
  }

  const workbook = new ExcelJS.Workbook();

  // ── Hoja 1: Datos ──
  const hoja = workbook.addWorksheet('Datos');

  const columnas = [
    { header: 'Numero_Accion',       key: 'Numero_Accion',       width: 15 },
    { header: 'Tipo_Accion',         key: 'Tipo_Accion',         width: 15 },
    { header: 'Estatus_Accion',      key: 'Estatus_Accion',      width: 16 },
    { header: 'Rol',                 key: 'Rol',                 width: 12 },
    { header: 'Nombre_Completo',     key: 'Nombre_Completo',     width: 30 },
    { header: 'Genero',              key: 'Genero',              width: 12 },
    { header: 'Fecha_Nacimiento',    key: 'Fecha_Nacimiento',    width: 18 },
    { header: 'Parentesco',          key: 'Parentesco',          width: 15 },
    { header: 'Domicilio',           key: 'Domicilio',           width: 35 },
    { header: 'Email',               key: 'Email',               width: 30 },
    { header: 'Telefono_Celular',    key: 'Telefono_Celular',    width: 18 },
    { header: 'Telefono_Particular', key: 'Telefono_Particular', width: 18 },
  ];

  hoja.columns = columnas;

  // Estilo headers — negrita con fondo azul claro
  hoja.getRow(1).eachCell(cell => {
    cell.font       = { bold: true, color: { argb: 'FF1e3a5f' } };
    cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFbfdbfe' } };
    cell.border     = {
      top:    { style: 'thin' }, bottom: { style: 'thin' },
      left:   { style: 'thin' }, right:  { style: 'thin' }
    };
    cell.alignment  = { horizontal: 'center', vertical: 'middle' };
  });

  // 3 filas de ejemplo
  const ejemplos = [
    { Numero_Accion: '1013', Tipo_Accion: 'Familiar',   Estatus_Accion: 'Propia',  Rol: 'Titular',
      Nombre_Completo: 'Carlos Mendoza Ruiz',    Genero: 'Masculino', Fecha_Nacimiento: '1975-04-12',
      Parentesco: '',          Domicilio: 'Av. Acueducto 123, Morelia', Email: 'carlos.mendoza@gmail.com',
      Telefono_Celular: '4431234567', Telefono_Particular: '4439876543' },
    { Numero_Accion: '1013', Tipo_Accion: 'Familiar',   Estatus_Accion: 'Propia',  Rol: 'Miembro',
      Nombre_Completo: 'Ana López de Mendoza',   Genero: 'Femenino',  Fecha_Nacimiento: '1978-09-25',
      Parentesco: 'Esposa',    Domicilio: 'Av. Acueducto 123, Morelia', Email: 'ana.lopez@gmail.com',
      Telefono_Celular: '4437654321', Telefono_Particular: '' },
    { Numero_Accion: '2047', Tipo_Accion: 'Individual', Estatus_Accion: 'Rentada', Rol: 'Titular',
      Nombre_Completo: 'Sandra Torres Sánchez',  Genero: 'Femenino',  Fecha_Nacimiento: '1990-11-03',
      Parentesco: '',          Domicilio: 'Calle Hidalgo 88, Morelia',  Email: 'sandra.torres@outlook.com',
      Telefono_Celular: '4439998877', Telefono_Particular: '' },
  ];

  ejemplos.forEach(e => hoja.addRow(e));

  // ── Hoja 2: Instrucciones ──
  const instrucciones = workbook.addWorksheet('Instrucciones');
  instrucciones.columns = [
    { key: 'campo',       width: 22 },
    { key: 'descripcion', width: 80 },
  ];
  instrucciones.addRow({ campo: 'Campo', descripcion: 'Descripción' });
  instrucciones.getRow(1).font = { bold: true };

  const guia = [
    ['Numero_Accion',       'Número de la acción familiar. Socios de la misma familia comparten este número.'],
    ['Tipo_Accion',         'Individual | Familiar'],
    ['Estatus_Accion',      'Propia | Rentada'],
    ['Rol',                 'Titular | Miembro'],
    ['Nombre_Completo',     'Nombre completo en un campo. Ej: María García López'],
    ['Genero',              'Masculino | Femenino'],
    ['Fecha_Nacimiento',    'Formato YYYY-MM-DD. Ej: 1985-03-22'],
    ['Parentesco',          'Solo Miembros: Esposo/a | Hijo/a. Vacío para Titular.'],
    ['Email',               'Se usará para generar el username de acceso al sistema'],
    ['Telefono_Celular',    '10 dígitos sin guiones ni espacios'],
    ['Telefono_Particular', 'Se usa como teléfono de emergencia'],
  ];

  guia.forEach(([campo, descripcion]) => instrucciones.addRow({ campo, descripcion }));

  res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="template_socios.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
};

// ── Helpers SCRUM-135 ────────────────────────────────────────────────────────
function normalizarNombre(nombreCompleto) {
  const partes = (nombreCompleto || '').trim().split(/\s+/);
  if (partes.length === 1) return { nombres: partes[0], apellido_paterno: '', apellido_materno: '' };
  if (partes.length === 2) return { nombres: partes[0], apellido_paterno: partes[1], apellido_materno: '' };
  return {
    nombres:          partes.slice(0, partes.length - 2).join(' '),
    apellido_paterno: partes[partes.length - 2],
    apellido_materno: partes[partes.length - 1],
  };
}

function normalizarUsername(email) {
  return (email || '').split('@')[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
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

async function leerFilasExcelDesdeBuffer(buffer) {
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
      const value = cellValue && typeof cellValue === 'object' && Object.prototype.hasOwnProperty.call(cellValue, 'result')
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

// ── SCRUM-135: POST /api/importacion/socios ──────────────────────────────────
const importarSocios = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Se requiere un archivo .xlsx (field: archivo)' });
  }

  // FASE 1 — Parsear
  let filas;
  try {
    filas = await leerFilasExcelDesdeBuffer(req.file.buffer);
  } catch {
    return res.status(400).json({ error: 'No se pudo leer el archivo Excel' });
  }

  if (filas.length === 0) {
    return res.status(400).json({ error: 'El archivo no tiene filas de datos' });
  }

  // Verificar columnas mínimas
  const columnasMínimas = ['Numero_Accion', 'Rol', 'Nombre_Completo', 'Email'];
  const columnas = Object.keys(filas[0]);
  const faltantes = columnasMínimas.filter(c => !columnas.includes(c));
  if (faltantes.length > 0) {
    return res.status(400).json({ error: `Faltan columnas requeridas: ${faltantes.join(', ')}` });
  }

  // Detectar emails duplicados en el mismo archivo
  const emailsVistos = new Map();
  const erroresPrevios = [];
  filas.forEach((fila, i) => {
    const email = (fila.Email || '').trim().toLowerCase();
    if (!email) return;
    if (emailsVistos.has(email)) {
      erroresPrevios.push({ fila: i + 2, motivo: `Email duplicado en el archivo: ${email} (ya aparece en fila ${emailsVistos.get(email)})` });
    } else {
      emailsVistos.set(email, i + 2);
    }
  });

  // FASE 2 — Sincronización
  let nuevos = 0, actualizados = 0;
  const errores = [...erroresPrevios];
  const emailsConError = new Set(erroresPrevios.map(e => {
    const match = e.motivo.match(/Email duplicado en el archivo: ([^\s]+)/);
    return match ? match[1] : null;
  }).filter(Boolean));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener rol_id de 'socio'
    const rolRes = await client.query("SELECT rol_id FROM roles WHERE nombre = 'socio' LIMIT 1");
    if (rolRes.rowCount === 0) throw new Error('Rol socio no encontrado en la BD');
    const rolSocioId = rolRes.rows[0].rol_id;

    for (let i = 0; i < filas.length; i++) {
      const fila       = filas[i];
      const numFila    = i + 2;
      const codigoAccion = String(fila.Numero_Accion || '').trim();
      const email        = (fila.Email || '').trim().toLowerCase();

      if (!codigoAccion) {
        errores.push({ fila: numFila, motivo: 'Numero_Accion vacío' }); continue;
      }
      if (!email) {
        errores.push({ fila: numFila, motivo: 'Email vacío' }); continue;
      }
      if (emailsConError.has(email)) continue; // ya reportado

      const esTitular  = String(fila.Rol || '').trim().toLowerCase() === 'titular';
      const modalidad  = String(fila.Tipo_Accion || 'Individual').trim();
      const tipo       = fila.Estatus_Accion === 'Propia' ? 'Accionista' : 'Rentista';
      const { nombres, apellido_paterno, apellido_materno } = normalizarNombre(fila.Nombre_Completo);
      const genero     = fila.Genero || null;
      const fechaNac   = parsearFecha(fila.Fecha_Nacimiento);
      const telefono   = String(fila.Telefono_Celular || '').trim() || null;
      const telEmerg   = String(fila.Telefono_Particular || '').trim() || null;
      const domicilio  = String(fila.Domicilio || '').trim() || null;
      const parentesco = String(fila.Parentesco || '').trim() || null;
      const username   = email;

      try {
        await client.query('SAVEPOINT sp_fila');
        // Buscar si ya existe la acción familiar
        const accionRes = await client.query(
          'SELECT accion_id FROM acciones_familiares WHERE codigo_accion = $1',
          [codigoAccion]
        );

        if (accionRes.rowCount > 0) {
          // ACTUALIZAR — buscar usuario por email
          const accionId = accionRes.rows[0].accion_id;
          const usuarioRes = await client.query(
            "SELECT u.usuario_id FROM usuarios u JOIN socios s ON s.usuario_id = u.usuario_id WHERE u.username = $1 AND s.accion_id = $2 LIMIT 1",
            [username, accionId]
          );

          if (usuarioRes.rowCount > 0) {
            // Usuario ya existe → actualizar datos
            const usuarioId = usuarioRes.rows[0].usuario_id;
            await client.query(
              `UPDATE usuarios SET nombres=$1, apellido_paterno=$2, apellido_materno=$3,
               genero=$4, fecha_nacimiento=$5, telefono=$6, direccion=$7
               WHERE usuario_id=$8`,
              [nombres, apellido_paterno, apellido_materno, genero, fechaNac, telefono, domicilio, usuarioId]
            );
            await client.query(
              `UPDATE socios SET tipo=$1, modalidad=$2, es_titular=$3, tel_emergencia=$4, parentesco=$5
               WHERE usuario_id=$6`,
              [tipo, modalidad, esTitular, telEmerg, parentesco, usuarioId]
            );
            actualizados++;
          } else {
            // Acción existe pero este miembro es nuevo → crear usuario y socio
            const anio = new Date().getFullYear();
            const passwordTemporal = `Club${codigoAccion}${anio}`;
            const passwordHash = await bcrypt.hash(passwordTemporal, 10);

            const nuevoUsuario = await client.query(
              `INSERT INTO usuarios (username, password_hash, rol_id,
                nombres, apellido_paterno, apellido_materno, genero, fecha_nacimiento,
                telefono, direccion, curp)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
               RETURNING usuario_id`,
              [username, passwordHash, rolSocioId,
               nombres, apellido_paterno, apellido_materno, genero, fechaNac,
               telefono, domicilio]
            );
            const nuevoUsuarioId = nuevoUsuario.rows[0].usuario_id;

            const countRes = await client.query(
              `SELECT COUNT(*) FROM socios s
               WHERE s.accion_id = $1 AND s.es_titular = FALSE`,
              [accionId]
            );
            const idx = Number(countRes.rows[0].count) + 1;
            const numeroSocio = esTitular ? `SOC-${codigoAccion}-T` : `SOC-${codigoAccion}-M${idx}`;

            await client.query(
              `INSERT INTO socios (usuario_id, accion_id, tipo, modalidad,
                es_titular, numero_socio, tel_emergencia, parentesco, activo)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)`,
              [nuevoUsuarioId, accionId, tipo, modalidad, esTitular, numeroSocio, telEmerg, parentesco]
            );
            nuevos++;
          }
        } else {
          // CREAR nuevo
          // i. INSERT accion familiar
          const nuevaAccion = await client.query(
            'INSERT INTO acciones_familiares (codigo_accion) VALUES ($1) ON CONFLICT (codigo_accion) DO NOTHING RETURNING accion_id',
            [codigoAccion]
          );
          const accionId = nuevaAccion.rowCount > 0
            ? nuevaAccion.rows[0].accion_id
            : (await client.query('SELECT accion_id FROM acciones_familiares WHERE codigo_accion=$1', [codigoAccion])).rows[0].accion_id;

          // ii-iii. Password y hash
          const anio = new Date().getFullYear();
          const passwordTemporal = `Club${codigoAccion}${anio}`;
          const passwordHash     = await bcrypt.hash(passwordTemporal, 10);

          // iv. INSERT usuario
          const nuevoUsuario = await client.query(
            `INSERT INTO usuarios (username, password_hash, rol_id,
              nombres, apellido_paterno, apellido_materno, genero, fecha_nacimiento,
              telefono, direccion, curp)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
             RETURNING usuario_id`,
            [username, passwordHash, rolSocioId,
             nombres, apellido_paterno, apellido_materno, genero, fechaNac,
             telefono, domicilio]
          );
          const usuarioId = nuevoUsuario.rows[0].usuario_id;

          // v. numero_socio con índice secuencial
          const countRes = await client.query(
            `SELECT COUNT(*) FROM socios s
             JOIN acciones_familiares af ON s.accion_id = af.accion_id
             WHERE af.codigo_accion = $1 AND s.es_titular = FALSE`,
            [codigoAccion]
          );
          const idx = Number(countRes.rows[0].count) + 1;
          const numeroSocio = esTitular ? `SOC-${codigoAccion}-T` : `SOC-${codigoAccion}-M${idx}`;

          // vii. INSERT socio
          await client.query(
            `INSERT INTO socios (usuario_id, accion_id, tipo, modalidad,
              es_titular, numero_socio, tel_emergencia, parentesco, activo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)`,
            [usuarioId, accionId, tipo, modalidad, esTitular, numeroSocio, telEmerg, parentesco]
          );
          nuevos++;
        }
        await client.query('RELEASE SAVEPOINT sp_fila');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp_fila');
        errores.push({ fila: numFila, motivo: err.message });
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error en la transacción: ' + err.message });
  } finally {
    client.release();
  }

  return res.json({
    total_procesados: filas.length,
    nuevos,
    actualizados,
    errores
  });
};

module.exports = { descargarTemplate, importarSocios };
