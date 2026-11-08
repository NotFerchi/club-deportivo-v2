/**
 * Marca del club — configuración central (rediseño SC-03, M0).
 *
 * Las pantallas leen el nombre, los logos y los datos de contacto de aquí en vez de escribirlos
 * en cada archivo. Los SVG se importan con Vite, así que `logos.*` ya son URLs listas para <img src>.
 *
 * Versiones de logo:
 *   principalA  — marca principal (A)
 *   atleta      — gráfica del atleta, versión -v2 (óvalo delgado, mano y pie cortando el óvalo)
 *   logotipo    — símbolo + nombre;  simbolo — solo el símbolo
 *   azul        — para fondos claros; blanco — para fondos oscuros (sidebar navy, degradados)
 *   (La marca principal A no tiene versión -v2; se usa la única que existe.)
 */
import principalALogotipoAzul from '../assets/brand/athlety-principal-A-logotipo-azul.svg';
import principalALogotipoBlanco from '../assets/brand/athlety-principal-A-logotipo-blanco.svg';
import principalASimboloAzul from '../assets/brand/athlety-principal-A-simbolo-azul.svg';
import principalASimboloBlanco from '../assets/brand/athlety-principal-A-simbolo-blanco.svg';
import atletaLogotipoAzul from '../assets/brand/athlety-grafica-atleta-logotipo-azul-v2.svg';
import atletaLogotipoBlanco from '../assets/brand/athlety-grafica-atleta-logotipo-blanco-v2.svg';
import atletaSimboloAzul from '../assets/brand/athlety-grafica-atleta-simbolo-azul-v2.svg';
import atletaSimboloBlanco from '../assets/brand/athlety-grafica-atleta-simbolo-blanco-v2.svg';

export const brand = {
  /** Nombre de la marca / producto. */
  nombre: 'Athlety',
  /** Nombre institucional del club. */
  club: 'Club Social y Deportivo',

  logos: {
    principalA: {
      logotipo: { azul: principalALogotipoAzul, blanco: principalALogotipoBlanco },
      simbolo: { azul: principalASimboloAzul, blanco: principalASimboloBlanco },
    },
    atleta: {
      logotipo: { azul: atletaLogotipoAzul, blanco: atletaLogotipoBlanco },
      simbolo: { azul: atletaSimboloAzul, blanco: atletaSimboloBlanco },
    },
  },

  /**
   * DATOS DE DEMOSTRACIÓN — NO SON REALES.
   * Placeholder para el modal "El alta se hace en recepción" (D4, M7). Hay que pedir al club el
   * horario y los datos de contacto reales y reemplazarlos aquí; mientras `esDemo` sea true,
   * las pantallas pueden mostrar un aviso o evitar publicarlos.
   */
  contacto: {
    esDemo: true,
    direccion: 'Morelia, Michoacán (dirección de ejemplo)',
    telefono: '443 000 0000 (ejemplo)',
    correo: 'contacto@ejemplo.com (ejemplo)',
    horario: [
      { dias: 'Martes a domingo', horas: '6:00 – 22:00 (ejemplo)' },
      { dias: 'Lunes', horas: 'Cerrado' },
    ],
  },
};

export default brand;
