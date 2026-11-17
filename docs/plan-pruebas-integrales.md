# Plan de pruebas integrales — Club Social y Deportivo V2

**Tarea:** U4-07 Pruebas integrales: plan y ejecución · **Responsable:** Aaron Telles Magaña · **Fecha límite:** 12 de noviembre de 2026
**Plan completo:** F10 (T18 y T19) · **Bloquea a:** U5 Corregir los bugs de las pruebas integrales

## 1. Objetivo
Probar el sistema de punta a punta antes de la simulación con el cliente (U5) y confirmar que el rediseño no rompió nada en ningún rol.

## 2. Alcance
75 casos en 7 módulos (socios con Excel, reservas, clases, torneos, evaluación de instructores, ludoteca y sanciones), un bloque de acceso y una revisión visual de las pantallas de instructor y coordinador con el diseño nuevo. Cada caso se corre en **escritorio** y en **celular** (DevTools en modo dispositivo), con usuarios de cada rol.

Fuera de alcance: cambios de código, pruebas de carga y de seguridad avanzada.

## 3. Ambientes y precauciones
| Ambiente | Uso | Antes de empezar |
|---|---|---|
| Frontend y backend de `develop` | Todos los casos | Confirmar que está actualizado con los PR de U4-02 a U4-05, U4-17 y U4-18. |
| Base de **production** (Neon) | Casos que lo requieran | **Verificar el host en `.env` antes de correr.** Usar solo datos de prueba con la palabra "Prueba" en el nombre, y **borrarlos al terminar**. No importar el Excel de socios reales ni sancionar a socios reales. |

> Las credenciales van solo en `.env`; no se escriben en este documento ni en ClickUp.

## 4. Datos de prueba necesarios
- Una cuenta por rol: socio, instructor, coordinador, recepción, admin (y gerente si existe).
- Un socio “limpio” (sin sanciones ni inscripciones) y uno con sanciones.
- Una clase con cupo, una clase llena y dos clases que se empalman.
- Un torneo con al menos 4 participantes inscritos y una visita con pase vigente.
- Una plantilla de Excel con 3 socios válidos con la palabra "Prueba" en el nombre y variantes con errores.
- Un niño de 5 años y otros de 2 y 8 años.

## 5. Cómo ejecutar y registrar
1. Correr cada caso en escritorio y luego en celular. En las columnas Escritorio y Celular marcar ✅ Pasa o ❌ Falla (o ⛔ si no se pudo correr, anotando por qué). Si falla, poner el enlace o el código del bug en la columna Bug.
2. Si falla, registrarlo en ClickUp como `[CÓDIGO] fix: …` con la plantilla de la sección 7.
3. Avisar al responsable del módulo en el grupo en cuanto salga el bug, sin esperar al final.
4. Al terminar, llenar la sección 8 (resumen).

## 6. Gravedad
| Nivel | Criterio |
|---|---|
| Alta | Bloquea el uso, da error 500, pierde datos o muestra datos de otro usuario. |
| Media | Funciona, pero con dificultad o con un resultado o mensaje incorrecto. |
| Baja | Detalle visual o de texto (alineación, ortografía, texto cortado). |

## 7. Plantilla de bug para ClickUp
```
Título: [CÓDIGO] fix: <qué falla, en una línea>
Caso: <ID del caso, por ejemplo CLA-07>
Gravedad: Alta | Media | Baja
Dispositivo: Escritorio | Celular (DevTools, modelo emulado)
Ambiente: develop | production
Rol / cuenta usada:
Pasos para reproducir:
  1.
  2.
Resultado esperado:
Resultado obtenido:
Evidencia: captura (obligatoria) o mensaje de error
Responsable sugerido:
```

## 8. Casos de prueba
> **Resultados registrados el 12 de noviembre de 2026.** ✅ Pasa · ❌ Falla · ◐ Verificado en parte · ⛔ No ejecutado (el alcance se recortó por tiempo, de acuerdo con el equipo; queda pendiente para una segunda pasada). La columna Escritorio quedó en ⛔ salvo SAN-02, SAN-05 y SAN-06, que se hicieron con el admin en PC; el resto se probó en celular (DevTools en modo dispositivo). Detalle, capturas y observaciones en `Avance-Pruebas-Integrales-U4-07.pdf`.
### 1. Socios con Excel (importación)
**Rol:** admin / gerente · **Pantalla / API:** Gestión de socios (importación) · `GET /api/importacion/template` · `POST /api/importacion/socios`

Importación masiva de socios desde un `.xlsx`. Columnas obligatorias: Numero_Accion, Tipo_Accion, Estatus_Accion, Rol, Nombre_Completo, Email. Límites: 5 MB y 5,000 filas. Si una fila falla, **no se importa nada**.

| ID | Caso | Pasos | Datos de prueba | Resultado esperado | Escritorio | Celular | Bug |
|---|---|---|---|---|:-:|:-:|---|
| SOC-01 | Descargar la plantilla | Entrar como admin → Gestión de socios → descargar plantilla de importación. | — | Se descarga un `.xlsx` con la hoja `Datos` y las 12 columnas del catálogo. | ⛔ | ⛔ |  |
| SOC-02 | Importar archivo válido | Llenar la plantilla con 3 socios nuevos y subirla. | 3 filas válidas, correos nuevos | Respuesta de éxito con el total importado; los 3 socios aparecen en la lista. | ⛔ | ⛔ |  |
| SOC-03 | Falta una columna obligatoria | Borrar la columna `Email` de la plantilla y subirla. | Archivo sin `Email` | Error 400 “Faltan columnas obligatorias: Email”; no se importa nada. | ⛔ | ⛔ |  |
| SOC-04 | Columnas repetidas | Duplicar el encabezado `Nombre_Completo` y subir. | Archivo con encabezado repetido | Error 400 “Columnas repetidas: …”. | ⛔ | ⛔ |  |
| SOC-05 | Archivo sin filas | Subir la plantilla vacía (solo encabezados). | Plantilla sin datos | Error 400 “El archivo no tiene filas de datos”. | ⛔ | ⛔ |  |
| SOC-06 | Una fila con error (todo o nada) | Subir 5 filas válidas y 1 con correo inválido. | 6 filas, una con `Email` mal escrito | Error que indica la fila con problema (“Se encontraron 1 error(es); no se importó ningún registro”). Ninguno de los 6 queda en la lista. | ⛔ | ⛔ |  |
| SOC-07 | Archivo que no es .xlsx | Subir un `.csv` o `.pdf`. | `socios.csv` | Error 400 “Se requiere un archivo .xlsx”. | ⛔ | ⛔ |  |
| SOC-08 | Archivo demasiado grande | Subir un `.xlsx` de más de 5 MB. | Archivo > 5 MB | Error 400 “El archivo excede el tamaño máximo de 5 MB”. | ⛔ | ⛔ |  |
| SOC-09 | Encabezados con alias y otro orden | Cambiar el orden de columnas y escribir `Número Acción` y `Correo` en lugar de los nombres oficiales. | Plantilla con alias | Se importa igual (los encabezados se comparan sin acentos ni mayúsculas). Columnas desconocidas se ignoran. | ⛔ | ⛔ |  |
| SOC-10 | Permisos por rol | Intentar la importación como socio, recepción e instructor (ruta directa o Postman). | Token de cada rol | Solo admin y gerente pueden. Los demás reciben 403 y no ven la opción en la interfaz. | ⛔ | ⛔ |  |

### 2. Reservas
**Rol:** socio (y vistas de admin/coordinador/recepción) · **Pantalla / API:** `/reservas` · `GET/POST /api/reservas` · `PUT /api/reservas/:id/cancelar`

Reservas de espacios por el socio. El sistema valida choques con otras reservas, con clases inscritas y con sesiones programadas.

| ID | Caso | Pasos | Datos de prueba | Resultado esperado | Escritorio | Celular | Bug |
|---|---|---|---|---|:-:|:-:|---|
| RES-01 | Reservar un espacio libre | Socio → Reservas → elegir espacio, fecha y horario libres → confirmar. | Espacio y horario sin reservas | Aparece el modal de confirmación y la reserva en la lista del socio. | ⛔ | ✅ |  |
| RES-02 | Ver disponibilidad | Elegir un espacio y fecha con reservas existentes. | Fecha con al menos 1 reserva | Los horarios ocupados se muestran como no disponibles. | ⛔ | ✅ |  |
| RES-03 | Choque con otra reserva | Intentar reservar el mismo espacio, fecha y hora ya ocupados. | Reserva del caso RES-01 | Error “El espacio ya esta reservado en ese horario”; no se crea. | ⛔ | ✅ |  |
| RES-04 | Choque con una clase inscrita | Inscribirse a una clase y reservar a esa misma hora el mismo día de la semana. | Clase inscrita + reserva a la misma hora | Error “El socio tiene una clase inscrita en ese horario”. | ⛔ | ✅ |  |
| RES-05 | Choque con sesión programada | Reservar un espacio a la hora en que tiene una clase programada. | Espacio con sesión programada | Error “El horario entra en conflicto con una sesion programada”. | ⛔ | ✅ |  |
| RES-06 | Cancelar una reserva | En Mis reservas, cancelar la reserva del caso RES-01. | Reserva activa | La reserva queda cancelada y el horario vuelve a estar libre. | ⛔ | ✅ |  |
| RES-07 | Cancelar una reserva ya cancelada | Repetir la cancelación (otra pestaña o Postman). | Reserva cancelada | Error 404 “Reserva no encontrada o ya estaba cancelada”; sin error 500. | ⛔ | ⛔ |  |
| RES-08 | Datos incompletos | Enviar una reserva sin fecha o sin espacio (Postman). | Body sin campos obligatorios | Error 400 con mensaje claro; no error 500. | ⛔ | ⛔ |  |
| RES-09 | Vista de reservas del staff | Entrar como coordinador y como admin/recepción a su vista de reservas. | Reservas del caso RES-01 | La reserva del socio aparece en la vista de cada rol con los datos correctos. | ⛔ | ⛔ |  |
| RES-10 | Reserva sin sesión | Abrir `/reservas` sin iniciar sesión y como otro rol (instructor). | Sin token / token de instructor | Redirige a login o a su dashboard; el instructor no accede a pantallas de socio. | ⛔ | ✅ |  |

### 3. Clases (socio)
**Rol:** socio · **Pantalla / API:** `/clases` · `GET /api/sesiones` · `POST /api/inscripciones/inscribir` · `POST /api/inscripciones/cancelar`

Pantalla rediseñada (U4-18): catálogo en carrusel, tira de días, filtros, Mis clases y confirmación.

| ID | Caso | Pasos | Datos de prueba | Resultado esperado | Escritorio | Celular | Bug |
|---|---|---|---|---|:-:|:-:|---|
| CLA-01 | Ver el catálogo | Socio → Clases → Catálogo. | Sesiones cargadas en la base | Se ve el carrusel con las clases del día de hoy y la tira LUN–DOM con hoy seleccionado. | ⛔ | ✅ |  |
| CLA-02 | Cambiar de día | Tocar otro día de la tira; tocar de nuevo el día elegido. | — | El carrusel muestra las clases de ese día; al volver a tocarlo se quitan el filtro de día y se ven todas. | ⛔ | ✅ |  |
| CLA-03 | Filtrar por deporte e instructor | Filtros → elegir un deporte y un instructor → Aplicar filtros; luego Limpiar. | Deporte y instructor con clases | Solo salen clases que cumplen; el botón muestra el número de filtros; Limpiar los quita. | ⛔ | ✅ |  |
| CLA-04 | Inscribirse | Tocar “Inscribirme” → Confirmar inscripción. | Clase con cupo | Modal “¡Inscripción exitosa!” con el detalle; la clase pasa a “Ya inscrito” y aparece en Mis clases. | ⛔ | ✅ |  |
| CLA-05 | Clase llena | Abrir una clase con cupo lleno. | Clase con inscritos = cupo | Muestra “Clase llena” y el botón está deshabilitado (criterio de QA de Fer). | ⛔ | ⛔ |  |
| CLA-06 | Ya inscrito | Volver al catálogo después del caso CLA-04. | Clase del caso CLA-04 | Muestra “Ya inscrito” y no se puede inscribir otra vez. Por API: 400 “Ya estás inscrito en esta clase”. | ⛔ | ✅ |  |
| CLA-07 | Choque con otra clase | Inscribirse a otra clase del mismo día y hora. | Dos clases que se empalman | Error “Choque de horario: Ya estás inscrito en … a esta hora.” | ⛔ | ✅ |  |
| CLA-08 | Choque con una reserva de hoy | Reservar una cancha hoy y luego inscribirse a una clase a esa hora. | Reserva de hoy + clase a la misma hora | Error “Tienes una reserva de cancha activa en ese horario.” | ⛔ | ✅ |  |
| CLA-09 | Cancelar inscripción | Mis clases → Cancelar inscripción → confirmar. | Inscripción del caso CLA-04 | La clase sale de Mis clases y en el catálogo vuelve a estar disponible; el cupo baja en 1. | ⛔ | ✅ |  |
| CLA-10 | Mis clases | Abrir la pestaña Mis clases con 0, 1 y varias inscripciones. | Socios con distinto número de inscripciones | Con 0: mensaje “No tienes clases inscritas” y botón al catálogo. Con varias: resumen, tarjetas ordenadas por cercanía y etiqueta Hoy/Mañana. | ⛔ | ◐ |  |

### 4. Torneos
**Rol:** socio · admin / coordinador · instructor (árbitro) · **Pantalla / API:** `/torneos` · `GestionTorneos` · `/api/torneos` · `/api/encuentros`

Ciclo del torneo: Abierto → Inscripciones cerradas → En curso → Finalizado (o Cancelado desde cualquier estado no final).

| ID | Caso | Pasos | Datos de prueba | Resultado esperado | Escritorio | Celular | Bug |
|---|---|---|---|---|:-:|:-:|---|
| TOR-01 | Crear un torneo | Admin/coordinador → Gestión de torneos → crear con fechas, categoría y cupo. | Torneo nuevo con fechas de inscripción | Aparece en la lista en estado Abierto con el cupo indicado. | ⛔ | ◐ |  |
| TOR-02 | Socio ve e inscribe | Socio → Torneos → inscribirse a un torneo Abierto. | Torneo abierto con fechas vigentes | Queda inscrito y el contador de participantes sube en 1. | ⛔ | ◐ |  |
| TOR-03 | Inscripción fuera de fechas | Intentar inscribirse a un torneo cuyas fechas de inscripción ya pasaron o aún no empiezan. | Torneo con fechas vencidas | No se permite inscribirse (`admite_inscripcion` falso) y muestra un mensaje claro. | ⛔ | ⛔ |  |
| TOR-04 | Cupo máximo | Inscribir participantes hasta llenar el cupo y probar con uno más. | Torneo con cupo 2 | El participante extra no entra y se muestra el aviso de cupo. | ⛔ | ⛔ |  |
| TOR-05 | Inscribir una visita con pase | Con una cuenta de staff (admin, coordinador o recepción) → inscribir una visita con pase en un torneo. | Visita con pase vigente | La visita queda inscrita (U4-06). | ⛔ | ⛔ |  |
| TOR-06 | Cerrar inscripciones y generar el bracket | Pasar el torneo a Inscripciones cerradas y confirmar el bracket. | Torneo con ≥ 4 participantes | Estado En curso y bracket con los encuentros correctos. | ⛔ | ⛔ |  |
| TOR-07 | Capturar resultados | Registrar el resultado de un encuentro (admin y, como árbitro, instructor). | Encuentro del bracket | El ganador avanza a la siguiente ronda y el socio lo ve en su bracket. | ⛔ | ⛔ |  |
| TOR-08 | Finalizar el torneo | Capturar todos los resultados y finalizar. | Torneo En curso completo | Estado Finalizado, se muestra el campeón y ya no se puede modificar. | ⛔ | ⛔ |  |
| TOR-09 | Eliminar un torneo En curso | Intentar eliminar un torneo En curso. | Torneo En curso | Error 409 “Cancela el torneo antes de eliminarlo”. Cancelado → ya se puede eliminar. | ⛔ | ⛔ |  |
| TOR-10 | Transiciones y permisos inválidos | Intentar saltar de estado (Abierto → En curso) y crear un torneo como socio (Postman). | Token de socio | Respuesta 4xx con mensaje claro; sin error 500 y sin cambios en la base. | ⛔ | ⛔ |  |

### 5. Evaluación de instructores
**Rol:** socio · **Pantalla / API:** `/evaluaciones` · `POST /api/evaluaciones` · `GET /api/evaluaciones/mias`

Calificación de 1 a 5 y comentario de hasta 500 caracteres. Es anónima. Solo una por clase y por mes.

| ID | Caso | Pasos | Datos de prueba | Resultado esperado | Escritorio | Celular | Bug |
|---|---|---|---|---|:-:|:-:|---|
| EVA-01 | Ver clases por evaluar | Socio con clases inscritas → Evaluaciones. | Al menos 2 clases inscritas | Lista de clases con su botón Evaluar; las ya evaluadas muestran su calificación. | ⛔ | ✅ |  |
| EVA-02 | Evaluar con calificación | Evaluar → elegir 4 de 5 → Enviar evaluación. | Clase inscrita sin evaluar | Mensaje de éxito; la clase queda marcada como evaluada. | ⛔ | ✅ |  |
| EVA-03 | Evaluar con comentario | Repetir con otra clase y escribir un comentario. | Comentario de 100 caracteres | Se guarda y se envía sin errores. | ⛔ | ◐ |  |
| EVA-04 | Comentario demasiado largo | Escribir más de 500 caracteres. | Comentario de 501 caracteres | No se permite (límite en pantalla o error 400 claro). | ⛔ | ✅ |  |
| EVA-05 | Enviar sin calificación | Intentar enviar sin elegir estrellas. | — | El botón está deshabilitado o muestra un error claro; no se envía. | ⛔ | ✅ |  |
| EVA-06 | Evaluación duplicada del mes | Evaluar otra vez la misma clase en el mismo mes (otra pestaña o Postman). | Clase ya evaluada | Error 409 con mensaje de que ya la evaluaste este mes; sin error 500. | ⛔ | ✅ |  |
| EVA-07 | Clase no inscrita | Enviar una evaluación de una clase en la que no está inscrito (Postman). | `sesion_id` ajeno | Error 403 “no inscrito”. | ⛔ | ⛔ |  |
| EVA-08 | Clase sin instructor | Evaluar una clase con instructor “Por asignar”. | Sesión sin instructor | No se puede evaluar; error 409 claro o no aparece el botón. | ⛔ | ✅ |  |
| EVA-09 | Anonimato | Entrar como instructor (solo ve las suyas) y como coordinador/admin (ven las de cualquier instructor). | Evaluaciones del caso EVA-02 | Se ve la calificación y el promedio, pero no quién la escribió. | ⛔ | ⛔ |  |
| EVA-10 | Hoja de evaluación en móvil | Abrir Evaluar en el celular y enviar una evaluación. | Pantalla de 390 px de ancho | La hoja inferior se ve completa, no se corta y el botón Enviar es alcanzable. | ⛔ | ✅ |  |

### 6. Ludoteca
**Rol:** socio · recepción · instructor · **Pantalla / API:** `/ludoteca` · `ControlLudoteca` · `MonitoreoLudoteca` · `/api/ludoteca`

Entradas y salidas de niños. Reglas: el niño debe tener entre 3 y 7 años, y no puede tener dos entradas activas.

| ID | Caso | Pasos | Datos de prueba | Resultado esperado | Escritorio | Celular | Bug |
|---|---|---|---|---|:-:|:-:|---|
| LUD-01 | Ver el aforo | Entrar a Ludoteca como socio y como recepción. | — | El aforo actual se muestra igual en ambos. | ⛔ | ⛔ |  |
| LUD-02 | Registrar entrada de un niño | Socio → registrar entrada con nombre y fecha de nacimiento. | Niño de 5 años | Se registra, aparece como activo con la hora de entrada. | ⛔ | ✅ |  |
| LUD-03 | Edad fuera de rango | Registrar un niño de 2 años y otro de 8. | Fechas de nacimiento fuera de 3–7 | Error 400 “El niño debe tener entre 3 y 7 años”; no se registra. | ⛔ | ✅ |  |
| LUD-04 | Nombre vacío y fecha inválida | Enviar nombre vacío y luego una fecha mal escrita. | Datos inválidos | Error 400 “nombre_hijo no puede estar vacío” / “fecha_nacimiento debe tener formato YYYY-MM-DD”. | ⛔ | ⛔ |  |
| LUD-05 | Entrada duplicada | Registrar otra vez al mismo niño sin haber registrado su salida. | Niño del caso LUD-02 | Error 409 “Este niño ya tiene una entrada activa en la ludoteca”. | ⛔ | ❌ | BUG-04 |
| LUD-06 | Registrar la salida | Registrar la salida del niño del caso LUD-02. | Registro activo | El registro pasa a finalizado con hora de salida y el aforo baja. | ⛔ | ✅ |  |
| LUD-07 | Salida doble | Registrar la salida otra vez. | Registro ya finalizado | Error 409 “Este niño ya tiene salida registrada”. | ⛔ | ⛔ |  |
| LUD-08 | Salida de otro socio | Intentar registrar la salida de un niño de otro socio (Postman). | Token de otro socio | Error 403 “No tienes permiso para registrar esta salida”. | ⛔ | ⛔ |  |
| LUD-09 | Control desde recepción | Recepción → Control de ludoteca → registrar entrada y salida por QR o manual. | QR de un socio activo | Funciona igual; con un socio inactivo muestra “El socio no está activo”. | ⛔ | ⛔ |  |
| LUD-10 | Historial y monitoreo | Socio → Mis registros; instructor → Monitoreo de ludoteca; recepción/admin → historial. | Registros de los casos anteriores | Cada rol ve solo lo que le corresponde y los datos coinciden entre vistas. | ⛔ | ⛔ |  |

### 7. Sanciones
**Rol:** socio · admin / recepción / coordinador · **Pantalla / API:** `/sanciones` · `/api/sanciones`

Sanciones manuales y por no-show. Se pueden perdonar o levantar, y una vez resueltas no se vuelven a resolver.

| ID | Caso | Pasos | Datos de prueba | Resultado esperado | Escritorio | Celular | Bug |
|---|---|---|---|---|:-:|:-:|---|
| SAN-01 | Socio sin sanciones | Entrar a Sanciones con un socio sin sanciones. | Socio limpio | Mensaje de que no tiene sanciones; el Inicio también indica 0. | ⛔ | ✅ |  |
| SAN-02 | Crear una sanción | Admin/recepción → crear una sanción para un socio. | Socio y motivo | La sanción aparece en la lista del staff y en la pantalla del socio. | ✅ | ⛔ |  |
| SAN-03 | El socio ve su sanción | Entrar como el socio del caso SAN-02. | Socio sancionado | Se muestra con el motivo y el estatus correctos. | ⛔ | ✅ |  |
| SAN-04 | Conteo en Inicio vs Sanciones | Comparar el número de sanciones activas en Inicio y en Sanciones. | Socio con 1 activa y 1 resuelta | **Mismo número en ambas pantallas** (hay un reporte previo de que cuentan distinto; verificar). | ⛔ | ❌ | BUG-01 |
| SAN-05 | Perdonar una sanción | Staff autorizado → perdonar. | Sanción activa | Pasa a resuelta y el socio ya no la ve como activa. | ◐ | ⛔ |  |
| SAN-06 | Levantar una sanción | Staff autorizado → levantar otra sanción. | Otra sanción activa | Queda levantada con fecha de resolución. | ✅ | ⛔ |  |
| SAN-07 | Resolver dos veces | Perdonar una sanción que ya se resolvió. | Sanción resuelta | Error 409 “Esta sanción ya fue resuelta”. | ⛔ | ⛔ |  |
| SAN-08 | No-show automático | Marcar una reserva como no-show y ejecutar la sincronización de no-shows (admin). | Reserva con no-show | Se crea una sanción (gravedad Moderada). Ejecutar de nuevo **no** crea duplicados. | ⛔ | ⛔ |  |
| SAN-09 | Sanciones de otro socio | Con token de un socio, consultar las sanciones de otro (Postman). | `socioId` ajeno | Error 403 “Sin permisos para consultar sanciones de este socio”. | ⛔ | ⛔ |  |
| SAN-10 | Permisos de borrado y edición | Intentar eliminar una sanción como recepción/coordinador (Postman). | Token no admin | Solo admin puede eliminar; los demás reciben 403. | ⛔ | ⛔ |  |

### 8. Acceso y sesión (transversal)
**Rol:** todos los roles · **Pantalla / API:** `/login` · `ProtectedRoute` · `POST /api/auth/login`

Entradas comunes a todos los módulos. Se corren una sola vez por rol.

| ID | Caso | Pasos | Datos de prueba | Resultado esperado | Escritorio | Celular | Bug |
|---|---|---|---|---|:-:|:-:|---|
| ACC-01 | Login correcto por rol | Entrar con socio, instructor, coordinador, recepción y admin. | Una cuenta por rol | Cada rol cae en su dashboard. | ⛔ | ◐ |  |
| ACC-02 | Credenciales incorrectas | Probar contraseña errónea y correo inexistente. | Datos inválidos | Mensaje claro de error; sin error 500. | ⛔ | ✅ |  |
| ACC-03 | Rutas protegidas | Abrir `/dashboard-socio` o `/clases` sin sesión. | Sin token | Redirige a login. | ⛔ | ✅ |  |
| ACC-04 | Cerrar sesión | Cerrar sesión y usar el botón Atrás. | Sesión iniciada | No se puede ver contenido protegido después de salir. | ⛔ | ✅ |  |
| ACC-05 | Sesión vencida | Borrar o alterar el token y recargar. | Token inválido | Redirige a login y no muestra pantalla en blanco. | ⛔ | ⛔ |  |
## 9. Revisión visual: instructor y coordinador (diseño nuevo)
Revisar que **no haya nada roto, cortado o encimado**: encabezado y menú, tipografía Plus Jakarta Sans, botones y tarjetas del kit, textos que no se salgan, y que no haya scroll horizontal en celular. Marcar ✅ o ❌ y anotar lo que se vea mal.

| ID | Rol | Pantalla | Escritorio | Celular | Observaciones |
|---|---|---|:-:|:-:|---|
| VIS-01 | Instructor | Dashboard (inicio) | ⛔ | ✅ | Sin pestaña de Inicio: entra a Agenda del día. |
| VIS-02 | Instructor | Agenda del día | ⛔ | ✅ | OBS-21, OBS-22 |
| VIS-03 | Instructor | Mis clases | ⛔ | ✅ |  |
| VIS-04 | Instructor | Métricas | ⛔ | ✅ | OBS-23 |
| VIS-05 | Instructor | Monitoreo de ludoteca | ⛔ | ✅ |  |
| VIS-06 | Coordinador | Resumen | ⛔ | ✅ | OBS-25 |
| VIS-07 | Coordinador | Gestión de disciplinas | ⛔ | ✅ |  |
| VIS-08 | Coordinador | Gestión de instructores | ⛔ | ⛔ | No se capturó la pestaña Instructores. |
| VIS-09 | Coordinador | Vista de espacios | ⛔ | ✅ | OBS-27 |
| VIS-10 | Coordinador | Vista de reservas | ⛔ | ✅ |  |
| VIS-11 | Coordinador | Vista de socios | ⛔ | ✅ | OBS-28 |
| VIS-12 | Coordinador | Vista de visitas | ⛔ | ✅ | OBS-27 |
| VIS-13 | Ambos | Rutas de otro rol (no deben abrirse) | ⛔ | ✅ | OBS-24 |

## 10. Resumen de resultados (llenar al terminar)
| Bloque | Casos | Pasan | Fallan | Bugs registrados |
|---|:-:|:-:|:-:|:-:|
| 1. Socios con Excel (importación) | 10 | 0 | 0 | 0 |
| 2. Reservas | 10 | 7 | 0 | 0 |
| 3. Clases (socio) | 10 | 8 | 0 | 0 |
| 4. Torneos | 10 | 0 | 0 | 0 |
| 5. Evaluación de instructores | 10 | 7 | 0 | 0 |
| 6. Ludoteca | 10 | 3 | 1 | 1 |
| 7. Sanciones | 10 | 4 | 1 | 1 |
| 8. Acceso y sesión (transversal) | 5 | 3 | 0 | 0 |
| **Total** | **75** | **32** | **2** | **2** |

Además: 6 casos verificados en parte (◐) y 35 no ejecutados (⛔) en estos 8 bloques. La revisión visual (sección 9) quedó con 12 de 13 pantallas revisadas en celular; falta VIS-08.

**Bugs registrados en ClickUp:**
- BUG-01 `[SAN-04] fix: Inicio y Estado de Cuenta cuentan distinto las sanciones activas` (Media)
- BUG-02 `[COORD] fix: editar una sesión devuelve "Error al actualizar sesión"` (Media, por confirmar)
- BUG-03 `[COORD-03] fix: la tarjeta del torneo destacado se rompe en celular (título en vertical)` (Media)
- BUG-04 `[LUD-05] fix: el staff puede registrar dos veces la entrada del mismo niño` (Media)

BUG-02 y BUG-03 salieron de casos nuevos del coordinador (COORD-02 y COORD-03) que no están en el plan, por eso no suman en las filas de arriba. Las 33 observaciones menores (OBS-01 a OBS-33) están en el PDF.

## 11. Revisión de QA (otro integrante)
Un compañero distinto de quien ejecutó elige **5 casos al azar** y los corre. El resultado debe ser el mismo.

| Caso | Resultado de Aaron | Resultado del revisor | Coincide |
|---|:-:|:-:|:-:|
|  |  |  | ☐ |
|  |  |  | ☐ |
|  |  |  | ☐ |
|  |  |  | ☐ |
|  |  |  | ☐ |

**Revisor:** ____________ · **Fecha:** ____________

## 12. Criterios de cierre
- Todos los casos tienen resultado (pasa o falla).
- Cada bug está en ClickUp con su gravedad y el responsable avisado.
- El revisor de QA obtuvo el mismo resultado en 5 casos al azar.
