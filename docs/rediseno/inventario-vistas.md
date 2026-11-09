# SC-03 · Rediseño UI/UX — Inventario de vistas

> Base para diseñar en Google Stitch y luego implementar **un PR por módulo**.
> Levantado del código en la rama `refactor/kit-instructor-socio` (después de los lotes E6.1–E6.4), el 30/10/2026.
> No se modificó código.

**Cómo leer este documento**

- **Kit**: la vista ya usa los componentes de `src/components/ui` y no tiene `style=` ni CSS propio.
- **Mixto**: usa algunos componentes del kit pero todavía tiene `style=` en línea, `AdminUI` o clases del CSS viejo.
- **Viejo**: usa solo el CSS de `frontend/css/*.css` o estilos en línea.
- **Estados**: C = cargando, V = vacío, E = error con mensaje. ✔ lo maneja, ✘ no lo maneja (falla en silencio o solo con un toast). Los estados se identificaron leyendo el código; puede que alguno manejado de forma implícita no aparezca.
- **Plataforma**: las vistas de **socio** son *móvil primero*. Todas las demás son *escritorio*, y se indica cuándo también se usan en tablet o móvil.

---

## 0. Cómo navega hoy la app (importante para el diseño)

| Rol | Ruta | Navegación |
|---|---|---|
| Público | `/`, `/login` | Páginas sueltas |
| Socio | `/dashboard-socio`, `/reservas`, `/clases`, `/evaluaciones`, `/ludoteca`, `/torneos`, `/sanciones` | **Rutas reales**. Todas usan `SocioLayout`: un encabezado, pestañas arriba en escritorio y una **barra fija abajo con 7 ítems** en móvil |
| Admin / Gerente | `/dashboard-admin`, `/dashboard-gerente` | **Una sola ruta** (`Dashboard.jsx`). Las secciones se cambian con estado interno (`activeTab`), sin URL propia. Tiene sidebar y una barra de pestañas en móvil. El gerente no ve Auditoría y ve Sanciones en solo lectura |
| Coordinador | `/dashboard-coordinador` | Una ruta con `activeTab` interno: sidebar y pestañas arriba en móvil |
| Instructor | `/dashboard-instructor` | Una ruta con `activeTab` interno: sidebar y pestañas en móvil |
| Recepción | `/dashboard-recepcion` | Una ruta con `activeTab` interno: sidebar, **sin navegación móvil propia** |

> **Decisión pendiente para M0:** ¿las secciones del personal pasan a tener rutas reales (`/admin/socios`…)? Eso permitiría enlaces directos y que funcione el botón “atrás”, pero ya no es solo presentación. Si se decide que no, el rediseño mantiene el `activeTab`.

---

## 1. Inventario

### M0 · Base: navegación y elementos globales

| ID | Vista | Archivo | Rol | Propósito | Contenido y acciones | Estado actual |
|---|---|---|---|---|---|---|
| B1 | Layout de socio | `components/SocioLayout.jsx` | Socio | Marco de todas las vistas de socio | Encabezado: logo, botón **Mi QR**, campana con contador, menú de perfil (nombre, “Socio Familiar”, cerrar sesión). Pestañas Inicio · Reservas · Clases · Evaluar · Ludoteca · Torneos · Historial. En móvil la barra es fija abajo con 7 íconos y etiqueta | Viejo (`ds-*` y muchos `style=`) |
| B2 | Panel de notificaciones (socio) | `SocioLayout.jsx` (`NotiDropdown`) | Socio | Avisos de reservas, clases y ludoteca | Lista con ícono por tipo, título, mensaje y “hace X min”; punto de no leída; “Leer todas”; eliminar una. Vacío: “Sin notificaciones” | Viejo |
| B3 | Toasts de socio | `SocioLayout.jsx` (`Toast`) | Socio | Aviso emergente cuando llega una notificación nueva | Abajo a la derecha, se cierra solo a los 6 s, color según el tipo | Viejo |
| B4 | Modal **Mi QR** | `SocioLayout.jsx` | Socio | Mostrar el QR de acceso al club | QR, nombre, número de socio, “Muéstralo en recepción”. C ✔ V — E ✔ | Viejo |
| B5 | Layout del personal | `Dashboard.jsx`, `DashboardCoordinador.jsx`, `DashboardInstructor.jsx`, `DashboardRecepcion.jsx` | Admin, gerente, coordinador, instructor, recepción | Sidebar, encabezado con título de sección y perfil | Hoy hay **4 implementaciones distintas**: sidebar con secciones, avatar con **cambiar foto de perfil**, cerrar sesión y título de la sección | Viejo (instructor: `instructor.css`) |
| B6 | Navegación móvil del personal | Mismos archivos | Personal | Pestañas con scroll horizontal arriba | Admin (13 ítems), coordinador (10) e instructor (6). Recepción no tiene | Viejo |
| B7 | Panel de alertas (admin) | `Dashboard.jsx` | Admin, gerente | Alertas de los últimos 3 días | Campana con contador; lista de alertas; descartar una; “Borrar todas”. Vacío: “Sin alertas pendientes · Todo al día” | Viejo |
| B8 | Toast y diálogo de confirmación globales | `context/NotificationContext.jsx` | Todos | `toast()` y `showConfirm()` que usa toda la app (eliminar, cerrar inscripciones…) | Diálogo con título, mensaje y botones Cancelar/Confirmar (con variante destructiva) | Viejo (`modal-overlay` y `style=`) |

### M1 · Socio (móvil primero)

Todas las vistas van dentro de B1. Las vistas de **Torneos** del socio están en M4.

#### S1 · Inicio — `/dashboard-socio` · `pages/dashboards/DashboardSocio.jsx` · Kit
- **Propósito:** resumen del día del socio.
- **Secciones:**
  1. Saludo “Buen día, {nombre}” con avatar (y cambio de foto).
  2. 4 KPI: reservas de hoy, torneos activos, niños en la ludoteca, sanciones activas.
  3. Tarjeta “Reservas de hoy”.
  4. Tarjeta “Mis torneos”.
  5. Tarjeta “Ludoteca” (niños dentro y su tiempo).
  6. Tarjeta “Sanciones activas” (solo si hay).
  7. Aviso de aforo.
- **Acciones:** cambiar la foto; atajos a Reservas y Torneos desde los estados vacíos.
- **Estados:** C ✔ (por tarjeta) · V ✔ (“Sin reservas hoy”, “Sin participaciones”, “Sin niños activos”) · E ✘ (solo un toast al subir la foto).

#### S2 · Reserva de canchas — `/reservas` · `socio/Reservas.jsx` · Kit
- **Propósito:** reservar una cancha para hoy en 3 pasos.
- **Secciones:**
  1. Título.
  2. “Mis reservas de hoy”, con botón para cancelar cada una.
  3. **Paso 1:** ¿qué quieres jugar? (chips de disciplinas).
  4. **Paso 2:** elige tu cancha (tarjetas de espacios).
  5. **Paso 3:** elige tu horario (cuadrícula de horas libre / ocupada / clase / pasada, duración y “Actualizar”).
  6. Botón “Reservar”.
- **Modales:** **S2a Confirmar reserva** (resumen de cancha, hora y duración; Cancelar / Confirmar).
- **Estados:** C ✔ (“Cargando disponibilidad…”) · V ✔ (“No hay canchas…”, “El club está cerrado hoy”) · E ✔ (Alert con el mensaje).

#### S3 · Clases y actividades — `/clases` · `socio/Clases.jsx` · Kit
- **Pestañas:**
  - **S3a Mis clases:** tarjetas con nombre, instructor, día, hora y espacio, un badge de estatus y el botón “Cancelar inscripción”.
  - **S3b Catálogo:** botón **Filtros (n)** y “Limpiar”; tarjetas de clase con un indicador de cupo y el botón Inscribirme, o “Inscrito” o “Lleno” deshabilitados.
- **Modales:**
  - **S3c Filtros:** disciplinas, días e instructores en checkboxes; Limpiar / Aplicar.
  - **S3d Confirmar inscripción:** cuando termina bien muestra “¡Inscripción exitosa!”.
  - **S3e Cancelar inscripción:** confirmación destructiva.
- **Estados:** C ✔ · V ✔ (“No tienes clases inscritas” con CTA “Ver catálogo”) · E ✔ (dentro del modal).

#### S4 · Evaluar instructores — `/evaluaciones` · `socio/Evaluaciones.jsx` · Kit
- **Propósito:** calificar las clases a las que asistió el socio.
- **Secciones:** título; aviso de éxito; tabla de clases confirmadas (clase, instructor, fecha, estado “Evaluada” o “Sin instructor”; botón Evaluar).
- **Modales:** **S4a Evaluar clase** (`evaluaciones-ui/EvaluarClaseModal.jsx`): de 1 a 5 estrellas con botones y un comentario opcional.
- **Estados:** C ✔ · V ✔ (“Aún no tienes clases confirmadas” con “Ver clases”) · E ✔ (con Reintentar).

#### S5 · Ludoteca — `/ludoteca` · `socio/Ludoteca.jsx` · Kit
- **Arriba de las pestañas:** alerta de tiempo excedido y una tarjeta **Aforo actual** con barra de progreso.
- **Pestañas:**
  - **S5a Activos:** tarjetas por niño con nombre, hora de entrada, barra de tiempo transcurrido y la acción de solicitar salida o mostrar el QR; botón “Registrar entrada”.
  - **S5b Historial:** tabla de las visitas completadas.
  - **S5c Cómo funciona:** texto informativo con los pasos.
- **Modales:**
  - **S5d Registrar entrada:** nombre del niño y fecha de nacimiento.
  - **S5e Mi código QR:** el QR de la entrada.
- **Estados:** C ✔ · V ✔ (“Sin niños activos” con CTA; “Sin historial”) · E ✔ (error del formulario).

#### S6 · Estado de cuenta (pestaña “Historial”) — `/sanciones` · `socio/Sanciones.jsx` · Kit
- **Secciones:**
  1. Título y badge de estado de la cuenta (limpia o con sanciones).
  2. 3 KPI: activas, total del historial, resueltas.
  3. Tarjeta con la explicación de la gravedad (leve, moderada, grave).
  4. Lista de sanciones: origen, fecha, gravedad, estado y “Ver detalle”.
- **Modales:** **S6a Detalle de sanción** (motivo, fechas, aviso si sigue vigente).
- **Estados:** C ✔ · V ✔ · E ✔.

### M2 · Instructor (escritorio; la Agenda también en tablet o móvil porque escanea QR con la cámara)

Va dentro de B5, en `DashboardInstructor.jsx`. La sección Torneos está en M4.

#### I1 · Agenda del día — `instructor/AgendaDia.jsx` · Kit (un `style=` necesario para el lector de QR)
- **Secciones:**
  1. Título y selector de **Fecha**.
  2. 2 KPI: clases e inscritos.
  3. Lista de **clases expandibles**: disciplina, hora, espacio y barra de cupo. Al expandir se ve la lista de alumnos, cada uno con **Presente / No-show / Quitar**, y los botones **Escanear QR** y **Agregar**.
- **Modales:**
  - **I1a Escanear QR:** usa la cámara, muestra el resultado (nombre del alumno) o un error.
  - **I1b Agregar al pase de lista:** pestañas *Socios* (buscador) y *Visitas activas*, con el botón Agregar en cada resultado.
- **Estados:** C ✔ · V ✔ (“Sin clases para este día”, “Sin alumnos inscritos”) · E ✔ (dentro de los modales).

#### I2 · Mis clases asignadas — `instructor/MisClases.jsx` · Kit
- **Secciones:** título con el número de sesiones a la semana; 3 KPI (hoy, alumnos, % de ocupación); selector de día; tarjetas de clase con barra de ocupación.
- **Estados:** C ✔ · V ✔ (“Sin clases para este día · prueba otro día”) · E ✘.

#### I3 · Métricas de rendimiento — `instructor/MetricasInstructor.jsx` · Kit
- **Secciones:** 4 KPI (promedio de asistencia, convocatoria mensual, sesiones de hoy, total de alumnos); tabla **Asistencia mensual** (mes y %); tabla **Convocatoria mensual** (mes y alumnos). *Candidatas a gráfica en el rediseño.*
- **Estados:** C ✔ · V ✔ · E ✘.

#### I4 · Monitoreo de la ludoteca — `instructor/MonitoreoLudoteca.jsx` · Kit
- **Secciones:** título con la hora de la última sincronización y el botón **Actualizar**; 4 KPI de semáforo (en la ludoteca, verde, amarillo, rojo); tarjetas por niño (entrada, tiempo transcurrido, barra de minutos y una acción).
- **Estados:** C ✔ · V ✔ · E ✔.

#### I5 · Sanciones del club (solo lectura) — `DashboardInstructor.jsx` (`VistaSancionesInstructor`) · Kit
- **Secciones:** 3 KPI (total, activas, resueltas); filtros (Buscar, Estado, Gravedad); tabla (socio, motivo, origen, fecha, gravedad, estado).
- **Estados:** C ✔ · V ✔ (con un mensaje distinto si hay filtros) · E ✘.

### M3 · Coordinador (escritorio)

Va dentro de B5, en `DashboardCoordinador.jsx`. **Ludoteca** usa `ControlLudoteca` (M5), **Sanciones** usa `SancionesPanel` (M5) y **Torneos** usa `TournamentBracket` (M4).

| ID | Vista | Archivo | Secciones y datos | Acciones | Modales | Estados | Estado actual |
|---|---|---|---|---|---|---|---|
| C1 | Resumen | `coordinador/DashboardResumen.jsx` | “Bienvenido al Panel de Coordinación”; 4 KPI (socios, visitas activas, reservas de hoy, sanciones activas); 4 tablas pequeñas: socios, visitas, reservas de hoy y sanciones | “Ver todo”, que lleva a cada sección | — | C ✔ V ✔ E ✘ | Kit |
| C2 | Socios (solo lectura) | `coordinador/VistaSocios.jsx` | 3 KPI que también funcionan como filtro (total, activos, inactivos); buscador; tabla (socio, número, tipo, modalidad, estado) | Buscar y filtrar por KPI | — | C ✔ V ✔ E ✘ | **Mixto**: la tabla es del kit pero los KPI y la carga tienen 35 `style=` |
| C3 | Visitas | `coordinador/VistaVisitas.jsx` | 3 KPI-filtro (en las instalaciones, finalizadas hoy, total del día); tabla (visitante, entrada, salida, duración, estado) | Filtrar por KPI | — | C ✔ V ✔ E ✘ | Kit |
| C4 | Reservas | `coordinador/VistaReservas.jsx` | 4 KPI-filtro (total, confirmadas, no-show, canceladas); selector de fecha; tabla (socio, espacio, horario, estado) | Cambiar la fecha y filtrar | — | C ✔ V ✔ E ✘ | Kit |
| C5 | Clases e instructores › **Sesiones** | `coordinador/GestionDisciplinas.jsx` | Botón “Nueva sesión”; 3 KPI-filtro (total, disponibles, llenas); Buscar y Fecha; contador; tabla (clase, instructor, horario, espacio, cupo, estado de cupo) | Ver inscritos, Editar, Eliminar | **C5a** Nueva o editar sesión (disciplina, instructor, espacio, día, hora de inicio y fin, cupo) · **C5b** Inscritos (barra de cupo y tabla de socios) | C ✔ V ✔ (+ CTA “Crear primera sesión”) E ✔ en los modales | Kit |
| C6 | Clases e instructores › **Instructores** | `coordinador/GestionInstructores.jsx` | “Nuevo instructor”; 3 KPI-filtro; buscador; tabla (instructor, especialidades, contacto, estado) | Editar y Eliminar | **C6a** Nuevo o editar instructor (nombre, especialidades, email, teléfono, activo) | C ✔ V ✔ (+ CTA) E ✔ en el modal | Kit |
| C7 | Espacios (solo lectura) | `coordinador/VistaEspacios.jsx` | 4 KPI (total, activos, inactivos, capacidad total); buscador; tabla (espacio, disciplina, capacidad, estado) | Buscar y filtrar | — | C ✔ V ✔ E ✘ | Kit |
| C8 | Evaluaciones de instructores | `components/evaluaciones-ui/ResultadosInstructor.jsx` | Selectores de Instructor y Mes; resumen (promedio de 0 a 5 y total); distribución por estrellas; tabla de evaluaciones (mes, clase, calificación, comentario) | Elegir instructor y mes; Reintentar | — | C ✔ V ✔ E ✔ | Kit |

> Las subpestañas “Disciplinas / Instructores” de la sección “Clases e instructores” están hechas con botones y `style=` dentro de `DashboardCoordinador.jsx`, y también se repiten en `Dashboard.jsx` (admin). Les corresponde el patrón **Pestañas** (sección 4).

### M4 · Torneos (todos los roles)

| ID | Vista | Archivo | Rol | Secciones, datos y acciones | Estados | Estado actual |
|---|---|---|---|---|---|---|
| T1 | Torneos › **Torneos** | `socio/Torneos.jsx` + `torneos-ui/TorneosListado.jsx` | Socio (móvil) | Título “Torneos y competencias”; pestañas Torneos · Mis participaciones · Brackets; filtros Disciplina y Estado; tabla (torneo, categoría, inicio, estado, inscritos). Al tocar una fila se abre T4 | C ✔ V ✔ (+ “Limpiar filtros”) E ✔ | Kit |
| T2 | Torneos › **Mis participaciones** | `torneos-ui/MisParticipaciones.jsx` | Socio | Tabla (torneo, categoría, inicio, estado). Al tocar una fila se abre T6 | C ✔ V ✔ E ✔ | Kit |
| T3 | Torneos › **Brackets** | `TournamentBracket` en modo `readOnly` | Socio | Es el mismo gestor que T7, en solo lectura y dentro del layout móvil | Igual que T7 | **Viejo** (no está pensado para móvil) |
| T4 | Modal Detalle de torneo | `torneos-ui/TorneoDetalleModal.jsx` | Socio | Badges (estado, individual o por equipos, inscrito), fechas, categoría, barra de inscritos y cupo. Botones Cerrar · Ver resultados · Inscribirme | — | Kit |
| T5 | Modal Inscribirme | `torneos-ui/InscripcionModal.jsx` | Socio | Confirmación y, si el torneo es por equipos, el nombre del equipo | E ✔ | Kit |
| T6 | Modal Resultados del torneo | `torneos-ui/ReporteTorneoModal.jsx` | Socio | Aviso del campeón; tabla de posiciones; filtro por ronda; tabla de encuentros (ronda, encuentro, marcador, ganador, cancha, fecha, estado) | C ✔ V ✔ E ✔ | Kit |
| T7 | **Gestor de torneos** (lista y detalle) | `components/TournamentBracket.jsx` (1 087 líneas) + `torneos/TournamentRow`, `DetalleTorneo`, `AccionesTorneo` | Admin y coordinador (editan); gerente e instructor (solo lectura) | Título y filtros (disciplina, estado, Aplicar, Limpiar). Vista en 2 columnas: **izquierda** con la lista de torneos y su contador, y el botón “Nuevo torneo”; **derecha** con el detalle del torneo (nombre, estado, fechas), los botones Editar y Ver inscritos, las **acciones de estado** (Cerrar inscripciones, Confirmar bracket, Finalizar, Cancelar, cada una con confirmación) y el bracket | C ✔ V ✔ (“No hay torneos”, “Selecciona un torneo”) E ✔ con Reintentar | **Viejo** (70 `style=`) |
| T8 | Bracket y edición de un encuentro | `torneos/BracketVisual.jsx` + `torneos/MatchEditPanel.jsx` | Igual que T7 | Rondas en columnas con los encuentros conectados. Al hacer clic en un encuentro se abre un panel con el marcador A/B, ganador, cancha, fecha y hora, estado, y los botones Guardar y Cancelar | C ✔ V ✔ (“Sin bracket · cierra las inscripciones…”) E ✔ | Viejo |
| T9 | Modal Crear o editar torneo | dentro de `TournamentBracket.jsx` | Admin y coordinador | Nombre, disciplina, modalidad, categoría, tipo, fechas, cupo y validación por campo | E ✔ | Viejo. **Nota:** ya existe `torneos-ui/TorneoFormModal.jsx` hecho con el kit, pero **no se usa en ningún lado** |
| T10 | Modal Participantes inscritos | dentro de `TournamentBracket.jsx` | Admin y coordinador | Tabla (tipo, participante…), botón para desinscribir y botón “Inscribir participante” | C ✔ V ✔ E ✔ | Viejo |
| T11 | Modal Inscribir participante | `torneos/InscribirModal.jsx` | Admin y coordinador | Individual o equipo, buscador de socio y nombre del equipo | E ✔ | Viejo |

> `components/torneos/ResultadosTorneo.jsx` **no se usa en ningún lado** (T6 lo reemplazó). Se puede borrar dentro de M4.

### M5 · Operación diaria (compartida entre admin, recepción y coordinador) — *ajuste a la propuesta*

**Por qué hice este cambio:** de las 6 secciones de Recepción, 5 usan exactamente los mismos componentes que Admin (`GestionSocios`, `admin/Reservas` a través de `CentralReservas`, `SancionesPanel`) o copias casi idénticas (`GestionVisitas` ≈ `admin/RecepcionVisitas`, `recepcion/ControlLudoteca` ≈ `admin/Ludoteca`). Si se diseñan una sola vez aquí, Admin, Recepción y Coordinador quedan listos en un único PR.

| ID | Vista | Archivo(s) | Lo usa | Secciones y datos | Acciones | Modales | Estados | Estado actual |
|---|---|---|---|---|---|---|---|---|
| O1 | **Gestión de socios** | `admin/GestionSocios.jsx` | Admin, gerente, recepción | Encabezado “Gestión de socios” con buscador (nombre, número, email, CURP); filtros (número, orden alfabético, tipo, estado); tabla (número, nombre, tipo, estado, teléfono, parentesco, sanciones, acciones con íconos) | **Importar Excel**, Nuevo socio; por fila: ver, QR, editar, inactivar, reactivar, eliminar definitivamente | **O1a** Nuevo o editar socio (formulario largo con datos personales y acción familiar) · **O1b** Detalle del socio (lista de campos) · **O1c** QR del socio (descargar) · **O1d** Resultado de la importación (tabla de errores: fila, columna, valor, motivo) | C ✔ V ✔ E (toast) | **Mixto** (Table, Modal y Button del kit, pero también `AdminUI` y 35 `style=`) |
| O2 | **Recepción y visitas** | `admin/RecepcionVisitas.jsx` **y** `recepcion/GestionVisitas.jsx` (casi duplicadas) | Admin y recepción | Encabezado con buscador y “Registrar pase”; 4 KPI (pases activos, finalizados, visitas, pases de un día); tarjetas de las **visitas activas** (visitante, anfitrión, observaciones); tabla de **historial** con filtro (visitante, tipo, anfitrión, entrada, salida, estado) | Registrar pase, ver detalle, editar, ver QR, finalizar | **O2a** Registrar pase (tipo, datos del visitante, identificación, socio anfitrión con buscador, observaciones) · **O2b** QR de acceso generado (imprimir, descargar, enviar por correo, vigencia) · **O2c** Detalle del pase o visita | C ✔ V ✔ E ✔ (Reintentar, solo en recepción) | Admin **mixto** · Recepción **viejo** |
| O3 | **Sistema de reservas** (cuadrícula) | `admin/Reservas.jsx` (+ `recepcion/CentralReservas.jsx`, que solo lo envuelve) | Admin y recepción | Barra de herramientas: Nueva reserva, día anterior/siguiente, “Hoy”, Actualizar, filtro de espacio, leyenda (confirmada, pendiente, no-show, sesión, mantenimiento). **Cuadrícula de espacios × horas** con bloques de color; aviso de “club cerrado” los lunes | Crear haciendo clic en un hueco o con el botón; en cada bloque: editar, cancelar, eliminar | **O3a** Nueva o editar reserva | C ✔ V ✔ E (toast) | **Viejo** |
| O4 | **Control de la ludoteca** | `recepcion/ControlLudoteca.jsx` **y** `admin/Ludoteca.jsx` (casi duplicadas) | Recepción, coordinador y admin | Título y “Registrar entrada”; 3 KPI (en la ludoteca, por vencer, excedidos); tarjetas por niño con **semáforo**, tutor, tiempo y botón **Registrar salida**; **historial de 7 días** que se despliega, con buscador | Registrar entrada, registrar salida, buscar en el historial | **O4a** Registrar entrada (buscador de tutor, niño, fecha de nacimiento, observaciones) · **O4b** Ticket de la ludoteca (imprimir) | C ✔ V ✔ E (toast) | **Viejo** (más de 120 `style=` en cada archivo) |
| O5 | **Panel de sanciones** | `components/SancionesPanel.jsx` (923 líneas) | Admin, gerente (solo lectura), coordinador, recepción | “Control disciplinario” y título; 3 indicadores (total filtrado, activas, resueltas); filtros (búsqueda, gravedad, estado, origen); tabla paginada (socio, origen, motivo, fecha, estado y acciones) | Nueva sanción, Actualizar, Ver detalle, páginas | **O5a** Detalle de la sanción (datos completos, quién la resolvió; Resolver y Editar) · **O5b** Nueva o editar sanción (buscador de socio, gravedad, origen, motivo) | C ✔ V ✔ E (toast) | **Viejo** (usa `shared/Modal`) |

### M6 · Administración (incluye el inicio de recepción)

Va dentro de B5, en `Dashboard.jsx` (admin y gerente) y `DashboardRecepcion.jsx`.

| ID | Vista | Archivo | Rol | Secciones, datos y acciones | Modales | Estados | Estado actual |
|---|---|---|---|---|---|---|---|
| A1 | **Inicio de admin y gerente** | `Dashboard.jsx` (pestaña dashboard) + `admin/OccupancyByHourChart.jsx` | Admin y gerente | Selector de periodo (semana, quincena, mes) y Actualizar; 5 KPI **con tendencia** (total de socios, accionistas, rentistas, reservas de hoy, sanciones activas); **gráfica de ocupación por hora**; composición de socios; resumen del día; reservas recientes | — | C ✔ (spinner) V ✔ por tarjeta E ✔ | Viejo (56 `style=`) |
| A2 | **Inicio de recepción** | `recepcion/DashboardResumen.jsx` | Recepción | “Recepción del club” y Actualizar; 4 KPI que se pueden pulsar (socios dentro, visitas activas, niños en la ludoteca, sanciones); paneles: socios dentro (accionistas y rentistas), ocupación de la ludoteca, reservas de hoy (activas, canceladas, no-show), pases activos y accesos rápidos | — | C ✔ V — E ✘ | Viejo |
| A3 | Disciplinas deportivas | `admin/Disciplinas.jsx` | Admin | Encabezado con buscador y “Nueva”; **tarjetas** de disciplina con Editar y Eliminar | **A3a** Nueva o editar disciplina | C ✔ V ✔ E (toast) | Viejo |
| A4 | Clases e instructores | `Dashboard.jsx` (pestaña sesiones) | Admin | **Reutiliza C5 y C6** con subpestañas “Sesiones / Instructores”. No hay que diseñarla aparte | — | — | Las vistas son del kit; las subpestañas no |
| A5 | Gestión de usuarios | `admin/GestionUsuarios.jsx` | Admin | Encabezado con buscador y “Nuevo usuario”; filtros (rol, estado, orden); tabla (nombre, email, rol, teléfono, estado y acciones: ver, editar, inactivar, reactivar, eliminar) | **A5a** Nuevo o editar usuario · **A5b** Detalle del usuario | C ✔ V ✔ E (toast) | Viejo |
| A6 | Configuración de espacios | `admin/ConfiguracionEspacios.jsx` | Admin | Encabezado con buscador y “Nuevo espacio”; filtros (disciplina, estado); **tarjetas** de espacio con acciones (historial, editar, mantenimiento, inactivar, reactivar) | **A6a** Nuevo o editar espacio · **A6b** Poner en mantenimiento (motivo, fechas) · **A6c** Historial de mantenimiento | C ✔ V ✔ (+ CTA) E ✔ (en el historial) | Viejo |
| A7 | Centro de reportes | `admin/ReportesDescargas.jsx` | Admin y gerente | 4 tarjetas de reporte (demografía de socios, ocupación de espacios, afluencia y días frecuentados, sanciones por periodo), cada una con rango de fechas y botones **Excel** y **PDF** | — | E (toast) | Viejo |
| A8 | Auditoría del sistema | `admin/AuditoriaLogs.jsx` | Solo admin | Encabezado con buscador, botón de filtros que se despliegan y Refrescar; filtros (tabla afectada, tipo de acción, limpiar); tabla (fecha y hora, usuario, acción, tabla, detalles, IP) | — | C ✔ V ✔ E ✘ | Viejo |

### M7 · Público

| ID | Vista | Ruta y archivo | Secciones y acciones | Estados | Estado actual |
|---|---|---|---|---|---|
| P1 | **Home (landing)** | `/` · `pages/Home.jsx` | Navbar (Nosotros, Disciplinas, Membresía, **Ingresar**); **hero** (“Tu mejor versión empieza aquí”, Hazte socio, Explorar, 4 cifras); Sobre nosotros; Disciplinas destacadas (3 tarjetas); Cómo funciona (4 pasos); Elige tu disciplina (tarjetas con flecha); cita; **CTA** (“Registrarme ahora”, “Ya soy socio”); footer (Morelia, Michoacán). Todo el contenido es fijo | — | Viejo (`home.css`) |
| P2 | **Login** | `/login` · `pages/Login.jsx` | Logo; “Club Social y Deportivo”; correo; contraseña con botón para mostrarla; error de credenciales; Ingresar; **bloque “Credenciales de prueba”** (socio, instructor, admin) | C ✔ (en el botón) E ✔ | Viejo (`login.css`) |
| P3 | Vista de espacios (huérfana) | `/espacios` · `pages/Espacios.jsx` + `components/CardEspacio.jsx` | Filtros de fecha y hora y tarjetas de espacios. **Ningún enlace lleva aquí** y usa clases de Tailwind, que **el proyecto no tiene instalado**, así que se ve sin estilos | ✘ | Viejo. **Decidir:** eliminarla o rediseñarla |

> Otras rutas que no se diseñan: `/ui-kit` (playground, solo en desarrollo), `/components/socio-layout` (ruta de prueba que sobró; conviene quitarla) y `*`, que redirige al Home (no existe página 404).

---

## 2. Módulos y plan de PRs

| Módulo | Vistas | Ya con kit | Mixto o viejo | Tamaño | Depende de |
|---|---|---|---|---|---|
| **M0 Base** | 8 (B1–B8) | 0 | 8 | **L** | — |
| **M1 Socio** | 17 | 17 | 0 | **M** | M0 |
| **M2 Instructor** | 7 | 7 | 0 | **S** | M0 |
| **M3 Coordinador** | 11 | 10 | 1 (C2) | **M** | M0 |
| **M4 Torneos** | 11 | 5 | 6 | **L** | M0 (y un SocioPicker de M0 o M5) |
| **M5 Operación diaria** | 17 | 0 | 17 (5 mixtas y 12 viejas) | **L+** (conviene partirlo en 2 PR, ver abajo) | M0 |
| **M6 Administración** | 13 | 0 | 13 | **L** | M0, M3 (A4 reutiliza C5 y C6) |
| **M7 Público** | 3 | 0 | 3 | **S** | M0 (solo tokens) |
| **Total** | **87** | **39** | **48** | | |

> El conteo incluye las pestañas internas y los modales con diseño propio. El modal de confirmación del éxito de inscripción (S3d) se contó como un estado del mismo modal. A4 no se cuenta porque reutiliza C5 y C6.

### Orden sugerido y contenido de cada PR

1. **M0 Base**
   1. Revisar los tokens (corregir el contraste de `--color-primary`).
   2. Agregar al kit los componentes que faltan (sección 4: `PageHeader`, `Tabs`, `IconButton`, `EmptyState`, `Spinner`/`Skeleton`, `ConfirmDialog`, `Toast`, `FilterBar`, `DescriptionList`, `SocioPicker`, `QrCard`, `DatePager`).
   3. **Un solo `StaffLayout`** que reemplace los 4 marcos actuales.
   4. **Barra flotante móvil con etiquetas** para socio. Hoy tiene 7 ítems y conviene bajarla a 5: Inicio, Reservas, Clases, Torneos y “Más” (que agrupe Ludoteca, Evaluar e Historial).
   5. Panel de notificaciones y diálogo global de confirmación.
   6. Título por sección: `document.title` y encabezado consistente.
   - **Cuidado:** M0 cambia el marco de todas las pantallas. Si el diseño de las vistas todavía no está, el resultado mezcla lo nuevo con lo viejo, pero no se rompe nada.
2. **M1 Socio**: ya usa el kit; es más que nada aplicar el diseño de Stitch. Es lo que más ven los usuarios.
3. **M2 Instructor**: pequeño, sirve como prueba del `StaffLayout`.
4. **M3 Coordinador**: termina C2 y unifica las KPI-filtro. Las secciones Ludoteca, Sanciones y Torneos se quedan con el diseño viejo hasta M4 y M5.
5. **M4 Torneos**:
   1. Partir `TournamentBracket.jsx` en lista, detalle, bracket y panel de edición.
   2. Usar `TorneoFormModal` (ya existe con el kit) en lugar del formulario en línea.
   3. Hacer un bracket que funcione en móvil (por ejemplo, rondas que se desplazan de lado) para T3.
6. **M5 Operación diaria**. Recomiendo **dos PR**:
   - **M5a:** Socios (O1) y Visitas (O2).
   - **M5b:** Reservas (O3), Ludoteca (O4) y Sanciones (O5).
   - Unificar las copias duplicadas (O2 y O4) **cambia la lógica**: hay que tomar la decisión antes. Ver “Hallazgos”.
7. **M6 Administración**: inicio con gráficas (falta un componente de gráfica en el kit), CRUD de usuarios, espacios y disciplinas, reportes y auditoría.
8. **M7 Público**: landing y login. Se puede adelantar en cualquier momento porque solo depende de los tokens.

---

## 3. Briefs para Stitch

> **Instrucciones de estilo para pegar al inicio de cada brief.** Salen de `src/styles/tokens.css`; si en Stitch se decide otro estilo, se actualizan los tokens.
>
> ```
> Sistema visual: app de un club social y deportivo en México, en español.
> Tipografía: Plus Jakarta Sans (títulos en extra-bold 800, cuerpo 14px). Playfair Display solo para títulos decorativos.
> Color: primario azul cielo (#0284C7, más oscuro para cumplir contraste AA en botones), acento cian #06B6D4,
> azul marino de marca #0F2146, neutros slate (fondo #F1F5F9, superficies blancas, sidebar #0F172A).
> Estados: éxito verde, advertencia ámbar, peligro rojo, info azul; etiquetas extra morado y naranja.
> Bordes redondeados de 8–12px, sombras suaves, mucho aire, densidad media.
> Íconos de línea estilo Lucide. Sin degradados decorativos.
> Toda pantalla debe incluir sus estados: cargando (skeleton), vacío (ilustración simple + texto + acción) y error (mensaje + Reintentar).
> ```

### M0 · Base

```
Tipo: Mobile (socio) + Web (personal)

1. Marco del socio (móvil): encabezado con el logo "Club Social y Deportivo", botón "Mi QR",
   campana con contador y avatar con menú (nombre, "Socio familiar", Cerrar sesión).
   Barra de navegación flotante abajo con ícono + etiqueta: Inicio, Reservas, Clases, Torneos, Más.
   "Más" abre una hoja inferior con: Ludoteca, Evaluar, Historial.
2. Marco del socio (escritorio): el mismo encabezado y pestañas horizontales debajo.
3. Panel de notificaciones: lista con ícono por tipo (reserva, clase, ludoteca), título, mensaje,
   "hace X min" y punto de no leída; "Leer todas"; eliminar una; estado vacío "Sin notificaciones".
4. Modal "Mi QR de acceso": QR grande, nombre, "Socio #1234", texto "Muéstralo en recepción".
5. Marco del personal (web): sidebar oscuro con el logo, secciones agrupadas con ícono, avatar con
   "cambiar foto" y cerrar sesión. Encabezado con el título de la sección, subtítulo, campana de alertas
   y acciones a la derecha. En tablet/móvil el sidebar se convierte en un menú lateral (hamburguesa).
6. Panel de alertas del personal: alertas de los últimos 3 días, descartar una, "Borrar todas",
   estado vacío "Todo al día".
7. Toast (éxito, error, info) y diálogo de confirmación (normal y destructivo).
```

### M1 · Socio

```
Tipo: Mobile

1. Inicio: saludo "Buen día, {nombre}" con avatar; 4 KPI (reservas de hoy, torneos activos,
   niños en la ludoteca, sanciones activas); tarjetas: Reservas de hoy, Mis torneos, Ludoteca,
   Sanciones activas (esta solo si hay). Cada tarjeta tiene su estado vacío con un atajo.
2. Reservar cancha (asistente de 3 pasos en una sola pantalla):
   arriba "Mis reservas de hoy" con Cancelar en cada una;
   paso 1, chips de disciplina; paso 2, tarjetas de cancha; paso 3, cuadrícula de horarios
   (libre / ocupado / clase / pasado) + duración (1–2 h) + botón fijo "Reservar".
   Modal "Confirmar reserva" con el resumen. Estado especial: "El club está cerrado hoy".
3. Clases: pestañas "Mis clases" / "Catálogo".
   - Mis clases: tarjetas (clase, instructor, día y hora, espacio, estatus) + "Cancelar inscripción".
   - Catálogo: botón "Filtros (n)" + "Limpiar"; tarjetas con indicador de cupo y
     botón Inscribirme / Inscrito / Lleno.
   - Hoja de filtros: disciplinas, días e instructores (checkbox); Limpiar / Aplicar.
   - Modal de confirmar inscripción → estado de éxito "¡Inscripción exitosa!".
   - Modal de cancelar inscripción (destructivo).
4. Evaluar instructores: lista de clases confirmadas (clase, instructor, fecha,
   "Evaluada" / "Sin instructor") + botón Evaluar.
   Modal "Evaluar clase": 5 estrellas grandes + comentario opcional.
5. Ludoteca: alerta si algún niño pasó del tiempo; tarjeta "Aforo actual" con barra;
   pestañas Activos / Historial / Cómo funciona.
   - Activos: tarjeta por niño (nombre, entrada, barra de tiempo) + Mostrar QR.
   - Historial: lista de visitas completadas.
   - Cómo funciona: pasos numerados.
   - Modal "Registrar entrada": nombre del niño + fecha de nacimiento.
   - Modal "Código QR" de la entrada.
6. Estado de cuenta (Historial): badge "Cuenta limpia / Con sanciones"; 3 KPI (activas, total, resueltas);
   explicación de la gravedad (leve, moderada, grave); lista de sanciones (origen, fecha, gravedad, estado)
   → modal Detalle (motivo, fechas, aviso de vigente).
```

### M2 · Instructor

```
Tipo: Web (la pantalla 1 también en tablet)

1. Agenda del día: selector de fecha; 2 KPI (clases, inscritos); lista de clases desplegables
   (disciplina, hora, espacio, barra de cupo). Al desplegar: lista de alumnos con
   Presente / No-show / Quitar, y los botones "Escanear QR" y "Agregar".
   - Modal "Escanear QR": vista de la cámara + resultado (nombre del alumno) o error.
   - Modal "Agregar al pase de lista": pestañas Socios (buscador) / Visitas activas, con Agregar.
2. Mis clases: 3 KPI (hoy, alumnos, % de ocupación); selector de día de la semana; tarjetas de clase con barra de ocupación.
3. Métricas: 4 KPI (promedio de asistencia, convocatoria mensual, sesiones de hoy, total de alumnos);
   gráfica de barras de "Asistencia mensual (%)" y "Convocatoria mensual (alumnos)".
4. Monitoreo de la ludoteca: usa el patrón "Tarjetas con semáforo" (sección de patrones), con KPI
   verde/amarillo/rojo, hora de la última sincronización y botón Actualizar.
5. Sanciones (solo lectura): usa el patrón "Listado con filtros" (buscar, estado, gravedad).
```

### M3 · Coordinador

```
Tipo: Web

1. Resumen: "Bienvenido al panel de coordinación"; 4 KPI (socios, visitas activas,
   reservas de hoy, sanciones activas); 4 tablas pequeñas (socios, visitas, reservas, sanciones),
   cada una con "Ver todo".
2. Socios / Visitas / Reservas / Espacios (solo lectura) → diseñar UNA vez el patrón
   "Listado con KPI-filtro": fila de KPI que se pueden pulsar como filtro + buscador o fecha + tabla.
   - Socios: KPI total/activos/inactivos; tabla socio, número, tipo, modalidad, estado.
   - Visitas: KPI en las instalaciones / finalizadas hoy / total; tabla visitante, entrada, salida, duración.
   - Reservas: selector de fecha; KPI total/confirmadas/no-show/canceladas; tabla socio, espacio, horario, estado.
   - Espacios: KPI total/activos/inactivos/capacidad; tabla espacio, disciplina, capacidad, estado.
3. Clases e instructores: pestañas Sesiones / Instructores.
   - Sesiones: "Nueva sesión"; KPI total/disponibles/llenas; buscador + fecha;
     tabla clase, instructor, horario, espacio, cupo (barra), estado; acciones Inscritos / Editar / Eliminar.
     Modal Nueva o editar sesión (disciplina, instructor, espacio, día, hora de inicio y fin, cupo).
     Modal Inscritos (barra de cupo + lista de socios).
   - Instructores: "Nuevo instructor"; KPI total/activos/inactivos; buscador;
     tabla instructor, especialidades, contacto, estado; Editar / Eliminar.
     Modal instructor (nombre, especialidades, email, teléfono, activo).
4. Evaluaciones de instructores: selectores de instructor y mes; promedio grande X/5 + total;
   distribución por estrellas (barras); tabla de comentarios.
```

### M4 · Torneos

```
Tipo: Mobile (socio) + Web (gestión)

Socio (Mobile):
1. Torneos: pestañas Torneos / Mis participaciones / Brackets; filtros de disciplina y estado;
   tarjetas o filas de torneo (nombre, disciplina, categoría, inicio, estado, inscritos/cupo).
2. Detalle del torneo (hoja inferior): badges de estado, modalidad (individual/equipos) e "Inscrito";
   fechas; barra de inscritos; Ver resultados / Inscribirme.
3. Inscribirme: confirmación (+ nombre del equipo si es por equipos).
4. Resultados: tarjeta de campeón; posiciones; filtro por ronda; lista de encuentros (marcador, ganador, cancha, hora).
5. Bracket en móvil: rondas como columnas con scroll horizontal o con selector de ronda; encuentros en tarjetas.

Gestión (Web: admin y coordinador editan; gerente e instructor solo ven):
6. Gestor de torneos: filtros arriba; vista de 2 columnas: lista de torneos a la izquierda (con "Nuevo torneo")
   y a la derecha el detalle (nombre, estado, fechas), Editar, Inscritos (n) y las acciones según el
   estado (Cerrar inscripciones → Confirmar bracket → Finalizar; Cancelar torneo); debajo, el bracket.
   Estado vacío "Selecciona un torneo".
7. Bracket con edición: al hacer clic en un encuentro se abre un panel lateral (marcador A/B, ganador, cancha,
   fecha y hora, estado; Guardar / Cancelar). Estado vacío "Cierra las inscripciones para generar el bracket".
8. Modal Crear o editar torneo: nombre, disciplina, modalidad, categoría, tipo, fechas, cupo.
9. Modal Inscritos: tabla de participantes con Desinscribir + botón "Inscribir participante".
10. Modal Inscribir participante: individual/equipo, buscador de socio, nombre del equipo.
```

### M5 · Operación diaria

```
Tipo: Web (también en tablet en recepción)

1. Gestión de socios: encabezado con buscador (nombre, número, email, CURP), "Importar Excel" y "Nuevo socio";
   filtros (tipo, estado, orden); tabla (número, nombre, tipo, estado, teléfono, parentesco,
   sanciones) con acciones en íconos: ver, QR, editar, inactivar, reactivar, eliminar.
   - Formulario de socio en modal (datos personales, contacto, CURP, dirección, tipo, acción familiar).
   - Detalle del socio (lista de campos).
   - QR del socio (patrón "Tarjeta QR": descargar).
   - Resultado de la importación (correctos / con error + tabla fila, columna, valor, motivo).
2. Recepción y visitas: buscador + "Registrar pase"; 4 KPI (pases activos, finalizados hoy,
   visitas, pases de un día); tarjetas de las visitas activas (visitante, anfitrión, notas, Ver detalle);
   historial con filtro y tabla (visitante, tipo, anfitrión, entrada, salida, estado).
   - Registrar pase: tipo (visita / pase de un día), nombre, correo, identificación,
     socio anfitrión (buscador), observaciones.
   - QR de acceso generado: QR, vigencia, Imprimir / Descargar / Enviar por correo.
   - Detalle del pase: datos, Ver QR, Editar, Finalizar.
3. Sistema de reservas: barra (Nueva reserva, ‹ fecha ›, Hoy, Actualizar, filtro de espacio)
   y leyenda; cuadrícula de espacios (filas) × horas (columnas) con bloques de color por estado;
   espacio en mantenimiento rayado; aviso "Lunes — club cerrado".
   Modal Nueva o editar reserva (socio, espacio, fecha, hora de inicio y fin, estado).
4. Control de la ludoteca: "Registrar entrada"; KPI en la ludoteca / por vencer / excedidos;
   tarjetas por niño con semáforo (verde/ámbar/rojo), tutor, tiempo y "Registrar salida";
   historial de 7 días desplegable con buscador.
   - Registrar entrada: buscador de tutor, nombre y fecha de nacimiento del niño, observaciones.
   - Ticket de la ludoteca (para imprimir).
5. Sanciones: encabezado "Control disciplinario" + "Nueva sanción"; 3 indicadores; filtros
   (búsqueda, gravedad, estado, origen); tabla paginada (socio, origen, motivo, fecha, estado, Ver).
   - Detalle de la sanción: datos completos, quién la resolvió; Resolver / Editar.
   - Nueva o editar sanción: buscador de socio, gravedad, origen, motivo.
   Variante de solo lectura (gerente e instructor): sin botones de escritura.
```

### M6 · Administración

```
Tipo: Web

1. Inicio admin/gerente: selector de periodo (semana, quincena, mes) + Actualizar;
   5 KPI con tendencia (↑/↓ %): total de socios, accionistas, rentistas, reservas de hoy, sanciones activas;
   gráfica de ocupación por hora (barras); composición de socios (dona accionistas/rentistas);
   resumen del día; tabla de reservas recientes.
2. Inicio recepción: "Recepción del club" + Actualizar; 4 KPI que se pueden pulsar (socios dentro,
   visitas activas, niños en la ludoteca, sanciones); paneles: socios dentro (accionistas/rentistas),
   ocupación de la ludoteca (barra), reservas de hoy (activas, canceladas, no-show), pases activos
   (visitas / pases de un día), accesos rápidos (Registrar visita, Ludoteca, Reservas).
3. Catálogos con tarjetas → diseñar UNA vez el patrón "Catálogo en tarjetas con acciones":
   - Disciplinas: tarjetas (nombre, descripción) con Editar / Eliminar; modal Nueva o editar.
   - Configuración de espacios: filtros de disciplina y estado; tarjetas (nombre, disciplina, capacidad,
     estado: activo / mantenimiento / inactivo) con Historial, Editar, Mantenimiento, Inactivar o Reactivar;
     modal de espacio, modal "Poner en mantenimiento" (motivo, fechas), modal de historial.
4. Gestión de usuarios: patrón "Listado con filtros" (rol, estado, orden); tabla nombre, email,
   rol, teléfono, estado y acciones en íconos; modal de usuario; modal de detalle.
5. Centro de reportes: 4 tarjetas (demografía de socios, ocupación de espacios, afluencia y días
   frecuentados, sanciones por periodo), cada una con su descripción, rango de fechas y botones Excel / PDF.
6. Auditoría: buscador + Filtros (tabla afectada, tipo de acción) + Refrescar; tabla
   fecha y hora, usuario, acción (badge), tabla, detalles, IP.
```

### M7 · Público

```
Tipo: Web (responsive)

1. Landing: navbar (Nosotros, Disciplinas, Membresía, botón Ingresar); hero "Tu mejor versión
   empieza aquí" con Hazte socio / Explorar instalaciones y 4 cifras; Sobre nosotros;
   Disciplinas destacadas (3 tarjetas con foto); Cómo funciona (4 pasos); Elige tu disciplina
   (tarjetas); cita inspiradora; CTA final (Registrarme ahora / Ya soy socio); footer (Morelia, Michoacán).
2. Login: logo, "Club Social y Deportivo", correo, contraseña con botón para mostrarla,
   error de credenciales, botón Ingresar con estado de carga. (Sin bloque de credenciales de prueba.)
3. (Opcional) Página 404 con un enlace de regreso.
```

---

## 4. Patrones reutilizables (diseñar una vez → componente del kit)

| # | Patrón | Dónde se repite | En el kit hoy | Propuesta |
|---|---|---|---|---|
| 1 | **Encabezado de sección** (título, subtítulo, contador, acciones a la derecha) | Casi todas las vistas; hoy hay 3 versiones (`Text heading`, `AdminUI.ModuleHeader`, `<h3>` en línea) | ✘ | `PageHeader` |
| 2 | **Fila de KPI** (con tono, ícono, tendencia y opción de usarse como filtro) | S1, S6, I2–I5, C1–C7, O2, O4, O5, A1, A2 | `StatCard` (sin tendencia ni estado de seleccionado) | Agregar a `StatCard` las props `trend`, `selected` y `onClick` |
| 3 | **Listado con filtros y tabla** (buscador, selects, fecha, contador, tabla, paginación) | I5, C2–C7, O1, O2, O5, A5, A8, T1 | `Table`, `Input`, `Select`; `shared/FilterBar` es viejo | `FilterBar` y paginación en `Table` |
| 4 | **Formulario en modal** (el mismo para crear y editar, con validación por campo) | S5d, C5a, C6a, T9, T11, O1a, O2a, O3a, O4a, O5b, A3a, A5a, A6a, A6b | `Modal`, `Input`, `Select`, `Textarea`, `Checkbox` | Plantilla `FormModal` (secciones y ancho de 1 o 2 columnas) |
| 5 | **Modal de detalle** (pares etiqueta/valor y acciones) | S6a, T4, O1b, O2c, O5a, A5b, A6c | ✘ | `DescriptionList` |
| 6 | **Diálogo de confirmación** (normal o destructivo) | S3e, eliminar en todos los CRUD y acciones de torneo | Viejo (`NotificationContext`) | `ConfirmDialog` en el kit |
| 7 | **Estados cargando, vacío y error** | Todas; hoy hay 4 versiones distintas (`Text muted`, `AdminUI`, `torneos/EmptyState`, `ErrorReintentar`) | Solo los props `empty*` de `Table` | `EmptyState`, `Skeleton`/`Spinner` y `ErrorState` con Reintentar |
| 8 | **Pestañas y subpestañas** | S3, S5, T1, I1b, C5/C6, A4 | Se arman con `Button role="tab"` | `Tabs` (y una variante segmentada para subpestañas) |
| 9 | **Tarjeta de entidad con acciones** (título, filas de datos, badge y botones en el pie) | Clases (S3), canchas (S2), visitas activas (O2), disciplinas (A3), espacios (A6), torneos | `Card` | Agregar a `Card` las ranuras `meta` y `footer` |
| 10 | **Tarjeta con temporizador y semáforo** | S5a, I4, O4 (está 2 veces) | `ProgressBar` | `TimerCard` (verde, ámbar o rojo según el tiempo) |
| 11 | **Tarjeta QR** (QR, nombre, vigencia; imprimir, descargar, correo) | B4, S5e, O1c, O2b, O4b (ticket) | ✘ | `QrCard` |
| 12 | **Buscador de socio** (autocompletar con nombre y número) | I1b, T11, O2a (anfitrión), O4a (tutor), O5b | ✘ (hay 5 implementaciones) | `SocioPicker` |
| 13 | **Acciones de fila con íconos** (ver, editar, eliminar, reactivar, QR) | O1, A5, A6, O3, T10 | ✘ | `IconButton` (con tooltip y `aria-label`) |
| 14 | **Selector de fecha con navegación** (‹ fecha ›, Hoy) | O3, I1, C4, C5 | `Input type=date` | `DatePager` |
| 15 | **Badge de estado con mapa único** (reserva, sanción, torneo, visita, cupo) | Casi todas; cada archivo tiene sus propios colores | `Badge` | Un mapa central de estado → variante |
| 16 | **Barra de cupo u ocupación** | S2, S3, S5, I1, I2, C5b, T4, A2 | `ProgressBar` | Ya existe; solo falta definir los umbrales (50/80/100 %) |
| 17 | **Gráficas** (barras, dona, tendencia) | A1, I3, C8, A2 | ✘ | `Chart` (fuera del kit actual; requiere decidir librería) |
| 18 | **Notificaciones** (campana, panel y toast) | B2, B3, B7, B8 | ✘ | `NotificationPanel` y `Toast` |
| 19 | **Asistente por pasos** | S2 (reservar en 3 pasos) | ✘ | Solo como estilo de `Card` numerada; no hace falta componente |

---

## 5. Hallazgos para decidir antes de implementar

1. **Duplicados que conviene unificar en M5** (es un cambio de lógica, no solo de presentación):
   - `admin/Ludoteca.jsx` (685 líneas) y `recepcion/ControlLudoteca.jsx` (631) son prácticamente iguales.
   - `admin/RecepcionVisitas.jsx` (883) y `recepcion/GestionVisitas.jsx` (917) solo cambian en textos menores (“Finalizados” / “Finalizados hoy”), el botón Reintentar y el campo de socio asociado.
2. **Código huérfano:** `torneos/ResultadosTorneo.jsx`, `torneos-ui/TorneoFormModal.jsx` (está hecho con el kit pero nadie lo usa; aprovecharlo en M4), `pages/Espacios.jsx` (ruta sin enlace y con clases de Tailwind que no existen) y la ruta `/components/socio-layout`.
3. **Enlace roto:** los botones “Hazte socio” y “Registrarme ahora” del Home llevan a `/alta-socio`, que no existe, así que regresan al Home. Hay que decidir el destino (¿un formulario de solicitud? ¿WhatsApp o contacto?).
4. **El login muestra credenciales de prueba** (incluida la de admin). Hay que quitarlas o mostrarlas solo en desarrollo.
5. **Contraste:** el texto blanco sobre `sky-500` (`--color-primary`) tiene un contraste de aproximadamente 2.8:1 y no cumple AA. Conviene cambiar el token en M0.
6. **Vistas que cuentan como migradas pero no lo están del todo:** `GestionSocios` (35 `style=`), `RecepcionVisitas` (21) y `VistaSocios` (35). Se terminan en M5 y M3.
7. **Navegación del personal sin URL** (sección 0): conviene decidirlo en M0.
8. **La barra móvil del socio tiene 7 ítems**, que es demasiado para una barra inferior. La propuesta es dejar 5 e incluir “Más”.
9. **Recepción no tiene navegación móvil**, aunque es probable que se use en tablet. `StaffLayout` lo resolvería.

---

## 6. Decisiones

> Se tomaron después de revisar los hallazgos de la sección 5. Cada una se aplica en el PR del módulo que se indica. Si algo contradice lo que dicen las secciones 2 a 5, manda esta sección.

| # | Decisión | Módulo | Cómo aplicarla |
|---|---|---|---|
| D1 | **Unificar los duplicados** de Ludoteca (`admin/Ludoteca.jsx` y `recepcion/ControlLudoteca.jsx`) y de Visitas (`admin/RecepcionVisitas.jsx` y `recepcion/GestionVisitas.jsx`) en un solo componente para cada uno | M5 | La descripción del PR debe **explicar el cambio de lógica**: cuál versión se tomó como base y qué diferencias se conservaron (por ejemplo, “Finalizados hoy”, el botón Reintentar y el campo de socio asociado) |
| D2 | **Rutas propias para el personal** (en lugar del `activeTab` interno) | M0 | Va en **un commit aparte** dentro del PR de M0, separado de los cambios visuales |
| D3 | **Barra móvil del socio**: Inicio · Reservar · Clases · Torneos · **Más**. “Más” agrupa Evaluar, Ludoteca y Sanciones | M0 | Sustituye la propuesta de la sección 2. En el brief de Stitch de M0, “Más” abre una hoja con Evaluar, Ludoteca y Sanciones |
| D4 | **“Hazte socio”** (y “Registrarme ahora”) abre un **modal informativo**: “El alta se hace en recepción” más el horario y el contacto del club | M7 | Se quita el enlace a `/alta-socio`, que no existe. Hay que pedir al club el horario y los datos de contacto antes del PR |
| D5 | **Credenciales de prueba del Login**: se muestran solo en desarrollo (`import.meta.env.DEV`), **nunca en producción** | M7 | Comprobar con `vite build` que el bloque no queda en el bundle |
| D6 | **Borrar** `components/torneos/ResultadosTorneo.jsx`, la ruta `/espacios` y la ruta `/components/socio-layout` | M0 | Al quitar `/espacios`, revisar si `pages/Espacios.jsx` y `components/CardEspacio.jsx` quedan sin uso; hoy solo los usa esa ruta |
| D7 | **Reutilizar `torneos-ui/TorneoFormModal.jsx`** para crear y editar torneos, en lugar del formulario en línea de `TournamentBracket.jsx` (T9) | M4 | — |

### Orden de implementación acordado

Sustituye al orden sugerido en la sección 2.

| Unidad | Módulos, en orden |
|---|---|
| **Esta unidad** | M0 → M1 → M4 → M7 → M2 / M3 |
| **Siguiente unidad** | M5 → M6 |

Consecuencias de este orden:
- Mientras M5 no esté hecho, el coordinador seguirá viendo con el diseño viejo sus secciones Ludoteca y Sanciones, porque las comparte con admin y recepción.
- M4 se hace antes que M5. Por eso el **buscador de socio** (`SocioPicker`) que necesita T11 debe crearse en M0 o en M4, no en M5.
