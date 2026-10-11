# Auditoría general de bugs (todo el proyecto, salvo torneos)

**Proyecto:** club-deportivo-v2 · **Rama:** `develop` @ `3668308` · **Fecha:** 2026-10-11
**Tipo:** solo inspección. No se cambió código, no se hizo nada en git y no se escribió en Neon.
**Fuera de alcance:** el módulo de torneos/encuentros y las rutas `/api/instructor/torneos*`, ya auditados en [auditoria-torneos.md](auditoria-torneos.md). Aquí no se repiten.

## Cómo se verificó

| Etiqueta | Significado |
|---|---|
| **[Neon-lectura]** | Consulta `SELECT` dentro de `BEGIN READ ONLY … ROLLBACK`. Postgres rechaza cualquier escritura. |
| **[API local]** | Backend local (puerto 3999) contra Neon, con dos protecciones. **1)** Solo se enviaron GETs y peticiones que se rechazan antes de la BD (sin token, rol sin permiso o body ausente). **2)** El pool de `pg` iba envuelto para **bloquear toda sentencia de escritura**. Gracias a esa protección se descubrió que dos GETs intentan escribir (GEN-B03). Los JWT se firmaron localmente con el `JWT_SECRET` del `.env`; no se usó `/api/auth/login`. |
| **[BD memoria]** | Rutas reales del backend sobre PostgreSQL en memoria (PGlite), con el esquema copiado de Neon, en una carpeta temporal fuera del repo. |
| **[Código]** | Análisis del código, sin ejecución. |

**Conteo de filas en Neon (29 tablas), antes y después:** idéntico.

| Tabla | Filas | Tabla | Filas | Tabla | Filas |
|---|---:|---|---:|---|---:|
| acciones_familiares | 13 | inscripciones_clases | 12 | reservaciones | 58 |
| asistencia | 18 | instructores | 18 | roles | 6 |
| categorias_torneo | 10 | lista_espera | 0 | roles_permisos | 0 |
| codigos_qr_socios | 30 | logs_sistema | 666 | sanciones | 77 |
| codigos_qr_visitas | 30 | mantenimiento_espacios | 6 | sesiones_programadas | 294 |
| disciplinas | 33 | miembros_equipo | 0 | socios | 73 |
| encuentros_torneo | 44 | participantes_torneo | 49 | torneos | 16 |
| equipos | 0 | permisos | 0 | usuarios | 66 |
| espacios | 37 | registro_acceso | 2 | visitas | 59 |
| espacios_disciplinas | 67 | registro_ludoteca | 53 | | |

La revisión de cada módulo la hicieron 5 agentes en paralelo con las mismas reglas de solo lectura. Lo transversal (rutas, sondas HTTP, esquema, tests, ESLint y build) y la consolidación se hicieron aparte. Los hallazgos repetidos entre módulos se fusionaron.

Los números de línea corresponden al commit `3668308`.

---

## 1. Resumen

| | Alta | Media | Baja | Total |
|---|---:|---:|---:|---:|
| **Bugs** | 28 | 80 | 45 | **153** |
| **Faltantes** | 1 | 21 | 12 | **34** |
| **Posibles SC** | | | | **13** |

**Por módulo**

| Módulo | Bugs Alta | Bugs Media | Bugs Baja | Bugs total | Faltantes |
|---|---:|---:|---:|---:|---:|
| Autenticación, usuarios y roles (AUTH) | 2 | 8 | 6 | 16 | 3 |
| Socios e importación (SOC) | 4 | 9 | 4 | 17 | 4 |
| Reservas y espacios (RES) | 5 | 12 | 7 | 24 | 8 |
| Clases, disciplinas e instructores (CLA) | 8 | 14 | 8 | 30 | 8 |
| Recepción, accesos y QR (REC) | 3 | 10 | 5 | 18 | 3 |
| Ludoteca (LUD) | 2 | 7 | 2 | 11 | 2 |
| Sanciones (SAN) | 1 | 8 | 4 | 13 | 3 |
| Reportes y auditoría (REP) | 0 | 8 | 4 | 12 | 2 |
| Dashboards generales (DASH) | 0 | 2 | 1 | 3 | 0 |
| Transversales (GEN) | 3 | 2 | 4 | 9 | 1 |
| **Total** | 28 | 80 | 45 | **153** | **34** |

Para comparar: el módulo de torneos, auditado aparte, tiene 27 bugs y 10 faltantes.

**Lo más importante**

1. **Datos personales y suplantación.**
   - Con token de **socio** se leen CURP, teléfono, dirección y contactos de emergencia de los 40 socios con cuenta (SOC-B01).
   - Un socio puede descargar el QR de acceso de otro socio (SOC-B02).
   - Un socio puede ver los listados de recepción (REC-B02).
   - Los datos de los instructores se exponen sin token (CLA-B06).
   - Cualquiera, sin token, puede inscribir, cancelar o leer las clases de cualquier socio (CLA-B01). **[API local]**
2. **Toma de cuenta.** Un gerente puede cambiar la contraseña del admin o crear admins (AUTH-B01). Además, las contraseñas de la importación son predecibles (SOC-B03).
3. **Reservas que siempre acaban en sanción.** No existe check-in de reservas de espacio, así que **todas** terminan en No-Show con sanción (RES-B01). Ese proceso lo dispara un **GET** sin transacción (GEN-B03). El socio, además, puede crear o cancelar reservas a nombre de otros (RES-B02, RES-B03).
4. **Funciones rotas.**
   - "Editar sesión" siempre da 500 (CLA-B02).
   - El QR que entrega recepción nunca se guarda, así que el torniquete lo rechaza (REC-B01).
   - Crear socio desde recepción siempre da 500 (SOC-B05).
   - El Excel de socios saca mal las 40 fechas de nacimiento (REP-B02).
   - Las sanciones de ludoteca nunca vencen (SAN-B01).
5. **Validación.**
   - Al menos 24 endpoints responden 500 sin body (GEN-B01).
   - 24 GETs responden 500 con ids no numéricos o fuera del rango int4 (GEN-B02).
   - Varias respuestas exponen el texto de PostgreSQL (GEN-B04).
6. **Esquema.** `npm run migrate` no reproduce Neon. La tabla de auditoría real (`logs_sistema`) no está en ninguna migración, y el código depende de tablas que Neon no tiene (`pases`) (GEN-B05).

**Lo que sí funciona** (verificado):

- Las 63 rutas no-GET protegidas (sin contar torneos) responden 401 sin token, y las 56 que no admiten al rol socio le responden 403 **[API local]**.
- No hay SQL armado con datos del usuario: todas las interpolaciones son columnas de listas blancas o placeholders **[Código]**.
- El frontend no llama a ningún endpoint inexistente, salvo la página huérfana `/espacios` (RES-B15).
- `vite build` compila.
- La propiedad de las sanciones sí se valida: un socio ajeno recibe 403.
- La importación de socios valida todo-o-nada.

**Tests**

- La suite completa da 496 pasan y 3 fallan. Los 3 fallos son **tests desactualizados, no bugs** (GEN-B08):
  - `accesoMetricas.test.js` (2): espera el texto "Sin permisos", pero desde `83490a0` el 403 dice "No tienes permisos para esta acción". El código de estado 403 es correcto.
  - `asistenciaQr.test.js` (1): espera un 403 "socio no inscrito", pero desde `704aa96` el QR auto-inscribe al socio. El test también usa una secuencia de mocks que ya no corresponde.
- Casi todos los demás tests son de caracterización con la BD y `checkRole` simulados, así que **fijan los bugs actuales**. Al corregir habrá que actualizar sus snapshots a propósito.

---

## 2. Bugs

### 2.1 Autenticación, usuarios y roles (AUTH)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| AUTH-B01 | Un gerente puede tomar la cuenta del admin (cambiarle la contraseña, crear admins o borrarlo) | Alta | PUT/POST/DELETE /api/usuarios; Gestión de Usuarios | backend/src/routes/usuarios.routes.js:8,24-33; services/usuarioService.js:172-271 (acepta rol_id y password sin mirar el rol de quien llama) | Con token gerente: PUT /api/usuarios/<id del admin> con el payload completo y password 'nueva123'. O bien POST /api/usuarios con rol_id 1 | **[Código]** 200: la contraseña del admin cambia y el gerente puede entrar como admin. También puede crear admins y desactivar o borrar al único admin (Neon tiene 1) **[Neon-lectura]** | Solo un admin crea, edita o borra admins; un gerente no puede asignar el rol admin; nadie se desactiva ni se borra a sí mismo |
| AUTH-B02 | El borrado permanente de un usuario falla con 500 para casi cualquier usuario real | Alta | DELETE /api/usuarios/:id/permanente (botón Eliminar) | backend/src/services/usuarioService.js:281-283 | Admin o gerente: eliminar de forma permanente a un usuario que alguna vez inició sesión, o a un instructor con ficha | **[Neon-lectura]** Las FKs de logs_sistema.usuario_id, instructores.usuario_id, socios.usuario_id, sanciones.resuelto_por y otras son NO ACTION. 11 usuarios tienen logs, incluido el admin. El DELETE viola la FK y responde 500 | 409 con mensaje claro, o borrar y anonimizar las dependencias; 404 si el usuario no existe |
| AUTH-B03 | 20 de los 26 usuarios internos no se pueden editar (incluido el admin) | Media | Gestión de Usuarios → Editar; PUT /api/usuarios/:id | frontend/src/pages/dashboards/admin/GestionUsuarios.jsx:105-109; backend/src/middleware/usuarioValidators.js:13-20 | Editar a un instructor o al admin | **[Neon-lectura]** Les falta la CURP o la dirección, o la tienen inválida: admin 1 de 1, recepción 2 de 2, instructores 17 de 19 | Permitir guardar sin CURP o dirección cuando ya faltaban, o migrar esos datos |
| AUTH-B04 | Una sesión desactivada o con el rol cambiado sigue siendo válida hasta 8 h | Media | Todas las rutas con verifyToken | backend/src/middleware/auth.middleware.js:7-20; services/authService.js:47-51 | Desactivar a un usuario con sesión abierta y seguir usando su token | **[Código]** El token solo se verifica por su firma: el usuario inactivo sigue operando y un rol degradado conserva sus permisos | Comprobar activo y rol en la BD, o usar tokens cortos con revocación |
| AUTH-B05 | Cerrar sesión deja un JWT válido en localStorage ('authToken') | Media | Logout de admin, gerente, socio y recepción | frontend/src/pages/Login.jsx:90; services/api.js:3-12,22-26; Dashboard.jsx:366-370; components/SocioLayout.jsx:228-233; DashboardRecepcion.jsx:27-38 | Iniciar sesión, cerrar sesión y revisar localStorage | **[Código]** Solo se borran 'token' y 'usuario'. 'authToken' sigue ahí, getAuthToken lo usa como respaldo y DashboardRecepcion lo vuelve a copiar a 'token' | Un único logout centralizado que borre todas las claves |
| AUTH-B06 | El login escribe en consola el email y los datos del usuario | Media | POST /api/auth/login | backend/src/services/authService.js:12-13,33,36 | Hacer cualquier login | **[Código]** Imprime el correo buscado, el objeto del usuario y si la contraseña coincidió | Quitar esos logs o registrar sin datos personales |
| AUTH-B07 | Login sin body o sin contraseña responde 500 | Media | POST /api/auth/login | backend/src/controllers/auth.controller.js:6; services/authService.js:35 | POST sin body, o solo con email | **[API local]** Sin body → 500 "Error interno del servidor". **[Código]** Sin contraseña, bcrypt.compare(undefined) lanza 'Illegal arguments' y también da 500 | 400 "Correo y contraseña son obligatorios" |
| AUTH-B08 | POST /api/usuarios acepta el rol socio o un rol inexistente | Media | POST/PUT /api/usuarios | backend/src/middleware/usuarioValidators.js:13-20; services/usuarioService.js:104-165 | POST con rol_id 4 (socio), 999 o 'abc' | **[Código]** Con 4 se crea un "socio" sin fila en socios, con el panel vacío. 999 y 'abc' dan 500. Con rol instructor no se crea la ficha (**[Neon-lectura]** hay 2 instructores sin ficha) | Validar rol_id contra los roles internos asignables y crear la ficha correspondiente |
| AUTH-B09 | /api/usuarios/:id: 500 con ids no numéricos y 200 con ids inexistentes | Media | GET/PUT/DELETE /api/usuarios/:id, /desactivar, /reactivar, /permanente | backend/src/services/usuarioService.js:30-58,172-283 | GET /api/usuarios/abc; PUT o DELETE /api/usuarios/999999 | **[API local]** /abc y /99999999999 → 500. **[Código]** Con un id inexistente, UPDATE y DELETE afectan 0 filas y responden 200 | 400 si el id es inválido y 404 si no existe |
| AUTH-B10 | Una foto de perfil inválida o de más de 5 MB da 500, y una foto grande rompe el login | Media | PUT /api/usuarios/me/foto; Login | backend/src/routes/usuarios.routes.js:9-16 (no maneja MulterError); frontend/src/pages/Login.jsx:91; DashboardSocio.jsx:83-84 | Subir un .txt o una imagen de 6 MB; subir una de ~4 MB y volver a entrar | **[Código]** 500. La foto viaja en base64 en la respuesta del login: a partir de ~3.7 MB, localStorage.setItem excede la cuota y el login muestra "Error al conectar con el servidor" | 400 por tipo o tamaño; no enviar foto_perfil en el login |
| AUTH-B11 | Login y unicidad de email y CURP distinguen mayúsculas | Baja | POST /api/auth/login; POST /api/usuarios y /api/socios | backend/src/services/authService.js:21; usuarioService.js:124-129,147; socioService.js:138-141 | Entrar con 'Ana@x.com' cuando el usuario es 'ana@x.com'; crear un usuario con la CURP en minúsculas | **[Neon-lectura]** 2 usernames tienen mayúsculas, y el frontend los pasa a minúsculas al editar, lo que les cambia el login. **[Código]** Se permiten CURP duplicadas que solo difieren en mayúsculas | Normalizar email (minúsculas) y CURP (mayúsculas), con índice único sobre lower(username) |
| AUTH-B12 | El fallback 'secreto_super_seguro' sigue en el código | Baja | Login | backend/src/services/authService.js:49 | Revisar el código | **[Código]** Hoy no se ejecuta, porque index.js:3 aborta el arranque si falta JWT_SECRET, pero queda como riesgo latente | Eliminar el fallback |
| AUTH-B13 | createUsuario devuelve la contraseña en texto plano y conserva el valor por defecto 'empleado123' | Baja | POST /api/usuarios | backend/src/services/usuarioService.js:134; controllers/usuariosController.js:35 | POST sin password (por API) | **[Código]** 201 con { password: 'empleado123' } | No devolver contraseñas; exigirla o generarla aleatoria |
| AUTH-B14 | GET /api/roles es público | Baja | GET /api/roles | backend/src/routes/roles.routes.js:5 | GET sin token | **[API local]** 200 con la lista de roles | verifyToken + admin/gerente, o usar /api/usuarios/roles |
| AUTH-B15 | El panel del socio siempre saluda "Socio" | Baja | Layout del socio (encabezado) | frontend/src/components/SocioLayout.jsx:222 | Entrar como socio | **[Código]** Lee usuario.nombre, pero el login guarda 'nombres' | Usar usuario.nombres |
| AUTH-B16 | Código muerto y una ruta sin proteger | Baja | Frontend | frontend/src/pages/dashboards/admin/GestionSocios.jsx:25,30,70; App.jsx:107 (/components/socio-layout sin ProtectedRoute); services/api.js:77 | npx eslint | **[Código]** Funciones sin uso y una ruta pública que renderiza el layout del socio | Eliminarlas |

### 2.2 Socios e importación (SOC)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| SOC-B01 | Cualquier autenticado, incluido un socio, lee CURP, teléfono y dirección de todos los socios | Alta | GET /api/socios y GET /api/socios/:id | backend/src/routes/socio.routes.js:14,25; services/socioService.js:45-110 | Con token de socio: GET /api/socios y GET /api/socios/<id de otro> | **[API local]** 200 con 40 socios: curp, telefono, direccion, tel_emergencia, nombre_emergencia, fecha_nacimiento, email y num_sanciones | Restringir a staff; el socio solo ve su propio registro |
| SOC-B02 | Un socio obtiene el QR de acceso de otro socio | Alta | GET /api/socios/:socio_id/qr | backend/src/routes/socio.routes.js:15-20; services/qrService.js:222-237 | Con token de socio: GET /api/socios/1/qr | **[API local]** 200 con el qr_image del socio 1. El QR de socio no expira (qrService.js:169-175), así que sirve indefinidamente en lectura-qr y en ludoteca. Ningún frontend consume este endpoint | Solo staff o el propio socio, o eliminarlo (el socio ya tiene /qr/mi-qr) |
| SOC-B03 | La importación asigna contraseñas predecibles y compartidas por familia | Alta | POST /api/importacion/socios | backend/src/services/importacionService.js:18 | Importar la acción 1001 con titular y miembros | **[Código]** Todos los integrantes quedan con la contraseña Club1001<año>: quien conozca el número de acción entra a la cuenta de otro. No existe forma de cambiarla (AUTH-F01) | Contraseña aleatoria por usuario, con cambio obligatorio al primer acceso |
| SOC-B04 | El borrado permanente de un socio responde 500 con el texto SQL si tiene historial | Alta | DELETE /api/socios/:id/permanente | backend/src/services/socioService.js:358-368; controllers/socioController.js:6,93 | Admin: eliminar un socio inactivo con reservas, sanciones, QR o logins | **[Neon-lectura]** 28 de 73 socios tienen dependencias con FK NO ACTION. **[Código]** 500 con el mensaje crudo de violación de FK | 409 "El socio tiene historial; solo puede inactivarse", sin detalle SQL |
| SOC-B05 | Crear un socio desde recepción siempre responde 500 (y usa contraseña fija) | Media | POST /api/recepcion/socios (sin consumidor en el frontend) | backend/src/services/socioService.js:389,411-416 | Cualquier alta válida | **[Neon-lectura]** MAX(CAST(SUBSTRING(numero_socio FROM 5) AS INTEGER)) falla en Neon con 22P02 'invalid input syntax for type integer: "O-ACTIVO-1"': 49 números no son numéricos a partir de la posición 5. Hace ROLLBACK y responde 500. Además devuelve 'socio123' en claro y no valida CURP ni dirección | Eliminar la ruta o reutilizar socioService.crearSocio |
| SOC-B06 | La numeración automática de socios salta a SOC-1006x | Media | POST /api/socios (Nuevo socio) | backend/src/services/socioService.js:158 (REGEXP_REPLACE quita todo lo que no es dígito) | Crear un socio desde Gestión de Socios | **[Neon-lectura]** 'SOC-1006-M1' se lee como 10061, por eso ya existen SOC-10062 a 10064 y el siguiente será SOC-10065. Hay 12 formatos distintos de numero_socio y 3 socios sin número | Una secuencia propia, solo sobre el patrón SOC-NNNN |
| SOC-B07 | 31 de 40 socios con usuario no se pueden editar | Media | Gestión de Socios → Editar; PUT /api/socios/:id | backend/src/services/socioService.js:24-36; importacionService.js:25; importacion/columnasSocios.js; frontend GestionSocios.jsx:205-211 | Editar un socio importado (por ejemplo, su teléfono) | **[Neon-lectura]** 31 sin CURP y 15 sin dirección (la importación no trae CURP), pero el formulario y el backend las exigen | Agregar la CURP a la plantilla, o hacerla opcional mientras falte |
| SOC-B08 | Recepción y gerente ven botones que siempre fallan con 403 | Media | Dashboard de Recepción → Socios; Gestión de Socios (gerente) | frontend/src/pages/dashboards/DashboardRecepcion.jsx:147; GestionSocios.jsx:485-498,523-540 | Como recepción: Inactivar, Eliminar, Importar, Plantilla o Exportar. Como gerente: Eliminar permanente | **[API local]** Los cinco responden 403. La UI muestra un toast de 403 y Plantilla falla en silencio | Ocultar cada acción según el rol real del backend |
| SOC-B09 | GET /api/socios/:id con id no numérico o fuera de rango responde 500 con el texto SQL | Media | GET /api/socios/:id | backend/src/controllers/socioController.js:6,21,29; routes/socio.routes.js:25 | GET /api/socios/abc; GET /api/socios/99999999999 | **[API local]** 500 {"error":"invalid input syntax for type integer: \"abc\""} y "value \"99999999999\" is out of range…" | 400 "id inválido", sin texto de PostgreSQL |
| SOC-B10 | PUT y DELETE permanente de un socio inexistente responden 500 en lugar de 404 | Media | PUT /api/socios/:id; DELETE /api/socios/:id/permanente | backend/src/services/socioService.js:239,363 | PUT /api/socios/999999 con payload válido | **[Código]** 500 { error: 'Socio no encontrado' } | 404 |
| SOC-B11 | El body del socio no se valida por tipo ni longitud: 500 con texto SQL | Media | POST/PUT /api/socios | backend/src/services/socioService.js:24-36,154 | POST con nombres:123, con un email de 60 caracteres o con un numero_socio repetido | **[API local]** Sin body → 500. **[Código]** .trim() sobre un número lanza TypeError; longitudes (22001) y duplicados (23505) dan 500 con error.message | 400 con validación según las longitudes de Neon (username 50, numero_socio 20, tel_emergencia 20) |
| SOC-B12 | La numeración M<n> de la importación usa COUNT+1 y choca después de una baja | Media | POST /api/importacion/socios | backend/src/services/importacionService.js:43,85-90,108-114 | En una acción con T, M1 y M2, borrar M1 e importar un miembro nuevo | **[Código]** COUNT=1 genera M2, que ya existe (23505), y la importación completa se rechaza siempre. Sin lock, dos importaciones simultáneas también chocan | MAX(n)+1 bajo advisory lock, o una secuencia por acción |
| SOC-B13 | La importación permite dos titulares, acciones Individual con varios miembros y modalidades mezcladas | Media | POST /api/importacion/socios | backend/src/services/importacion/validacionSocios.js:229-261; importacionService.js:76 | Reimportar como Titular a un miembro de una acción que ya tiene titular en la BD | **[Código]** Quedan dos titulares. Las reglas solo se comprueban dentro del archivo, no contra la BD | Validar contra la BD: un titular por acción, Individual con un solo integrante, modalidad coherente |
| SOC-B14 | 33 socios sin usuario no aparecen en Gestión de Socios | Baja | GET /api/socios | backend/src/services/socioService.js:73 (JOIN en lugar de LEFT JOIN) | Abrir Gestión de Socios | **[Neon-lectura]** 33 de 73 socios tienen usuario_id NULL (datos de prueba) y 2 de ellos participan en torneos | Limpiar esos datos y declarar usuario_id NOT NULL UNIQUE |
| SOC-B15 | VistaSocios del coordinador oculta errores y muestra 0 socios | Baja | Coordinador → Socios | frontend/src/pages/dashboards/coordinador/VistaSocios.jsx:22-35 | Con el token vencido o ante un 500 | **[Código]** No revisa res.ok ni el 401: muestra la lista vacía sin avisar | Usar apiRequest y mostrar el error |
| SOC-B16 | Íconos de importación y exportación cruzados y conteo de exportados erróneo | Baja | Gestión de Socios | frontend GestionSocios.jsx:525-537,363 | Ver los botones; exportar con una búsqueda activa | **[Código]** Importar usa el ícono de descarga. "Exportados N" cuenta la lista filtrada por la búsqueda, pero el backend exporta sin ese filtro | Corregir los íconos y el conteo |
| SOC-B17 | La importación devuelve el detalle SQL en el 500 | Baja | POST /api/importacion/socios | backend/src/services/importacionService.js:203 | Provocar un fallo general de la transacción | **[Código]** Responde 'Error en la transacción: ' + err.message | Mensaje genérico; el detalle solo al log |

### 2.3 Reservas y espacios (RES)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| RES-B01 | Toda reserva de espacio termina en No-Show y genera una sanción | Alta | GET /api/reservas y /:id (syncReservasNoShow); Reservas del socio | backend/src/services/reservaService.js:53-85 (NOT EXISTS sobre asistencia, líneas 65-75); todos los INSERT en asistencia exigen sesion_id | Un socio reserva una cancha, asiste, y después de la hora_fin alguien abre una pantalla que llama GET /api/reservas | **[Código]** Ningún endpoint registra la asistencia a una reserva de espacio, así que se marca No-Show y se crea una sanción Moderada de 7 días que bloquea sus próximas reservas. **[Neon-lectura]** Las 11 reservas de espacio no canceladas están en No-Show con sanción | Check-in de la reserva (recepción, QR o registro_acceso) antes de marcar No-Show, con margen de gracia (ver RES-F01) |
| RES-B02 | Un socio crea reservas a nombre de otro socio | Alta | POST /api/reservas (rol socio) | backend/src/routes/reservas.routes.js:19; reservasController.js:37-46; frontend socio/Reservas.jsx:236 | Con token de socio: POST /api/reservas con el socio_id de otro | **[Código]** Se crea sin compararla con req.user. Si nadie asiste, la sanción le cae al otro socio (RES-B01) | Para el rol socio, tomar el socio_id del token |
| RES-B03 | Un socio cancela reservas de otros | Alta | PUT /api/reservas/:id/cancelar | backend/src/routes/reservas.routes.js:21; reservaService.js:469-482 | Con token de socio: PUT /api/reservas/<id ajeno>/cancelar | **[Código]** No se comprueba de quién es la reserva; instructor y recepción también cancelan cualquiera | Para el rol socio, solo sus propias reservas (403 en otro caso) |
| RES-B04 | Cualquier autenticado ve todas las reservas, con nombre y número de socio | Alta | GET /api/reservas, /:id; GET /api/recepcion/reservas | backend/src/routes/reservas.routes.js:10,17; reservaService.js:309-367; recepcionDashboardService.js:156-176; socio/Reservas.jsx:105-114 | Entrar como socio a Reservas | **[Código]** El socio descarga el historial completo de todos los socios (nombre, apellido, numero_socio) y el filtrado se hace en el navegador. Sin paginación | Filtrar por socio en el backend (RES-F05) y paginar |
| RES-B05 | El GET de reservas escribe en la BD sin transacción y da 500 si hay reservas de visita vencidas | Alta | GET /api/reservas y /:id | backend/src/services/reservaService.js:53-85, 87-122 | Una reserva de visita Confirmada (socio_id NULL) ya vencida, y después GET /api/reservas | **[Código]** El UPDATE la marca No-Show (en autocommit) y luego el INSERT de la sanción con socio_id NULL falla: responde 500 y el resto del lote queda sin sanción. **[Neon-lectura]** Las reservas 42 y 46 están en No-Show sin sanción. Ver GEN-B03 | Sacar la sincronización del GET (job o transacción) y omitir las filas sin socio |
| RES-B06 | El socio esquiva el No-Show eligiendo el estado al crear o cancelando tarde | Media | POST /api/reservas; PUT /:id/cancelar | backend/src/controllers/reservasController.js:37,46; reservaService.js:388-396, 60, 469-482 | POST con estado Pendiente; cancelar una reserva ya terminada | **[Código]** "Pendiente" nunca pasa a No-Show y "No-Show" se guarda sin sanción. Se puede cancelar después de la hora o cuando ya está en No-Show | Para el socio, forzar Confirmada y no permitir cancelar después de la hora de inicio |
| RES-B07 | PUT de reserva con body parcial siempre falla | Media | PUT /api/reservas/:id | backend/src/services/reservaService.js:423, 31-33 (String(Date).split('T')) | PUT /api/reservas/17 {"estado":"Confirmada"} | **[Código]** String(Date) produce 'Tue Apr 28 …', así que la fecha queda vacía o con basura: 400 "Faltan campos obligatorios" o "Solo se permiten reservas para el mismo día" | Formatear el DATE de pg a YYYY-MM-DD (ver GEN, paquete de fechas) |
| RES-B08 | No se puede corregir el estado de una reserva ya iniciada o pasada | Media | Admin y Recepción → Reservas → Editar | backend/src/services/reservaService.js:140-149, 428 | Editar una reserva de ayer para marcarla Confirmada | **[Código]** 400 por las reglas de horario de "crear", así que un No-Show equivocado (RES-B01) no se puede revertir | Aplicar las reglas de horario solo si cambian espacio, fecha u horas |
| RES-B09 | Doble reserva posible bajo concurrencia | Media | POST y PUT /api/reservas | backend/src/services/reservaService.js:386 (el lock solo es por espacio y solo al crear), 409-467 | Dos POST simultáneos del mismo socio en espacios distintos; un PUT a un hueco que un POST está ocupando | **[Código]** El máximo por día y el traslape por socio no se serializan, y el update no toma ningún lock | Lock por socio y por espacio también en el update; opcionalmente EXCLUDE en la BD |
| RES-B10 | Mensaje engañoso del máximo de reservas por día, con límites distintos en front y back | Media | POST /api/reservas; modal de Admin Reservas | backend/src/services/reservaService.js:216-227; frontend/src/pages/dashboards/admin/Reservas.jsx:39,408-416,446 | Un socio con 2 reservas de clase intenta reservar una cancha | **[Código]** Dice "ya tiene una reserva activa para ese día" aunque el límite es 2, y cuenta clases y No-Show. El admin bloquea desde la 2.ª reserva. **[Neon-lectura]** El socio 4 tiene 3 reservas no canceladas el 27/05 | Contar solo reservas de espacio activas, con mensaje "Máximo N por día" y el mismo límite en front y back |
| RES-B11 | Poner un espacio en mantenimiento deja sus reservas vivas y ocultas | Media | PATCH /api/espacios/:id/estado; rejilla de Admin Reservas | backend/src/services/espacioService.js:233-265; admin/Reservas.jsx (~685-711, 263) | Reservar la cancha X hoy y ponerla en Mantenimiento | **[Código]** La reserva sigue Confirmada, no se ve ni se puede cancelar, y termina en No-Show con sanción | Avisar o cancelar las reservas afectadas y mostrarlas |
| RES-B12 | Ids no numéricos o fuera de rango dan 500 con el error SQL | Media | /api/reservas/:id y /cancelar, /disponibilidad, /api/espacios/:id, /mantenimiento, /estado | backend/src/controllers/reservasController.js:6-12; espaciosController.js:98-102; middleware/validators.js:26-33 | GET /api/reservas/disponibilidad?espacio_id=99999999999; GET /api/espacios/abc/mantenimiento | **[API local]** 500 "value \"99999999999\" is out of range for type integer"; /mantenimiento devuelve pg_code y detail | 400 con requirePositiveInt (tope 2147483647) |
| RES-B13 | Body ausente o con tipos inválidos da 500 en reservas y espacios | Media | POST /api/reservas, PUT /:id; POST/PUT/PATCH /api/espacios | backend/src/middleware/validators.js:12-19,128-139; espacioService.js:192-201, 212, 234 | POST /api/reservas sin body; POST /api/espacios con un nombre de 101 caracteres | **[API local]** Sin body: POST /api/reservas, PUT y PATCH /api/espacios/1 y POST /api/espacios → 500. **[Código]** Longitud (varchar 100) y capacidad negativa → 500 | 400 con validación de body, tipos y longitudes |
| RES-B14 | Eliminar un espacio con historial da 500 | Media | DELETE /api/espacios/:id | backend/src/services/espacioService.js:267-270 | Eliminar un espacio inactivo con reservas | **[Neon-lectura]** 34 de 37 espacios tienen dependencias; el 23503 cae en un 500 | 409 explicativo, o solo permitir inactivar |
| RES-B15 | La página pública /espacios se cae | Media | Ruta /espacios (App.jsx:100, sin ProtectedRoute) | frontend/src/pages/Espacios.jsx:20-28,76; components/CardEspacio.jsx:44-53 | Abrir /espacios | **[API local]** Llama GET /api/espacios?fecha=…, que responde 404 "Ruta no encontrada". **[Código]** Guarda el objeto de error y espacios.map revienta. El botón Reservar no tiene acción y ninguna ruta enlaza a la página | Eliminarla o conectarla a un endpoint de disponibilidad (RES-F04) |
| RES-B16 | "Mis reservas de hoy" del socio mezcla clases y No-Show, todas con Cancelar | Media | Socio → Reservas | frontend socio/Reservas.jsx:110-114, 332-347, 258-262 | Socio con una clase hoy o una reserva No-Show | **[Código]** Filas sin espacio, No-Shows cancelables sin confirmación; cancelar una clase por aquí deja viva la inscripción. Luego llama a disponibilidad?espacio_id=0 → 400 | Mostrar solo reservas de espacio vigentes y pedir confirmación |
| RES-B17 | El admin bloquea a socios cuya sanción ya venció | Media | Admin/Recepción → Reservas → selector de socio | frontend admin/Reservas.jsx:290-297; backend reservaService.js:26-29 | Abrir "Nueva reserva" | **[Neon-lectura]** 10 socios con sanción 'Activa' ya vencida aparecen deshabilitados como "(sancionado)" aunque el backend los acepta | Usar la regla del backend (fecha_fin >= hoy) |
| RES-B18 | El PATCH de estado acepta valores inválidos y reactiva el espacio | Baja | PATCH /api/espacios/:id/estado; PUT /api/espacios/:id | backend/src/services/espacioService.js:11-15, 237, 214-221 | PATCH con {} o {"estado":"xyz"} sobre un espacio en Mantenimiento | **[Código]** 200 "Espacio reactivado" y se cierra el mantenimiento | 400 si el estado no es válido |
| RES-B19 | La fecha estimada de fin del mantenimiento se ignora | Baja | Configuración de espacios → Mantenimiento | frontend ConfiguracionEspacios.jsx:28,239; backend espacioService.js:234 | Poner un espacio en mantenimiento con fecha de fin | **[Código]** La fecha no se guarda | Guardarla y respetarla (RES-F02) |
| RES-B20 | La validación de la ventana de mantenimiento está muerta en Neon | Baja | POST /api/reservas | backend/src/services/reservaService.js:198-214 | Hacer cualquier reserva | **[Neon-lectura]** mantenimiento_espacios no tiene `activo` y su PK es mantenimiento_id: la consulta siempre falla (42703) y se ignora en silencio | Alinear el esquema (GEN-B05) y no tragar errores |
| RES-B21 | Horario y duración fijos en el código; las variables de .env no se usan | Baja | Reservas (socio y admin) | backend/src/services/reservaService.js:18,157-158,505-506; socio/Reservas.jsx:65-67; admin/Reservas.jsx:22-25 | Comparar los textos con la validación | **[Código]** RESERVAS_DURACION_MINUTOS y CLUB_HORA_CIERRE no afectan las reservas, y el socio ve "hasta 10:30 pm" cuando el backend cierra a las 22:00 | Una sola configuración y textos coherentes |
| RES-B22 | La fecha y hora del socio salen del reloj del navegador | Baja | Socio → Reservas; VistaReservas del coordinador | frontend socio/Reservas.jsx:26-29,62,181,216; coordinador/VistaReservas.jsx:8 | Usar un dispositivo en otra zona horaria | **[Código]** 400 "Solo se permiten reservas para el mismo día" | Usar la fecha de México o la que entrega el backend |
| RES-B23 | Errores ocultos y sesión vencida silenciosa en VistaReservas, VistaEspacios y AgendaDia | Baja | Coordinador e instructor | VistaReservas.jsx:16-25; VistaEspacios.jsx:67-82; AgendaDia.jsx:405-421 | Usar un token vencido o provocar un fallo de la API | **[Código]** "No hay reservas" sin error; "Quitar" saca al alumno de la lista aunque falle y puede llamar /reservas/undefined/cancelar | Usar apiRequest y mostrar el error |
| RES-B24 | created_by nunca se guarda | Baja | POST /api/reservas | backend/src/services/reservaService.js:393-396 | Crear una reserva | **[Neon-lectura]** 0 de 58 reservas tienen created_by | Guardar req.user.usuario_id |

### 2.4 Clases, disciplinas e instructores (CLA)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| CLA-B01 | /api/inscripciones/* sin autenticación: cualquiera inscribe, cancela o lista clases por socioId | Alta | POST /api/inscripciones/inscribir, /cancelar; GET /mis-inscripciones | backend/src/routes/inscripciones.routes.js:7-21 (sin verifyToken ni checkRole) | Sin token: POST inscribir {sesionId, socioId}; GET mis-inscripciones?socioId=1 | **[API local]** Sin token, POST con body {} responde 400 de validación (nunca 401) y GET ?socioId=1 devuelve las 3 clases del socio 1. **[BD memoria]** Inscribir y cancelar sin token → 201 y 200 | 401 sin token; el socio solo actúa sobre su propio socio_id (tomado del token) |
| CLA-B02 | "Editar sesión" siempre falla: el UPDATE escribe una columna activo que no existe | Alta | GestionDisciplinas → Editar sesión; PUT /api/sesiones/:id | backend/src/services/sesionService.js:122-133; frontend coordinador/GestionDisciplinas.jsx:226-237 | Editar cualquier sesión y guardar | **[Neon-lectura]** sesiones_programadas no tiene la columna activo. **[BD memoria]** 500 "Error al actualizar sesión" (desde fdbb05e) | 200: quitar activo o crear la columna; 404 si no existe |
| CLA-B03 | Sobrecupo: hay dos modelos de inscripción que se ignoran entre sí; la reactivación no revisa cupo y el panel y el QR no bloquean | Alta | POST /api/inscripciones/inscribir; POST /api/instructor/clases/inscribir; POST /api/sesiones/:id/asistencia-qr | backend/src/services/inscripcionService.js:129-153; instructorPanelService.js:409-426; asistenciaQrService.js:44-71 | Sesión con cupo 1: el socio 1 se inscribe, el instructor agrega a otro, el 1 cancela, ocupa el 7 y el 1 reactiva | **[BD memoria]** Todo responde 201: 2 inscripciones Confirmadas y 2 reservaciones para un cupo de 1. **[Neon-lectura]** La sesión 65 ya supera su cupo | Un conteo único de ocupación bajo el mismo lock en todos los caminos |
| CLA-B04 | Instructor y recepción pasan lista, inscriben o quitan alumnos en cualquier clase, incluso a no inscritos | Alta | /api/instructor/asistencia, /clases/inscribir, /clases/:id/alumnos; /api/sesiones/:id/asistencia-qr | backend/src/routes/instructor.routes.js:16-17,26; instructorPanelService.js:271-290; routes/sesiones.routes.js:8 | Con el instructor B: POST asistencia en una clase del instructor A, para un socio no inscrito | **[BD memoria]** 200 y se graba la asistencia. **[Neon-lectura]** Ya hay 5 asistencias de no inscritos (ids 4, 5, 6, 15 y 17) | 403 si la clase no es suya; 409 si el socio no está inscrito |
| CLA-B05 | Pasar lista a una visita desde AgendaDia da 500 con detalle SQL y la UI la marca presente igual | Alta | Instructor → Agenda del día → ✓ sobre una visita | frontend instructor/AgendaDia.jsx:363-369; backend instructorPanelService.js:285-289 | Agregar una visita a la clase y pulsar ✓ | **[BD memoria]** 500 con "detalle":"… violates check constraint \"asistencia_check\"". **[Código]** La fila se pinta como Presente | Aceptar visitaId y mostrar el error si res.ok es falso |
| CLA-B06 | GET /api/instructores y /:id son públicos y devuelven email y teléfono | Alta | GET /api/instructores, /api/instructores/:id | backend/src/routes/instructores.routes.js:7-8; instructorService.js:17-19,41-42 | GET /api/instructores sin token | **[API local]** 200 con 18 instructores, con telefono y email | Exigir token; al socio, solo nombre y foto |
| CLA-B07 | Crear instructor: contraseña fija, vinculación a ciegas por email e instructores que no aparecen | Alta | GestionInstructores → Nuevo; POST /api/instructores | backend/src/services/instructorService.js:66-86, 23 | POST con un email nuevo; POST con el email de un socio o admin; POST {nombre:'Fantasma'} | **[Código]** La cuenta queda con 'instructor123'; un usuario existente se vincula sin cambiar su rol. **[BD memoria]** Sin email ni especialidad → 201, pero no aparece en la lista. Sin UNIQUE en instructores.usuario_id | Contraseña aleatoria con cambio obligatorio, rechazar emails de otros roles, nombre obligatorio y un instructor por usuario |
| CLA-B08 | Las sesiones de espacios con un mantenimiento ya terminado no admiten inscripción | Alta | Socio → Clases → Inscribirse | backend/src/services/inscripcionService.js:11-20 | Inscribirse a una sesión de un espacio que tuvo mantenimiento en 2025 | **[BD memoria]** 404 "La clase no existe o el espacio no está disponible". **[Neon-lectura]** 37 sesiones de espacios activos quedan bloqueadas para siempre; el catálogo muestra 286 sesiones y solo 249 son inscribibles | Bloquear solo con un mantenimiento vigente, con el mismo criterio en el catálogo |
| CLA-B09 | Con cupo_maximo NULL el socio ve "clase llena", el instructor inscribe sin límite y la UI muestra 20 | Media | Clases del socio; AgendaDia | backend/src/services/inscripcionService.js:152; instructorPanelService.js:424; frontend Clases.jsx:203-204 | Inscribirse a la sesión 303 | **[BD memoria]** Socio → 400; instructor → 201. **[Neon-lectura]** Las sesiones 303 a 306 tienen cupo NULL | cupo_maximo NOT NULL y validado |
| CLA-B10 | La fecha de inscripción o asistencia no se valida contra dia_semana; una fecha basura da 500 | Media | asistencia-qr; /api/instructor/clases/inscribir; /api/instructor/asistencia | backend/src/services/asistenciaQrService.js:144; instructorPanelService.js:271-290,387-436 | QR con una fecha de 2020 en martes para una sesión de miércoles; fecha 'hola' | **[BD memoria]** 201 en el primer caso; 'hola' → 500. **[Neon-lectura]** 14 de 18 asistencias y 32 de 36 reservaciones de clase no coinciden con dia_semana | 400 si la fecha no es ISO o no corresponde al día de la sesión |
| CLA-B11 | La asistencia por QR de visitas usa CURRENT_DATE de la BD y no la fecha de México | Media | POST /api/sesiones/:id/asistencia-qr (visita); /api/instructor/clases/inscribir | backend/src/services/asistenciaQrService.js:106,126; instructorPanelService.js:402 | Escanear una visita de noche (hora de México) | **[BD memoria]** Se guarda con fecha de mañana, mientras que el socio usa la fecha de México | Usar getMexicoDateISO en ambos caminos |
| CLA-B12 | La lista de alumnos nunca muestra la asistencia de las visitas | Media | AgendaDia → alumnos; GET /api/instructor/clases/:id/alumnos | backend/src/services/instructorPanelService.js:117-119 | Registrar una visita por QR y abrir la lista | **[BD memoria]** asistio null después del 201 | Unir también por visita_id |
| CLA-B13 | La inscripción rápida con solo visita_id no detecta duplicados ni visitas inexistentes | Media | AgendaDia → Agregar → Visitas | backend/src/services/instructorPanelService.js:388-405 | POST /api/instructor/clases/inscribir {visita_id} dos veces | **[BD memoria]** 201 y 201 (ocupa dos lugares); una visita inexistente da 500 | 409 en el duplicado y 404 si la visita no existe |
| CLA-B14 | El QR rechaza a un socio inscrito de forma recurrente si las reservaciones llenaron el cupo, y si lo acepta duplica | Media | POST /api/sesiones/:id/asistencia-qr | backend/src/services/asistenciaQrService.js:34-42 | Socio inscrito en la sesión 1 (cupo 1) y otro agregado por reservación; escanear | **[BD memoria]** 400 "La clase está llena" a un socio ya inscrito | Tratar inscripciones_clases como inscrito y usar el conteo unificado |
| CLA-B15 | Editar instructor ignora nombre, email y teléfono pero responde "actualizado"; no comprueba existencia ni longitud | Media | GestionInstructores → Editar; PUT /api/instructores/:id | backend/src/services/instructorService.js:91-98; frontend GestionInstructores.jsx:100-111 | PUT con nombre, email y teléfono nuevos; PUT a la id 999 | **[BD memoria]** 200 sin cambios; la id 999 → 200; una especialidad de 101 caracteres → 500 | Actualizar el usuario vinculado, 404 si no existe y validar longitudes |
| CLA-B16 | Eliminar una sesión, instructor o disciplina con dependencias da 500 y uno inexistente da 200 | Media | DELETE /api/sesiones/:id, /api/instructores/:id, /api/disciplinas/:id | backend/src/services/sesionService.js:136-138; instructorService.js:100-102; disciplinaService.js:36-47; frontend GestionInstructores.jsx:244-251 | DELETE de una sesión con inscritos; DELETE de la id 999 | **[BD memoria]** 500 (FK 23503) en los primeros; 200 en los inexistentes. **[Neon-lectura]** 17 sesiones, 3 instructores y 15 disciplinas tienen dependencias | 409 con mensaje claro, 404 si no existe y baja lógica |
| CLA-B17 | Entradas inválidas dan 500 en lugar de 400 en inscripciones, sesiones, instructores, disciplinas y el panel del instructor | Media | /api/inscripciones, /api/sesiones, /api/instructores, /api/disciplinas, /api/instructor/* | backend/src/routes/inscripciones.routes.js; sesionService.js:92-119; disciplinas.routes.js:8; instructor.routes.js:26; instructorPanelService.js:7-11 | Ids 'abc' o > int4, fecha=hola, POST sin body | **[API local]** Sin body: POST /api/inscripciones/inscribir (sin token), /api/instructor/asistencia, /clases/inscribir, POST y PUT /api/sesiones, POST /api/disciplinas, POST /api/instructores → 500. GET /api/sesiones?dia=abc (sin token), /api/instructores/abc, /api/disciplinas/abc, /api/sesiones/dia/abc y /api/instructor/clases-general?fecha=a&fecha=b → 500 | 400 o 404 con mensaje claro (GEN-B01, GEN-B02) |
| CLA-B18 | Los 500 del panel del instructor devuelven el detalle SQL | Media | /api/instructor/* | backend/src/controllers/instructorController.js:10-15 | GET /api/instructor/clases?fecha=hola | **[API local]** {"error":"Error al obtener clases","detalle":"invalid input syntax for type date: \"hola\""}; /clases/abc/alumnos devuelve el detalle igual | Mensaje genérico; el detalle solo al log |
| CLA-B19 | Crear sesión no valida el traslape del instructor ni que la disciplina sea la del espacio | Media | GestionDisciplinas → Nueva sesión; POST /api/sesiones | backend/src/services/sesionService.js:96-108 | Crear una sesión del instructor 1 a la misma hora que otra suya en otro espacio | **[BD memoria]** 201. **[Neon-lectura]** 2 traslapes del mismo instructor, 91 pares traslapados en el mismo espacio y día, y 3 sesiones con una disciplina que no corresponde a su espacio | 409 por traslape y validar la disciplina del espacio |
| CLA-B20 | "Quitar" en AgendaDia cancela la inscripción recurrente completa, y quitar una visita borra todas las visitas de la lista | Media | Instructor → Agenda del día → Quitar | frontend instructor/AgendaDia.jsx:403-421, 576-579, 459-460 | Quitar a un socio inscrito; quitar una de varias visitas | **[Código]** La inscripción queda cancelada para todas las semanas y la lista local elimina todas las visitas | Quitar solo esa fecha e indexar por inscripcion_id o reserva_id |
| CLA-B21 | Desmarcar ✓ o ✗ guarda presente=false en la BD aunque la UI muestre "sin registrar" | Media | AgendaDia → AlumnoRow | frontend AgendaDia.jsx:359,366 | Marcar presente y volver a pulsar ✓ | **[Código]** Cuenta como ausencia en las métricas | Borrar el registro o tener un estado "sin registrar" real |
| CLA-B22 | seedDisciplinas destruye datos actuales | Media | npm run seed:disciplinas | backend/src/seeders/seedDisciplinas.js:70-84,128-134 | Ejecutarlo contra la BD actual | **[Neon-lectura]** Dejaría NULL en 99 sesiones, 17 espacios y 7 torneos y borraría 25 disciplinas | Un seeder idempotente o bloqueado fuera de una BD vacía |
| CLA-B23 | Admin, coordinador y recepción entran a /mis-clases, /metricas y /clases y reciben 404 | Baja | GET /api/instructor/mis-clases, /metricas, /clases | backend/src/routes/instructor.routes.js:17; instructorPanelService.js:14-24 | GET /api/instructor/mis-clases con token de admin | **[API local]** 404 "Instructor no encontrado" | Limitar esas rutas al rol instructor |
| CLA-B24 | Las reservaciones creadas por el instructor o por el QR no guardan espacio_id | Baja | /api/instructor/clases/inscribir; asistencia QR | backend/src/services/instructorPanelService.js:428-432; asistenciaQrService.js:67-71 | Hacer una inscripción rápida | **[Neon-lectura]** 15 de 36 reservaciones de clase no tienen espacio_id | Copiar sp.espacio_id |
| CLA-B25 | GET /api/sesiones/dia/:dia (público y sin consumidor) cuenta las reservaciones de todas las fechas | Baja | GET /api/sesiones/dia/:dia | backend/src/services/sesionService.js:72,78-83 | GET /api/sesiones/dia/2 | **[API local]** 200 (la columna i.nombre ya no da error), pero cupo_actual es histórico | Contar por fecha, o eliminar el endpoint |
| CLA-B26 | Métricas del instructor incorrectas | Baja | Instructor → Métricas | backend/src/services/instructorPanelService.js:364-376, 327, 342; frontend MetricasInstructor.jsx:115-117 | Abrir Métricas | **[Código]** No cuenta los alumnos recurrentes, usa el último mes con datos en lugar del mes actual, pone los meses en inglés y marca "Mejorable" cuando no hay datos | Corregir los cálculos y los textos |
| CLA-B27 | Modal QR: el mensaje de inscripción nunca aparece y el escáner se detiene tras un error | Baja | AgendaDia → Escanear QR | backend/src/controllers/asistenciaQrController.js:19-25; frontend AgendaDia.jsx:73-74,85,122 | Escanear un QR inválido y luego uno válido | **[Código]** Siempre dice "Asistencia registrada" y hay que reabrir el modal | Devolver inscrito_ahora y reiniciar el escáner |
| CLA-B28 | El catálogo del socio puede mostrar lugares negativos o "20" falsos | Baja | Socio → Clases → Catálogo | frontend Clases.jsx:202-205,233-239; backend sesionService.js:45-46 | Ver una sesión con sobrecupo o con cupo NULL | **[Código]** "Casi lleno (-1)" o "20 de 20" | Usar el conteo unificado y limitar a 0 |
| CLA-B29 | Fechas y días tomados del navegador; KPIs de GestionDisciplinas incoherentes | Baja | MisClases, AgendaDia, GestionDisciplinas | frontend MisClases.jsx:64-66,78-79; AgendaDia.jsx:481-483,627-633; GestionDisciplinas.jsx:393-396,436-445 | Usar la app en otra zona horaria o en domingo | **[Código]** "Hoy" no coincide con el club, el domingo salta al lunes y el KPI no coincide con la lista filtrada | Usar la fecha de México y un mismo criterio |
| CLA-B30 | ESLint con errores en las pantallas del módulo | Baja | Clases, AgendaDia, GestionDisciplinas y otras | AgendaDia.jsx:100,479; GestionDisciplinas.jsx:309 | npx eslint | **[Código]** 8 errores y 3 warnings | Limpiar |

### 2.5 Recepción, accesos y QR (REC)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| REC-B01 | El QR que entrega recepción nunca se guarda y el torniquete lo rechaza | Alta | POST /api/recepcion/visitas; GET /api/recepcion/visitas/:id/qr; POST /api/acceso/lectura-qr | backend/src/services/qrService.js:44-50, 68-76 (ON CONFLICT sin índice único), 78-81 (el catch traga el error) | Crear un pase en recepción y leer su codigo_qr con lectura-qr | **[BD memoria]** 201 con qr_id null ("there is no unique or exclusion constraint matching the ON CONFLICT specification"); codigos_qr_visitas queda vacía y lectura-qr responde 401 "QR expirado". **[Neon-lectura]** No hay índice único en visita_id; 31 de 59 visitas no tienen QR, entre ellas las más recientes (64-66) | Guardar el QR (índice único o INSERT simple) y registrar la entrada |
| REC-B02 | Los GET de /api/recepcion/* están abiertos a cualquier autenticado, con datos personales | Alta | GET /api/recepcion/socios, /socios-lista, /reservas, /espacios, /visitas*, /dashboard, /ludoteca/activos, /clases* | backend/src/routes/recepcion.routes.js:12,15,21-27,34,37,42-43 | Con token de socio, llamar a cada GET | **[API local]** /socios → 20 registros con telefono y email; /socios-lista → 40 con email; /reservas y /clases → 200. **[BD memoria]** /visitas/historial devuelve teléfono y correo de los visitantes, y cada GET de visitas o dashboard dispara escrituras (GEN-B03) | 403 para socio (e instructor donde no aplique) |
| REC-B03 | XSS persistente al imprimir el QR: el nombre del visitante se escribe sin escapar | Alta | Recepción → Visitas → QR → Imprimir (recepción y admin) | frontend/src/pages/dashboards/recepcion/GestionVisitas.jsx:352; admin/RecepcionVisitas.jsx:207 (doc.write con el nombre) | Registrar una visita con el nombre `<img src=x onerror=alert(localStorage.token)>` y que otro usuario pulse Imprimir | **[Código]** El iframe es del mismo origen, así que el script se ejecuta y puede leer el token del staff | Escapar el texto o construir el DOM sin doc.write |
| REC-B04 | Un QR de socio revocado o regenerado sigue valiendo en ludoteca y en la identificación | Media | POST /api/ludoteca/acceso-qr; POST /api/qr/identificar-socio | backend/src/services/ludotecaService.js:297-336; qrService.js:281-297 | Usar un QR firmado que no está en la tabla o que ya se desactivó | **[BD memoria]** Entrada a ludoteca 201 | Exigir que el QR exista con activo = TRUE, como hace lectura-qr |
| REC-B05 | Los pases creados después de las 22:00 se cierran al instante | Media | Recepción → Nuevo pase; GET /api/recepcion/visitas* | backend/src/services/paseService.js:8,130-166; frontend GestionVisitas.jsx:129,265 | Crear un pase a las 22:30 | **[Neon-lectura]** Las visitas 59, 60 y 61 se cerraron en menos de 1 s; las 62 a 66, de golpe, 32 a 41 h después | Vigencia de 24 h (épica 3) o bloquear las altas después del cierre |
| REC-B06 | Una visita cerrada conserva su QR activo y el acceso lo acepta | Media | PUT /api/recepcion/visitas/:id/salida; POST /api/acceso/lectura-qr | backend/src/services/accesoService.js:54-73; visitaService.js:196-239 | Registrar la salida de una visita y volver a escanear su QR | **[BD memoria]** El QR sigue activo. **[Neon-lectura]** 30 QR activos de visitas ya cerradas (hoy ya expirados) | Desactivar el QR al cerrar la visita y validar que siga vigente |
| REC-B07 | "Ver QR" regenera el QR y renueva otras 24 h cada vez | Media | GET /api/recepcion/visitas/:id/qr | backend/src/services/qrService.js:17-29,143-147 | Abrir "Ver QR" varias veces | **[BD memoria]** Cada vez devuelve un expira_en nuevo | Devolver el QR guardado con su expiración original |
| REC-B08 | Un pase de día con identificación aparece como "visita" | Media | Visitas (recepción, admin, coordinador) | backend/src/services/paseService.js:79-83; visitaService.js:72-74 | Crear un pase de día con identificación "INE 1234" | **[BD memoria]** Se lista con tipo_pase:'visita'. **[Neon-lectura]** 25 visitas sin anfitrión salen como 'visita' e identificacion_tipo contiene basura | Guardar el tipo de pase y la identificación en columnas separadas (REC-F02) |
| REC-B09 | Editar una visita ignora teléfono, correo, identificación, tipo y anfitrión, pero responde 200 | Media | Admin → Visitas → Editar; PUT /api/recepcion/visitas/:id | backend/src/services/visitaService.js:288-301 | Editar teléfono, correo y tipo | **[BD memoria]** 200, pero solo cambia el nombre, y observaciones pisa "Identificacion: X" | Actualizar todas las columnas o avisar de lo que no se guardó |
| REC-B10 | "Enviar QR por correo" no envía el QR | Media | Botón de correo del modal QR; POST /api/recepcion/visitas/:id/enviar-qr | frontend GestionVisitas.jsx:368-376; RecepcionVisitas.jsx:212-219; backend recepcionController.js:403-425; emailService.js:193 | Pulsar el botón de correo | **[Código]** Abre un mailto sin la imagen. El endpoint no tiene consumidor, ignora :id, acepta cualquier imagen y destinatario, no escapa el nombre y devuelve error.message en el 503. **[API local]** Sin imagen → 400 "Imagen QR requerida" | Llamar a enviar-qr con el QR del pase de :id |
| REC-B11 | Entradas inválidas en recepción dan 500 en lugar de 4xx | Media | POST /api/recepcion/visitas, /asistencia/manual; PUT /visitas/:id/salida; GET /visitas, /reservas, /clases | backend/src/middleware/recepcionValidators.js:12-21; recepcionController.js:298; visitaService.js:72-93 | Sin body; id 'abc'; fecha 'hoy' o '2026-02-30'; identificación de 60 caracteres | **[API local]** POST /visitas y /asistencia/manual sin body → 500; /reservas?fecha=hoy, /clases?fecha=2026-02-30 y /clases/abc/alumnos → 500. **[BD memoria]** Salida con 'abc' e identificación larga → 500 | 400 con mensaje claro y las longitudes de Neon |
| REC-B12 | La vista de visitas del coordinador duplica las activas y cuenta 7 días como "hoy" | Media | Coordinador → Visitas | frontend coordinador/VistaVisitas.jsx:16-35,63-66,100 | Abrir la vista con una visita activa | **[Código]** Concatena activas + historial (que ya las incluye): duplicados y KPIs de 7 días | Usar solo el historial filtrado por hoy |
| REC-B13 | La lectura QR de socio no revisa sanciones y la alternancia entrada/salida se desfasa | Media | POST /api/acceso/lectura-qr | backend/src/services/accesoService.js:104-122,173-190 | Omitir una lectura de salida | **[Código]** Al día siguiente, la entrada se registra como "salida"; solo se comprueba socio.activo | Reiniciar por día y validar sanciones |
| REC-B14 | Los GET de visitas y dashboard ejecutan consultas que siempre fallan | Baja | GET /api/recepcion/visitas, /activas, /historial, /dashboard | backend/src/controllers/recepcionController.js:44,118,127,137; paseService.js:115-166 | Cualquier GET | **[Código + Neon-lectura]** UPDATE pases → 42P01 → cae a UPDATE visitas y luego SELECT pases → 42P01 → ruta legacy. No da 500, pero cada petición provoca 2 errores en PG y escribe (GEN-B03) | Cierre programado; quitar la ruta de pases si no se va a migrar |
| REC-B15 | Los KPIs difieren entre las copias casi idénticas de admin y recepción | Baja | Admin → Recepción frente a Recepción → Visitas | frontend admin/RecepcionVisitas.jsx:325-330; recepcion/GestionVisitas.jsx:213-222 | Comparar los KPIs | **[Código]** Admin cuenta 7 días y recepción solo hoy; los archivos difieren en ~875 líneas | Un solo componente |
| REC-B16 | El dashboard de recepción calcula "ingresos" y "socios dentro" con la asistencia a clases | Baja | Recepción → Dashboard | backend/src/services/recepcionDashboardService.js:40-57 | Ver los KPIs | **[Código]** No usa registro_acceso; "socios dentro" nunca baja | Usar registro_acceso y la ludoteca de hoy |
| REC-B17 | La asistencia manual acepta reservas canceladas y fechas futuras | Baja | POST /api/recepcion/asistencia/manual (sin consumidor) | backend/src/controllers/recepcionController.js:310-334 | Una reserva Cancelada; sesionId='abc' | **[Código]** Registra la asistencia; 'abc' → 500 | 400/409 |
| REC-B18 | Alias `identificacion` duplicado en pasesSelect | Baja | GET visitas (si existiera la tabla pases) | backend/src/services/paseService.js:30,39 | Revisar el código | **[Código]** Latente: la columna NULL pisa a p.identificacion | Quitar el duplicado |

### 2.6 Ludoteca (LUD)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| LUD-B01 | Un socio puede registrar y sacar hijos ajenos y ver el historial completo | Alta | GET /api/ludoteca/historial; POST /api/ludoteca; PUT /api/ludoteca/:id/salida | backend/src/routes/ludoteca.routes.js:22-24 (solo verifyToken) | Con token de socio: POST con socio_padre_id=2, luego GET /historial y PUT /:id/salida | **[BD memoria]** 201 a nombre del padre 2. El historial devuelve niños, fechas de nacimiento y padres de otros. La salida se acepta y, pasadas 2 h, sanciona al otro socio. **[API local]** GET /historial con socio → 200 (hoy vacío en los últimos días) | checkRole de staff, como en /entrada y /salida/:id |
| LUD-B02 | En el acceso por QR, intentar meter a un segundo hijo saca al primero | Alta | POST /api/ludoteca/acceso-qr | backend/src/controllers/ludotecaController.js:283-307; ludotecaService.js:320-327 | Con el hijo A dentro, escanear el QR del padre y enviar nombre_hijo='Hijo B' | **[BD memoria]** 200 {accion:'salida', nombre_hijo:'Hijo A'}: sale A y B no entra | La salida debe ser por niño y, si el nombre no coincide, registrar la entrada |
| LUD-B03 | El aforo máximo de 15 nunca se aplica | Media | POST /api/ludoteca/entrada, /socio/entrada, /acceso-qr; /api/recepcion/ludoteca/entrada | backend/src/services/ludotecaService.js:9,190-193 | Registrar 16 niños | **[BD memoria]** Aforo {activos:19, maximo:15} | 409 al llegar al aforo |
| LUD-B04 | La edad permitida es de 3 a 7 años; la épica pide de 3 a 6 | Media | Todas las entradas de ludoteca | backend/src/services/ludotecaService.js:39-51; CHECK de registro_ludoteca en Neon; frontend socio/Ludoteca.jsx:483,540; ControlLudoteca.jsx:210 | Registrar un niño de 6 años y 11 meses | **[BD memoria]** 201. **[Neon-lectura]** 6 registros con 6 años o más (5, 21, 22, 23, 38 y 48) | Rango de 3 a 6 años, alineado en el CHECK y en los textos |
| LUD-B05 | Las entradas de staff y por QR no detectan niños duplicados ni padres inactivos o sancionados | Media | POST /api/ludoteca/entrada, /acceso-qr | backend/src/services/ludotecaService.js:224-230,352-363 | Dar dos veces la entrada al mismo niño; dar entrada con el padre sancionado | **[BD memoria]** 201 en ambos casos | 409 por duplicado y bloqueo según la épica 7 |
| LUD-B06 | /api/recepcion/ludoteca/entrada y /salida no validan nada y se saltan la sanción | Media | POST /api/recepcion/ludoteca/entrada; PUT /salida/:id (sin consumidor) | backend/src/services/ludotecaService.js:391-420 | Entrada sin socioId; entrada de un niño de 1 año | **[BD memoria]** Sin socioId → 201 con padre NULL (cuenta en el aforo pero no aparece en activos); el niño de 1 año → 500 por el CHECK. La salida nunca sanciona | Quitar esas rutas o delegar en el flujo validado |
| LUD-B07 | Una doble lectura del QR al salir genera dos sanciones | Media | POST /api/ludoteca/acceso-qr (salida) | backend/src/services/ludotecaService.js:339-341,72-81 | Dos escaneos casi simultáneos | **[Código]** El UPDATE no exige hora_salida IS NULL ni usa FOR UPDATE: las dos transacciones sancionan | Usar bloquearRegistro + exigirSinSalida |
| LUD-B08 | Registros abiertos durante días, sin cierre ni alerta | Media | Ludoteca (staff) | backend/src/services/ludotecaService.js (sin cierre); CHECK con CURRENT_DATE | Revisar las duraciones en Neon | **[Neon-lectura]** 15 registros superaron las 24 h (el 51 duró 1885 h), el 11 tiene la salida antes de la entrada y 27 de 53 pasaron de 2 h. El CHECK con CURRENT_DATE haría fallar con 500 la salida de un niño que ya cumplió 7 años | Alerta o cierre al vencer el tiempo, y el CHECK solo al insertar |
| LUD-B09 | Los 500 de ludoteca devuelven el mensaje de Postgres | Media | GET /api/ludoteca/activos, /historial | backend/src/controllers/ludotecaController.js:136,161; ludotecaService.js:159,181 | GET /api/ludoteca/historial?dias=1000000000000 | **[API local]** 500 {"error":"interval field value out of range: \"1000000000000 days\""} | Mensaje genérico y un tope para `dias` |
| LUD-B10 | hora_limite del QR depende de la zona horaria del servidor | Baja | POST /api/ludoteca/acceso-qr | backend/src/services/ludotecaService.js:360-362 | Servidor en UTC | **[Código]** Se desfasa 6 h | Calcularla en SQL |
| LUD-B11 | Los límites de fecha del formulario del socio se calculan en UTC | Baja | Socio → Ludoteca | frontend socio/Ludoteca.jsx:147-148 | Abrir el formulario después de las 18:00 | **[Código]** toISOString corre min y max un día | Usar la fecha local |

### 2.7 Sanciones (SAN)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| SAN-B01 | Las sanciones de ludoteca nunca vencen: se crean sin fechas, sin gravedad y con 'Activo' en lugar de 'Activa' | Alta | Salida de ludoteca con exceso de tiempo → reservas y clases del socio | backend/src/services/ludotecaService.js:88-91; reservaService.js:26-29; instructorPanelService.js:399-402 (COALESCE(fecha_fin, CURRENT_DATE) >= CURRENT_DATE) | Un socio excede las 2 h de ludoteca y después intenta reservar | **[Neon-lectura]** Las sanciones 65, 74, 77 y 78 están en 'Activo' con fechas NULL (3 socios): con fecha_fin NULL se tratan como vigentes para siempre y siempre aparecen primero en el listado. Las 14 sanciones de ludoteca usan 'Activo'; el resto, 'Activa' | Crearlas con sancionService.crearSancion y corregir las 4 filas |
| SAN-B02 | Las sanciones vencidas siguen "activas" y cada módulo las cuenta de forma distinta | Media | QR, GestionSocios, dashboard de recepción, reporte, DashboardSocio, SancionesPanel | backend/src/services/qrService.js:330-334; socioService.js:74-78; recepcionDashboardService.js:42-44; sancionService.js:367-374; reportes/sancionesReport.js:20,83; frontend DashboardSocio.jsx:89-98; SancionesPanel.jsx:52-55 | Una sanción Moderada de junio que nadie resolvió | **[Neon-lectura]** 48 tienen estado activo, pero solo 4 están vigentes; 44 vencidas afectan a 13 socios. DashboardSocio muestra "Sancionado" y la página Sanciones del mismo socio dice "Cuenta Limpia" | Un solo criterio de "activa" (estado + fecha_fin >= hoy) o un proceso de vencimiento (SAN-F01) |
| SAN-B03 | La deduplicación de no-shows con ILIKE '%reserva #N%' confunde reservas por prefijo | Media | POST /api/sanciones/no-shows/sincronizar; GET /api/reservas | backend/src/services/sancionService.js:520-526; reservaService.js:87-97 | Socio con la sanción de la "reserva #32" que luego no se presenta a la reserva #3 | **[Neon-lectura]** Las reservas 3 y 1 en No-Show no tienen sanción porque las enmascaran las sanciones 28 y 34. Sin índice único, una sincronización concurrente puede duplicar | Guardar reserva_id en una columna con índice único parcial |
| SAN-B04 | "Crear sanción" se puede enviar dos veces | Media | Sanciones → Nueva sanción | frontend/src/components/SancionesPanel.jsx:912-914, 384-418 | Doble clic con una red lenta | **[Código]** Se crean 2 sanciones y la segunda sale con la gravedad escalada | Deshabilitar el botón mientras se guarda (igual en "Resolver") |
| SAN-B05 | Editar la gravedad no recalcula fecha_fin | Media | Sanciones → Detalle → Editar | frontend SancionesPanel.jsx:399-406; backend sancionService.js:427-430 | Cambiar una Leve a Grave | **[Código]** fecha_fin se queda a 1 día | Recalcular la vigencia según la gravedad |
| SAN-B06 | PUT /api/sanciones/:id acepta estados fuera de catálogo, reactiva sanciones resueltas, reasigna el socio y admite fechas incoherentes | Media | PUT /api/sanciones/:id | backend/src/services/sancionService.js:410-445 | PUT {"estado":"Cancelada"}; {"socio_id":5}; fecha_fin < fecha_inicio | **[Código]** Se guarda tal cual; los valores largos, fechas inválidas o socios inexistentes dan 500 | Catálogo de estados, fechas validadas y socio no editable |
| SAN-B07 | Permisos invertidos: el gerente puede borrar sanciones pero no resolverlas, y su cambio de estado se ignora sin aviso | Media | DELETE, PUT /api/sanciones/:id; PATCH /:sancion_id; /levantar; /perdonar | backend/src/routes/sanciones.routes.js:20-23,40-43; sancionService.js:413,426; frontend SancionesPanel.jsx:29-31; Dashboard.jsx:830 | Como gerente: PUT {"estado":"Resuelta","motivo":"x"}; DELETE | **[Código]** 200 "Sancion actualizada" sin cambiar el estado; DELETE → 200 y el historial se pierde. El panel del gerente se declara de solo lectura, pero no recibe ese prop | Matriz de permisos explícita y 403 si un rol sin permiso intenta cambiar el estado |
| SAN-B08 | Ids inválidos y body ausente dan 500 en sanciones | Media | GET, PUT, DELETE /api/sanciones/:id; /levantar; /perdonar; POST / | backend/src/routes/sanciones.routes.js:8-12,29,31,40-43 | GET /api/sanciones/abc; POST /api/sanciones sin body | **[API local]** /abc y /99999999999 → 500; POST sin body → 500. **[Código]** El resto, igual (22P02, 22003, 23503, 22001) | 400 o 404 con mensaje claro |
| SAN-B09 | La vista de sanciones del instructor solo ve 20 y sus filtros no coinciden con los estados reales | Media | Instructor → Sanciones | frontend/src/pages/dashboards/DashboardInstructor.jsx:27,52-61,100-103 | Abrir la pestaña y filtrar por "Activa" | **[Neon-lectura]** Hay 77 sanciones y el total muestra 20. El filtro deja fuera las 14 'Activo', "Levantada" no existe y no hay opción para 'Inactivo' (17 filas) | Paginar en el servidor y usar el campo activa |
| SAN-B10 | Dos caminos de resolución con estados distintos ('Resuelta' e 'Inactivo'); "levantar" no revisa si ya estaba resuelta | Baja | PUT /:id/levantar y /perdonar; PATCH /:sancion_id | backend/src/services/sancionService.js:453-508 | Levantar dos veces la misma sanción | **[Neon-lectura]** 12 'Resuelta' y 17 'Inactivo'. **[Código]** El segundo levantar sobrescribe responsable y fecha | Un solo estado resuelto y 409 si ya estaba resuelta |
| SAN-B11 | GET /api/sanciones/socio/:id da 403 al instructor, que sí puede listar todas las sanciones | Baja | GET /api/sanciones/socio/:id | backend/src/services/sancionService.js:8; routes/sanciones.routes.js:21 | Instructor: GET /api/sanciones/socio/2 y GET /api/sanciones?socio_id=2 | **[API local]** El primero → 403; el segundo → 200 con la misma información | Permisos coherentes |
| SAN-B12 | El panel no informa la gravedad final que asignó el servidor | Baja | Nueva sanción | frontend SancionesPanel.jsx:406-412; backend sancionService.js:393 | Elegir "Leve" para un socio con historial | **[Código]** El servidor la escala y la UI no lo muestra | Toast con la gravedad y la vigencia resultantes |
| SAN-B13 | Cambiar un filtro estando en otra página lanza dos fetch que compiten | Baja | Panel de sanciones | frontend SancionesPanel.jsx:340-346 | En la página 3, cambiar un filtro | **[Código]** La tabla puede quedar vacía o desfasada | Reiniciar la página en el mismo cambio |

### 2.8 Reportes y auditoría (REP)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| REP-B01 | Las fechas del PDF de sanciones salen vacías o mal cortadas | Media | GET /api/reportes/sanciones?formato=pdf | backend/src/services/reportes/reporteComun.js:65-68 (String(Date).split('T')); sancionesReport.js:256,264,267 | Descargar el PDF de abril a junio de 2026 | **[Código]** Las fechas de martes y jueves salen vacías; las demás, como "Wed Jun 24 2026 00:00:00 GM". **[Neon-lectura]** 19 de 77 sanciones caen en martes o jueves | Formatear el Date (GEN, paquete de fechas) |
| REP-B02 | La Fecha_Nacimiento del Excel de socios sale vacía o mal formateada en todas las filas | Media | GET /api/reportes/socios/exportar | backend/src/services/reportes/sociosExport.js:101 | Exportar socios | **[API local]** De 40 filas, 23 salen vacías y 17 como "Sat Nov 11 200…" | YYYY-MM-DD o una celda de fecha |
| REP-B03 | El reporte de sanciones cuenta las vencidas como activas y el Top 20 ignora el periodo | Media | GET /api/reportes/sanciones | backend/src/services/reportes/sancionesReport.js:20,83,77-91 | Sacar el reporte de un mes | **[Código]** "Activas" incluye las 44 vencidas y el Top es histórico | Usar fecha_fin para "activas" y filtrar el Top por rango |
| REP-B04 | El reporte de asistencia cuenta a los ausentes, no corresponde con las ocurrencias y sin fechas devuelve ceros | Media | GET /api/reportes/asistencia (sin consumidor) | backend/src/services/reportes/asistenciaReport.js:9-21; reportesController.js:29-37 | GET sin parámetros; GET con fechaInicio=x | **[API local]** Sin fechas → 200 con total_asistentes 0; con fechas inválidas → 500. **[Neon-lectura]** total_asistentes incluye filas con presente distinto de true | Filtrar presente = true, contar las ocurrencias reales y exigir el rango |
| REP-B05 | Los reportes devuelven error.message crudo en el 500 | Media | /api/reportes/*; /socios/exportar | backend/src/controllers/reportesController.js:24; exportacionController.js:11 | Provocar cualquier error de BD | **[Código]** El texto de PostgreSQL llega al cliente. Si falla a mitad del PDF, responde 200 con el archivo truncado | Mensaje genérico; el detalle solo al log |
| REP-B06 | POST /api/logs responde 201 aunque no se guarde; se pueden falsificar entradas e IP | Media | POST /api/logs (sin consumidor) y todos los logAudit | backend/src/controllers/logsController.js:5-17; utils/auditLogger.js:3-10,18-35 | POST con una accion de 101 caracteres; cualquier petición con X-Forwarded-For: 1.2.3.4 | **[Código]** 201 "Log registrado" sin fila; un admin crea entradas idénticas a las del sistema y la IP se toma de X-Forwarded-For sin validar | Eliminar el POST o marcar las entradas manuales, validar y usar req.ip con trust proxy |
| REP-B07 | La hora de la bitácora se muestra 6 h antes | Media | Admin → Auditoría | backend/src/services/logService.js:15,64; config/database.js:24-26 | Ver un log recién creado | **[API local]** El log 666 (login de las 22:09) aparece con fecha_local 2026-10-10T16:09:36 | Tratar fecha como hora de México o migrar a timestamptz |
| REP-B08 | La auditoría solo muestra los últimos 100 logs y el "Total" engaña | Media | Admin → Auditoría | frontend AuditoriaLogs.jsx:55,76-106; backend logService.js:4 | Abrir Auditoría | **[API local]** 100 de 666 logs; los filtros y el total trabajan solo sobre esos 100 | Paginación y filtros en el servidor, con el total real |
| REP-B09 | Los parámetros de GET /api/logs no se validan | Baja | GET /api/logs | backend/src/services/logService.js:4-52 | ?limite=abc, ?usuarioId=abc, ?fechaInicio=zz | **[API local]** Los tres → 500; `limite` no tiene tope | 400 y un límite máximo |
| REP-B10 | Rótulos incorrectos en el Excel de socios | Baja | GET /api/reportes/socios/exportar | backend/src/services/reportes/sociosExport.js:96-107 | Exportar | **[Código]** "Telefono_Particular" contiene tel_emergencia, "Parentesco" siempre sale vacío y una edad de 0 sale vacía | Rótulos con el dato real |
| REP-B11 | Si se borra una de las dos fechas, el reporte sale de un solo día sin aviso | Baja | Reportes → tarjetas con rango | frontend ReportesDescargas.jsx:19-26,37-48; backend reporteComun.js:37-38 | Borrar "Desde" y descargar | **[Código]** Se genera un reporte de 1 día | Validar que las dos fechas estén capturadas |
| REP-B12 | La migración de audit_logs está muerta | Baja | backend/migrations/Crear_audit_log.sql | backend/migrations/Crear_audit_log.sql:1-17 | Revisar Neon y el código | **[Neon-lectura]** audit_logs no existe y nada la usa; todo va a logs_sistema | Borrarla o documentarla (GEN-B05) |

### 2.9 Dashboards generales (DASH)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| DASH-B01 | El KPI "Sanciones Activas" del admin y el gerente se calcula sobre 20 filas y cuenta las vencidas | Media | Dashboard ejecutivo y gerencial (inicio) | frontend/src/services/api.js:109; Dashboard.jsx:291-296,309-320,334-337 | Abrir el dashboard | **[Neon-lectura]** Daría 14, cuando las vigentes son 4. Cada dashboard da un número distinto: admin 14, coordinador 8, recepción 48 | Un endpoint de conteo en el backend con el criterio de vigencia |
| DASH-B02 | El dashboard del coordinador limita "Total Socios" a 20 y no detecta la sesión vencida | Media | Coordinador → Inicio | frontend coordinador/DashboardResumen.jsx:114-135; backend recepcionDashboardService.js:93-130 (LIMIT 20) | Abrir el resumen, también con un token vencido | **[Neon-lectura]** Total Socios = 20 frente a 40 reales; Sanciones = 8 frente a 4 vigentes. **[Código]** Con un 401, los KPIs quedan en 0 sin redirigir | Endpoints de conteo, revisar res.ok y manejar el 401 |
| DASH-B03 | La Home pública muestra cifras inventadas | Baja | / (Home) | frontend/src/pages/Home.jsx:60-72,95,132,332 | Abrir la Home | **[Código]** "1,200+ socios activos" y "840 reseñas 4.9/5" están fijos en el código (hay 40 socios) | Textos aprobados o datos agregados reales |

### 2.10 Transversales (GEN)

| ID | Título | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| GEN-B01 | Body ausente provoca 500 en al menos 24 endpoints | Alta | Por ejemplo: POST /api/auth/login, /api/socios, /api/reservas, /api/espacios, /api/sesiones, /api/disciplinas, /api/instructores, /api/sanciones, /api/recepcion/visitas, /api/ludoteca, /api/inscripciones/inscribir; PUT /api/torneos… (detalle en los módulos) | backend/src/middleware/validators.js:72-80,128-139,169-182 (leen req[source] sin valor por defecto); escalate.js:39-44 (requireBodyOrEscalate reproduce el TypeError a propósito); index.js:66 (Express 5 deja req.body en undefined) | POST /api/socios con token de admin y sin body ni Content-Type | **[API local]** 500 {"ok":false,"error":"Error interno del servidor"} en los 24 endpoints probados (17 de esta auditoría y 7 de torneos). Es la misma causa raíz que el B-09 de torneos | Tratar el body ausente como {} (`req.body ?? {}` en un middleware global) y validar → 400 |
| GEN-B02 | Ids no numéricos o fuera del rango int4 dan 500 en 24 GETs | Alta | /api/socios/:id, /qr, /sanciones; /api/usuarios/:id; /api/espacios/:id, /mantenimiento; /api/instructor/clases/:id/alumnos, /sesiones/:id/inscritos; /api/instructores/:id; /api/sanciones/:id, /socio/:id, /verificar; /api/sesiones/dia/:dia; /api/disciplinas/:id | backend/src/middleware/validators.js:86-109 (requirePositiveInt sin tope y no aplicado en estas rutas) | GET <ruta>/abc y <ruta>/99999999999 con token de admin | **[API local]** 24 respuestas 500 (barrido de todos los GET; ver Anexo 6) | 400 "id inválido" con un validador común (1..2147483647) en todas las rutas con :id |
| GEN-B03 | Dos GETs escriben en la BD y los puede disparar cualquier rol | Alta | GET /api/reservas, /api/reservas/:id; GET /api/recepcion/visitas, /visitas/activas, /visitas/historial, /dashboard | backend/src/services/reservaService.js:53-85 (UPDATE reservaciones no_show + INSERT sanciones); paseService.js:130-166 (UPDATE pases/visitas) | Con el pool protegido contra escrituras, llamar a esos GETs | **[API local]** El guardia bloqueó 52 sentencias: "UPDATE reservaciones r SET estado = $1, no_show = TRUE …" y "UPDATE pases SET hora_salida … estado = 'finalizado'". Un socio que abre su pantalla de reservas genera sanciones a otros socios (RES-B01, RES-B05, REC-B14) | GETs sin efectos secundarios; mover esos procesos a un job programado y transaccional |
| GEN-B04 | Respuestas que exponen el texto de PostgreSQL | Media | /api/socios/:id; /api/espacios/:id/mantenimiento (pg_code + detail); /api/instructor/*; /api/ludoteca/historial; /api/reservas/*; reportes; importación | backend/src/controllers/socioController.js:6; espaciosController.js:98-102; instructorController.js:10-15; ludotecaController.js:136,161; reservasController.js:6-12; reportesController.js:24 | GET /api/socios/abc; GET /api/espacios/abc/mantenimiento | **[API local]** {"error":"invalid input syntax for type integer: \"abc\""}; {"pg_code":"22P02","detail":"…"}; "interval field value out of range" | Un handler común: mensaje genérico al cliente y el detalle solo al log |
| GEN-B05 | `npm run migrate` no reproduce la BD y el esquema de Neon diverge de las migraciones | Media | npm run migrate; cualquier entorno nuevo | backend/src/config/migrate.js:37-39 (orden alfabético: los ALTER corren antes que schema.sql); migrations/Crear_socios.sql; Seed_espacios.sql; Crear_audit_log.sql; Crear_pases.sql | Aplicar las migraciones en una BD vacía, en el orden de migrate.js y también en orden lógico (schema.sql primero, reintentando) | **[BD memoria]** migrate se detiene en el primer archivo (42P01 "espacios"). En orden lógico fallan también Crear_socios.sql (columna curp) y Seed_espacios.sql (columna tipo). Contra **[Neon-lectura]**: 105 diferencias solo en Neon y 100 solo en las migraciones. Neon tiene logs_sistema (la auditoría real) y lista_espera, que ninguna migración crea; columnas que usa el código (usuarios.foto_perfil, socios.parentesco, reservaciones.visita_id) no están en ninguna migración; las migraciones crean pases, codigos_qr_pases, audit_logs y usuariosinternos, que Neon no tiene; mantenimiento_espacios difiere (PK y columna activo); codigos_qr_visitas no tiene el índice único que el código supone (REC-B01) | Una migración base generada desde Neon, migraciones versionadas con tabla de control y un orden explícito |
| GEN-B06 | Un Origin no permitido por CORS responde 500 | Baja | Todas las rutas | backend/index.js:53-64 (callback(new Error) → errorHandler) | curl con Origin: https://evil.example | **[API local]** 500 "Error interno del servidor" | 403 sin pasar por el errorHandler genérico |
| GEN-B07 | apiRequest revienta con respuestas que no son JSON | Baja | Todo el frontend | frontend/src/services/api.js:40 (JSON.parse sin try) | Una respuesta HTML (502 del proxy o página de error) | **[Código]** Se propaga "Unexpected token <" en lugar de un mensaje útil | Intentar parsear y, si falla, usar un mensaje por status |
| GEN-B08 | Los 3 tests que fallan están desactualizados | Baja | backend/src/tests/accesoMetricas.test.js:91; asistenciaQr.test.js:91-113 | Ver el Resumen | npx jest | **[Código]** 496 pasan / 3 fallan; ningún fallo es un bug real | Actualizar los asserts y añadir pruebas de permisos reales (GEN-F01) |
| GEN-B09 | ESLint reporta 101 problemas en el frontend | Baja | frontend/src | 39 no-unused-vars, 31 react-hooks/set-state-in-effect, 14 exhaustive-deps, 8 immutability, 5 purity (p. ej. SocioLayout.jsx:65, socio/Ludoteca.jsx:39,84), 2 refs (socio/Ludoteca.jsx:88,312), 1 no-unused-labels (admin/Ludoteca.jsx:288) | npx eslint src | **[Código]** 101 problemas en 25 archivos; 23 están en GestionTorneos (ya reportado en torneos) | Limpiar por módulo, junto con los demás cambios |

---

## 3. Faltantes

| ID | Título | Gravedad | Dónde debería estar | Por qué hace falta |
|---|---|---|---|---|
| AUTH-F01 | Cambio de contraseña por el propio usuario | Media | /api/usuarios/me/password + pantalla de perfil | Los socios importados quedan con contraseñas predecibles (SOC-B03) y no pueden cambiarlas |
| AUTH-F02 | Límite de intentos de login y bloqueo | Media | POST /api/auth/login | Sin límite, la fuerza bruta contra contraseñas como Club<acción><año> es trivial |
| AUTH-F03 | Sincronizar socios.activo al desactivar el usuario | Baja | usuarioService.cambiarActivo | Desactivar un usuario socio por /api/usuarios deja el socio activo |
| SOC-F01 | Límite de 6 integrantes por acción familiar | Media | socioService e importacion/validacionSocios | Lo exige la épica 1 y no está en el código |
| SOC-F02 | Vínculo familiar en el alta y edición manual | Media | GestionSocios / POST /api/socios | **[Neon-lectura]** 24 socios sin acción; solo la importación crea familias |
| SOC-F03 | Estados Suspendido y Baja | Baja | socios (hoy solo hay activo boolean) | La épica los pide; la rama 'Suspendido' de la UI es inalcanzable |
| SOC-F04 | Paginación y búsqueda en /api/socios | Baja | GET /api/socios | La épica pide endpoints paginados y con filtros |
| RES-F01 | Check-in o asistencia de las reservas de espacio | Alta | Recepción/QR, endpoint por reserva_id | Sin esto toda reserva acaba en No-Show con sanción (RES-B01) |
| RES-F02 | Mantenimiento preventivo programado | Media | espacioService y modal de mantenimiento | La épica 4 lo pide; hoy solo hay mantenimiento inmediato sin fecha de fin |
| RES-F03 | Código de reserva único | Media | Columna con índice único en reservaciones | Lo pide explícitamente la épica 4 |
| RES-F04 | API de disponibilidad por rango | Media | GET /api/reservas/disponibilidad | Lo pide la épica 4; /espacios ya la llama (RES-B15) |
| RES-F05 | Endpoint "mis reservas" del socio | Media | GET /api/reservas/mias | Para dejar de enviar las reservas de todos (RES-B04) |
| RES-F06 | Reserva asistida para visitantes | Media | POST /api/reservas con visita_id | Lo pide la épica 3; la columna existe |
| RES-F07 | Validación de capacidad | Baja | POST /api/reservas | La épica 4 la menciona; capacidad_maxima no se usa |
| RES-F08 | Restricción contra traslapes en la BD | Baja | reservaciones (EXCLUDE o CHECK) | Defensa de fondo para RES-B09 |
| CLA-F01 | Modelo único de ocupación de clase | Media | inscripcion, instructorPanel, asistenciaQr y sesionService | Es el origen de CLA-B03, B09, B14, B25 y B28 |
| CLA-F02 | UNIQUE en asistencia por sesión, persona y fecha | Media | BD | Hoy se comprueba y luego se inserta sin restricción |
| CLA-F03 | Restricciones de esquema de clases | Media | BD (cupo NOT NULL, CHECK de estado, UNIQUE en instructores.usuario_id, FKs con ON DELETE) | 4 sesiones con cupo NULL; estado en texto libre |
| CLA-F04 | Desactivar sesiones (baja lógica) | Media | sesiones_programadas y GestionDisciplinas | El código ya lo intenta (CLA-B02) y borrar falla con dependencias |
| CLA-F05 | Validar el traslape del instructor y la disciplina del espacio | Media | sesionService | CLA-B19 y los datos ya inconsistentes |
| CLA-F06 | Uso de lista_espera | Baja | inscripcionService / Clases | La tabla existe en Neon, sin migración ni código |
| CLA-F07 | Ajustar el usuario al eliminar un instructor | Baja | instructorService.eliminarInstructor | 2 usuarios instructor sin ficha reciben 404 en su panel |
| CLA-F08 | Excluir sesiones de instructores inactivos | Baja | listarSesiones, clasesGeneral | **[Neon-lectura]** Una sesión tiene instructor inactivo y 274 de 294 no tienen instructor |
| REC-F01 | Pantalla de escaneo para el control de acceso | Media | Recepción (lectura-qr, identificar-socio, ludoteca/acceso-qr) | Los tres endpoints no tienen consumidor; registro_acceso tiene 2 filas |
| REC-F02 | Migrar a `pases`/`codigos_qr_pases` o eliminar esa ruta | Media | Migraciones + paseService | Todo el código es doble (pases/legacy) y el tipo de pase se pierde (REC-B08) |
| REC-F03 | Pantalla de métricas de acceso | Baja | Gerencia/Admin | GET /api/acceso/metricas no tiene consumidor |
| LUD-F01 | Alerta y cierre al vencer las 2 h | Media | Ludoteca (staff) / backend | Lo pide la épica 7; hay registros abiertos durante semanas (LUD-B08) |
| LUD-F02 | Bloquear la ludoteca a socios sancionados por exceso | Media | ludotecaService (entradas) | La épica 7 pide "bloqueo si tiempo excedido" |
| SAN-F01 | Vencimiento automático de sanciones | Media | sancionService (job o vista) | Sin esto existen 44 "activas" vencidas (SAN-B02) |
| SAN-F02 | Auditoría de las acciones sobre sanciones | Media | sancionesController → logAudit | logs_sistema no tiene ninguna entrada de sanciones; un borrado no deja rastro |
| SAN-F03 | Mostrar vigencia y gravedad en el detalle | Baja | SancionesPanel.jsx:668-673 | El staff no sabe hasta cuándo aplica una sanción |
| REP-F01 | Límite máximo del rango en reportes | Baja | reporteValidators / resolveDateRange | Un rango 1900-2100 recorre ~73 000 fechas × espacios × 16 h en JS |
| REP-F02 | Pantalla de reportes para el coordinador | Baja | DashboardCoordinador | El backend le permite ocupación, afluencia y asistencia, pero no hay UI |
| GEN-F01 | Pruebas de permisos y reglas con una BD real | Media | backend/src/tests | Los tests simulan checkRole y la BD, así que ningún hueco de permisos de esta auditoría se detecta en CI |

---

## 4. Posibles solicitudes de cambio (SC)

| ID | Propuesta | Por qué parece fuera del alcance |
|---|---|---|
| SC-01 | UI de roles y permisos configurables (RBAC) | La épica 2 la menciona, pero hoy los permisos están fijos en las rutas |
| SC-02 | Recuperación de contraseña por correo | No existe ninguna infraestructura para ello |
| SC-03 | Historial de cambios visible en la ficha del socio | Hoy solo está en logs_sistema |
| SC-04 | Unificar los dos flujos de alta de socio y las dos pantallas de visitas | Es refactor de producto (RecepcionVisitas/GestionVisitas difieren en ~875 líneas) |
| SC-05 | Reservas con días de anticipación | Hoy RESERVAS_MISMO_DIA limita al mismo día |
| SC-06 | Lista de espera con avisos (clases y espacios) | La tabla existe sin uso |
| SC-07 | Notificaciones (cancelación de reservas, mantenimiento, vencimiento de ludoteca) | No hay infraestructura de notificaciones |
| SC-08 | Excepciones de calendario (feriados, cancelar una sola fecha) | No está modelado |
| SC-09 | QR de socio rotativo o con expiración | Hoy no expira (ver SOC-B02) |
| SC-10 | Reglas de negocio pendientes de confirmar: escalamiento de gravedad permanente, no-shows siempre Moderada, sanciones por no-show en clases | Requieren una decisión de negocio |
| SC-11 | Botones para sincronizar no-shows, levantar y eliminar sanciones | Los endpoints existen sin UI |
| SC-12 | Política de PII en la exportación de socios y en GET /api/sanciones (socio_email para recepción e instructor) | Decisión de privacidad (épica 12) |
| SC-13 | Decidir si /api/ludoteca/aforo debe ser público | Solo expone un conteo |

---

## 5. Por verificar en local

1. **Escenarios reproducidos solo en BD memoria o por código.** Confirmarlos en una BD local o branch de pruebas, nunca en producción:
   - AUTH-B01: un gerente cambia la contraseña del admin.
   - AUTH-B02 y SOC-B04: borrados permanentes con dependencias.
   - SOC-B05: alta de socio desde recepción (confirmar que el ROLLBACK deshace el usuario creado).
   - SOC-B12, RES-B02, RES-B03, RES-B05 y RES-B06.
   - CLA-B01 (inscribir/cancelar), CLA-B02 a CLA-B05, CLA-B13 a CLA-B16.
   - REC-B01, REC-B04, REC-B06 a REC-B09.
   - LUD-B01 a LUD-B06.
   - SAN-B04: doble clic.
2. **Concurrencia (dos sesiones simultáneas):** RES-B09, CLA-B03, LUD-B07 y SAN-B03 (sincronización junto con el GET de reservas).
3. **Zona horaria.**
   - `config/database.js:24-26` hace `SET timezone` en cada conexión, pero con el pooler de Neon (modo transacción) ese SET puede no persistir.
   - Hay que confirmar el TZ efectivo de las consultas y el del proceso Node en producción. Afecta a CLA-B11, REP-B07, LUD-B10 y a la ocupación (toISODate).
4. **Navegador:** no se abrió uno en esta sesión. Por confirmar visualmente:
   - RES-B15 (/espacios) y RES-B16.
   - CLA-B05, CLA-B20, CLA-B21 y CLA-B27.
   - REC-B03 (XSS al imprimir; probar solo con datos locales).
   - AUTH-B05 y AUTH-B10 (cuota de localStorage).
   - DASH-B01 y DASH-B02.
   - Los warnings de la consola.
5. **Correo real** de enviar-qr con GMAIL configurado (REC-B10).
6. **Datos ya corruptos que requieren decidir una corrección con script:**
   - Las sanciones 65, 74, 77 y 78 (SAN-B01).
   - Las reservas 42 y 46 en No-Show sin sanción y las 11 reservas de espacio sancionadas por RES-B01.
   - Los registros de ludoteca abiertos durante semanas.
   - Los 33 socios sin usuario.
   - Las 4 sesiones con cupo NULL.
7. **AUTH-B04:** usar el token de un usuario después de desactivarlo.
8. **REP-B01:** abrir el PDF de sanciones y revisar las fechas.

---

## 6. Anexo: todas las rutas del backend

Se generó instrumentando `verifyToken` y `checkRole` al cargar cada router (no es una lectura manual).

- "Observación" marca las rutas sin token, las que exponen datos de más y las que tienen roles de más según esta auditoría.
- Las rutas de torneos y encuentros se incluyen por completitud; sus hallazgos están en auditoria-torneos.md.
- Barrido **[API local]**:
  - Las **63** rutas no-GET protegidas (sin contar torneos) responden 401 sin token, y las 56 que no admiten al rol socio le responden 403.
  - Las excepciones son las públicas: `/api/inscripciones/*` (400, nunca 401) y `PUT /api/encuentros/:id`.

| Método | Ruta | verifyToken | Roles | Observación |
|---|---|---|---|---|
| POST | `/api/auth/login` | **NO** | público | Público (esperado). Sin body → 500 (AUTH-B07) |
| GET | `/api/qr/mi-qr` | sí | cualquier autenticado |  |
| POST | `/api/qr/generar-socio` | sí | admin, gerente, coordinador, recepcion |  |
| POST | `/api/qr/generar-visita` | sí | admin, gerente, coordinador, recepcion |  |
| POST | `/api/qr/identificar-socio` | sí | admin, gerente, coordinador, recepcion, instructor |  |
| POST | `/api/acceso/lectura-qr` | sí | admin, gerente, coordinador, recepcion |  |
| GET | `/api/acceso/metricas` | sí | admin, gerente, coordinador |  |
| GET | `/api/socios` | sí | cualquier autenticado | Expone CURP, teléfono y dirección a cualquier rol (SOC-B01) |
| GET | `/api/socios/:socio_id/qr` | sí | cualquier autenticado | QR ajeno a cualquier rol (SOC-B02) |
| GET | `/api/socios/:socio_id/sanciones` | sí | cualquier autenticado |  |
| GET | `/api/socios/:id` | sí | cualquier autenticado | Expone CURP, teléfono y dirección a cualquier rol (SOC-B01) |
| POST | `/api/socios` | sí | admin, gerente, recepcion, coordinador |  |
| PUT | `/api/socios/:id` | sí | admin, gerente, recepcion, coordinador |  |
| PUT | `/api/socios/:id/reactivar` | sí | admin, gerente, recepcion, coordinador |  |
| DELETE | `/api/socios/:id` | sí | admin, gerente |  |
| DELETE | `/api/socios/:id/permanente` | sí | admin |  |
| PUT | `/api/usuarios/me/foto` | sí | cualquier autenticado |  |
| GET | `/api/usuarios/me/perfil` | sí | cualquier autenticado |  |
| GET | `/api/usuarios` | sí | admin, gerente |  |
| GET | `/api/usuarios/roles` | sí | admin, gerente |  |
| GET | `/api/usuarios/:id` | sí | admin, gerente |  |
| POST | `/api/usuarios` | sí | admin, gerente | El gerente puede tocar admins (AUTH-B01) |
| PUT | `/api/usuarios/:id` | sí | admin, gerente | El gerente puede tocar admins (AUTH-B01) |
| PUT | `/api/usuarios/:id/desactivar` | sí | admin, gerente | El gerente puede tocar admins (AUTH-B01) |
| PUT | `/api/usuarios/:id/reactivar` | sí | admin, gerente | El gerente puede tocar admins (AUTH-B01) |
| DELETE | `/api/usuarios/:id` | sí | admin, gerente | El gerente puede tocar admins (AUTH-B01) |
| DELETE | `/api/usuarios/:id/permanente` | sí | admin, gerente | El gerente puede tocar admins (AUTH-B01) |
| GET | `/api/roles` | **NO** | público | Sin token (AUTH-B14) |
| GET | `/api/espacios/todos` | sí | cualquier autenticado |  |
| GET | `/api/espacios/disciplinas` | sí | cualquier autenticado |  |
| GET | `/api/espacios/:id/mantenimiento` | sí | cualquier autenticado |  |
| GET | `/api/espacios/:id` | sí | cualquier autenticado |  |
| POST | `/api/espacios` | sí | admin, gerente |  |
| PUT | `/api/espacios/:id` | sí | admin, gerente |  |
| PATCH | `/api/espacios/:id/estado` | sí | admin, gerente |  |
| DELETE | `/api/espacios/:id` | sí | admin, gerente |  |
| GET | `/api/recepcion/dashboard` | sí | cualquier autenticado | Abierto a socio (REC-B02); escribe en un GET (GEN-B03) |
| GET | `/api/recepcion/socios` | sí | cualquier autenticado | Abierto a cualquier rol, con PII (REC-B02) |
| POST | `/api/recepcion/socios` | sí | admin, gerente, recepcion, coordinador | Siempre 500; contraseña fija (SOC-B05) |
| PUT | `/api/recepcion/socios/:id` | sí | admin, gerente, recepcion, coordinador |  |
| DELETE | `/api/recepcion/socios/:id` | sí | admin, gerente |  |
| GET | `/api/recepcion/reservas` | sí | cualquier autenticado | Abierto a cualquier rol, con PII (REC-B02) |
| GET | `/api/recepcion/espacios` | sí | cualquier autenticado | Abierto a cualquier rol, con PII (REC-B02) |
| GET | `/api/recepcion/visitas/activas` | sí | cualquier autenticado | Abierto a socio (REC-B02); escribe en un GET (GEN-B03) |
| GET | `/api/recepcion/visitas/historial` | sí | cualquier autenticado | Abierto a socio (REC-B02); escribe en un GET (GEN-B03) |
| GET | `/api/recepcion/visitas` | sí | cualquier autenticado | Abierto a socio (REC-B02); escribe en un GET (GEN-B03) |
| POST | `/api/recepcion/visitas/cerrar-vencidas` | sí | admin, gerente, recepcion, coordinador |  |
| POST | `/api/recepcion/visitas` | sí | admin, gerente, recepcion, coordinador |  |
| PUT | `/api/recepcion/visitas/:id/salida` | sí | admin, gerente, recepcion, coordinador |  |
| PUT | `/api/recepcion/visitas/:id` | sí | admin, gerente |  |
| GET | `/api/recepcion/visitas/:id/qr` | sí | admin, gerente, recepcion, coordinador | Abierto a socio (REC-B02); escribe en un GET (GEN-B03) |
| POST | `/api/recepcion/visitas/:id/enviar-qr` | sí | admin, gerente, recepcion, coordinador |  |
| GET | `/api/recepcion/socios-lista` | sí | cualquier autenticado | Abierto a cualquier rol, con PII (REC-B02) |
| GET | `/api/recepcion/ludoteca/activos` | sí | cualquier autenticado | Abierto a cualquier rol, con PII (REC-B02) |
| POST | `/api/recepcion/ludoteca/entrada` | sí | admin, gerente, recepcion, coordinador |  |
| PUT | `/api/recepcion/ludoteca/salida/:id` | sí | admin, gerente, recepcion, coordinador |  |
| GET | `/api/recepcion/clases` | sí | cualquier autenticado | Abierto a cualquier rol, con PII (REC-B02) |
| GET | `/api/recepcion/clases/:sesionId/alumnos` | sí | cualquier autenticado | Abierto a cualquier rol, con PII (REC-B02) |
| POST | `/api/recepcion/asistencia/manual` | sí | admin, gerente, recepcion, coordinador |  |
| GET | `/api/instructor/clases` | sí | admin, gerente, instructor, coordinador, recepcion | Incluye recepción; sin chequeo de dueño de la clase (CLA-B04) |
| GET | `/api/instructor/clases/:sesionId/alumnos` | sí | admin, gerente, instructor, coordinador, recepcion | Incluye recepción; sin chequeo de dueño de la clase (CLA-B04) |
| POST | `/api/instructor/asistencia` | sí | admin, gerente, instructor, coordinador, recepcion | Incluye recepción; sin chequeo de dueño de la clase (CLA-B04) |
| POST | `/api/instructor/clases/inscribir` | sí | admin, gerente, instructor, coordinador, recepcion | Incluye recepción; sin chequeo de dueño de la clase (CLA-B04) |
| GET | `/api/instructor/mis-clases` | sí | admin, gerente, instructor, coordinador, recepcion | Incluye recepción; sin chequeo de dueño de la clase (CLA-B04) |
| GET | `/api/instructor/metricas` | sí | admin, gerente, instructor, coordinador, recepcion | Incluye recepción; sin chequeo de dueño de la clase (CLA-B04) |
| GET | `/api/instructor/clases-general` | sí | admin, gerente, instructor, coordinador, recepcion | Incluye recepción; sin chequeo de dueño de la clase (CLA-B04) |
| GET | `/api/instructor/sesiones/:sesionId/inscritos` | sí | admin, gerente, instructor, coordinador, recepcion | Incluye recepción; sin chequeo de dueño de la clase (CLA-B04) |
| GET | `/api/instructor/torneos` | sí | admin, gerente, instructor, coordinador, recepcion | Ver torneos B-07 |
| GET | `/api/instructor/torneos/:torneoId/encuentros` | sí | admin, gerente, instructor, coordinador, recepcion | Ver torneos B-07 |
| PUT | `/api/instructor/torneos/encuentro/:encuentroId` | sí | admin, gerente, instructor, coordinador, recepcion | Ver torneos B-07 |
| GET | `/api/instructores` | **NO** | público | Sin token, expone email y teléfono (CLA-B06) |
| GET | `/api/instructores/:id` | **NO** | público | Sin token, expone email y teléfono (CLA-B06) |
| POST | `/api/instructores` | sí | admin, gerente, coordinador |  |
| PUT | `/api/instructores/:id` | sí | admin, gerente, coordinador |  |
| DELETE | `/api/instructores/:id` | sí | admin, gerente, coordinador |  |
| GET | `/api/sanciones/socio/:socioId` | sí | cualquier autenticado | Propiedad validada; el instructor recibe 403 (SAN-B11) |
| GET | `/api/sanciones/socio/:socioId/verificar` | sí | cualquier autenticado | Propiedad validada; el instructor recibe 403 (SAN-B11) |
| GET | `/api/sanciones` | sí | admin, gerente, recepcion, coordinador, instructor |  |
| GET | `/api/sanciones/:id` | sí | admin, gerente, recepcion, coordinador, instructor |  |
| POST | `/api/sanciones` | sí | admin, gerente, coordinador |  |
| POST | `/api/sanciones/no-shows/sincronizar` | sí | admin, gerente |  |
| PATCH | `/api/sanciones/:sancion_id` | sí | admin, coordinador |  |
| PUT | `/api/sanciones/:id` | sí | admin, gerente, coordinador |  |
| PUT | `/api/sanciones/:id/perdonar` | sí | admin, coordinador |  |
| PUT | `/api/sanciones/:id/levantar` | sí | admin, coordinador |  |
| DELETE | `/api/sanciones/:id` | sí | admin, gerente | El gerente borra pero no resuelve (SAN-B07) |
| GET | `/api/sesiones` | **NO** | público | Sin token: catálogo público sin PII; ids inválidos → 500 (GEN-B02) |
| GET | `/api/sesiones/dia/:dia` | **NO** | público | Sin token: catálogo público sin PII; ids inválidos → 500 (GEN-B02) |
| POST | `/api/sesiones/:sesion_id/asistencia-qr` | sí | admin, gerente, coordinador, instructor, recepcion |  |
| POST | `/api/sesiones` | sí | admin, gerente, coordinador |  |
| PUT | `/api/sesiones/:id` | sí | admin, gerente, coordinador |  |
| DELETE | `/api/sesiones/:id` | sí | admin, gerente, coordinador |  |
| GET | `/api/logs` | sí | admin |  |
| POST | `/api/logs` | sí | admin | Permite falsificar entradas (REP-B06) |
| GET | `/api/logs/estadisticas` | sí | admin |  |
| GET | `/api/logs/tabla/:tabla` | sí | admin |  |
| GET | `/api/ludoteca/aforo` | **NO** | público | Sin token: solo un conteo (SC-13) |
| POST | `/api/ludoteca/socio/entrada` | sí | cualquier autenticado |  |
| PATCH | `/api/ludoteca/socio/salida/:registro_id` | sí | cualquier autenticado |  |
| GET | `/api/ludoteca/activos` | sí | instructor, recepcion, admin, coordinador, gerente |  |
| GET | `/api/ludoteca/historial` | sí | cualquier autenticado | Solo token: el socio opera sobre hijos ajenos (LUD-B01) |
| POST | `/api/ludoteca` | sí | cualquier autenticado | Solo token: el socio opera sobre hijos ajenos (LUD-B01) |
| PUT | `/api/ludoteca/:id/salida` | sí | cualquier autenticado | Solo token: el socio opera sobre hijos ajenos (LUD-B01) |
| POST | `/api/ludoteca/entrada` | sí | instructor, recepcion, admin, coordinador, gerente |  |
| PATCH | `/api/ludoteca/salida/:registro_id` | sí | instructor, recepcion, admin, coordinador, gerente |  |
| GET | `/api/ludoteca/mis-registros` | sí | cualquier autenticado |  |
| POST | `/api/ludoteca/acceso-qr` | sí | instructor, recepcion, admin, coordinador, gerente |  |
| POST | `/api/inscripciones/inscribir` | **NO** | público | SIN TOKEN: inscribe, cancela o lista por socioId (CLA-B01) |
| POST | `/api/inscripciones/cancelar` | **NO** | público | SIN TOKEN: inscribe, cancela o lista por socioId (CLA-B01) |
| GET | `/api/inscripciones/mis-inscripciones` | **NO** | público | SIN TOKEN: inscribe, cancela o lista por socioId (CLA-B01) |
| GET | `/api/disciplinas` | sí | cualquier autenticado |  |
| GET | `/api/disciplinas/:id` | sí | cualquier autenticado |  |
| POST | `/api/disciplinas` | sí | admin, gerente |  |
| PUT | `/api/disciplinas/:id` | sí | admin, gerente |  |
| DELETE | `/api/disciplinas/:id` | sí | admin, gerente |  |
| GET | `/api/reservas` | sí | cualquier autenticado | Escribe en un GET (GEN-B03); el socio ve todas las reservas (RES-B04) |
| GET | `/api/reservas/disponibilidad` | sí | cualquier autenticado |  |
| GET | `/api/reservas/:id` | sí | cualquier autenticado | Escribe en un GET (GEN-B03); el socio ve todas las reservas (RES-B04) |
| POST | `/api/reservas` | sí | admin, gerente, recepcion, coordinador, instructor, socio | El socio reserva a nombre de otro (RES-B02) |
| PUT | `/api/reservas/:id` | sí | admin, gerente, recepcion, coordinador, instructor |  |
| PUT | `/api/reservas/:id/cancelar` | sí | admin, gerente, recepcion, coordinador, instructor, socio | El socio cancela reservas ajenas (RES-B03) |
| DELETE | `/api/reservas/:id` | sí | admin, gerente |  |
| GET | `/api/torneos` | sí | cualquier autenticado |  |
| GET | `/api/torneos/categorias` | sí | cualquier autenticado |  |
| GET | `/api/torneos/mis-participaciones` | sí | cualquier autenticado |  |
| GET | `/api/torneos/:torneo_id/participantes` | sí | cualquier autenticado |  |
| GET | `/api/torneos/:torneo_id/bracket` | sí | cualquier autenticado |  |
| GET | `/api/torneos/:torneo_id/reporte` | sí | cualquier autenticado |  |
| POST | `/api/torneos` | sí | admin, gerente, coordinador |  |
| PUT | `/api/torneos/:torneo_id` | sí | admin, gerente, coordinador |  |
| POST | `/api/torneos/:torneo_id/inscribir` | sí | admin, gerente, coordinador |  |
| POST | `/api/torneos/:torneo_id/inscribir-me` | sí | cualquier autenticado |  |
| PATCH | `/api/torneos/:torneo_id/cerrar-inscripciones` | sí | admin, gerente, coordinador |  |
| PATCH | `/api/torneos/:torneo_id/confirmar-bracket` | sí | admin, gerente, coordinador |  |
| PATCH | `/api/torneos/:torneo_id/finalizar` | sí | admin, gerente, coordinador |  |
| PATCH | `/api/torneos/:torneo_id/cancelar` | sí | admin, gerente, coordinador |  |
| DELETE | `/api/torneos/:torneo_id/participantes/:participante_id` | sí | admin, gerente, coordinador |  |
| PUT | `/api/encuentros/:encuentro_id` | **NO** | público | Sin token: ver torneos B-01 |
| PATCH | `/api/encuentros/:encuentro_id/resultado` | sí | instructor, admin, gerente, coordinador |  |
| PATCH | `/api/encuentros/:encuentro_id/cancha` | sí | admin, gerente, coordinador |  |
| GET | `/api/reportes/asistencia` | sí | admin, gerente, coordinador |  |
| GET | `/api/reportes/demografico` | sí | admin, gerente |  |
| GET | `/api/reportes/ocupacion` | sí | admin, gerente, coordinador |  |
| GET | `/api/reportes/afluencia` | sí | admin, gerente, coordinador |  |
| GET | `/api/reportes/sanciones` | sí | admin, gerente |  |
| GET | `/api/reportes/socios/exportar` | sí | admin, gerente |  |
| GET | `/api/importacion/template` | sí | admin, gerente |  |
| POST | `/api/importacion/socios` | sí | admin, gerente |  |

---

## 7. Anexo: agrupación sugerida por causa raíz

| Paquete | Hallazgos | Comentario |
|---|---|---|
| 1. Autorización y propiedad | SOC-B01, SOC-B02, REC-B02, CLA-B01, CLA-B04, CLA-B06, RES-B02, RES-B03, RES-B04, LUD-B01, AUTH-B01, AUTH-B14, SAN-B07, SAN-B11, CLA-B23 | Un middleware que compare `req.user` con el recurso (socio dueño o instructor de la clase) más checkRole explícito en todas las rutas. Es el paquete de mayor impacto |
| 2. Credenciales y sesión | SOC-B03, CLA-B07, AUTH-B04, AUTH-B05, AUTH-B06, AUTH-B12, AUTH-B13, SOC-B05, AUTH-F01, AUTH-F02 | Contraseñas aleatorias con cambio obligatorio, un logout central y revocación de sesiones |
| 3. Validación de entrada y errores | GEN-B01, GEN-B02, GEN-B04, GEN-B06, GEN-B07, y en los módulos: AUTH-B07, B09, B10; SOC-B09 a B11, B17; RES-B12, B13; CLA-B17, B18; REC-B11; LUD-B09; SAN-B08; REP-B05, B09 | `req.body ?? {}` global, un validador común de ids, longitudes tomadas del esquema y un handler de errores sin detalles SQL |
| 4. Reservas, no-shows y sanciones | RES-B01, RES-B05, RES-B06, GEN-B03, SAN-B01, SAN-B02, SAN-B03, SAN-F01, RES-F01, DASH-B01, REP-B03 | Check-in de reservas, un job de no-shows y de vencimiento fuera de los GET, y un único criterio de sanción "activa". Incluye corregir los datos existentes |
| 5. Clases e inscripciones | CLA-B02, CLA-B03, CLA-B08, CLA-B09, CLA-B10, CLA-B14, CLA-F01 a F05 | Un solo modelo de ocupación con lock, cupo NOT NULL y quitar la columna `activo` inexistente |
| 6. Recepción, QR y ludoteca | REC-B01, REC-B04 a REC-B09, REC-B13, LUD-B02 a LUD-B08, REC-F01, REC-F02 | Índice único y persistencia del QR, decidir pases frente a legacy, aforo, edad y alertas de ludoteca |
| 7. Esquema y migraciones | GEN-B05, RES-B20, REP-B12, CLA-B22, SOC-B06, SOC-B12, SOC-B14 | Una migración base desde Neon y migraciones versionadas. Va antes de crear cualquier entorno nuevo |
| 8. Fechas y zona horaria | RES-B07, REP-B01, REP-B02, REP-B07, CLA-B11, LUD-B10, LUD-B11, RES-B22, CLA-B29 | pg devuelve DATE como objeto Date y el código hace `String(Date).split('T')`. Un type parser para DATE y un helper de fecha de México resuelven la mayoría |
| 9. Seguridad del frontend | REC-B03 | Escapar el HTML al imprimir (XSS) |
| 10. UX y limpieza del frontend | Las Bajas de cada módulo, GEN-B09, DASH-B02, DASH-B03 | Cambios locales por pantalla |

---

## 8. Checklist para ClickUp

```text
[BUG][ALTA] AUTH-B01 Un gerente puede tomar la cuenta del admin (cambiarle la contraseña, crear admins o borrarlo) — PUT/POST/DELETE /api/usuarios; Gestión de Usuarios — Con token gerente: PUT /api/usuarios/<id del admin> con el payload completo y password 'nueva123'. O bien POST /api/usuarios con …
[BUG][ALTA] AUTH-B02 El borrado permanente de un usuario falla con 500 para casi cualquier usuario real — DELETE /api/usuarios/:id/permanente (botón Eliminar) — Admin o gerente: eliminar de forma permanente a un usuario que alguna vez inició sesión, o a un instructor con ficha
[BUG][MEDIA] AUTH-B03 20 de los 26 usuarios internos no se pueden editar (incluido el admin) — Gestión de Usuarios → Editar; PUT /api/usuarios/:id — Editar a un instructor o al admin
[BUG][MEDIA] AUTH-B04 Una sesión desactivada o con el rol cambiado sigue siendo válida hasta 8 h — Todas las rutas con verifyToken — Desactivar a un usuario con sesión abierta y seguir usando su token
[BUG][MEDIA] AUTH-B05 Cerrar sesión deja un JWT válido en localStorage ('authToken') — Logout de admin, gerente, socio y recepción — Iniciar sesión, cerrar sesión y revisar localStorage
[BUG][MEDIA] AUTH-B06 El login escribe en consola el email y los datos del usuario — POST /api/auth/login — Hacer cualquier login
[BUG][MEDIA] AUTH-B07 Login sin body o sin contraseña responde 500 — POST /api/auth/login — POST sin body, o solo con email
[BUG][MEDIA] AUTH-B08 POST /api/usuarios acepta el rol socio o un rol inexistente — POST/PUT /api/usuarios — POST con rol_id 4 (socio), 999 o 'abc'
[BUG][MEDIA] AUTH-B09 /api/usuarios/:id: 500 con ids no numéricos y 200 con ids inexistentes — GET/PUT/DELETE /api/usuarios/:id, /desactivar, /reactivar, /permanente — GET /api/usuarios/abc; PUT o DELETE /api/usuarios/999999
[BUG][MEDIA] AUTH-B10 Una foto de perfil inválida o de más de 5 MB da 500, y una foto grande rompe el login — PUT /api/usuarios/me/foto; Login — Subir un .txt o una imagen de 6 MB; subir una de ~4 MB y volver a entrar
[BUG][BAJA] AUTH-B11 Login y unicidad de email y CURP distinguen mayúsculas — POST /api/auth/login; POST /api/usuarios y /api/socios — Entrar con 'Ana@x.com' cuando el usuario es 'ana@x.com'; crear un usuario con la CURP en minúsculas
[BUG][BAJA] AUTH-B12 El fallback 'secreto_super_seguro' sigue en el código — Login — Revisar el código
[BUG][BAJA] AUTH-B13 createUsuario devuelve la contraseña en texto plano y conserva el valor por defecto 'empleado123' — POST /api/usuarios — POST sin password (por API)
[BUG][BAJA] AUTH-B14 GET /api/roles es público — GET /api/roles — GET sin token
[BUG][BAJA] AUTH-B15 El panel del socio siempre saluda "Socio" — Layout del socio (encabezado) — Entrar como socio
[BUG][BAJA] AUTH-B16 Código muerto y una ruta sin proteger — Frontend — npx eslint
[BUG][ALTA] SOC-B01 Cualquier autenticado, incluido un socio, lee CURP, teléfono y dirección de todos los socios — GET /api/socios y GET /api/socios/:id — Con token de socio: GET /api/socios y GET /api/socios/<id de otro>
[BUG][ALTA] SOC-B02 Un socio obtiene el QR de acceso de otro socio — GET /api/socios/:socio_id/qr — Con token de socio: GET /api/socios/1/qr
[BUG][ALTA] SOC-B03 La importación asigna contraseñas predecibles y compartidas por familia — POST /api/importacion/socios — Importar la acción 1001 con titular y miembros
[BUG][ALTA] SOC-B04 El borrado permanente de un socio responde 500 con el texto SQL si tiene historial — DELETE /api/socios/:id/permanente — Admin: eliminar un socio inactivo con reservas, sanciones, QR o logins
[BUG][MEDIA] SOC-B05 Crear un socio desde recepción siempre responde 500 (y usa contraseña fija) — POST /api/recepcion/socios (sin consumidor en el frontend) — Cualquier alta válida
[BUG][MEDIA] SOC-B06 La numeración automática de socios salta a SOC-1006x — POST /api/socios (Nuevo socio) — Crear un socio desde Gestión de Socios
[BUG][MEDIA] SOC-B07 31 de 40 socios con usuario no se pueden editar — Gestión de Socios → Editar; PUT /api/socios/:id — Editar un socio importado (por ejemplo, su teléfono)
[BUG][MEDIA] SOC-B08 Recepción y gerente ven botones que siempre fallan con 403 — Dashboard de Recepción → Socios; Gestión de Socios (gerente) — Como recepción: Inactivar, Eliminar, Importar, Plantilla o Exportar. Como gerente: Eliminar permanente
[BUG][MEDIA] SOC-B09 GET /api/socios/:id con id no numérico o fuera de rango responde 500 con el texto SQL — GET /api/socios/:id — GET /api/socios/abc; GET /api/socios/99999999999
[BUG][MEDIA] SOC-B10 PUT y DELETE permanente de un socio inexistente responden 500 en lugar de 404 — PUT /api/socios/:id; DELETE /api/socios/:id/permanente — PUT /api/socios/999999 con payload válido
[BUG][MEDIA] SOC-B11 El body del socio no se valida por tipo ni longitud: 500 con texto SQL — POST/PUT /api/socios — POST con nombres:123, con un email de 60 caracteres o con un numero_socio repetido
[BUG][MEDIA] SOC-B12 La numeración M<n> de la importación usa COUNT+1 y choca después de una baja — POST /api/importacion/socios — En una acción con T, M1 y M2, borrar M1 e importar un miembro nuevo
[BUG][MEDIA] SOC-B13 La importación permite dos titulares, acciones Individual con varios miembros y modalidades mezcladas — POST /api/importacion/socios — Reimportar como Titular a un miembro de una acción que ya tiene titular en la BD
[BUG][BAJA] SOC-B14 33 socios sin usuario no aparecen en Gestión de Socios — GET /api/socios — Abrir Gestión de Socios
[BUG][BAJA] SOC-B15 VistaSocios del coordinador oculta errores y muestra 0 socios — Coordinador → Socios — Con el token vencido o ante un 500
[BUG][BAJA] SOC-B16 Íconos de importación y exportación cruzados y conteo de exportados erróneo — Gestión de Socios — Ver los botones; exportar con una búsqueda activa
[BUG][BAJA] SOC-B17 La importación devuelve el detalle SQL en el 500 — POST /api/importacion/socios — Provocar un fallo general de la transacción
[BUG][ALTA] RES-B01 Toda reserva de espacio termina en No-Show y genera una sanción — GET /api/reservas y /:id (syncReservasNoShow); Reservas del socio — Un socio reserva una cancha, asiste, y después de la hora_fin alguien abre una pantalla que llama GET /api/reservas
[BUG][ALTA] RES-B02 Un socio crea reservas a nombre de otro socio — POST /api/reservas (rol socio) — Con token de socio: POST /api/reservas con el socio_id de otro
[BUG][ALTA] RES-B03 Un socio cancela reservas de otros — PUT /api/reservas/:id/cancelar — Con token de socio: PUT /api/reservas/<id ajeno>/cancelar
[BUG][ALTA] RES-B04 Cualquier autenticado ve todas las reservas, con nombre y número de socio — GET /api/reservas, /:id; GET /api/recepcion/reservas — Entrar como socio a Reservas
[BUG][ALTA] RES-B05 El GET de reservas escribe en la BD sin transacción y da 500 si hay reservas de visita vencidas — GET /api/reservas y /:id — Una reserva de visita Confirmada (socio_id NULL) ya vencida, y después GET /api/reservas
[BUG][MEDIA] RES-B06 El socio esquiva el No-Show eligiendo el estado al crear o cancelando tarde — POST /api/reservas; PUT /:id/cancelar — POST con estado Pendiente; cancelar una reserva ya terminada
[BUG][MEDIA] RES-B07 PUT de reserva con body parcial siempre falla — PUT /api/reservas/:id — PUT /api/reservas/17 {"estado":"Confirmada"}
[BUG][MEDIA] RES-B08 No se puede corregir el estado de una reserva ya iniciada o pasada — Admin y Recepción → Reservas → Editar — Editar una reserva de ayer para marcarla Confirmada
[BUG][MEDIA] RES-B09 Doble reserva posible bajo concurrencia — POST y PUT /api/reservas — Dos POST simultáneos del mismo socio en espacios distintos; un PUT a un hueco que un POST está ocupando
[BUG][MEDIA] RES-B10 Mensaje engañoso del máximo de reservas por día, con límites distintos en front y back — POST /api/reservas; modal de Admin Reservas — Un socio con 2 reservas de clase intenta reservar una cancha
[BUG][MEDIA] RES-B11 Poner un espacio en mantenimiento deja sus reservas vivas y ocultas — PATCH /api/espacios/:id/estado; rejilla de Admin Reservas — Reservar la cancha X hoy y ponerla en Mantenimiento
[BUG][MEDIA] RES-B12 Ids no numéricos o fuera de rango dan 500 con el error SQL — /api/reservas/:id y /cancelar, /disponibilidad, /api/espacios/:id, /mantenimien… — GET /api/reservas/disponibilidad?espacio_id=99999999999; GET /api/espacios/abc/mantenimiento
[BUG][MEDIA] RES-B13 Body ausente o con tipos inválidos da 500 en reservas y espacios — POST /api/reservas, PUT /:id; POST/PUT/PATCH /api/espacios — POST /api/reservas sin body; POST /api/espacios con un nombre de 101 caracteres
[BUG][MEDIA] RES-B14 Eliminar un espacio con historial da 500 — DELETE /api/espacios/:id — Eliminar un espacio inactivo con reservas
[BUG][MEDIA] RES-B15 La página pública /espacios se cae — Ruta /espacios (App.jsx:100, sin ProtectedRoute) — Abrir /espacios
[BUG][MEDIA] RES-B16 "Mis reservas de hoy" del socio mezcla clases y No-Show, todas con Cancelar — Socio → Reservas — Socio con una clase hoy o una reserva No-Show
[BUG][MEDIA] RES-B17 El admin bloquea a socios cuya sanción ya venció — Admin/Recepción → Reservas → selector de socio — Abrir "Nueva reserva"
[BUG][BAJA] RES-B18 El PATCH de estado acepta valores inválidos y reactiva el espacio — PATCH /api/espacios/:id/estado; PUT /api/espacios/:id — PATCH con {} o {"estado":"xyz"} sobre un espacio en Mantenimiento
[BUG][BAJA] RES-B19 La fecha estimada de fin del mantenimiento se ignora — Configuración de espacios → Mantenimiento — Poner un espacio en mantenimiento con fecha de fin
[BUG][BAJA] RES-B20 La validación de la ventana de mantenimiento está muerta en Neon — POST /api/reservas — Hacer cualquier reserva
[BUG][BAJA] RES-B21 Horario y duración fijos en el código; las variables de .env no se usan — Reservas (socio y admin) — Comparar los textos con la validación
[BUG][BAJA] RES-B22 La fecha y hora del socio salen del reloj del navegador — Socio → Reservas; VistaReservas del coordinador — Usar un dispositivo en otra zona horaria
[BUG][BAJA] RES-B23 Errores ocultos y sesión vencida silenciosa en VistaReservas, VistaEspacios y AgendaDia — Coordinador e instructor — Usar un token vencido o provocar un fallo de la API
[BUG][BAJA] RES-B24 created_by nunca se guarda — POST /api/reservas — Crear una reserva
[BUG][ALTA] CLA-B01 /api/inscripciones/* sin autenticación: cualquiera inscribe, cancela o lista clases por socioId — POST /api/inscripciones/inscribir, /cancelar; GET /mis-inscripciones — Sin token: POST inscribir {sesionId, socioId}; GET mis-inscripciones?socioId=1
[BUG][ALTA] CLA-B02 "Editar sesión" siempre falla: el UPDATE escribe una columna activo que no existe — GestionDisciplinas → Editar sesión; PUT /api/sesiones/:id — Editar cualquier sesión y guardar
[BUG][ALTA] CLA-B03 Sobrecupo: hay dos modelos de inscripción que se ignoran entre sí; la reactivación no revisa cupo y el panel … — POST /api/inscripciones/inscribir; POST /api/instructor/clases/inscribir; POST … — Sesión con cupo 1: el socio 1 se inscribe, el instructor agrega a otro, el 1 cancela, ocupa el 7 y el 1 reactiva
[BUG][ALTA] CLA-B04 Instructor y recepción pasan lista, inscriben o quitan alumnos en cualquier clase, incluso a no inscritos — /api/instructor/asistencia, /clases/inscribir, /clases/:id/alumnos; /api/sesion… — Con el instructor B: POST asistencia en una clase del instructor A, para un socio no inscrito
[BUG][ALTA] CLA-B05 Pasar lista a una visita desde AgendaDia da 500 con detalle SQL y la UI la marca presente igual — Instructor → Agenda del día → ✓ sobre una visita — Agregar una visita a la clase y pulsar ✓
[BUG][ALTA] CLA-B06 GET /api/instructores y /:id son públicos y devuelven email y teléfono — GET /api/instructores, /api/instructores/:id — GET /api/instructores sin token
[BUG][ALTA] CLA-B07 Crear instructor: contraseña fija, vinculación a ciegas por email e instructores que no aparecen — GestionInstructores → Nuevo; POST /api/instructores — POST con un email nuevo; POST con el email de un socio o admin; POST {nombre:'Fantasma'}
[BUG][ALTA] CLA-B08 Las sesiones de espacios con un mantenimiento ya terminado no admiten inscripción — Socio → Clases → Inscribirse — Inscribirse a una sesión de un espacio que tuvo mantenimiento en 2025
[BUG][MEDIA] CLA-B09 Con cupo_maximo NULL el socio ve "clase llena", el instructor inscribe sin límite y la UI muestra 20 — Clases del socio; AgendaDia — Inscribirse a la sesión 303
[BUG][MEDIA] CLA-B10 La fecha de inscripción o asistencia no se valida contra dia_semana; una fecha basura da 500 — asistencia-qr; /api/instructor/clases/inscribir; /api/instructor/asistencia — QR con una fecha de 2020 en martes para una sesión de miércoles; fecha 'hola'
[BUG][MEDIA] CLA-B11 La asistencia por QR de visitas usa CURRENT_DATE de la BD y no la fecha de México — POST /api/sesiones/:id/asistencia-qr (visita); /api/instructor/clases/inscribir — Escanear una visita de noche (hora de México)
[BUG][MEDIA] CLA-B12 La lista de alumnos nunca muestra la asistencia de las visitas — AgendaDia → alumnos; GET /api/instructor/clases/:id/alumnos — Registrar una visita por QR y abrir la lista
[BUG][MEDIA] CLA-B13 La inscripción rápida con solo visita_id no detecta duplicados ni visitas inexistentes — AgendaDia → Agregar → Visitas — POST /api/instructor/clases/inscribir {visita_id} dos veces
[BUG][MEDIA] CLA-B14 El QR rechaza a un socio inscrito de forma recurrente si las reservaciones llenaron el cupo, y si lo acepta d… — POST /api/sesiones/:id/asistencia-qr — Socio inscrito en la sesión 1 (cupo 1) y otro agregado por reservación; escanear
[BUG][MEDIA] CLA-B15 Editar instructor ignora nombre, email y teléfono pero responde "actualizado"; no comprueba existencia ni lon… — GestionInstructores → Editar; PUT /api/instructores/:id — PUT con nombre, email y teléfono nuevos; PUT a la id 999
[BUG][MEDIA] CLA-B16 Eliminar una sesión, instructor o disciplina con dependencias da 500 y uno inexistente da 200 — DELETE /api/sesiones/:id, /api/instructores/:id, /api/disciplinas/:id — DELETE de una sesión con inscritos; DELETE de la id 999
[BUG][MEDIA] CLA-B17 Entradas inválidas dan 500 en lugar de 400 en inscripciones, sesiones, instructores, disciplinas y el panel d… — /api/inscripciones, /api/sesiones, /api/instructores, /api/disciplinas, /api/in… — Ids 'abc' o > int4, fecha=hola, POST sin body
[BUG][MEDIA] CLA-B18 Los 500 del panel del instructor devuelven el detalle SQL — /api/instructor/* — GET /api/instructor/clases?fecha=hola
[BUG][MEDIA] CLA-B19 Crear sesión no valida el traslape del instructor ni que la disciplina sea la del espacio — GestionDisciplinas → Nueva sesión; POST /api/sesiones — Crear una sesión del instructor 1 a la misma hora que otra suya en otro espacio
[BUG][MEDIA] CLA-B20 "Quitar" en AgendaDia cancela la inscripción recurrente completa, y quitar una visita borra todas las visitas… — Instructor → Agenda del día → Quitar — Quitar a un socio inscrito; quitar una de varias visitas
[BUG][MEDIA] CLA-B21 Desmarcar ✓ o ✗ guarda presente=false en la BD aunque la UI muestre "sin registrar" — AgendaDia → AlumnoRow — Marcar presente y volver a pulsar ✓
[BUG][MEDIA] CLA-B22 seedDisciplinas destruye datos actuales — npm run seed:disciplinas — Ejecutarlo contra la BD actual
[BUG][BAJA] CLA-B23 Admin, coordinador y recepción entran a /mis-clases, /metricas y /clases y reciben 404 — GET /api/instructor/mis-clases, /metricas, /clases — GET /api/instructor/mis-clases con token de admin
[BUG][BAJA] CLA-B24 Las reservaciones creadas por el instructor o por el QR no guardan espacio_id — /api/instructor/clases/inscribir; asistencia QR — Hacer una inscripción rápida
[BUG][BAJA] CLA-B25 GET /api/sesiones/dia/:dia (público y sin consumidor) cuenta las reservaciones de todas las fechas — GET /api/sesiones/dia/:dia — GET /api/sesiones/dia/2
[BUG][BAJA] CLA-B26 Métricas del instructor incorrectas — Instructor → Métricas — Abrir Métricas
[BUG][BAJA] CLA-B27 Modal QR: el mensaje de inscripción nunca aparece y el escáner se detiene tras un error — AgendaDia → Escanear QR — Escanear un QR inválido y luego uno válido
[BUG][BAJA] CLA-B28 El catálogo del socio puede mostrar lugares negativos o "20" falsos — Socio → Clases → Catálogo — Ver una sesión con sobrecupo o con cupo NULL
[BUG][BAJA] CLA-B29 Fechas y días tomados del navegador; KPIs de GestionDisciplinas incoherentes — MisClases, AgendaDia, GestionDisciplinas — Usar la app en otra zona horaria o en domingo
[BUG][BAJA] CLA-B30 ESLint con errores en las pantallas del módulo — Clases, AgendaDia, GestionDisciplinas y otras — npx eslint
[BUG][ALTA] REC-B01 El QR que entrega recepción nunca se guarda y el torniquete lo rechaza — POST /api/recepcion/visitas; GET /api/recepcion/visitas/:id/qr; POST /api/acces… — Crear un pase en recepción y leer su codigo_qr con lectura-qr
[BUG][ALTA] REC-B02 Los GET de /api/recepcion/* están abiertos a cualquier autenticado, con datos personales — GET /api/recepcion/socios, /socios-lista, /reservas, /espacios, /visitas*, /das… — Con token de socio, llamar a cada GET
[BUG][ALTA] REC-B03 XSS persistente al imprimir el QR: el nombre del visitante se escribe sin escapar — Recepción → Visitas → QR → Imprimir (recepción y admin) — Registrar una visita con el nombre `<img src=x onerror=alert(localStorage.token)>` y que otro usuario pulse Imprimir
[BUG][MEDIA] REC-B04 Un QR de socio revocado o regenerado sigue valiendo en ludoteca y en la identificación — POST /api/ludoteca/acceso-qr; POST /api/qr/identificar-socio — Usar un QR firmado que no está en la tabla o que ya se desactivó
[BUG][MEDIA] REC-B05 Los pases creados después de las 22:00 se cierran al instante — Recepción → Nuevo pase; GET /api/recepcion/visitas* — Crear un pase a las 22:30
[BUG][MEDIA] REC-B06 Una visita cerrada conserva su QR activo y el acceso lo acepta — PUT /api/recepcion/visitas/:id/salida; POST /api/acceso/lectura-qr — Registrar la salida de una visita y volver a escanear su QR
[BUG][MEDIA] REC-B07 "Ver QR" regenera el QR y renueva otras 24 h cada vez — GET /api/recepcion/visitas/:id/qr — Abrir "Ver QR" varias veces
[BUG][MEDIA] REC-B08 Un pase de día con identificación aparece como "visita" — Visitas (recepción, admin, coordinador) — Crear un pase de día con identificación "INE 1234"
[BUG][MEDIA] REC-B09 Editar una visita ignora teléfono, correo, identificación, tipo y anfitrión, pero responde 200 — Admin → Visitas → Editar; PUT /api/recepcion/visitas/:id — Editar teléfono, correo y tipo
[BUG][MEDIA] REC-B10 "Enviar QR por correo" no envía el QR — Botón de correo del modal QR; POST /api/recepcion/visitas/:id/enviar-qr — Pulsar el botón de correo
[BUG][MEDIA] REC-B11 Entradas inválidas en recepción dan 500 en lugar de 4xx — POST /api/recepcion/visitas, /asistencia/manual; PUT /visitas/:id/salida; GET /… — Sin body; id 'abc'; fecha 'hoy' o '2026-02-30'; identificación de 60 caracteres
[BUG][MEDIA] REC-B12 La vista de visitas del coordinador duplica las activas y cuenta 7 días como "hoy" — Coordinador → Visitas — Abrir la vista con una visita activa
[BUG][MEDIA] REC-B13 La lectura QR de socio no revisa sanciones y la alternancia entrada/salida se desfasa — POST /api/acceso/lectura-qr — Omitir una lectura de salida
[BUG][BAJA] REC-B14 Los GET de visitas y dashboard ejecutan consultas que siempre fallan — GET /api/recepcion/visitas, /activas, /historial, /dashboard — Cualquier GET
[BUG][BAJA] REC-B15 Los KPIs difieren entre las copias casi idénticas de admin y recepción — Admin → Recepción frente a Recepción → Visitas — Comparar los KPIs
[BUG][BAJA] REC-B16 El dashboard de recepción calcula "ingresos" y "socios dentro" con la asistencia a clases — Recepción → Dashboard — Ver los KPIs
[BUG][BAJA] REC-B17 La asistencia manual acepta reservas canceladas y fechas futuras — POST /api/recepcion/asistencia/manual (sin consumidor) — Una reserva Cancelada; sesionId='abc'
[BUG][BAJA] REC-B18 Alias `identificacion` duplicado en pasesSelect — GET visitas (si existiera la tabla pases) — Revisar el código
[BUG][ALTA] LUD-B01 Un socio puede registrar y sacar hijos ajenos y ver el historial completo — GET /api/ludoteca/historial; POST /api/ludoteca; PUT /api/ludoteca/:id/salida — Con token de socio: POST con socio_padre_id=2, luego GET /historial y PUT /:id/salida
[BUG][ALTA] LUD-B02 En el acceso por QR, intentar meter a un segundo hijo saca al primero — POST /api/ludoteca/acceso-qr — Con el hijo A dentro, escanear el QR del padre y enviar nombre_hijo='Hijo B'
[BUG][MEDIA] LUD-B03 El aforo máximo de 15 nunca se aplica — POST /api/ludoteca/entrada, /socio/entrada, /acceso-qr; /api/recepcion/ludoteca… — Registrar 16 niños
[BUG][MEDIA] LUD-B04 La edad permitida es de 3 a 7 años; la épica pide de 3 a 6 — Todas las entradas de ludoteca — Registrar un niño de 6 años y 11 meses
[BUG][MEDIA] LUD-B05 Las entradas de staff y por QR no detectan niños duplicados ni padres inactivos o sancionados — POST /api/ludoteca/entrada, /acceso-qr — Dar dos veces la entrada al mismo niño; dar entrada con el padre sancionado
[BUG][MEDIA] LUD-B06 /api/recepcion/ludoteca/entrada y /salida no validan nada y se saltan la sanción — POST /api/recepcion/ludoteca/entrada; PUT /salida/:id (sin consumidor) — Entrada sin socioId; entrada de un niño de 1 año
[BUG][MEDIA] LUD-B07 Una doble lectura del QR al salir genera dos sanciones — POST /api/ludoteca/acceso-qr (salida) — Dos escaneos casi simultáneos
[BUG][MEDIA] LUD-B08 Registros abiertos durante días, sin cierre ni alerta — Ludoteca (staff) — Revisar las duraciones en Neon
[BUG][MEDIA] LUD-B09 Los 500 de ludoteca devuelven el mensaje de Postgres — GET /api/ludoteca/activos, /historial — GET /api/ludoteca/historial?dias=1000000000000
[BUG][BAJA] LUD-B10 hora_limite del QR depende de la zona horaria del servidor — POST /api/ludoteca/acceso-qr — Servidor en UTC
[BUG][BAJA] LUD-B11 Los límites de fecha del formulario del socio se calculan en UTC — Socio → Ludoteca — Abrir el formulario después de las 18:00
[BUG][ALTA] SAN-B01 Las sanciones de ludoteca nunca vencen: se crean sin fechas, sin gravedad y con 'Activo' en lugar de 'Activa' — Salida de ludoteca con exceso de tiempo → reservas y clases del socio — Un socio excede las 2 h de ludoteca y después intenta reservar
[BUG][MEDIA] SAN-B02 Las sanciones vencidas siguen "activas" y cada módulo las cuenta de forma distinta — QR, GestionSocios, dashboard de recepción, reporte, DashboardSocio, SancionesPa… — Una sanción Moderada de junio que nadie resolvió
[BUG][MEDIA] SAN-B03 La deduplicación de no-shows con ILIKE '%reserva #N%' confunde reservas por prefijo — POST /api/sanciones/no-shows/sincronizar; GET /api/reservas — Socio con la sanción de la "reserva #32" que luego no se presenta a la reserva #3
[BUG][MEDIA] SAN-B04 "Crear sanción" se puede enviar dos veces — Sanciones → Nueva sanción — Doble clic con una red lenta
[BUG][MEDIA] SAN-B05 Editar la gravedad no recalcula fecha_fin — Sanciones → Detalle → Editar — Cambiar una Leve a Grave
[BUG][MEDIA] SAN-B06 PUT /api/sanciones/:id acepta estados fuera de catálogo, reactiva sanciones resueltas, reasigna el socio y ad… — PUT /api/sanciones/:id — PUT {"estado":"Cancelada"}; {"socio_id":5}; fecha_fin < fecha_inicio
[BUG][MEDIA] SAN-B07 Permisos invertidos: el gerente puede borrar sanciones pero no resolverlas, y su cambio de estado se ignora s… — DELETE, PUT /api/sanciones/:id; PATCH /:sancion_id; /levantar; /perdonar — Como gerente: PUT {"estado":"Resuelta","motivo":"x"}; DELETE
[BUG][MEDIA] SAN-B08 Ids inválidos y body ausente dan 500 en sanciones — GET, PUT, DELETE /api/sanciones/:id; /levantar; /perdonar; POST / — GET /api/sanciones/abc; POST /api/sanciones sin body
[BUG][MEDIA] SAN-B09 La vista de sanciones del instructor solo ve 20 y sus filtros no coinciden con los estados reales — Instructor → Sanciones — Abrir la pestaña y filtrar por "Activa"
[BUG][BAJA] SAN-B10 Dos caminos de resolución con estados distintos ('Resuelta' e 'Inactivo'); "levantar" no revisa si ya estaba … — PUT /:id/levantar y /perdonar; PATCH /:sancion_id — Levantar dos veces la misma sanción
[BUG][BAJA] SAN-B11 GET /api/sanciones/socio/:id da 403 al instructor, que sí puede listar todas las sanciones — GET /api/sanciones/socio/:id — Instructor: GET /api/sanciones/socio/2 y GET /api/sanciones?socio_id=2
[BUG][BAJA] SAN-B12 El panel no informa la gravedad final que asignó el servidor — Nueva sanción — Elegir "Leve" para un socio con historial
[BUG][BAJA] SAN-B13 Cambiar un filtro estando en otra página lanza dos fetch que compiten — Panel de sanciones — En la página 3, cambiar un filtro
[BUG][MEDIA] REP-B01 Las fechas del PDF de sanciones salen vacías o mal cortadas — GET /api/reportes/sanciones?formato=pdf — Descargar el PDF de abril a junio de 2026
[BUG][MEDIA] REP-B02 La Fecha_Nacimiento del Excel de socios sale vacía o mal formateada en todas las filas — GET /api/reportes/socios/exportar — Exportar socios
[BUG][MEDIA] REP-B03 El reporte de sanciones cuenta las vencidas como activas y el Top 20 ignora el periodo — GET /api/reportes/sanciones — Sacar el reporte de un mes
[BUG][MEDIA] REP-B04 El reporte de asistencia cuenta a los ausentes, no corresponde con las ocurrencias y sin fechas devuelve ceros — GET /api/reportes/asistencia (sin consumidor) — GET sin parámetros; GET con fechaInicio=x
[BUG][MEDIA] REP-B05 Los reportes devuelven error.message crudo en el 500 — /api/reportes/*; /socios/exportar — Provocar cualquier error de BD
[BUG][MEDIA] REP-B06 POST /api/logs responde 201 aunque no se guarde; se pueden falsificar entradas e IP — POST /api/logs (sin consumidor) y todos los logAudit — POST con una accion de 101 caracteres; cualquier petición con X-Forwarded-For: 1.2.3.4
[BUG][MEDIA] REP-B07 La hora de la bitácora se muestra 6 h antes — Admin → Auditoría — Ver un log recién creado
[BUG][MEDIA] REP-B08 La auditoría solo muestra los últimos 100 logs y el "Total" engaña — Admin → Auditoría — Abrir Auditoría
[BUG][BAJA] REP-B09 Los parámetros de GET /api/logs no se validan — GET /api/logs — ?limite=abc, ?usuarioId=abc, ?fechaInicio=zz
[BUG][BAJA] REP-B10 Rótulos incorrectos en el Excel de socios — GET /api/reportes/socios/exportar — Exportar
[BUG][BAJA] REP-B11 Si se borra una de las dos fechas, el reporte sale de un solo día sin aviso — Reportes → tarjetas con rango — Borrar "Desde" y descargar
[BUG][BAJA] REP-B12 La migración de audit_logs está muerta — backend/migrations/Crear_audit_log.sql — Revisar Neon y el código
[BUG][MEDIA] DASH-B01 El KPI "Sanciones Activas" del admin y el gerente se calcula sobre 20 filas y cuenta las vencidas — Dashboard ejecutivo y gerencial (inicio) — Abrir el dashboard
[BUG][MEDIA] DASH-B02 El dashboard del coordinador limita "Total Socios" a 20 y no detecta la sesión vencida — Coordinador → Inicio — Abrir el resumen, también con un token vencido
[BUG][BAJA] DASH-B03 La Home pública muestra cifras inventadas — / (Home) — Abrir la Home
[BUG][ALTA] GEN-B01 Body ausente provoca 500 en al menos 24 endpoints — Por ejemplo: POST /api/auth/login, /api/socios, /api/reservas, /api/espacios, /… — POST /api/socios con token de admin y sin body ni Content-Type
[BUG][ALTA] GEN-B02 Ids no numéricos o fuera del rango int4 dan 500 en 24 GETs — /api/socios/:id, /qr, /sanciones; /api/usuarios/:id; /api/espacios/:id, /manten… — GET <ruta>/abc y <ruta>/99999999999 con token de admin
[BUG][ALTA] GEN-B03 Dos GETs escriben en la BD y los puede disparar cualquier rol — GET /api/reservas, /api/reservas/:id; GET /api/recepcion/visitas, /visitas/acti… — Con el pool protegido contra escrituras, llamar a esos GETs
[BUG][MEDIA] GEN-B04 Respuestas que exponen el texto de PostgreSQL — /api/socios/:id; /api/espacios/:id/mantenimiento (pg_code + detail); /api/instr… — GET /api/socios/abc; GET /api/espacios/abc/mantenimiento
[BUG][MEDIA] GEN-B05 `npm run migrate` no reproduce la BD y el esquema de Neon diverge de las migraciones — npm run migrate; cualquier entorno nuevo — Aplicar las migraciones en una BD vacía, en el orden de migrate.js y también en orden lógico (schema.sql primero, reintentando)
[BUG][BAJA] GEN-B06 Un Origin no permitido por CORS responde 500 — Todas las rutas — curl con Origin: https://evil.example
[BUG][BAJA] GEN-B07 apiRequest revienta con respuestas que no son JSON — Todo el frontend — Una respuesta HTML (502 del proxy o página de error)
[BUG][BAJA] GEN-B08 Los 3 tests que fallan están desactualizados — backend/src/tests/accesoMetricas.test.js:91; asistenciaQr.test.js:91-113 — npx jest
[BUG][BAJA] GEN-B09 ESLint reporta 101 problemas en el frontend — frontend/src — npx eslint src
[FALTANTE][MEDIA] AUTH-F01 Cambio de contraseña por el propio usuario — /api/usuarios/me/password + pantalla de perfil — Los socios importados quedan con contraseñas predecibles (SOC-B03) y no pueden cambiarlas
[FALTANTE][MEDIA] AUTH-F02 Límite de intentos de login y bloqueo — POST /api/auth/login — Sin límite, la fuerza bruta contra contraseñas como Club<acción><año> es trivial
[FALTANTE][BAJA] AUTH-F03 Sincronizar socios.activo al desactivar el usuario — usuarioService.cambiarActivo — Desactivar un usuario socio por /api/usuarios deja el socio activo
[FALTANTE][MEDIA] SOC-F01 Límite de 6 integrantes por acción familiar — socioService e importacion/validacionSocios — Lo exige la épica 1 y no está en el código
[FALTANTE][MEDIA] SOC-F02 Vínculo familiar en el alta y edición manual — GestionSocios / POST /api/socios — [Neon-lectura] 24 socios sin acción; solo la importación crea familias
[FALTANTE][BAJA] SOC-F03 Estados Suspendido y Baja — socios (hoy solo hay activo boolean) — La épica los pide; la rama 'Suspendido' de la UI es inalcanzable
[FALTANTE][BAJA] SOC-F04 Paginación y búsqueda en /api/socios — GET /api/socios — La épica pide endpoints paginados y con filtros
[FALTANTE][ALTA] RES-F01 Check-in o asistencia de las reservas de espacio — Recepción/QR, endpoint por reserva_id — Sin esto toda reserva acaba en No-Show con sanción (RES-B01)
[FALTANTE][MEDIA] RES-F02 Mantenimiento preventivo programado — espacioService y modal de mantenimiento — La épica 4 lo pide; hoy solo hay mantenimiento inmediato sin fecha de fin
[FALTANTE][MEDIA] RES-F03 Código de reserva único — Columna con índice único en reservaciones — Lo pide explícitamente la épica 4
[FALTANTE][MEDIA] RES-F04 API de disponibilidad por rango — GET /api/reservas/disponibilidad — Lo pide la épica 4; /espacios ya la llama (RES-B15)
[FALTANTE][MEDIA] RES-F05 Endpoint "mis reservas" del socio — GET /api/reservas/mias — Para dejar de enviar las reservas de todos (RES-B04)
[FALTANTE][MEDIA] RES-F06 Reserva asistida para visitantes — POST /api/reservas con visita_id — Lo pide la épica 3; la columna existe
[FALTANTE][BAJA] RES-F07 Validación de capacidad — POST /api/reservas — La épica 4 la menciona; capacidad_maxima no se usa
[FALTANTE][BAJA] RES-F08 Restricción contra traslapes en la BD — reservaciones (EXCLUDE o CHECK) — Defensa de fondo para RES-B09
[FALTANTE][MEDIA] CLA-F01 Modelo único de ocupación de clase — inscripcion, instructorPanel, asistenciaQr y sesionService — Es el origen de CLA-B03, B09, B14, B25 y B28
[FALTANTE][MEDIA] CLA-F02 UNIQUE en asistencia por sesión, persona y fecha — BD — Hoy se comprueba y luego se inserta sin restricción
[FALTANTE][MEDIA] CLA-F03 Restricciones de esquema de clases — BD (cupo NOT NULL, CHECK de estado, UNIQUE en instructores.usuario_id… — 4 sesiones con cupo NULL; estado en texto libre
[FALTANTE][MEDIA] CLA-F04 Desactivar sesiones (baja lógica) — sesiones_programadas y GestionDisciplinas — El código ya lo intenta (CLA-B02) y borrar falla con dependencias
[FALTANTE][MEDIA] CLA-F05 Validar el traslape del instructor y la disciplina del espacio — sesionService — CLA-B19 y los datos ya inconsistentes
[FALTANTE][BAJA] CLA-F06 Uso de lista_espera — inscripcionService / Clases — La tabla existe en Neon, sin migración ni código
[FALTANTE][BAJA] CLA-F07 Ajustar el usuario al eliminar un instructor — instructorService.eliminarInstructor — 2 usuarios instructor sin ficha reciben 404 en su panel
[FALTANTE][BAJA] CLA-F08 Excluir sesiones de instructores inactivos — listarSesiones, clasesGeneral — [Neon-lectura] Una sesión tiene instructor inactivo y 274 de 294 no tienen instructor
[FALTANTE][MEDIA] REC-F01 Pantalla de escaneo para el control de acceso — Recepción (lectura-qr, identificar-socio, ludoteca/acceso-qr) — Los tres endpoints no tienen consumidor; registro_acceso tiene 2 filas
[FALTANTE][MEDIA] REC-F02 Migrar a `pases`/`codigos_qr_pases` o eliminar esa ruta — Migraciones + paseService — Todo el código es doble (pases/legacy) y el tipo de pase se pierde (REC-B08)
[FALTANTE][BAJA] REC-F03 Pantalla de métricas de acceso — Gerencia/Admin — GET /api/acceso/metricas no tiene consumidor
[FALTANTE][MEDIA] LUD-F01 Alerta y cierre al vencer las 2 h — Ludoteca (staff) / backend — Lo pide la épica 7; hay registros abiertos durante semanas (LUD-B08)
[FALTANTE][MEDIA] LUD-F02 Bloquear la ludoteca a socios sancionados por exceso — ludotecaService (entradas) — La épica 7 pide "bloqueo si tiempo excedido"
[FALTANTE][MEDIA] SAN-F01 Vencimiento automático de sanciones — sancionService (job o vista) — Sin esto existen 44 "activas" vencidas (SAN-B02)
[FALTANTE][MEDIA] SAN-F02 Auditoría de las acciones sobre sanciones — sancionesController → logAudit — logs_sistema no tiene ninguna entrada de sanciones; un borrado no deja rastro
[FALTANTE][BAJA] SAN-F03 Mostrar vigencia y gravedad en el detalle — SancionesPanel.jsx:668-673 — El staff no sabe hasta cuándo aplica una sanción
[FALTANTE][BAJA] REP-F01 Límite máximo del rango en reportes — reporteValidators / resolveDateRange — Un rango 1900-2100 recorre ~73 000 fechas × espacios × 16 h en JS
[FALTANTE][BAJA] REP-F02 Pantalla de reportes para el coordinador — DashboardCoordinador — El backend le permite ocupación, afluencia y asistencia, pero no hay UI
[FALTANTE][MEDIA] GEN-F01 Pruebas de permisos y reglas con una BD real — backend/src/tests — Los tests simulan checkRole y la BD, así que ningún hueco de permisos de esta auditoría se detecta en CI
[SC] SC-01 UI de roles y permisos configurables (RBAC)
[SC] SC-02 Recuperación de contraseña por correo
[SC] SC-03 Historial de cambios visible en la ficha del socio
[SC] SC-04 Unificar los dos flujos de alta de socio y las dos pantallas de visitas
[SC] SC-05 Reservas con días de anticipación
[SC] SC-06 Lista de espera con avisos (clases y espacios)
[SC] SC-07 Notificaciones (cancelación de reservas, mantenimiento, vencimiento de ludoteca)
[SC] SC-08 Excepciones de calendario (feriados, cancelar una sola fecha)
[SC] SC-09 QR de socio rotativo o con expiración
[SC] SC-10 Reglas de negocio pendientes de confirmar: escalamiento de gravedad permanente, no-shows siempre Moderada, sanciones po…
[SC] SC-11 Botones para sincronizar no-shows, levantar y eliminar sanciones
[SC] SC-12 Política de PII en la exportación de socios y en GET /api/sanciones (socio_email para recepción e instructor)
[SC] SC-13 Decidir si /api/ludoteca/aforo debe ser público
```
