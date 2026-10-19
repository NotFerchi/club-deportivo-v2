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
| F-08 | Administrar las categorías | **Backend** + interfaz | Endpoints nuevos `POST`, `PUT` y `DELETE /api/torneos/categorias` (§3.7–§3.9). Pantalla de admin |
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
- **Nombres de campos:** los de la base (`torneos`, `participantes_torneo`, `encuentros_torneo`, `categorias_torneo`). El único campo nuevo es `torneos.cupo_maximo` (F-02). `admite_inscripcion` es calculado y no se guarda.

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
| **Regla** | Borrado físico, solo si el torneo **no tiene participantes ni encuentros**. Un torneo con inscritos o con bracket se cancela (`PATCH /:torneo_id/cancelar`), no se elimina: así se conserva el historial y no hace falta `ON DELETE` en las FKs. Se hace en una transacción con la fila del torneo bloqueada (`bloquearTorneo`) |
| **Respuesta 200** | `{ "ok": true, "message": "Torneo eliminado correctamente" }` |
| **400** | `torneo_id debe ser un entero válido` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Torneo no encontrado` |
| **409** | `No se puede eliminar: el torneo tiene participantes inscritos. Cancélalo en su lugar` |
| **409** | `No se puede eliminar: el torneo ya tiene bracket. Cancélalo en su lugar` |

Request:

```http
DELETE /api/torneos/45
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
{ "ok": true, "message": "Torneo eliminado correctamente" }
```

Response 409:

```json
{ "error": "No se puede eliminar: el torneo tiene participantes inscritos. Cancélalo en su lugar" }
```

### 3.2 Listar torneos — Cambia (F-02, F-07)

| | |
|---|---|
| **Método** | `GET` |
| **Ruta** | `/api/torneos` |
| **Roles** | Cualquier usuario autenticado |
| **Query** | `disciplina_id` (opcional, id válido), `estado` (opcional, sin distinguir mayúsculas) |
| **Respuesta 200** | Arreglo de torneos con `torneo_id`, `nombre`, `disciplina_id`, `nombre_disciplina`, `fecha_inicio`, `fecha_fin`, `estado`, `tipo_torneo`, `categoria_id`, `nombre_categoria`, `total_participantes`, `se_realiza`, `cupo_maximo` *(nuevo)* y `admite_inscripcion` *(nuevo)* |
| **400** | `disciplina_id debe ser un entero valido` |
| **403** | — (no restringe rol) |
| **404** | — (una lista vacía responde 200 con `[]`) |
| **409** | — |

`admite_inscripcion` es `true` solo si se cumplen todas: `estado = 'Abierto'`, `categoria_id` no es NULL, `fecha_inicio` es NULL o posterior a hoy (F-07) y `cupo_maximo` es NULL o mayor que `total_participantes` (F-02). La vista del socio muestra "Inscribirse" solo cuando es `true`, y la tarjeta pinta la barra `total_participantes / cupo_maximo` cuando hay cupo.

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
| **400** | `El nombre es requerido` · `Máximo 150 caracteres` · `disciplina_id es requerido` · `disciplina_id debe ser un entero valido` · `categoria_id es requerido` · `categoria_id debe ser un entero valido` · `tipo_torneo debe ser Individual o Equipos` · `La fecha de fin no puede ser menor que la fecha de inicio` · `Formato de fecha invalido` · `La disciplina no existe` · `La categoría no existe` · *(nuevo)* `La fecha de inicio no puede ser anterior a hoy` · *(nuevo)* `cupo_maximo debe ser un entero entre 4 y 256` |
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

### 3.7 Crear categoría — Nuevo (F-08)

| | |
|---|---|
| **Método** | `POST` |
| **Ruta** | `/api/torneos/categorias` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | `nombre` (requerido, ≤ 50, el límite de `categorias_torneo.nombre`) |
| **Regla** | El nombre se guarda sin espacios en los extremos. Los duplicados se comparan con `normalizarNombre` (sin espacios sobrantes y en minúsculas), igual que los externos |
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
| **Regla** | Solo cambia el nombre. Se permite aunque la categoría esté en uso: los torneos y participantes guardan `categoria_id`, no el texto |
| **Respuesta 200** | `{ "ok": true, "categoria_id": <id>, "nombre": "<nombre>", "message": "Categoría actualizada correctamente" }` |
| **400** | `categoria_id debe ser un entero valido` · `El nombre es requerido` · `Máximo 50 caracteres` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Categoría no encontrada` |
| **409** | `Ya existe una categoría con ese nombre` (sin contar la propia) |

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

### 3.9 Eliminar categoría — Nuevo (F-08)

| | |
|---|---|
| **Método** | `DELETE` |
| **Ruta** | `/api/torneos/categorias/:categoria_id` |
| **Roles** | `admin`, `gerente`, `coordinador` |
| **Body** | Ninguno |
| **Regla** | Solo si ningún torneo ni participante la usa (`torneos.categoria_id` y `participantes_torneo.categoria_id`). Las categorías duplicadas o de prueba que ya están en uso (por ejemplo "Libre", ids 3 y 5) se resuelven con un script de datos revisado, no con este endpoint |
| **Respuesta 200** | `{ "ok": true, "message": "Categoría eliminada correctamente" }` |
| **400** | `categoria_id debe ser un entero valido` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Categoría no encontrada` |
| **409** | `No se puede eliminar: la categoría está en uso por 3 torneos` · `No se puede eliminar: la categoría está en uso por 12 participantes` |

Request:

```http
DELETE /api/torneos/categorias/9
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
{ "ok": true, "message": "Categoría eliminada correctamente" }
```

Response 409:

```json
{ "error": "No se puede eliminar: la categoría está en uso por 3 torneos" }
```

### 3.10 Programar horario de un encuentro — Nuevo (F-09)

| | |
|---|---|
| **Método** | `PATCH` |
| **Ruta** | `/api/encuentros/:encuentro_id/horario` |
| **Roles** | `admin`, `gerente`, `coordinador` (los mismos que asignar cancha) |
| **Body** | `hora_programada`: `"YYYY-MM-DDTHH:mm"` en hora del club, sin zona ni `Z`; o `null` para quitarla |
| **Regla** | Mismos estados del torneo que la cancha (`admiteAsignarCancha`: `Inscripciones_cerradas` o `En_curso`), con la fila del torneo bloqueada (`estadoDelTorneo`). No se programa un encuentro `finalizado`. Si el torneo tiene `fecha_inicio`/`fecha_fin`, la fecha debe caer entre ellas. La columna es `TIMESTAMP` sin zona: el backend la escribe y la devuelve como texto (`to_char(... 'YYYY-MM-DD"T"HH24:MI')`) para que Node no la convierta a UTC |
| **Respuesta 200** | `{ "ok": true, "message": "Horario asignado correctamente", "encuentro": { "encuentro_id": <id>, "hora_programada": "<YYYY-MM-DDTHH:mm>" \| null } }` |
| **400** | `encuentro_id inválido` · `hora_programada es requerida` (si el campo no viene; `null` sí es válido) · `hora_programada debe tener el formato YYYY-MM-DDTHH:mm` · `La fecha debe estar entre el inicio y el fin del torneo (2026-11-07 a 2026-11-15)` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Encuentro no encontrado` |
| **409** | `Solo se puede programar el horario con las inscripciones cerradas o el torneo en curso (estado actual: Abierto)` · `No se puede programar un encuentro ya finalizado` |

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
{ "ok": false, "error": "No se puede programar un encuentro ya finalizado" }
```

---

## 4. Auditoría de las acciones (F-04)

No agrega endpoints ni cambia respuestas. Cada endpoint que escribe llama a `logAudit` (`backend/src/utils/auditLogger.js`) **solo cuando la operación tuvo éxito**, igual que `disciplinasController.js`. `usuario_id` e `ip_origen` los toma `logAudit` de la petición; si la escritura del log falla, la respuesta no cambia.

| Endpoint | `accion` | `tabla_afectada` | `registro_id` | `detalles` |
|---|---|---|---|---|
| `POST /api/torneos` | `crear_torneo` | `torneos` | `torneo_id` | `Torneo creado: <nombre>` |
| `PUT /api/torneos/:torneo_id` | `actualizar_torneo` | `torneos` | `torneo_id` | JSON con los campos que cambiaron (antes → después) |
| `DELETE /api/torneos/:torneo_id` | `eliminar_torneo` | `torneos` | `torneo_id` | `Torneo eliminado: <nombre>` |
| `PATCH /:torneo_id/cerrar-inscripciones` | `cerrar_inscripciones_torneo` | `torneos` | `torneo_id` | `Bracket generado con <n> participantes` |
| `PATCH /:torneo_id/confirmar-bracket` | `confirmar_bracket_torneo` | `torneos` | `torneo_id` | `Bracket confirmado` |
| `PATCH /:torneo_id/finalizar` | `finalizar_torneo` | `torneos` | `torneo_id` | `Campeón: participante <ganador_id>` |
| `PATCH /:torneo_id/cancelar` | `cancelar_torneo` | `torneos` | `torneo_id` | `Cancelado desde <estado anterior>` |
| `POST /:torneo_id/inscribir` | `inscribir_participante_torneo` | `participantes_torneo` | `participante_id` | JSON con `torneo_id` y `socio_id`/`visita_id`/`nombre_externo` |
| `POST /:torneo_id/inscribir-me` | `autoinscribir_socio_torneo` | `participantes_torneo` | `participante_id` | JSON con `torneo_id` y `socio_id` |
| `DELETE /:torneo_id/participantes/:participante_id` | `desinscribir_participante_torneo` | `participantes_torneo` | `participante_id` | JSON con `torneo_id` |
| `PATCH /api/encuentros/:encuentro_id/resultado` | `registrar_resultado_encuentro` o `editar_resultado_encuentro` (con `allowEdit`) | `encuentros_torneo` | `encuentro_id` | JSON con marcadores y `ganador_id`, antes y después en la edición |
| `PATCH /api/encuentros/:encuentro_id/cancha` | `asignar_cancha_encuentro` | `encuentros_torneo` | `encuentro_id` | `Cancha: <cancha_asignada>` |
| `PATCH /api/encuentros/:encuentro_id/horario` | `programar_horario_encuentro` | `encuentros_torneo` | `encuentro_id` | `Horario: <hora_programada>` |
| `POST /api/torneos/categorias` | `crear_categoria_torneo` | `categorias_torneo` | `categoria_id` | `Categoría creada: <nombre>` |
| `PUT /api/torneos/categorias/:categoria_id` | `actualizar_categoria_torneo` | `categorias_torneo` | `categoria_id` | `<nombre anterior> → <nombre nuevo>` |
| `DELETE /api/torneos/categorias/:categoria_id` | `eliminar_categoria_torneo` | `categorias_torneo` | `categoria_id` | `Categoría eliminada: <nombre>` |

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

`PATCH /api/encuentros/:encuentro_id/resultado` ya admite `instructor`, `admin`, `gerente` y `coordinador`. El modo árbitro del panel del instructor solo necesita montar `MatchEditPanel` sin `readOnly` para ese rol y enviar `{ "marcador_1": <n>, "marcador_2": <n> }`. Si producto decide quitar el arbitraje, se saca `instructor` del `checkRole` de la ruta y de `ROLES_ARBITRAJE` en `encuentroService.js`, y el instructor recibe 403 `No tienes permisos para esta acción`.

---

## 6. Decisiones de este contrato

Son las reglas que la auditoría dejó abiertas y que aquí se fijan. Si alguna no se acepta, se corrige este documento antes de implementar.

1. **Eliminar torneo (F-01):** borrado físico solo sin participantes ni encuentros; en otro caso se cancela. Lo pueden hacer los tres roles de staff, igual que cancelar.
2. **Cupo (F-02):** `torneos.cupo_maximo INT NULL` con `CHECK (cupo_maximo IS NULL OR cupo_maximo BETWEEN 4 AND 256)`, en una migración nueva e idempotente. NULL significa sin límite, así que los torneos existentes no cambian.
3. **Fechas (F-07):** la inscripción cierra el día anterior a `fecha_inicio` (el día del inicio ya no se inscribe nadie). Un torneo sin `fecha_inicio` admite inscripciones mientras esté `Abierto`. No se crean torneos con fecha de inicio pasada.
4. **Categorías (F-08):** las administran los tres roles de staff; no se borra una categoría en uso.
5. **Horario (F-09):** se intercambia como texto local `YYYY-MM-DDTHH:mm`, sin zona, para no depender de la zona del proceso de Node.
