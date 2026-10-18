# Contrato de API de torneos

**Proyecto:** club-deportivo-v2 · **Rama base:** `develop` @ `4d72f73` · **Fecha:** 2026-10-18
**Origen:** los 10 faltantes (F-01 a F-10) de [auditoria-torneos.md](auditoria-torneos.md), sección 3.

Este documento fija qué endpoints hay que construir o cambiar para cerrar los faltantes del módulo de torneos, antes de escribir código. Backend y frontend trabajan contra este contrato: si algo cambia al implementar, se actualiza aquí primero.

---

## 1. Faltantes: backend o interfaz

| ID | Faltante | Lado | Qué toca |
|---|---|---|---|
| F-01 | Eliminar torneo | **Backend** + interfaz | Endpoint nuevo `DELETE /api/torneos/:torneo_id` (§3.1). Botón en `TournamentBracket` |
| F-02 | Cupo máximo de participantes | **Backend** + interfaz | Columna nueva `torneos.cupo_maximo`; cambia `POST`/`PUT /api/torneos`, `GET /api/torneos` y las dos inscripciones (§3.2–§3.6). Campo en el formulario y barra "X/Y inscritos" |
| F-04 | Auditoría de las acciones | **Backend** | Sin endpoint nuevo: cada endpoint que escribe registra una fila en `logs_sistema` (§4) |
| F-06 | Pruebas de reglas y permisos | **Backend** | Sin endpoint: tests en `backend/src/tests` que cubran las reglas de este contrato |
| F-07 | Validar las fechas de inscripción | **Backend** + interfaz | Cambia `POST`/`PUT /api/torneos`, `GET /api/torneos` y las dos inscripciones (§3.2–§3.6). La vista del socio usa `admite_inscripcion` |
| F-08 | Administrar las categorías | **Backend** + interfaz | Endpoints nuevos `POST`, `PUT` y `PATCH .../desactivar` en `/api/torneos/categorias`; `GET` suma `activo` y el filtro `activas` (§3.6.1–§3.9). Pantalla de admin |
| F-09 | Programar fecha y hora de los encuentros | **Backend** + interfaz | Endpoint nuevo `PATCH /api/encuentros/:encuentro_id/horario` (§3.10). Campo en `MatchEditPanel` |
| F-03 | Reporte y resultados en la UI | **Interfaz** | Consume `GET /api/torneos/:torneo_id/reporte`, que ya existe (§5). Reutilizar `ResultadosTorneo` |
| F-05 | Arbitraje desde el panel del instructor | **Interfaz** (decisión de producto) | Consume `PATCH /api/encuentros/:encuentro_id/resultado`, que ya admite el rol `instructor` (§5). Si se decide quitar el rol, el único cambio de backend es sacar `instructor` del `checkRole` de esa ruta |
| F-10 | Inscribir visitas desde la UI | **Interfaz** | Consume `POST /api/torneos/:torneo_id/inscribir` con `visita_id`, que ya existe (§3.5). Opción "Visita" en `InscribirModal` |

**Resumen:** 7 faltantes requieren backend (F-01, F-02, F-04, F-06, F-07, F-08, F-09); 3 son solo de interfaz (F-03, F-05, F-10). F-01, F-02, F-07, F-08 y F-09 también llevan trabajo de interfaz.

---

## 2. Convenciones comunes

- **Base:** `/api/torneos` y `/api/encuentros`. Todos los endpoints exigen `Authorization: Bearer <token>`.
- **Roles de staff:** `admin`, `gerente` y `coordinador` (la constante `staffRoles` de `torneos.routes.js`).
- **Forma del error:** `/api/torneos` responde `{ "error": "<mensaje>" }`; `/api/encuentros` responde `{ "ok": false, "error": "<mensaje>" }`. Se mantiene la forma de cada router.
- **Errores comunes a todos los endpoints** (no se repiten en cada tabla):

  | Código | Cuándo | Mensaje |
  |---|---|---|
  | 401 | Sin cabecera `Authorization` | `Sin token de autenticación` |
  | 401 | Cabecera sin `Bearer <token>` | `Formato de token inválido` |
  | 401 | Token vencido o alterado | `Token inválido o expirado` |
  | 403 | El rol no está en la lista del endpoint | `No tienes permisos para esta acción` |
  | 500 | Error no previsto | El mensaje genérico del controlador; nunca detalles de la BD |

- **Ids:** enteros entre 1 y 2147483647 (`esIdValido`), como número o como texto de dígitos.
- **Body ausente:** se trata como `{}` y responde 400 con el mensaje del primer campo que falte.
- **Fechas:** `fecha_inicio` y `fecha_fin` son `DATE` (`"YYYY-MM-DD"`). "Hoy" es la fecha del club en `America/Mexico_City`, la zona que ya fija `config/database.js`.
- **Nombres de campos:** los de la base (`torneos`, `participantes_torneo`, `encuentros_torneo`, `categorias_torneo`). Los campos nuevos son `torneos.cupo_maximo` (F-02), `torneos.activo` (borrado lógico, F-01) y `categorias_torneo.activo` (desactivar categoría, E2.6). `admite_inscripcion` es calculado y no se guarda.

---

## 3. Endpoints de backend

Marcas: **Nuevo** = no existe hoy. **Cambia** = ya existe; se documenta completo y se resalta lo nuevo con *(nuevo)*.

### 3.1 Eliminar torneo — Nuevo (F-01)

| | |
|---|---|
| **Método** | `DELETE` |
| **Ruta** | `/api/torneos/:torneo_id` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | Ninguno |
| **Regla** | Un torneo `En_curso` no se elimina: primero se cancela (`PATCH /:torneo_id/cancelar`). En cualquier otro estado: **sin participantes ni encuentros**, borrado físico (`DELETE` de la fila); **con participantes o encuentros**, borrado lógico (`activo = FALSE`), que conserva el historial sin necesitar `ON DELETE` en las FKs. Todo ocurre en una transacción con la fila del torneo bloqueada (`bloquearTorneo`), así que nadie se inscribe ni genera el bracket entre la comprobación y el borrado |
| **Visibilidad** | Un torneo con `activo = FALSE` no aparece en `GET /api/torneos` ni en `GET /mis-participaciones`. Participantes, bracket, reporte y cualquier acción sobre él, o sobre sus encuentros, responden 404, igual que si no existiera. Eliminarlo otra vez también responde 404 |
| **Respuesta 200** | `{ "ok": true, "message": "Torneo eliminado correctamente", "borrado": "fisico" \| "logico" }` |
| **400** | `torneo_id debe ser un entero válido` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Torneo no encontrado` (no existe o ya está eliminado) |
| **409** | `Cancela el torneo antes de eliminarlo` (el torneo está `En_curso`) |

Requiere la columna `torneos.activo BOOLEAN NOT NULL DEFAULT TRUE` (migración `Agregar_activo_torneos.sql`).

Request:

```http
DELETE /api/torneos/45
Authorization: Bearer eyJhbGciOi...
```

Response 200 (torneo sin participantes ni encuentros):

```json
{ "ok": true, "message": "Torneo eliminado correctamente", "borrado": "fisico" }
```

Response 200 (torneo con participantes o encuentros):

```json
{ "ok": true, "message": "Torneo eliminado correctamente", "borrado": "logico" }
```

Response 409:

```json
{ "error": "Cancela el torneo antes de eliminarlo" }
```

### 3.2 Listar torneos — Cambia (F-02, F-07, E2.12)

| | |
|---|---|
| **Método** | `GET` |
| **Ruta** | `/api/torneos` |
| **Roles** | Cualquier usuario autenticado |
| **Query** | `disciplina_id` (opcional, id válido), `estado` (opcional, sin distinguir mayúsculas) |
| **Respuesta 200** | Arreglo de torneos con `torneo_id`, `nombre`, `disciplina_id`, `nombre_disciplina`, `fecha_inicio`, `fecha_fin`, `fecha_inicio_inscripcion`, `fecha_fin_inscripcion`, `estado`, `tipo_torneo`, `categoria_id`, `nombre_categoria`, `total_participantes`, `se_realiza`, `cupo_maximo` *(nuevo)* y `admite_inscripcion` *(nuevo)* |
| **400** | `disciplina_id debe ser un entero valido` |
| **403** | — (no restringe rol) |
| **404** | — (una lista vacía responde 200 con `[]`) |
| **409** | — |

`admite_inscripcion` es `true` solo si se cumplen todas: `estado = 'Abierto'`, `categoria_id` no es NULL, hoy (fecha del club) está dentro del periodo de inscripción (F-07, `enPeriodoInscripcion` de `torneoFechas.js`: desde `fecha_inicio_inscripcion` si existe; hasta `fecha_fin_inscripcion` inclusiva si existe, si no hasta el día anterior a `fecha_inicio`, y sin límite si no hay ninguna) y `cupo_maximo` es NULL o mayor que `total_participantes` (F-02). *(E2.12)* Se calcula en el backend con las mismas funciones que usan las inscripciones (`admiteInscripciones` y `enPeriodoInscripcion`), así que la tarjeta y el 409 de la inscripción no se contradicen. No mira la modalidad: un torneo por equipos con `true` admite inscripción por el staff, no auto-inscripción. La vista del socio muestra "Inscribirse" solo cuando es `true`, y la tarjeta pinta la barra `total_participantes / cupo_maximo` cuando hay cupo.

Request:

```http
GET /api/torneos?estado=Abierto
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
[
  {
    "torneo_id": 45,
    "nombre": "Copa Otoño 2026",
    "disciplina_id": 2,
    "nombre_disciplina": "Tenis",
    "fecha_inicio": "2026-11-07",
    "fecha_fin": "2026-11-15",
    "estado": "Abierto",
    "tipo_torneo": "Individual",
    "categoria_id": 1,
    "nombre_categoria": "Adulto",
    "total_participantes": 6,
    "se_realiza": true,
    "cupo_maximo": 16,
    "admite_inscripcion": true
  }
]
```

### 3.3 Crear torneo — Cambia (F-02, F-07)

| | |
|---|---|
| **Método** | `POST` |
| **Ruta** | `/api/torneos` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | `nombre` (requerido, ≤ 150), `disciplina_id` (requerido), `categoria_id` (requerido), `tipo_torneo` (`Individual` \| `Equipos`, por defecto `Individual`), `fecha_inicio`, `fecha_fin` (opcionales, `YYYY-MM-DD`), `cupo_maximo` *(nuevo, opcional: entero entre 4 y 256, o `null` para sin límite)*. `estado` se ignora: todo torneo nace `Abierto` |
| **Respuesta 201** | `{ "torneo_id": <id> }` |
| **400** | `El nombre es requerido` · `Máximo 150 caracteres` · `disciplina_id es requerido` · `disciplina_id debe ser un entero valido` · `categoria_id es requerido` · `categoria_id debe ser un entero valido` · `tipo_torneo debe ser Individual o Equipos` · `La fecha de fin no puede ser menor que la fecha de inicio` · `Formato de fecha invalido` · `La disciplina no existe` · `La categoría no existe` · *(nuevo, E2.6)* `La categoría está desactivada` · *(nuevo)* `La fecha de inicio no puede ser anterior a hoy` · *(nuevo)* `cupo_maximo debe ser un entero entre 4 y 256` |
| **403** | `No tienes permisos para esta acción` |
| **404** | — (las referencias inexistentes responden 400) |
| **409** | — |

El mínimo de 4 coincide con `MINIMO_PARTICIPANTES` de `participanteService.js`: un cupo menor impediría que el torneo se realice.

Request:

```http
POST /api/torneos
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{
  "nombre": "Copa Otoño 2026",
  "disciplina_id": 2,
  "categoria_id": 1,
  "tipo_torneo": "Individual",
  "fecha_inicio": "2026-11-07",
  "fecha_fin": "2026-11-15",
  "cupo_maximo": 16
}
```

Response 201:

```json
{ "torneo_id": 45 }
```

Response 400:

```json
{ "error": "La fecha de inicio no puede ser anterior a hoy" }
```

### 3.4 Editar torneo — Cambia (F-02, F-07)

| | |
|---|---|
| **Método** | `PUT` |
| **Ruta** | `/api/torneos/:torneo_id` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | Los mismos campos que el alta. `estado` solo se acepta si es igual al actual. `cupo_maximo` *(nuevo)*: si no viene, se conserva el actual; `null` lo quita |
| **Regla** | Con el torneo `Abierto` la categoría es obligatoria. Con las inscripciones cerradas solo cambian `nombre` y fechas. *(nuevo)* La fecha de inicio pasada solo se rechaza si `fecha_inicio` cambia, para poder seguir editando torneos antiguos. *(nuevo)* El cupo no puede quedar por debajo de los inscritos actuales |
| **Respuesta 200** | `{ "ok": true, "torneo_id": <id>, "message": "Torneo actualizado correctamente" }` |
| **400** | Los mismos que el alta, más `torneo_id debe ser un entero valido` y `El estado se cambia con las acciones del torneo` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Torneo no encontrado` |
| **409** | `Con las inscripciones cerradas no se puede cambiar la disciplina, el tipo de torneo, la categoría ni el cupo` *(se amplía el mensaje actual con "ni el cupo")* · `No se puede cambiar la categoría: el torneo ya tiene inscritos` · *(nuevo)* `El cupo no puede ser menor que los inscritos actuales (6)` |

Request:

```http
PUT /api/torneos/45
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{
  "nombre": "Copa Otoño 2026",
  "disciplina_id": 2,
  "categoria_id": 1,
  "tipo_torneo": "Individual",
  "fecha_inicio": "2026-11-07",
  "fecha_fin": "2026-11-15",
  "cupo_maximo": 4
}
```

Response 200:

```json
{ "ok": true, "torneo_id": 45, "message": "Torneo actualizado correctamente" }
```

Response 409:

```json
{ "error": "El cupo no puede ser menor que los inscritos actuales (6)" }
```

### 3.5 Inscribir participante (staff) — Cambia (F-02, F-07; consumido por F-10)

| | |
|---|---|
| **Método** | `POST` |
| **Ruta** | `/api/torneos/:torneo_id/inscribir` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | Exactamente uno de `socio_id`, `visita_id` o `nombre_externo` (≤ 150). Opcionales: `categoria_id` (si viene, debe ser la del torneo) y `equipo_id`. F-10 usa `visita_id`, que ya funciona |
| **Regla** | Con la fila del torneo bloqueada, en este orden: existe → `Abierto` → *(nuevo)* fecha de inscripción vigente → tiene categoría → modalidad → *(nuevo)* cupo disponible → duplicados. El cupo se cuenta dentro de la misma transacción para que dos inscripciones simultáneas no lo rebasen |
| **Respuesta 201** | `{ "participante_id": <id> }` |
| **400** | `Debe especificar exactamente un tipo de participante` · `torneo_id debe ser un entero valido` · `socio_id debe ser un entero valido` · `visita_id debe ser un entero valido` · `Máximo 150 caracteres` · `categoria_id debe ser un entero valido` · `equipo_id debe ser un entero valido` · `La categoría debe ser la del torneo` · `En un torneo por equipos solo se inscriben equipos (nombre_externo)` · `Socio no encontrado o inactivo` · `Visita no encontrada o no vigente` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Torneo no encontrado` |
| **409** | `El torneo no está abierto para inscripciones` · `Este torneo no tiene categoría asignada` · `Este participante ya está inscrito en el torneo` · *(nuevo)* `El periodo de inscripción terminó: el torneo inicia el 2026-10-15` · *(nuevo)* `El torneo alcanzó su cupo máximo (16 participantes)` |

Request (visita, F-10):

```http
POST /api/torneos/45/inscribir
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{ "visita_id": 312 }
```

Response 201:

```json
{ "participante_id": 188 }
```

Response 409:

```json
{ "error": "El torneo alcanzó su cupo máximo (16 participantes)" }
```

### 3.6 Auto-inscripción del socio — Cambia (F-02, F-07)

| | |
|---|---|
| **Método** | `POST` |
| **Ruta** | `/api/torneos/:torneo_id/inscribir-me` |
| **Roles** | Cualquier usuario autenticado con socio activo vinculado (el `socio_id` sale del token, nunca del body) |
| **Body** | Ninguno |
| **Regla** | Mismo orden que §3.5: existe → `Abierto` → *(nuevo)* fecha vigente → no es por equipos → socio activo → tiene categoría → *(nuevo)* cupo → duplicado |
| **Respuesta 201** | `{ "participante_id": <id> }` |
| **400** | `torneo_id debe ser un entero valido` · `Socio no encontrado o inactivo` |
| **403** | — (el permiso lo da tener socio activo; sin socio responde 400) |
| **404** | `Torneo no encontrado` |
| **409** | `El torneo no está abierto para inscripciones` · `Este torneo es por equipos: la inscripción la hace el staff` · `Este torneo no tiene categoría asignada` · `Este participante ya está inscrito en el torneo` · *(nuevo)* `El periodo de inscripción terminó: el torneo inicia el 2026-10-15` · *(nuevo)* `El torneo alcanzó su cupo máximo (16 participantes)` |

Request:

```http
POST /api/torneos/45/inscribir-me
Authorization: Bearer eyJhbGciOi...
```

Response 201:

```json
{ "participante_id": 189 }
```

Response 409:

```json
{ "error": "El periodo de inscripción terminó: el torneo inicia el 2026-10-15" }
```

### 3.6.1 Listar categorías — Cambia (F-08, E2.6)

| | |
|---|---|
| **Método** | `GET` |
| **Ruta** | `/api/torneos/categorias` |
| **Roles** | Cualquier usuario autenticado |
| **Query** | `activas` *(nuevo, opcional)*: `true` devuelve solo las activas; sin el parámetro (o `false`) devuelve todas, como hasta ahora |
| **Respuesta 200** | Arreglo `[{ "categoria_id", "nombre", "activo" }]` ordenado por nombre. `activo` *(nuevo)*. Sin filtro siguen saliendo las inactivas para que las pantallas que muestran el nombre de la categoría de un torneo viejo lo sigan encontrando; el formulario de alta debe pedir `?activas=true` |
| **400** | *(nuevo)* `activas debe ser true o false` |

Requiere la columna `categorias_torneo.activo BOOLEAN NOT NULL DEFAULT TRUE` (migración `Agregar_activo_categorias_torneo.sql`).

### 3.7 Crear categoría — Nuevo (F-08)

| | |
|---|---|
| **Método** | `POST` |
| **Ruta** | `/api/torneos/categorias` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | `nombre` (requerido, ≤ 50, el límite de `categorias_torneo.nombre`) |
| **Regla** | El nombre se guarda sin espacios en los extremos. Los duplicados se comparan con `normalizarNombre` (sin espacios sobrantes y en minúsculas), igual que los externos, y solo contra las categorías **activas**. La comprobación corre con la tabla bloqueada (`LOCK TABLE ... SHARE ROW EXCLUSIVE`) porque no hay índice único: hoy existen duplicados en uso ("Libre", ids 3 y 5) y el índice no se podría crear sin tocar datos |
| **Respuesta 201** | `{ "categoria_id": <id>, "nombre": "<nombre>" }` |
| **400** | `El nombre es requerido` · `Máximo 50 caracteres` |
| **403** | `No tienes permisos para esta acción` |
| **404** | — |
| **409** | `Ya existe una categoría con ese nombre` |

Request:

```http
POST /api/torneos/categorias
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{ "nombre": "Juvenil femenil" }
```

Response 201:

```json
{ "categoria_id": 9, "nombre": "Juvenil femenil" }
```

Response 409:

```json
{ "error": "Ya existe una categoría con ese nombre" }
```

### 3.8 Renombrar categoría — Nuevo (F-08)

| | |
|---|---|
| **Método** | `PUT` |
| **Ruta** | `/api/torneos/categorias/:categoria_id` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | `nombre` (requerido, ≤ 50) |
| **Regla** | Solo cambia el nombre. Se permite aunque la categoría esté en uso: los torneos y participantes guardan `categoria_id`, no el texto. Una categoría desactivada no se renombra |
| **Respuesta 200** | `{ "ok": true, "categoria_id": <id>, "nombre": "<nombre>", "message": "Categoría actualizada correctamente" }` |
| **400** | `categoria_id debe ser un entero valido` · `El nombre es requerido` · `Máximo 50 caracteres` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Categoría no encontrada` |
| **409** | `Ya existe una categoría con ese nombre` (otra activa, sin contar la propia) · `La categoría está desactivada` |

Request:

```http
PUT /api/torneos/categorias/9
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{ "nombre": "Juvenil Femenil" }
```

Response 200:

```json
{ "ok": true, "categoria_id": 9, "nombre": "Juvenil Femenil", "message": "Categoría actualizada correctamente" }
```

Response 404:

```json
{ "error": "Categoría no encontrada" }
```

### 3.9 Desactivar categoría — Nuevo (F-08, E2.6)

Reemplaza al `DELETE` que proponía este contrato: las categorías no se borran, se desactivan.

| | |
|---|---|
| **Método** | `PATCH` |
| **Ruta** | `/api/torneos/categorias/:categoria_id/desactivar` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | Ninguno |
| **Regla** | Marca `activo = FALSE`; la fila no se borra, así que los torneos y participantes que ya la usan conservan su `categoria_id` y su nombre. No se desactiva si la usa algún **torneo activo**: no eliminado (`torneos.activo`) y en un estado distinto de `Finalizado` y `Cancelado`. Con la fila de la categoría bloqueada. Una categoría inactiva no se asigna a torneos: `POST /api/torneos` y el `PUT` que cambie a ella responden 400 `La categoría está desactivada`; un torneo que ya la tenía se sigue editando sin cambiarla. No hay endpoint para reactivar (queda para cuando se necesite) |
| **Respuesta 200** | `{ "ok": true, "message": "Categoría desactivada correctamente" }` |
| **400** | `categoria_id debe ser un entero valido` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Categoría no encontrada` |
| **409** | `No se puede desactivar: la categoría está en uso por 1 torneo activo` · `No se puede desactivar: la categoría está en uso por 3 torneos activos` · `La categoría ya está desactivada` |

Request:

```http
PATCH /api/torneos/categorias/9/desactivar
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
{ "ok": true, "message": "Categoría desactivada correctamente" }
```

Response 409:

```json
{ "error": "No se puede desactivar: la categoría está en uso por 3 torneos activos" }
```

### 3.10 Programar horario de un encuentro — Nuevo (F-09, E2.7)

| | |
|---|---|
| **Método** | `PATCH` |
| **Ruta** | `/api/encuentros/:encuentro_id/horario` |
| **Roles** | `admin`, `gerente`, `coordinador` (los mismos que asignar cancha) |
| **Body** | `hora_programada`: `"YYYY-MM-DDTHH:mm"` en hora del club, sin zona ni `Z`; o `null` para quitarla |
| **Regla** | Mismos estados del torneo que la cancha (`admiteAsignarCancha`: `Inscripciones_cerradas` o `En_curso`), con la fila del torneo bloqueada (`estadoDelTorneo`). *(E2.7)* No se reprograma (ni se quita la hora de) un encuentro con resultado: `finalizado` o con `ganador_id`. Si el torneo tiene `fecha_inicio`/`fecha_fin`, el día debe caer entre ellas (extremos inclusivos; si solo tiene una, se compara contra esa). *(E2.7)* **Choque de horario:** 409 si alguno de los dos participantes ya tiene otro encuentro a la misma hora exacta; se compara el `participante_id` y también la persona (mismo `socio_id` o `visita_id`) en otros torneos activos no cancelados. Los encuentros no tienen duración, así que solo choca la misma hora (minuto). Con `null` no se buscan choques. Las programaciones se serializan con un `pg_advisory_xact_lock` para que dos simultáneas no dejen a la misma persona en dos encuentros a la vez. La columna es `TIMESTAMP` sin zona: el backend la escribe y la devuelve como texto (`to_char(... 'YYYY-MM-DD"T"HH24:MI')`) para que Node no la convierta a UTC |
| **Respuesta 200** | `{ "ok": true, "message": "Horario asignado correctamente", "encuentro": { "encuentro_id": <id>, "hora_programada": "<YYYY-MM-DDTHH:mm>" \| null } }` |
| **400** | `encuentro_id inválido` · `hora_programada es requerida` (si el campo no viene; `null` sí es válido) · `hora_programada debe tener el formato YYYY-MM-DDTHH:mm` (también si la fecha u hora no existe, p. ej. `2026-02-30T10:00` o `T24:00`) · `La fecha debe estar entre el inicio y el fin del torneo (2026-11-07 a 2026-11-15)` · `La fecha no puede ser anterior al inicio del torneo (2026-11-07)` · `La fecha no puede ser posterior al fin del torneo (2026-11-15)` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Encuentro no encontrado` |
| **409** | `Solo se puede programar el horario con las inscripciones cerradas o el torneo en curso (estado actual: Abierto)` · `No se puede reprogramar un encuentro que ya tiene resultado` · *(E2.7)* `Un participante ya tiene otro encuentro a esa hora (encuentro 140)` |

Request:

```http
PATCH /api/encuentros/131/horario
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{ "hora_programada": "2026-11-08T10:30" }
```

Response 200:

```json
{
  "ok": true,
  "message": "Horario asignado correctamente",
  "encuentro": { "encuentro_id": 131, "hora_programada": "2026-11-08T10:30" }
}
```

Response 409:

```json
{ "ok": false, "error": "Un participante ya tiene otro encuentro a esa hora (encuentro 140)" }
```

### 3.11 Asignar árbitro a un encuentro — Nuevo (E2.8)

| | |
|---|---|
| **Método** | `PATCH` |
| **Ruta** | `/api/encuentros/:encuentro_id/arbitro` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | `instructor_id`: id de `instructores`; o `null` para quitar el árbitro |
| **Regla** | Mismos estados del torneo que la cancha (`Inscripciones_cerradas` o `En_curso`). No se cambia el árbitro de un encuentro con resultado (`finalizado` o con `ganador_id`). `instructor_id` debe ser un instructor activo: fila en `instructores` con `activo` no FALSE y su usuario con `activo` no FALSE. Se guarda en `encuentros_torneo.arbitro_id` (migración `Agregar_arbitro_encuentros_torneo.sql`) |
| **Efecto en el resultado** | Ver §5.2: con árbitro asignado, un `instructor` que no sea ese árbitro recibe 403 al registrar o editar el resultado. El staff siempre puede |
| **Respuesta 200** | `{ "ok": true, "message": "Árbitro asignado correctamente", "encuentro": { "encuentro_id": <id>, "arbitro_id": <id> | null } }` |
| **400** | `encuentro_id inválido` · `instructor_id es requerido` · `instructor_id debe ser un entero valido` · `instructor_id no corresponde a un instructor activo` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Encuentro no encontrado` |
| **409** | `Solo se puede asignar árbitro con las inscripciones cerradas o el torneo en curso (estado actual: Abierto)` · `No se puede cambiar el árbitro de un encuentro que ya tiene resultado` |

Request:

```http
PATCH /api/encuentros/131/arbitro
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{ "instructor_id": 5 }
```

Response 200:

```json
{ "ok": true, "message": "Árbitro asignado correctamente", "encuentro": { "encuentro_id": 131, "arbitro_id": 5 } }
```

Response 400:

```json
{ "ok": false, "error": "instructor_id no corresponde a un instructor activo" }
```

### 3.12 Bitácora de un torneo — Nuevo (E2.10)

| | |
|---|---|
| **Método** | `GET` |
| **Ruta** | `/api/torneos/:torneo_id/bitacora` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | Ninguno |
| **Regla** | Solo lectura. Devuelve las filas de `logs_sistema` con `tabla_afectada = 'torneos'` y `registro_id = torneo_id`, de la más reciente a la más antigua, hasta 200. **No** exige que el torneo exista: un torneo eliminado (lógico o físico) sigue teniendo bitácora, que es cuando más se consulta. Un id sin registros responde `[]`. No devuelve `ip_origen` (la bitácora completa con IP sigue en `/api/logs`, solo admin) |
| **Respuesta 200** | `[{ "log_id", "usuario_id", "usuario_nombre", "accion", "detalles", "fecha_local" }]`; `fecha_local` es `YYYY-MM-DDTHH:mm:ss` en hora del club |
| **400** | `torneo_id debe ser un entero válido` |
| **403** | `No tienes permisos para esta acción` |
| **404** | — |
| **409** | — |

Request:

```http
GET /api/torneos/45/bitacora
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
[
  {
    "log_id": 812,
    "usuario_id": 7,
    "usuario_nombre": "Ana López",
    "accion": "actualizar_torneo",
    "detalles": "{\"nombre\":{\"antes\":\"Copa Otoño\",\"despues\":\"Copa Invierno\"}}",
    "fecha_local": "2026-10-18T10:15:03"
  }
]
```

---

## 4. Auditoría de las acciones (F-04)

No cambia respuestas; el único endpoint nuevo es la bitácora de solo lectura (§3.12). *(E2.10)* **Implementado:** crear, editar, cancelar y eliminar torneo; el resto de las filas de la tabla queda pendiente. Cada endpoint que escribe llama a `logAudit` (`backend/src/utils/auditLogger.js`) **solo cuando la operación tuvo éxito**, igual que `disciplinasController.js`. `usuario_id` e `ip_origen` los toma `logAudit` de la petición; si la escritura del log falla, la respuesta no cambia: `logAudit` atrapa el error y solo deja un `console.warn`. El log se escribe con el pool, después del `COMMIT` de la operación, así que tampoco la revierte.

| Endpoint | `accion` | `tabla_afectada` | `registro_id` | `detalles` |
|---|---|---|---|---|
| `POST /api/torneos` | `crear_torneo` | `torneos` | `torneo_id` | `Torneo creado: <nombre>` |
| `PUT /api/torneos/:torneo_id` | `actualizar_torneo` | `torneos` | `torneo_id` | JSON con los campos que cambiaron: `{ "<campo>": { "antes": …, "despues": … } }` entre `nombre`, `disciplina_id`, `tipo_torneo`, `categoria_id`, `fecha_inicio`, `fecha_fin`, `fecha_inicio_inscripcion` y `fecha_fin_inscripcion`; `{}` si nada cambió |
| `DELETE /api/torneos/:torneo_id` | `eliminar_torneo` | `torneos` | `torneo_id` | `Torneo eliminado (<fisico|logico>): <nombre>` |
| `PATCH /:torneo_id/cerrar-inscripciones` | `cerrar_inscripciones_torneo` | `torneos` | `torneo_id` | `Bracket generado con <n> participantes` |
| `PATCH /:torneo_id/confirmar-bracket` | `confirmar_bracket_torneo` | `torneos` | `torneo_id` | `Bracket confirmado` |
| `PATCH /:torneo_id/finalizar` | `finalizar_torneo` | `torneos` | `torneo_id` | `Campeón: participante <ganador_id>` |
| `PATCH /:torneo_id/cancelar` | `cancelar_torneo` | `torneos` | `torneo_id` | `Cancelado desde <estado anterior>` |
| `POST /:torneo_id/inscribir` | `inscribir_participante_torneo` | `participantes_torneo` | `participante_id` | JSON con `torneo_id` y `socio_id`/`visita_id`/`nombre_externo` |
| `POST /:torneo_id/inscribir-me` | `autoinscribir_socio_torneo` | `participantes_torneo` | `participante_id` | JSON con `torneo_id` y `socio_id` |
| `DELETE /:torneo_id/participantes/:participante_id` | `desinscribir_participante_torneo` | `participantes_torneo` | `participante_id` | JSON con `torneo_id` |
| `PATCH /api/encuentros/:encuentro_id/resultado` | `registrar_resultado_encuentro` o `editar_resultado_encuentro` (con `allowEdit`) | `encuentros_torneo` | `encuentro_id` | JSON con marcadores y `ganador_id`, antes y después en la edición |
| `PATCH /api/encuentros/:encuentro_id/cancha` | `asignar_cancha_encuentro` | `encuentros_torneo` | `encuentro_id` | `Cancha: <cancha_asignada>` |
| `PATCH /api/encuentros/:encuentro_id/arbitro` | `asignar_arbitro_encuentro` | `encuentros_torneo` | `encuentro_id` | `Árbitro: instructor <instructor_id>` |
| `PATCH /api/encuentros/:encuentro_id/horario` | `programar_horario_encuentro` | `encuentros_torneo` | `encuentro_id` | `Horario: <hora_programada>` |
| `POST /api/torneos/categorias` | `crear_categoria_torneo` | `categorias_torneo` | `categoria_id` | `Categoría creada: <nombre>` |
| `PUT /api/torneos/categorias/:categoria_id` | `actualizar_categoria_torneo` | `categorias_torneo` | `categoria_id` | `<nombre anterior> → <nombre nuevo>` |
| `PATCH /api/torneos/categorias/:categoria_id/desactivar` | `desactivar_categoria_torneo` | `categorias_torneo` | `categoria_id` | `Categoría desactivada: <nombre>` |

`detalles` se recorta a 1000 caracteres (`normalizeDetails`).

---

## 5. Endpoints existentes que consume la interfaz (sin cambios)

Para F-03 y F-05 no hay trabajo de backend. Se listan aquí para que la interfaz tenga el contrato a mano.

### 5.1 Reporte del torneo (F-03)

| | |
|---|---|
| **Método** | `GET` |
| **Ruta** | `/api/torneos/:torneo_id/reporte` |
| **Roles** | Cualquier usuario autenticado |
| **Body** | Ninguno |
| **Respuesta 200** | `{ "torneo": { torneo_id, nombre, estado, disciplina }, "encuentros": [ { encuentro_id, ronda, estado, marcador_1, marcador_2, cancha_asignada, hora_programada, participante_1: { id, nombre }, participante_2: { id, nombre }, ganador: { id, nombre } \| null } ] }`, ordenado por ronda y `encuentro_id` |
| **400** | `torneo_id debe ser un entero válido` |
| **403** | — |
| **404** | `Torneo no encontrado` |
| **409** | — |

Request:

```http
GET /api/torneos/33/reporte
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
{
  "torneo": { "torneo_id": 33, "nombre": "Copa Primavera", "estado": "Finalizado", "disciplina": "Tenis" },
  "encuentros": [
    {
      "encuentro_id": 72,
      "ronda": 2,
      "estado": "finalizado",
      "marcador_1": 6,
      "marcador_2": 3,
      "cancha_asignada": "Cancha 1",
      "hora_programada": null,
      "participante_1": { "id": 145, "nombre": "Ana López Ruiz" },
      "participante_2": { "id": 151, "nombre": "Luis Pérez Gómez" },
      "ganador": { "id": 145, "nombre": "Ana López Ruiz" }
    }
  ]
}
```

### 5.2 Registrar resultado (F-05)

`PATCH /api/encuentros/:encuentro_id/resultado` ya admite `instructor`, `admin`, `gerente` y `coordinador`. *(E2.8)* Si el encuentro tiene árbitro asignado (§3.11), un `instructor` solo registra o edita el resultado si es ese árbitro; si no, 403 `{ "ok": false, "error": "Solo el árbitro asignado o el staff pueden registrar el resultado de este encuentro" }`. Sin árbitro asignado cualquier instructor puede, como antes. El staff siempre puede. El modo árbitro del panel del instructor solo necesita montar `MatchEditPanel` sin `readOnly` para ese rol y enviar `{ "marcador_1": <n>, "marcador_2": <n> }`. Si producto decide quitar el arbitraje, se saca `instructor` del `checkRole` de la ruta y de `ROLES_ARBITRAJE` en `encuentroService.js`, y el instructor recibe 403 `No tienes permisos para esta acción`.

---

## 6. Decisiones de este contrato

Son las reglas que la auditoría dejó abiertas y que aquí se fijan. Si alguna no se acepta, se corrige este documento antes de implementar.

1. **Eliminar torneo (F-01):** borrado físico si el torneo no tiene participantes ni encuentros; si los tiene, borrado lógico con `torneos.activo = FALSE` (migración nueva e idempotente, DEFAULT TRUE). Los torneos inactivos se ocultan en todos los listados y responden 404. Un torneo en curso se cancela antes de eliminarlo (409). Lo pueden hacer los tres roles de staff, igual que cancelar.
2. **Cupo (F-02):** `torneos.cupo_maximo INT NULL` con `CHECK (cupo_maximo IS NULL OR cupo_maximo BETWEEN 4 AND 256)`, en una migración nueva e idempotente. NULL significa sin límite, así que los torneos existentes no cambian.
3. **Fechas (F-07):** la inscripción cierra el día anterior a `fecha_inicio` (el día del inicio ya no se inscribe nadie). Un torneo sin `fecha_inicio` admite inscripciones mientras esté `Abierto`. No se crean torneos con fecha de inicio pasada.
4. **Categorías (F-08, E2.6):** las administran los tres roles de staff. No se borran: se desactivan (`categorias_torneo.activo`), y no se desactiva una que use un torneo activo (no eliminado, ni Finalizado ni Cancelado). El nombre es único entre las activas, comparado con `normalizarNombre`.
5. **Horario (F-09):** se intercambia como texto local `YYYY-MM-DDTHH:mm`, sin zona, para no depender de la zona del proceso de Node.

---

## 7. Colección de Postman (E2.11)

`docs/postman/torneos.json` (colección v2.1) cubre los 24 endpoints de este contrato, con un caso exitoso y uno de error en cada uno, y pruebas (`pm.test`) del status y del mensaje. `docs/postman/torneos.postman_environment.json` es la plantilla del entorno: `baseUrl`, ids y fechas, y las credenciales de staff, instructor y socio **vacías**, que se llenan solo en el entorno local y nunca se suben. La carpeta "0. Autenticación" guarda `token`, `token_instructor` y `token_socio`; "Crear torneo" y "Crear categoría" guardan sus ids. Si cambia un endpoint, se cambia también la colección.
