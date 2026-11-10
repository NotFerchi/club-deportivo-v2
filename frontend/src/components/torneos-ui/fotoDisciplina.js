// Fotos de demostración por disciplina (frontend/public/torneos/*.jpg).
// Solo se muestran a las cuentas de prueba: el correo de la cuenta debe estar en
// VITE_FOTOS_DEMO_EMAILS (frontend/.env, separado por comas). Para el resto de los usuarios no hay
// fotos y la tarjeta se queda con su degradado. Sin la variable, nadie las ve.

const FOTOS = [
  [/tenis|p[aá]del|squash|frontenis|front[oó]n/, '/torneos/tenis.jpg'],
  [/f[uú]tbol|futbol|soccer/, '/torneos/futbol.jpg'],
  [/atletismo|correr|carrera|marat[oó]n/, '/torneos/atletismo.jpg'],
  [/pilates|yoga|barre|meditaci[oó]n|higiene/, '/torneos/pilates.jpg'],
];

function correosDemo() {
  return String(import.meta.env.VITE_FOTOS_DEMO_EMAILS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/** true si el usuario con sesión es una cuenta de prueba con fotos. */
export function usuarioVeFotos() {
  try {
    const email = String(JSON.parse(localStorage.getItem('usuario') || '{}').email || '').toLowerCase();
    return Boolean(email) && correosDemo().includes(email);
  } catch {
    return false;
  }
}

/** Ruta de la foto de una disciplina, o undefined si no hay foto o el usuario no es de prueba. */
export function fotoDisciplina(nombre) {
  if (!usuarioVeFotos()) return undefined;
  const texto = String(nombre || '').toLowerCase();
  return FOTOS.find(([patron]) => patron.test(texto))?.[1];
}
