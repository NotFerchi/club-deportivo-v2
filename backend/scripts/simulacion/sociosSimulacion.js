// Socios de prueba de la simulación (U5-07), con el formato del importador de Excel
// (src/services/importacion/columnasSocios.js). Datos fijos (sin azar): cada corrida da los mismos archivos.
//
//  - Día 1: 20 acciones (SIM01–SIM20), 54 filas. La semilla lo importa con el importador real.
//  - Día 3: la "carga diaria" que sube el Director: 4 filas que actualizan socios del día 1, 5 miembros
//    nuevos en acciones existentes y 2 acciones nuevas (SIM21, SIM22) con 3 filas.
//
// Los correos usan el dominio reservado .test (RFC 2606): nunca se entregan.
// socio@sim.club.test (titular de SIM01) es el usuario de acceso del rol socio.

const DOMINIO = 'sim.club.test';
const USUARIO_SOCIO = `socio@${DOMINIO}`;

const sinAcentos = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
const correo = (nombres, paterno) =>
  `${sinAcentos(nombres.split(' ')[0])}.${sinAcentos(paterno)}@${DOMINIO}`.toLowerCase();

// [acción, tipo, estatus, domicilio, titular, miembros]; titular = [nombres, paterno, materno, género, nacimiento]
// miembro = [nombres, materno?, género, nacimiento, parentesco] (el paterno es el del titular, salvo cónyuge)
const ACCIONES = [
  ['SIM01', 'Familiar', 'Propia', 'Av. Camelinas 1450, Morelia', ['Mariana', 'Torres', 'Vega', 'Femenino', '1982-03-14'], [
    ['Andrés', 'Ruiz', 'Salas', 'Masculino', '1980-07-02', 'Esposo'],
    ['Valeria', 'Ruiz', 'Torres', 'Femenino', '2010-05-19', 'Hija'],
    ['Diego', 'Ruiz', 'Torres', 'Masculino', '2013-11-08', 'Hijo']
  ]],
  ['SIM02', 'Familiar', 'Propia', 'Calle Madero Ote 820, Morelia', ['Jorge', 'Méndez', 'Ríos', 'Masculino', '1975-01-22'], [
    ['Patricia', 'Lara', 'Gómez', 'Femenino', '1977-09-30', 'Esposa'],
    ['Sofía', 'Méndez', 'Lara', 'Femenino', '2008-02-11', 'Hija'],
    ['Emilio', 'Méndez', 'Lara', 'Masculino', '2011-06-25', 'Hijo']
  ]],
  ['SIM03', 'Familiar', 'Rentada', 'Fracc. Las Américas 33, Morelia', ['Laura', 'Castillo', 'Peña', 'Femenino', '1988-12-05'], [
    ['Ricardo', 'Herrera', 'Nava', 'Masculino', '1986-04-17', 'Esposo'],
    ['Camila', 'Herrera', 'Castillo', 'Femenino', '2015-08-29', 'Hija']
  ]],
  ['SIM04', 'Familiar', 'Propia', 'Av. Acueducto 2100, Morelia', ['Fernando', 'Aguilar', 'Soto', 'Masculino', '1970-06-09'], [
    ['Gabriela', 'Morales', 'Ibarra', 'Femenino', '1972-10-13', 'Esposa'],
    ['Daniel', 'Aguilar', 'Morales', 'Masculino', '2002-03-03', 'Hijo'],
    ['Ximena', 'Aguilar', 'Morales', 'Femenino', '2005-01-27', 'Hija'],
    ['Pablo', 'Aguilar', 'Morales', 'Masculino', '2009-09-15', 'Hijo']
  ]],
  ['SIM05', 'Familiar', 'Propia', 'Col. Chapultepec Nte 410, Morelia', ['Claudia', 'Navarro', 'León', 'Femenino', '1984-02-28'], [
    ['Miguel', 'Ortiz', 'Campos', 'Masculino', '1983-05-06', 'Esposo'],
    ['Renata', 'Ortiz', 'Navarro', 'Femenino', '2012-12-01', 'Hija'],
    ['Mateo', 'Ortiz', 'Navarro', 'Masculino', '2016-04-21', 'Hijo']
  ]],
  ['SIM06', 'Familiar', 'Rentada', 'Calle Allende 155, Morelia', ['Roberto', 'Vargas', 'Pineda', 'Masculino', '1979-08-18'], [
    ['Elena', 'Cruz', 'Mejía', 'Femenino', '1981-03-09', 'Esposa'],
    ['Santiago', 'Vargas', 'Cruz', 'Masculino', '2014-07-07', 'Hijo']
  ]],
  ['SIM07', 'Familiar', 'Propia', 'Av. Lázaro Cárdenas 980, Morelia', ['Adriana', 'Romero', 'Fuentes', 'Femenino', '1976-11-11'], [
    ['Héctor', 'Silva', 'Ramos', 'Masculino', '1974-02-14', 'Esposo'],
    ['Isabela', 'Silva', 'Romero', 'Femenino', '2006-10-04', 'Hija'],
    ['Tomás', 'Silva', 'Romero', 'Masculino', '2010-01-16', 'Hijo']
  ]],
  ['SIM08', 'Familiar', 'Propia', 'Fracc. Tres Marías 77, Morelia', ['Alejandro', 'Domínguez', 'Rojas', 'Masculino', '1985-09-23'], [
    ['Natalia', 'Paredes', 'Luna', 'Femenino', '1987-06-12', 'Esposa'],
    ['Regina', 'Domínguez', 'Paredes', 'Femenino', '2013-03-30', 'Hija'],
    ['Lucas', 'Domínguez', 'Paredes', 'Masculino', '2017-02-08', 'Hijo'],
    ['Julia', 'Domínguez', 'Paredes', 'Femenino', '2019-11-25', 'Hija']
  ]],
  ['SIM09', 'Familiar', 'Rentada', 'Calle Guerrero 640, Morelia', ['Verónica', 'Salazar', 'Ochoa', 'Femenino', '1990-04-02'], [
    ['Arturo', 'Medina', 'Cortés', 'Masculino', '1989-12-19', 'Esposo'],
    ['Paula', 'Medina', 'Salazar', 'Femenino', '2018-06-14', 'Hija']
  ]],
  ['SIM10', 'Familiar', 'Propia', 'Av. Ventura Puente 300, Morelia', ['Eduardo', 'Gutiérrez', 'Bravo', 'Masculino', '1968-07-29'], [
    ['Mónica', 'Rangel', 'Tapia', 'Femenino', '1970-01-05', 'Esposa'],
    ['Andrea', 'Gutiérrez', 'Rangel', 'Femenino', '2000-09-09', 'Hija'],
    ['Iván', 'Gutiérrez', 'Rangel', 'Masculino', '2003-05-31', 'Hijo']
  ]],
  ['SIM11', 'Familiar', 'Propia', 'Col. Vista Bella 58, Morelia', ['Silvia', 'Estrada', 'Montes', 'Femenino', '1983-10-21'], [
    ['Raúl', 'Cabrera', 'Ponce', 'Masculino', '1982-08-08', 'Esposo'],
    ['Fernanda', 'Cabrera', 'Estrada', 'Femenino', '2011-04-03', 'Hija'],
    ['Nicolás', 'Cabrera', 'Estrada', 'Masculino', '2015-12-12', 'Hijo']
  ]],
  ['SIM12', 'Familiar', 'Rentada', 'Calle Abasolo 270, Morelia', ['Óscar', 'Ibáñez', 'Rivas', 'Masculino', '1987-03-26'], [
    ['Carolina', 'Zamora', 'Díaz', 'Femenino', '1988-07-15', 'Esposa'],
    ['Emiliano', 'Ibáñez', 'Zamora', 'Masculino', '2016-10-10', 'Hijo']
  ]],
  ['SIM13', 'Individual', 'Propia', 'Av. Madero Pte 1120, Morelia', ['Lucía', 'Espinoza', 'Duarte', 'Femenino', '1992-05-08'], []],
  ['SIM14', 'Individual', 'Rentada', 'Calle Morelos Sur 45, Morelia', ['Javier', 'Quintero', 'Lozano', 'Masculino', '1995-02-17'], []],
  ['SIM15', 'Individual', 'Propia', 'Fracc. Misión del Valle 12, Morelia', ['Daniela', 'Fuentes', 'Arriaga', 'Femenino', '1989-08-24'], []],
  ['SIM16', 'Individual', 'Propia', 'Col. Félix Ireta 501, Morelia', ['Manuel', 'Correa', 'Valdez', 'Masculino', '1965-04-12'], []],
  ['SIM17', 'Individual', 'Rentada', 'Av. Periodismo 880, Morelia', ['Andrea', 'Villalobos', 'Sosa', 'Femenino', '1998-11-30'], []],
  ['SIM18', 'Individual', 'Propia', 'Calle Aldama 333, Morelia', ['Rodrigo', 'Bautista', 'Galván', 'Masculino', '1980-01-09'], []],
  ['SIM19', 'Individual', 'Rentada', 'Fracc. Los Ángeles 90, Morelia', ['Paulina', 'Acosta', 'Reyes', 'Femenino', '1993-06-06'], []],
  ['SIM20', 'Individual', 'Propia', 'Col. Nueva Chapultepec 215, Morelia', ['Sergio', 'Maldonado', 'Uribe', 'Masculino', '1972-12-20'], []]
];

const telefono = (n) => `443${String(1000000 + n * 7919).slice(-7)}`;

function filaTitular([codigo, tipo, estatus, domicilio, [nombres, paterno, materno, genero, nacimiento]], n) {
  return {
    Numero_Accion: codigo,
    Tipo_Accion: tipo,
    Estatus_Accion: estatus,
    Rol: 'Titular',
    Nombre_Completo: `${nombres} ${paterno} ${materno}`,
    Genero: genero,
    Fecha_Nacimiento: nacimiento,
    Parentesco: '',
    Domicilio: domicilio,
    Email: codigo === 'SIM01' ? USUARIO_SOCIO : correo(nombres, paterno),
    Telefono_Celular: telefono(n),
    Telefono_Particular: ''
  };
}

function filaMiembro([codigo, tipo, estatus, domicilio], [nombres, paterno, materno, genero, nacimiento, parentesco], n) {
  return {
    Numero_Accion: codigo,
    Tipo_Accion: tipo,
    Estatus_Accion: estatus,
    Rol: 'Miembro',
    Nombre_Completo: `${nombres} ${paterno} ${materno}`,
    Genero: genero,
    Fecha_Nacimiento: nacimiento,
    Parentesco: parentesco,
    Domicilio: domicilio,
    Email: correo(nombres, `${paterno}.${materno}`),
    Telefono_Celular: telefono(n),
    Telefono_Particular: ''
  };
}

/** Filas del día 1 (54), en el orden de las columnas del importador. */
function sociosDia1() {
  const filas = [];
  let n = 1;
  for (const accion of ACCIONES) {
    filas.push(filaTitular(accion, n++));
    for (const miembro of accion[5]) filas.push(filaMiembro(accion, miembro, n++));
  }
  return filas;
}

/** Filas del día 3 (12): 4 actualizaciones, 5 miembros nuevos y 2 acciones nuevas. */
function sociosDia3() {
  const dia1 = sociosDia1();
  const porEmail = (email) => ({ ...dia1.find((f) => f.Email === email) });
  const accion = (codigo) => ACCIONES.find((a) => a[0] === codigo);

  // Actualizaciones: mismo email y acción, cambian teléfono o domicilio
  const actualizados = [
    { ...porEmail('jorge.mendez@sim.club.test'), Telefono_Celular: '4435550101' },
    { ...porEmail('laura.castillo@sim.club.test'), Domicilio: 'Fracc. Las Américas 35, Morelia' },
    { ...porEmail('lucia.espinoza@sim.club.test'), Telefono_Celular: '4435550102', Telefono_Particular: '4433120000' },
    { ...porEmail('sergio.maldonado@sim.club.test'), Domicilio: 'Col. Nueva Chapultepec 217, Morelia' }
  ];
  let n = 100;
  const nuevosMiembros = [
    filaMiembro(accion('SIM03'), ['Bruno', 'Herrera', 'Castillo', 'Masculino', '2019-02-14', 'Hijo'], n++),
    filaMiembro(accion('SIM06'), ['Ana', 'Vargas', 'Cruz', 'Femenino', '2018-09-03', 'Hija'], n++),
    filaMiembro(accion('SIM09'), ['Leonardo', 'Medina', 'Salazar', 'Masculino', '2020-05-22', 'Hijo'], n++),
    filaMiembro(accion('SIM12'), ['Valentina', 'Ibáñez', 'Zamora', 'Femenino', '2019-12-07', 'Hija'], n++),
    filaMiembro(accion('SIM05'), ['Inés', 'Ortiz', 'Navarro', 'Femenino', '2020-08-18', 'Hija'], n++)
  ];
  const sim21 = ['SIM21', 'Individual', 'Rentada', 'Calle Hidalgo 702, Morelia', ['Teresa', 'Montoya', 'Garza', 'Femenino', '1991-07-01'], []];
  const sim22 = ['SIM22', 'Familiar', 'Propia', 'Av. Solidaridad 1300, Morelia', ['Gerardo', 'Pacheco', 'Luna', 'Masculino', '1978-10-28'], []];
  const accionesNuevas = [
    filaTitular(sim21, n++),
    filaTitular(sim22, n++),
    filaMiembro(sim22, ['Beatriz', 'Solís', 'Mora', 'Femenino', '1980-03-15', 'Esposa'], n)
  ];
  return [...actualizados, ...nuevosMiembros, ...accionesNuevas];
}

module.exports = { DOMINIO, USUARIO_SOCIO, sociosDia1, sociosDia3 };
