// Datos fijos de la semilla de la simulación (U5-07). Las fechas se expresan en días relativos a --inicio
// (el primer día de la semana de simulación); semillaSimulacion.js las convierte a fechas reales.
// Los socios salen de socios-dia1.xlsx (sociosSimulacion.js) y se referencian por su email.
const { DOMINIO, USUARIO_SOCIO } = require('./sociosSimulacion');

// Mismo orden que en production: en un branch vacío quedan con los mismos rol_id (1 a 6)
const ROLES = ['admin', 'recepcion', 'instructor', 'socio', 'coordinador', 'gerente'];

/**
 * Cuentas de acceso, una por rol. Su contraseña sale de la variable de entorno indicada (U5-08):
 *  - admin, gerente, coordinador y recepción solo se crean si su variable existe;
 *  - instructor y socio son también datos (el instructor da clases, el socio es el titular de SIM01):
 *    existen siempre, y sin su variable quedan con una contraseña imposible (no se puede entrar).
 */
const CUENTAS_ACCESO = [
  { rol: 'admin', username: `admin@${DOMINIO}`, nombres: 'Administración', paterno: 'Simulación', env: 'SIM_PASS_ADMIN' },
  { rol: 'gerente', username: `gerente@${DOMINIO}`, nombres: 'Gerencia', paterno: 'Simulación', env: 'SIM_PASS_GERENTE' },
  { rol: 'coordinador', username: `coordinador@${DOMINIO}`, nombres: 'Coordinación', paterno: 'Simulación', env: 'SIM_PASS_COORDINADOR' },
  { rol: 'recepcion', username: `recepcion@${DOMINIO}`, nombres: 'Recepción', paterno: 'Simulación', env: 'SIM_PASS_RECEPCION' },
  { rol: 'instructor', username: `instructor@${DOMINIO}`, env: 'SIM_PASS_INSTRUCTOR', esDato: true },
  { rol: 'socio', username: USUARIO_SOCIO, env: 'SIM_PASS_SOCIO', esDato: true }
];

const DISCIPLINAS = ['Tenis', 'Pádel', 'Natación', 'Básquetbol', 'Yoga', 'Zumba', 'Spinning', 'Gimnasio'];

// [nombre, disciplina principal, capacidad, otras disciplinas que se imparten ahí]
const ESPACIOS = [
  ['Cancha de Tenis 1', 'Tenis', 4, []],
  ['Cancha de Tenis 2', 'Tenis', 4, []],
  ['Cancha de Tenis 3', 'Tenis', 4, []],
  ['Cancha de Pádel 1', 'Pádel', 4, []],
  ['Cancha de Pádel 2', 'Pádel', 4, []],
  ['Alberca Semiolímpica', 'Natación', 30, []],
  ['Cancha de Básquetbol', 'Básquetbol', 20, []],
  ['Salón de Usos Múltiples', 'Yoga', 25, ['Zumba']],
  ['Salón de Spinning', 'Spinning', 20, []],
  ['Gimnasio', 'Gimnasio', 40, []]
];

// Instructores. "instructor" es la cuenta de acceso del rol (CUENTAS_ACCESO); los demás no inician sesión.
// [clave, username, nombres, paterno, materno, especialidad]
const INSTRUCTORES = [
  ['instructor', `instructor@${DOMINIO}`, 'Carlos', 'Rivera', 'Mota', 'Tenis'],
  ['padel', `pablo.zuniga@${DOMINIO}`, 'Pablo', 'Zúñiga', 'Cano', 'Pádel'],
  ['natacion', `irene.solano@${DOMINIO}`, 'Irene', 'Solano', 'Bernal', 'Natación'],
  ['basquet', `hugo.mercado@${DOMINIO}`, 'Hugo', 'Mercado', 'Lira', 'Básquetbol'],
  ['yoga', `marisol.trejo@${DOMINIO}`, 'Marisol', 'Trejo', 'Haro', 'Yoga, Zumba'],
  ['spinning', `ruben.alcala@${DOMINIO}`, 'Rubén', 'Alcalá', 'Vera', 'Spinning, Gimnasio']
];

// Clases semanales: [disciplina, espacio, instructor, día (1 = lunes … 7 = domingo), inicio, fin, cupo]
const SESIONES = [
  ['Tenis', 'Cancha de Tenis 1', 'instructor', 1, '07:00', '08:00', 4],
  ['Tenis', 'Cancha de Tenis 1', 'instructor', 3, '07:00', '08:00', 4],
  ['Tenis', 'Cancha de Tenis 2', 'instructor', 6, '10:00', '11:30', 4],
  ['Pádel', 'Cancha de Pádel 1', 'padel', 2, '18:00', '19:00', 4],
  ['Pádel', 'Cancha de Pádel 1', 'padel', 4, '18:00', '19:00', 4],
  ['Natación', 'Alberca Semiolímpica', 'natacion', 1, '17:00', '18:00', 15],
  ['Natación', 'Alberca Semiolímpica', 'natacion', 3, '17:00', '18:00', 15],
  ['Natación', 'Alberca Semiolímpica', 'natacion', 5, '17:00', '18:00', 15],
  ['Básquetbol', 'Cancha de Básquetbol', 'basquet', 2, '16:00', '17:30', 12],
  ['Básquetbol', 'Cancha de Básquetbol', 'basquet', 4, '16:00', '17:30', 12],
  ['Yoga', 'Salón de Usos Múltiples', 'yoga', 2, '08:00', '09:00', 20],
  ['Zumba', 'Salón de Usos Múltiples', 'yoga', 4, '19:00', '20:00', 25],
  ['Spinning', 'Salón de Spinning', 'spinning', 1, '06:30', '07:15', 20],
  ['Spinning', 'Salón de Spinning', 'spinning', 5, '06:30', '07:15', 20]
];

const correo = (texto) => `${texto}@${DOMINIO}`;

// Inscripciones a clases: [email del socio, índice en SESIONES]
const INSCRIPCIONES = [
  [USUARIO_SOCIO, 0], [USUARIO_SOCIO, 10],
  [correo('valeria.ruiz.torres'), 5], [correo('diego.ruiz.torres'), 5], [correo('diego.ruiz.torres'), 8],
  [correo('jorge.mendez'), 3], [correo('patricia.lara.gomez'), 10], [correo('sofia.mendez.lara'), 11],
  [correo('emilio.mendez.lara'), 8], [correo('laura.castillo'), 12], [correo('fernando.aguilar'), 1],
  [correo('daniel.aguilar.morales'), 4], [correo('claudia.navarro'), 11], [correo('renata.ortiz.navarro'), 6],
  [correo('roberto.vargas'), 13], [correo('adriana.romero'), 10], [correo('alejandro.dominguez'), 2],
  [correo('regina.dominguez.paredes'), 7], [correo('lucia.espinoza'), 11], [correo('javier.quintero'), 3],
  [correo('daniela.fuentes'), 12], [correo('manuel.correa'), 9], [correo('andrea.villalobos'), 13],
  [correo('rodrigo.bautista'), 2]
];

// Ludoteca (entradas ya cerradas): [email del padre, nombre del niño, edad (3 a 7), día, entrada, salida, observaciones]
// La de 11:00 a 14:20 excede el límite de 2 horas: genera la sanción de origen Ludoteca (SANCIONES[0]).
const LUDOTECA = [
  [USUARIO_SOCIO, 'Emma Ruiz Torres', 5, -3, '10:00', '11:30', null],
  [correo('alejandro.dominguez'), 'Martina Domínguez Paredes', 4, -2, '17:00', '18:15', 'Alergia al cacahuate'],
  [correo('claudia.navarro'), 'Joaquín Ortiz Navarro', 6, -1, '11:00', '14:20', null],
  [correo('veronica.salazar'), 'Paula Medina Salazar', 6, -1, '16:00', '17:00', null]
];

// Sanciones: [email, origen, motivo, gravedad, estado, día inicio, día fin, índice de LUDOTECA o null]
const SANCIONES = [
  [correo('claudia.navarro'), 'Ludoteca', 'Exceso de estancia: 80 min sobre el límite de 2 horas', 'Leve', 'Activa', -1, 6, 2],
  [correo('roberto.vargas'), 'Reservaciones', 'No se presentó a su reserva de la Cancha de Tenis 2', 'Moderada', 'Activa', -2, 12, null],
  [correo('oscar.ibanez'), 'Administración', 'Conducta inapropiada en vestidores', 'Grave', 'Activa', -4, 26, null],
  [correo('javier.quintero'), 'Administración', 'Pago de mantenimiento atrasado', 'Leve', 'Resuelta', -10, -3, null]
];

// Visitas (registradas en recepción y ya cerradas): [nombre, email del socio anfitrión, día, entrada, salida, mayor de 16]
// Las tres del día -1 se inscribieron ese día en la Copa de Tenis (U5-06: una visita solo se inscribe el día que se registra).
const VISITAS = [
  ['Laura Méndez Ruiz', correo('jorge.mendez'), -1, '09:30', '13:00', true],
  ['Diego Herrera Soto', correo('laura.castillo'), -1, '10:00', '12:30', true],
  ['Sofía Ramírez Luna', correo('laura.castillo'), -1, '10:05', '12:30', false],
  ['Martín Cervantes Gil', USUARIO_SOCIO, -3, '16:00', '19:00', true],
  ['Lorena Pizano Ávila', correo('adriana.romero'), -2, '08:30', '11:00', true]
];

const CATEGORIAS = ['Infantil', 'Juvenil', 'Libre', 'Adulto', 'Máster'];

// Torneos (nombre con prefijo "SIM"). Días relativos a --inicio.
const TORNEOS = [
  {
    nombre: 'SIM Copa de Tenis Otoño',
    disciplina: 'Tenis',
    categoria: 'Libre',
    tipo: 'Individual',
    estado: 'Abierto',
    cupo: 16,
    inicioInscripcion: -7,
    finInscripcion: 3,
    inicio: 5,
    fin: 6,
    socios: [USUARIO_SOCIO, correo('jorge.mendez'), correo('fernando.aguilar'), correo('alejandro.dominguez'),
      correo('lucia.espinoza'), correo('rodrigo.bautista')],
    visitas: ['Laura Méndez Ruiz', 'Diego Herrera Soto', 'Sofía Ramírez Luna'],
    externos: ['Marco Externo Díaz']
  },
  {
    nombre: 'SIM Relámpago de Pádel por Equipos',
    disciplina: 'Pádel',
    categoria: 'Libre',
    tipo: 'Equipos',
    estado: 'En_curso',
    cupo: 8,
    inicioInscripcion: -10,
    finInscripcion: -1,
    inicio: 0,
    fin: 2,
    socios: [],
    visitas: [],
    externos: ['Raquetas Morelianas', 'Los del Acueducto', 'Club Camelinas', 'Pádel Tres Marías'],
    // Bracket de 4: semifinal 1 jugada (6-3), semifinal 2 programada y la final esperando a los ganadores
    bracket: {
      arbitro: 'padel',
      semifinales: [
        { cancha: 'Cancha de Pádel 1', dia: 0, hora: '10:00', marcador: [6, 3] },
        { cancha: 'Cancha de Pádel 2', dia: 1, hora: '11:00', marcador: null }
      ]
    }
  }
];

module.exports = {
  ROLES,
  CUENTAS_ACCESO,
  DISCIPLINAS,
  ESPACIOS,
  INSTRUCTORES,
  SESIONES,
  INSCRIPCIONES,
  LUDOTECA,
  SANCIONES,
  VISITAS,
  CATEGORIAS,
  TORNEOS
};
