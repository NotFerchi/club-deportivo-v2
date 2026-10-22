# Contrato de API de evaluaciones de instructores

**Proyecto:** club-deportivo-v2 · **Rama base:** `develop` @ `11ce7c8` · **Fecha:** 2026-10-22
**Origen:** entregable E4, "Evaluación de instructores (SC-01): tablas en Neon y endpoints". La interfaz es el E5.

Este documento fija los endpoints y las reglas de la evaluación de instructores antes de escribir código. Backend y frontend trabajan contra este contrato: si algo cambia al implementar, se actualiza aquí primero.

---

## 1. Alcance

| Tema | Regla |
|---|---|
| **Quién evalúa** | Solo el rol `socio`, y solo en una sesión donde tiene una inscripción con `estado = 'Confirmada'` (`inscripciones_clases`). El `socio_id` sale del token (por `usuario_id`), nunca del body |
| **Qué evalúa** | Al instructor de la sesión (`sesiones_programadas.instructor_id`), que se guarda en la evaluación. Calificación entera de 1 a 5 y comentario opcional de hasta 500 caracteres: se recorta y, si queda vacío, se guarda `NULL` |
| **Frecuencia** | Una evaluación por socio, por sesión y por mes. El mes es el de la fecha del club en `America/Mexico_City` (`periodo`) |
| **Quién ve** | El `instructor` solo las suyas. `admin`, `gerente` y `coordinador`, las de cualquier instructor. El `socio`, solo las que él hizo (§3.4) |
| **Anonimato** | Las respuestas de listado (§3.2) y de promedio (§3.3) **nunca** incluyen `socio_id` ni el nombre del socio |
| **Fuera de alcance** | Editar o borrar evaluaciones, y la interfaz (E5) |

Tabla nueva: `evaluaciones_instructor` (script `backend/migrations/Crear_evaluaciones_instructor.sql`), con `UNIQUE (socio_id, sesion_id, periodo)`.

---

## 2. Convenciones comunes

- **Base:** `/api/evaluaciones`. Todos los endpoints exigen `Authorization: Bearer <token>`.
- **Roles de staff:** `admin`, `gerente` y `coordinador`.
- **Forma del error:** `{ "error": "<mensaje>" }`.
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
- **`periodo`:** en la BD es un `DATE` con el día 1 del mes; en las respuestas y en el query viaja como texto `"YYYY-MM"`. Lo calcula la BD al guardar: `date_trunc('month', now() AT TIME ZONE 'America/Mexico_City')`.
- **`fecha_creacion`:** texto `"YYYY-MM-DDTHH:mm:ss"` en hora del club, sin zona (`to_char`), para que Node no lo convierta a UTC.
- **Filtro `?periodo`** (opcional en §3.2, §3.3 y §3.4): `YYYY-MM` con mes de `01` a `12`. Si no viene, se toman todos los meses.

---

## 3. Endpoints de backend

Los cuatro son **nuevos**.

### 3.1 Crear evaluación

| | |
|---|---|
| **Método** | `POST` |
| **Ruta** | `/api/evaluaciones` |
| **Roles** | `socio` |
| **Body** | `sesion_id` (requerido, id válido), `calificacion` (requerido, entero de 1 a 5, como número o texto de dígitos), `comentario` (opcional, texto; se recorta; hasta 500 caracteres después de recortar; `null`, ausente o vacío → `NULL`) |
| **Regla** | En este orden: formato (400) → el usuario tiene socio activo (403) → la sesión existe (404) → el socio tiene inscripción `Confirmada` en esa sesión (403) → la sesión tiene instructor (409) → el instructor está activo (409) → no hay evaluación de ese socio, sesión y mes (409). La validación de la inscripción y el `INSERT` van en una transacción; el duplicado lo decide el `UNIQUE` de la tabla (`23505` → 409), así dos envíos simultáneos no crean dos filas |
| **Respuesta 201** | La evaluación creada: `evaluacion_id`, `instructor_id`, `sesion_id`, `calificacion`, `comentario`, `periodo`, `fecha_creacion` |
| **400** | `sesion_id debe ser un entero válido` · `calificacion debe ser un entero de 1 a 5` · `comentario debe ser texto de máximo 500 caracteres` |
| **403** | `No tienes permisos para esta acción` · `Tu usuario no tiene un registro de socio activo` · `Solo puedes evaluar clases en las que estás inscrito` |
| **404** | `Sesión no encontrada` |
| **409** | `La sesión no tiene instructor asignado` · `El instructor de esta sesión está inactivo` · `Ya evaluaste esta clase este mes` |

Request:

```http
POST /api/evaluaciones
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{ "sesion_id": 14, "calificacion": 5, "comentario": "  Muy buena clase, explica con paciencia.  " }
```

Response 201:

```json
{
  "evaluacion_id": 27,
  "instructor_id": 3,
  "sesion_id": 14,
  "calificacion": 5,
  "comentario": "Muy buena clase, explica con paciencia.",
  "periodo": "2026-10",
  "fecha_creacion": "2026-10-22T18:05:41"
}
```

Response 409:

```json
{ "error": "Ya evaluaste esta clase este mes" }
```

### 3.2 Listar evaluaciones de un instructor

| | |
|---|---|
| **Método** | `GET` |
| **Ruta** | `/api/evaluaciones/instructor/:instructor_id` |
| **Roles** | `admin`, `gerente`, `coordinador`, `instructor` (este último solo si `:instructor_id` es el suyo) |
| **Query** | `periodo` (opcional, `YYYY-MM`) |
| **Regla** | Para el rol `instructor` se busca su `instructor_id` por `usuario_id`; si no tiene registro o no coincide con `:instructor_id`, 403. El 404 solo aplica si el instructor no existe: uno inactivo se puede consultar |
| **Respuesta 200** | Arreglo **anónimo** ordenado de la más reciente a la más antigua (`fecha_creacion` y luego `evaluacion_id`, descendente): `evaluacion_id`, `sesion_id`, `disciplina`, `calificacion`, `comentario`, `periodo`, `fecha_creacion`. Sin evaluaciones → `[]`. Nunca incluye `socio_id` ni el nombre del socio |
| **400** | `instructor_id debe ser un entero válido` · `periodo debe tener el formato YYYY-MM` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Instructor no encontrado` |
| **409** | — |

Request:

```http
GET /api/evaluaciones/instructor/3?periodo=2026-10
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
[
  {
    "evaluacion_id": 27,
    "sesion_id": 14,
    "disciplina": "Natación",
    "calificacion": 5,
    "comentario": "Muy buena clase, explica con paciencia.",
    "periodo": "2026-10",
    "fecha_creacion": "2026-10-22T18:05:41"
  }
]
```

Response 403 (un instructor consulta a otro):

```json
{ "error": "No tienes permisos para esta acción" }
```

### 3.3 Promedio de un instructor

| | |
|---|---|
| **Método** | `GET` |
| **Ruta** | `/api/evaluaciones/instructor/:instructor_id/promedio` |
| **Roles** | Los mismos que §3.2, con la misma regla para `instructor` |
| **Query** | `periodo` (opcional, `YYYY-MM`) |
| **Respuesta 200** | `{ "instructor_id", "total", "promedio", "distribucion" }`. `promedio` es un número con 2 decimales, o `null` si `total = 0`. `distribucion` trae siempre las cinco claves `"1"` a `"5"`, con 0 cuando no hay votos |
| **400** | `instructor_id debe ser un entero válido` · `periodo debe tener el formato YYYY-MM` |
| **403** | `No tienes permisos para esta acción` |
| **404** | `Instructor no encontrado` |
| **409** | — |

Request:

```http
GET /api/evaluaciones/instructor/3/promedio
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
{
  "instructor_id": 3,
  "total": 3,
  "promedio": 4.33,
  "distribucion": { "1": 0, "2": 0, "3": 0, "4": 2, "5": 1 }
}
```

Response 200 (sin evaluaciones):

```json
{
  "instructor_id": 3,
  "total": 0,
  "promedio": null,
  "distribucion": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
}
```

### 3.4 Mis evaluaciones (socio)

| | |
|---|---|
| **Método** | `GET` |
| **Ruta** | `/api/evaluaciones/mias` |
| **Roles** | `socio` |
| **Query** | `periodo` (opcional, `YYYY-MM`) |
| **Regla** | Solo las evaluaciones que hizo el socio del token. Sirve para que el formulario del E5 sepa qué clases ya calificó en el mes |
| **Respuesta 200** | Arreglo ordenado de la más reciente a la más antigua: `evaluacion_id`, `sesion_id`, `instructor_id`, `disciplina`, `calificacion`, `comentario`, `periodo`, `fecha_creacion`. Sin `socio_id`. Sin evaluaciones → `[]` |
| **400** | `periodo debe tener el formato YYYY-MM` |
| **403** | `No tienes permisos para esta acción` · `Tu usuario no tiene un registro de socio activo` |
| **404** | — |
| **409** | — |

Request:

```http
GET /api/evaluaciones/mias?periodo=2026-10
Authorization: Bearer eyJhbGciOi...
```

Response 200:

```json
[
  {
    "evaluacion_id": 27,
    "sesion_id": 14,
    "instructor_id": 3,
    "disciplina": "Natación",
    "calificacion": 5,
    "comentario": "Muy buena clase, explica con paciencia.",
    "periodo": "2026-10",
    "fecha_creacion": "2026-10-22T18:05:41"
  }
]
```

---

## 4. Auditoría

Solo escribe §3.1. El controlador llama a `logAudit` (`backend/src/utils/auditLogger.js`) **solo cuando la evaluación se guardó**. `usuario_id` e `ip_origen` los toma `logAudit` de la petición; si la escritura del log falla, la respuesta no cambia.

| Endpoint | `accion` | `tabla_afectada` | `registro_id` | `detalles` |
|---|---|---|---|---|
| `POST /api/evaluaciones` | `crear_evaluacion_instructor` | `evaluaciones_instructor` | `evaluacion_id` | JSON con `sesion_id`, `instructor_id` y `periodo` (sin el comentario ni la calificación) |

---

## 5. Qué consume la interfaz (E5)

| Pantalla | Rol | Endpoints | Para qué |
|---|---|---|---|
| Formulario de evaluación | `socio` | §3.4 `GET /api/evaluaciones/mias?periodo=<mes actual>` | Marcar las clases que ya calificó este mes y no ofrecer el envío otra vez |
| | | §3.1 `POST /api/evaluaciones` | Enviar la calificación y el comentario; mostrar el mensaje de error del 403/404/409 tal cual |
| Vista de resultados | `instructor` (las suyas), staff (cualquiera) | §3.3 `GET /api/evaluaciones/instructor/:id/promedio` | Promedio, total y gráfica de distribución |
| | | §3.2 `GET /api/evaluaciones/instructor/:id` | Lista anónima de calificaciones y comentarios |

---

## 6. Decisiones de este contrato

Si alguna no se acepta, se corrige este documento antes de implementar.

1. **Socio inactivo:** un usuario con rol `socio` sin fila en `socios` o con `socios.activo = FALSE` se trata igual: 403 `Tu usuario no tiene un registro de socio activo`.
2. **Formato de fechas:** `periodo` viaja como `"YYYY-MM"` y `fecha_creacion` como `"YYYY-MM-DDTHH:mm:ss"` en hora del club, ambos con `to_char`, igual que el horario de los encuentros de torneos.
3. **Filtro `?periodo`:** opcional; sin él se devuelven todos los meses.
4. **Instructor inexistente vs. inactivo:** §3.2 y §3.3 responden 404 solo si el `instructor_id` no existe; un instructor inactivo conserva su historial consultable. Para crear una evaluación (§3.1), en cambio, el instructor debe estar activo.
5. **`/mias` sin `socio_id`:** el socio ya sabe quién es; la respuesta no lo repite.
6. **Limitación conocida:** no se exige asistencia previa a la clase; se puede endurecer después exigiendo al menos una asistencia presente del socio en esa sesión.
