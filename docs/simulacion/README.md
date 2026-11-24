# Simulación con el Director de Operaciones (U5-07)

Una semana de uso del sistema con datos ficticios, en una base propia: el branch de Neon `simulacion-u5`,
creado "solo esquema" desde production. Production no se toca.

## Archivos

| Archivo | Para qué |
|---|---|
| `hoja-acceso.md` / `.pdf` | Para el Director: dirección y usuario por rol, **sin contraseñas** (1 página) |
| `guia-rapida.md` / `.pdf` | Para el Director: qué está cargado y qué probar por rol (1 página) |
| `socios-dia1.xlsx` | 54 socios en 20 acciones (SIM01–SIM20). Lo importa la semilla |
| `socios-dia3.xlsx` | Carga diaria que sube el Gerente: 4 actualizaciones y 8 altas (incluye SIM21 y SIM22) |
| `despliegue.md` | Render + Vercel: pasos y variables por servicio |

Todos los correos son del dominio reservado `sim.club.test`: nunca se entregan.

## Scripts (`backend/scripts/`)

| Script | Qué hace |
|---|---|
| `generarExcelSocios.js` | Genera los dos Excel y los valida con el importador real (sin BD) |
| `semillaSimulacion.js --simulacion --inicio=YYYY-MM-DD [--ensayo]` | Siembra `simulacion-u5` (ver abajo) |
| `generarDocsSimulacion.js [--url-app=…] [--inicio=…]` | Regenera la hoja de acceso y la guía (md y pdf) |

### Semilla

- **Destino.** Solo escribe en `SIMULACION_DATABASE_URL` (`backend/.env.simulacion`, ignorado por git).
- **Contraseñas.** Lee `SIM_PASS_ADMIN`, `SIM_PASS_GERENTE`, `SIM_PASS_COORDINADOR`, `SIM_PASS_RECEPCION`,
  `SIM_PASS_INSTRUCTOR` y `SIM_PASS_SOCIO` del mismo archivo (U5-08). Nunca las imprime.
- **Protecciones.** Se niega:
  - sin `--simulacion` o sin `--inicio`;
  - si el host es el de production (`DATABASE_URL` de `backend/.env`) o no puede compararlo;
  - si la base tiene datos que no son de la simulación.
- **Transacción.** Todo va en una transacción. La semilla corre dos veces y, si la segunda pasada cambia
  algo, se revierte todo. `--ensayo` siempre termina en ROLLBACK.
- **Socios.** Importa `socios-dia1.xlsx` con el importador real. La contraseña predecible
  `Club<acción><año>` que da el importador se reemplaza por una imposible.
- **Sin contraseña.** Las cuentas de admin, gerente, coordinador y recepción solo se crean con su variable.
  Las de instructor y socio existen siempre (son datos), pero no se puede entrar con ellas hasta tener su variable.
- **Contenido:**
  - 6 roles, 8 disciplinas y 10 instalaciones;
  - 6 instructores y 14 clases semanales con 24 inscripciones;
  - 5 visitas cerradas;
  - 4 entradas de ludoteca (una con exceso de 2 h y su sanción);
  - 4 sanciones;
  - 2 torneos: la *Copa de Tenis Otoño*, abierta, con 6 socios, 3 visitas y 1 externo, y el *Relámpago de
    Pádel por Equipos*, en curso, con el bracket a medias.
- **Fechas.** Son relativas a `--inicio`.

## Estado

| Paso | Estado |
|---|---|
| Excel, semilla, despliegue y documentos en el repo | Hecho |
| `--ensayo` contra `simulacion-u5` | Pendiente: falta `backend/.env.simulacion` |
| Migraciones en `simulacion-u5` (índice de ludoteca) | En espera: #47 fusionado |
| Semilla en real | En espera: fecha de inicio (Fernando) |
| Contraseñas de las cuentas de acceso | En espera: U5-08 |
| Despliegue Render + Vercel | En espera: #47 y #48 fusionados |
| Índice de ludoteca en production (paso 7) | En espera: respaldo confirmado + #47 + OK |
