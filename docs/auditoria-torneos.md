# Auditoría del módulo de torneos

**Proyecto:** club-deportivo-v2 · **Rama:** `develop` @ `3668308` · **Fecha:** 2026-10-10
**Tipo:** solo inspección. No se cambió código, no se hizo nada en git y no se escribió en Neon.

## Alcance y cómo leer la evidencia

Se revisó el backend: rutas, validadores, controladores, los servicios `torneoService`, `participanteService`, `bracketService`, `encuentroService` y `torneoComun`, las migraciones y el esquema real en Neon. También el frontend: `TournamentBracket` y `components/torneos/*`, `GestionTorneos`, la vista del socio y su CSS, y todo lo que llama a `/api/torneos`, `/api/encuentros` y `/api/instructor/torneos`.

`docks/Epicas.txt` no tiene una épica de torneos. Por eso, para separar faltantes de posibles SC, se tomó como alcance el ciclo de vida de la solicitud: crear → editar → inscribir (staff y socio) → bracket → resultados → avance de rondas → finalizar/cancelar → reporte → eliminar.

Cada hallazgo indica cómo se comprobó:

| Etiqueta | Significado |
|---|---|
| **[Neon-lectura]** | Consulta `SELECT` dentro de `BEGIN READ ONLY … ROLLBACK`. Postgres rechaza cualquier escritura en ese modo. |
| **[API local]** | Backend local (puerto 3999) conectado a Neon. Solo se enviaron GETs y peticiones que se rechazan antes de llegar a la BD (rol, validación o body ausente). |
| **[BD memoria]** | Rutas reales del backend sobre un PostgreSQL en memoria (PGlite) con el mismo esquema que Neon. Sirve para reproducir flujos que escriben sin tocar Neon. |
| **[Código]** | Análisis del código, sin ejecución. |

Los conteos de Neon antes y después de la auditoría son idénticos: 16 torneos, 49 participantes y 44 encuentros.

Los números de línea corresponden al commit `3668308`.

---

## 1. Resumen

| | Alta | Media | Baja | Total |
|---|---:|---:|---:|---:|
| **Bugs** | 10 | 11 | 6 | **27** |
| **Faltantes** | 0 | 7 | 3 | **10** |
| **Posibles SC** | | | | **9** |
| **Por verificar en local** | | | | **8** |

**Lo más importante**

1. **Huecos de permisos.**
   - `PUT /api/encuentros/:id` no pide sesión: cualquiera puede reasignar los cruces (B-01).
   - El endpoint heredado del panel de instructor permite que recepción cambie el nombre del campeón que se muestra (B-07).
2. **No hay máquina de estados.** El estado se edita libremente desde "Editar torneo" y las acciones `PATCH` aceptan casi cualquier estado de partida. De ahí salen los brackets duplicados, las inscripciones después del cierre, los torneos cancelados que se "reviven" y los resultados en torneos cancelados (B-02, B-03, B-04, B-12).
3. **El bracket se corrompe al editar resultados.** El "campeón" puede no haber jugado la final (B-05). Además, los cruces dependen del orden en que se capturan los resultados y no coinciden con el dibujo (B-16).
4. **Hay datos ya dañados en Neon.**
   - Los torneos 1 y 42 están bloqueados por byes de antes del fix (B-06).
   - En el torneo 33, el campeón fue eliminado en semifinal (B-21).
   - El torneo 2 tiene dos brackets mezclados (B-21).
   - 5 de los 7 torneos abiertos no admiten auto-inscripción porque no tienen categoría (B-10).
5. **Validación de entrada.**
   - 7 endpoints responden 500 sin body, y también con textos largos o ids fuera de rango (B-08, B-09).
   - Varios mensajes de error son engañosos (B-13).
6. **Esquema.** En una BD creada desde `backend/migrations`, el bracket responde 500, y `npm run migrate` no corre en una BD vacía (B-17).

**Lo que sí funciona** (verificado):

- El ciclo completo con 4 participantes de punta a punta [BD memoria].
- El socio recibe 403 en todas las acciones de staff [API local].
- Se rechazan los empates, se exige el mínimo de 4 participantes y una inscripción duplicada de socio da 409.
- El JSON mal formado da 400; las fechas inválidas o con fin antes que inicio dan 400.
- Todas las llamadas del frontend apuntan a rutas existentes, con el método, la URL y los campos que espera el backend.

**Tests:**

- `torneos.characterization`: 62/62 pasan.
- `encuentros.characterization`: 22/22 pasan.
- Suite completa: 496 pasan y 3 fallan. Los 3 fallos son preexistentes y ajenos a torneos.
- Son tests de **caracterización** con la BD y `checkRole` simulados, así que **fijan los bugs actuales** (ver el Anexo B).

---

## 2. Bugs

| ID | Título corto | Gravedad | Pantalla o endpoint | Archivo y línea | Pasos para reproducir | Resultado actual | Resultado esperado |
|---|---|---|---|---|---|---|---|
| B-01 | `PUT /api/encuentros/:id` sin autenticación | Alta | `PUT /api/encuentros/:encuentro_id` (ningún frontend lo usa) | `backend/src/routes/encuentros.routes.js:8` (sin `verifyToken`/`checkRole`); `backend/src/services/encuentroService.js:180-227` | Sin cabecera `Authorization`: `PUT /api/encuentros/<id pendiente>` con `{"participante_1_id":X,"participante_2_id":Y}`, donde X e Y ya están en otro cruce del torneo | **[API local]** Sin token responde 400 de validación, nunca 401: la ruta no exige sesión. **[BD memoria]** 200, y la ronda 1 queda `#1 (4 v 2)` y `#2 (4 v 2)`: dos participantes desaparecen del cuadro y otros dos juegan dos veces | 401 sin token y 403 si no es staff. Validar que los participantes no estén en otro cruce y que vengan de la ronda anterior. Otra opción: eliminar el endpoint |
| B-02 | Estado del torneo sin control de transiciones | Alta | "Editar torneo" → Estado; `POST`/`PUT /api/torneos`; `PATCH /:id/confirmar-bracket`; `PATCH /:id/finalizar` | `backend/src/services/torneoService.js:142,160,183,215`; `bracketService.js:136`; `frontend/src/components/TournamentBracket.jsx:771-797`; `migrations/Ajustar_torneos_estado_check.sql:2-3` (pese al nombre, no crea un CHECK) | (UI) Editar un torneo Finalizado → Estado "Abierto" → Actualizar. (API) `PATCH confirmar-bracket` sobre un torneo Abierto sin inscritos y después `PATCH finalizar` | **[BD memoria]** Todo responde 200: Abierto → En_curso sin encuentros → Finalizado; Finalizado → Abierto; Cancelado → En_curso; Cancelado → Finalizado. Un `POST` con estado `"Lo que sea"` se guarda (luego cerrar inscripciones da 409) y uno con estado `"Finalizado"` crea el torneo ya finalizado. **[Neon-lectura]** `torneos.estado` no tiene CHECK | Solo se permiten Abierto → Inscripciones_cerradas → En_curso → Finalizado, y Cancelado desde cualquier estado no final; el resto responde 409. El estado no se acepta en el body de POST/PUT (o solo con lista blanca), hay un CHECK en la BD, y disciplina, tipo y categoría se bloquean tras cerrar inscripciones |
| B-03 | Reabrir y volver a cerrar duplica el bracket | Alta | `PATCH /api/torneos/:id/cerrar-inscripciones`; `DELETE /:id/participantes/:pid` | `bracketService.js:27-125` (no revisa si ya hay encuentros); `participanteService.js:200-217`; las FKs de `encuentros_torneo` no tienen `ON DELETE` | 1) Torneo con 4 inscritos → Cerrar inscripciones. 2) Editar → Estado "Abierto". 3) Quitar a un participante. 4) Inscribir a otro. 5) Cerrar inscripciones | **[BD memoria]** El paso 3 da 500 "Error al desinscribir participante" (FK 23503). El paso 5 da 200 y deja **10** encuentros (6 cruces en la ronda 1, con participantes repetidos) en lugar de 7. **[Neon-lectura]** El torneo 2 tiene 4 encuentros de ronda 1 para 4 participantes (2 heredados y 2 nuevos) | Cerrar inscripciones responde 409 si ya hay encuentros, o regenera el bracket borrando los anteriores en la misma transacción. Desinscribir responde 409 "El participante ya está en el bracket" |
| B-04 | El staff inscribe en torneos no abiertos | Alta | `POST /api/torneos/:id/inscribir` (Inscritos → Inscribir) | `participanteService.js:98-153` (nunca consulta el torneo); `backend/src/middleware/torneoValidators.js:52-59` | Con un torneo En_curso, Cancelado o Finalizado: `POST inscribir {"nombre_externo":"X","categoria_id":1}`. Desde la UI: abrir "Inscritos" de un torneo Abierto mientras otro usuario cierra inscripciones y pulsar Inscribir | **[BD memoria]** 201 en Inscripciones_cerradas, En_curso, Cancelado y Finalizado. En la prueba, 3 inscritos quedaron fuera del bracket | 409 "El torneo no está abierto para inscripciones", igual que ya hace `inscribir-me`, y 404 si el torneo no existe. El estado se verifica con bloqueo |
| B-05 | Editar un resultado corrompe la ronda siguiente | Alta | Bracket → "Editar resultado"; `PATCH /api/encuentros/:id/resultado` con `allowEdit` | `encuentroService.js:10-35` (cambia al participante de la ronda siguiente aunque ese partido ya tenga resultado); `frontend/src/components/torneos/MatchEditPanel.jsx:50,266` | Torneo de 4: jugar la ronda 1 y la final → en un partido de la ronda 1, "Editar resultado" invirtiendo el marcador → Actualizar | **[BD memoria]** 200. La final queda `1 v 4` con `ganador_id=3`, que ya no juega la final, y `finalizar` responde 200 con ese "campeón" | 409 si el partido siguiente ya tiene resultado, o recalcular en cascada dentro de la transacción. La edición queda registrada en auditoría |
| B-06 | Torneos 1 y 42 bloqueados por byes antiguos | Alta | Bracket de "Torneo de Tenis Primavera 2026" (1) y de "Copa Zeus" (42); `GET /api/torneos/:id/bracket` | `bracketService.js:66-121` (el fix de byes del commit `523b71c` solo aplica a brackets nuevos); `encuentroService.js:134-153` (solo activa la ronda siguiente si toda la ronda está `finalizado`) | Abrir el bracket del torneo 1 o del 42 | **[API local]** Torneo 1: los byes `#75`–`#80` están en `programado` con un solo participante y la ronda 2 (`#81`–`#84`) tiene huecos. Torneo 42: los byes `#96` y `#97` están igual, y `#98` ya tiene a sus dos rivales pero nunca se activa. Con la regla actual la ronda 2 no se activará y los ganadores de bye no avanzan. En la UI, los byes muestran casillas de marcador sin botón Guardar | Un script de corrección que pase los byes a `finalizado`, coloque a sus ganadores en la ronda 2 y la active. Probarlo antes en una copia o branch de Neon |
| B-07 | Recepción e instructores pueden cambiar el campeón que se muestra | Alta | `PUT /api/instructor/torneos/encuentro/:id` (ningún frontend lo usa) | `backend/src/routes/instructor.routes.js:17,36`; `backend/src/controllers/instructorController.js:110-118`; `backend/src/services/instructorPanelService.js:467-469`; `bracketService.js:162`; `frontend/src/components/torneos/BracketVisual.jsx:30-31` | Con token de recepción: `PUT /api/instructor/torneos/encuentro/<id de la final> {"ganador":"Cualquier texto"}` → abrir el bracket | **[BD memoria]** 200 "Ganador registrado correctamente". El bracket devuelve `ganador_nombre: "Cualquier texto"` y `BracketVisual` lo pinta como CAMPEÓN aunque `ganador_id` sea otro. Con un id inexistente también responde 200 con el mismo mensaje | Eliminar el endpoint heredado, o limitarlo a staff y hacerlo pasar por `encuentroService`. El campeón del bracket debe salir de `ganador_id`, no de la columna de texto `ganador` |
| B-08 | Textos largos provocan 500 (alcanzable desde la UI) | Alta | Nuevo/Editar torneo (Nombre), Inscribir (nombre de externo o equipo) y cancha en texto libre; `POST`/`PUT /api/torneos`, `POST /:id/inscribir`, `PATCH /api/encuentros/:id/cancha` y `/resultado` | `torneoValidators.js:32-49,52-59,88-92` (no validan longitud); `backend/src/controllers/torneosController.js:26-31` (no mapea el error 22001). Inputs sin `maxLength`: `TournamentBracket.jsx:623-635`, `frontend/src/components/torneos/InscribirModal.jsx:128-140`, `MatchEditPanel.jsx:230-243` | Crear un torneo con un nombre de 151 caracteres | **[BD memoria]** 500 "Error al crear torneo". También responden 500 un `nombre_externo` de 151, una cancha de 51 (al asignarla o junto con el resultado) y un estado de 31. Los límites en la BD son: nombre 150, estado 30, nombre_externo 150 y cancha 50 | 400 con un mensaje como "Máximo 150 caracteres", y `maxLength` en los inputs |
| B-09 | Body ausente o ids fuera de rango provocan 500 (vía API) | Alta | Sin body: `POST`/`PUT /api/torneos`, `POST /:id/inscribir`, `PATCH /api/encuentros/:id/resultado` y `/cancha`, `PUT /api/encuentros/:id`, `PUT /api/instructor/torneos/encuentro/:id`. Ids mayores que 2147483647: `GET /api/torneos?disciplina_id=`, `/:id/bracket`, `/:id/participantes`. Id no numérico: `GET /api/instructor/torneos/abc/encuentros` | `torneoValidators.js:33,44,53,76-77,90,96` (leen `req.body` sin valor por defecto, y en Express 5 llega `undefined`); `backend/src/services/torneoComun.js:19-22` y `torneoValidators.js:70-71` (aceptan cualquier entero); `instructorController.js:92-97,111` | `POST /api/torneos` con token de admin y sin body; `GET /api/torneos/99999999999/bracket` | **[API local]** Los 7 endpoints sin body responden 500 `{"ok":false,"error":"Error interno del servidor"}`. Con ids fuera del rango int4, bracket, participantes y la lista de torneos responden 500. El `GET` del instructor con id `abc` responde 500 con `"detalle": "invalid input syntax for type integer"`, que expone el error SQL. **[BD memoria]** `POST` con `disciplina_id` 2147483648 responde 500 | 400 con un mensaje claro. El body ausente se trata como `{}`, los ids se validan entre 1 y 2147483647 y la respuesta nunca incluye detalles de la BD |
| B-10 | Auto-inscripción imposible en torneos sin categoría | Alta | Socio → Torneos → Inscribirse; `POST /:id/inscribir-me` | `participanteService.js:178-180`; `TournamentBracket.jsx:744-770` (la categoría es opcional al crear); `frontend/src/pages/dashboards/socio/Torneos.jsx:367-384,401` | Como socio, "Inscribirse" en Copa Validacion QA (8), Fortnite (35), Pumas Cup (36), Super Tupper (39) o Torneo prueba (40) | **[Neon-lectura]** 5 de los 7 torneos abiertos tienen `categoria_id` NULL. El modal muestra "⚠ Sin categoría asignada" con Confirmar deshabilitado, y la API responde 400 "Este torneo no tiene categoría asignada" **[BD memoria]** | La categoría es obligatoria al crear y al editar (front y back), o se usa una categoría por defecto, y no se muestra "Inscribirse" donde no se puede. Mitigación inmediata sin código: asignar categoría a esos 5 torneos desde "Editar torneo" |
| B-11 | Con `allowEdit` en un partido no jugado, el ganador no avanza y el torneo cierra sin campeón | Media | `PATCH /api/encuentros/:id/resultado {"allowEdit":true}`; `PATCH /:id/finalizar` | `encuentroService.js:79,97-103` (se salta las validaciones de estado) y `:11,36` (no hay rama de avance para este caso); `torneoService.js:220-225` (ignora los partidos con hueco y no exige campeón) | Torneo de 4 confirmado → `PATCH resultado {"marcador_1":2,"marcador_2":0,"allowEdit":true}` en un partido de la ronda 1 → registrar el otro partido de forma normal → registrar la final → finalizar | **[BD memoria]** 200 "Resultado actualizado", pero la final queda `4 v _`: registrarla da 409 y finalizar da 200 con campeón `null`. Con `allowEdit` también se registran resultados en partidos `pendiente` de un bracket sin confirmar (200). Solo se alcanza por API: la UI envía `allowEdit` únicamente en partidos ya finalizados | `allowEdit` solo vale para partidos finalizados; en otro caso, 409. Finalizar exige que la final tenga ganador |
| B-12 | Se registran y editan resultados en torneos cancelados o finalizados | Media | Bracket → "Editar resultado"; `PATCH /api/encuentros/:id/resultado` y `/cancha` | `encuentroService.js:82-107,166-177` (no consultan `torneos.estado`); `MatchEditPanel.jsx:264-289` (los botones dependen de `readOnly`, no del estado del torneo) | Torneo Finalizado → clic en la final → Editar resultado → invertir el marcador → Actualizar | **[BD memoria]** 200, y el campeón cambia después de finalizado el torneo. En un torneo Cancelado, registrar un resultado también da 200 | 409 si el torneo no está En_curso, y ocultar la edición en torneos cerrados. Alternativa: un flujo explícito de corrección, auditado |
| B-13 | Mensajes y códigos de error engañosos | Media | `POST`/`PUT /api/torneos`; `POST /:id/inscribir`; `GET /:id/participantes` | `torneosController.js:26-31` (el error 23514 devuelve el mensaje de fechas y el 23503 devuelve "La disciplina no existe") y `:34-37`; `participanteService.js:122-123`; `participanteService.js:18-59` (nunca responde 404) | `POST /api/torneos {"nombre":"A","disciplina_id":1,"tipo_torneo":"Mixto"}`; repetir con `"categoria_id":999` | **[BD memoria]** Un tipo inválido responde 400 "La fecha de fin no puede ser menor que la fecha de inicio". Una categoría inexistente responde 400 "La disciplina no existe", también en PUT. Inscribir sin categoría responde "La categoría no existe". Inscribir en un torneo inexistente responde 400 "Referencia no encontrada". **[API local]** Los participantes de un torneo inexistente devuelven 200 con una lista vacía | Validar `tipo_torneo` (Individual/Equipos) y la categoría con mensajes propios ("categoria_id es requerido", "La categoría no existe"), y responder 404 "Torneo no encontrado" |
| B-14 | En la inscripción por staff, la categoría no se precarga ni se valida | Media | Inscritos → Inscribir (`InscribirModal`); `POST /:id/inscribir` | `InscribirModal.jsx:10,18,169-194`; `participanteService.js:122-128` | En un torneo de categoría "Adulto": Inscribir dejando "Sin categoría"; repetir eligiendo "Juvenil" | Sin elegir categoría responde 400 "La categoría no existe"; con otra categoría responde 201 **[BD memoria]**. **[Neon-lectura]** El torneo 41 (Adulto) tiene 4 participantes Juvenil, el 44 (Open) tiene un Máster y el 43 mezcla Juvenil y Libre | La categoría del torneo se precarga y queda fija (o se valida que sea compatible), y el campo es obligatorio |
| B-15 | Un socio se inscribe como individuo en un torneo por equipos | Media | Socio → Torneos → Inscribirse; `POST /:id/inscribir-me` | `participanteService.js:159-197` (no lee `tipo_torneo`); `socio/Torneos.jsx:133,266-271` | Torneo Abierto con modalidad Equipos y categoría (en Neon: "Copa talacha cara", id 44) → como socio, Inscribirse → Confirmar | **[BD memoria]** 201: el torneo queda mezclando equipos (`nombre_externo`) con socios individuales. El modal del staff, en cambio, sí exige nombre de equipo (`InscribirModal.jsx:6-7,19`) | 409 "Este torneo es por equipos", y ocultar el botón |
| B-16 | Los cruces dependen del orden de captura, no del dibujo | Media | Bracket (`BracketVisual`); `PATCH /api/encuentros/:id/resultado`; cierre con byes | `encuentroService.js:36-62` (usa el primer hueco libre por `encuentro_id`); `bracketService.js:98-121`; `BracketVisual.jsx:84-101` (dibuja R1[i] → R2[⌊i/2⌋]) | Torneo de 8 → confirmar → capturar los resultados de la ronda 1 en el orden 4.º, 1.º, 3.º, 2.º | **[BD memoria]** Las semifinales reales quedan `(3 v 5)` y `(6 v 8)`, pero el dibujo une `(5 v 8)` y `(6 v 3)`. Con 5 inscritos, el ganador del único partido real (R1[0]) cae en R2[1] aunque la línea lo une con R2[0], y los dos primeros byes se enfrentan entre sí | Al generar el bracket, fijar el partido y la posición de destino de cada ganador (por ejemplo, `siguiente_encuentro_id` + slot) y usar eso tanto para avanzar como para dibujar |
| B-17 | El esquema no se reproduce desde las migraciones: el bracket da 500 en una BD nueva | Media | `GET /api/torneos/:id/bracket`; `npm run migrate` | `bracketService.js:162,169,178` (lee `e.ganador` y `e.participante_1/2`); `migrations/Crear_encuentros_torneo.sql:1-13` (no crea esas columnas); `migrations/schema.sql` (no crea `encuentros_torneo`); `backend/src/config/migrate.js:37-39` (orden alfabético); `Ajustar_torneos_estado_check.sql:2-3` | Con una BD vacía, ejecutar `npm run migrate`. O bien aplicar `schema.sql` y las 4 migraciones de torneos → crear un torneo con 4 inscritos, cerrar inscripciones y abrir el bracket | **[BD memoria]** `migrate` se detiene en el primer archivo (`42P01 relation "espacios" does not exist`). En orden lógico, `GET /bracket` responde 500 (`42703 column e.ganador does not exist`). **[Neon-lectura]** Neon tampoco coincide con las migraciones: `estado` tiene DEFAULT 'Abierto', hay una columna con errata `gandor_id` con su propia FK, las FKs de `participante_1/2_id` están duplicadas y el CHECK de fechas también. No afecta a Neon hoy, pero rompe cualquier entorno nuevo | Una migración consolidada que refleje el esquema real (o quitar la dependencia de las columnas heredadas) y un orden de ejecución explícito |
| B-18 | Carrera entre la inscripción y "Cerrar inscripciones" | Media | `POST /:id/inscribir-me`, `POST /:id/inscribir`, `DELETE /:id/participantes/:pid` | `participanteService.js:170-194,205-214` (leen el estado y luego escriben sin transacción ni `FOR UPDATE`); `bracketService.js:31-41` | Un socio confirma su inscripción en el mismo instante en que el coordinador cierra inscripciones | **[Código]** Si el INSERT llega después de que el cierre leyó la lista de participantes, el socio queda inscrito pero fuera del bracket. No se reprodujo porque requiere concurrencia real | Inscribir y desinscribir dentro de una transacción con `SELECT … FROM torneos … FOR UPDATE` |
| B-19 | Un equipo o participante externo se puede inscribir dos veces | Media | Inscritos → Inscribir → Externo/Equipo; `POST /:id/inscribir` | `participanteService.js:130-140` (solo controla duplicados de socio y de visita); no hay índice único para `nombre_externo` | Inscribir "Águilas FC" y después " Águilas FC " | **[BD memoria]** 201 en ambos casos | 409 "Este participante ya está inscrito", comparando el nombre normalizado (sin espacios en los extremos y en minúsculas) dentro del torneo |
| B-20 | No se puede asignar cancha a un partido programado | Media | Bracket → partido programado (`MatchEditPanel`) | `MatchEditPanel.jsx:29,340` (el botón "Guardar cancha" exige `!showInputs`) | Elegir un partido programado → seleccionar una cancha | **[Código]** No aparece "Guardar cancha": la cancha solo se guarda junto con el resultado. El botón sí aparece en partidos pendientes o ya finalizados | Poder guardar la cancha antes de que se juegue el partido |
| B-21 | Datos heredados inconsistentes en Neon | Media | Torneos 2 y 33, y participantes de los torneos 1, 2 y 3 | Datos **[Neon-lectura]**; las consultas están en el Anexo D | Consultar `encuentros_torneo` y `participantes_torneo` de esos torneos | **Torneo 33** (Finalizado): el participante 150 jugó y ganó la final `#72` aunque perdió la semifinal `#71` ante el 145 (6-1). El campeón que se muestra es un eliminado. Sin auditoría no se puede saber la causa; el dato es compatible con B-01. **Torneo 2**: los encuentros heredados `#8` y `#9` (solo nombres en texto) están mezclados con el bracket nuevo `#88`–`#90`. **Participantes**: 16 no tienen `categoria_id` y su categoría solo está en la columna heredada `categoria`, así que aparecen vacíos en Inscritos y en "Mis participaciones" | Decidir la corrección de cada caso y aplicarla con un script revisado, probándolo antes en una copia o branch |
| B-22 | La pestaña Torneos de admin/gerente hace 4 peticiones que descarta | Baja | Dashboard admin/gerente → Torneos | `frontend/src/pages/dashboards/admin/GestionTorneos.jsx:547-567` (`fetchAll` pide `/torneos`, `/disciplinas`, `/torneos/categorias` y `/socios`), `:642` (espera a esas 4 antes de pintar) y `:646-651` (solo monta `TournamentBracket`, que vuelve a pedirlas) | Abrir la pestaña Torneos como admin | **[Código + ESLint]** Al entrar se hacen 9 peticiones y se descartan 4, entre ellas la lista completa de socios con CURP, teléfono y dirección. La pantalla real espera a que terminen, y si una falla aparece un toast de error. Hay unas 520 líneas de UI muerta y 18 errores `no-unused-vars` de ESLint | Que `GestionTorneos` solo monte `TournamentBracket`, o que reutilice `ResultadosTorneo` (ver F-03) |
| B-23 | Etiquetas de estado sin formato y "Cancelado" incompleto | Baja | Lista y detalle de torneos, filtro Estado, modal Editar | `frontend/src/components/torneos/torneoUtils.js:3-8` (no incluye Cancelado); `frontend/src/components/torneos/TournamentRow.jsx:4-10,35`; `frontend/src/components/torneos/DetalleTorneo.jsx:7-12,52`; `TournamentBracket.jsx:778-795` | Ver un torneo "Inscripciones_cerradas" o "Cancelado"; filtrar por estado; editar un torneo cancelado | Se muestran "Inscripciones_cerradas" y "En_curso" tal cual. Cancelado no tiene color ni opción en el filtro. Al editar un torneo cancelado, el select aparenta "Abierto" aunque el valor real sigue siendo Cancelado | Etiquetas legibles, y color y opción para Cancelado |
| B-24 | Un mensaje persiste entre torneos y "Cancelar" usa el confirm nativo | Baja | Panel "Gestión del torneo" (`AccionesTorneo`) | `frontend/src/components/torneos/AccionesTorneo.jsx:9,25,160`; `TournamentBracket.jsx:497` (sin `key` por torneo) | Cerrar inscripciones de un torneo y seleccionar otro; pulsar "Cancelar torneo" | El mensaje "Inscripciones cerradas y bracket generado" sigue visible en el otro torneo. Cancelar usa `window.confirm`, mientras las demás acciones usan el modal `showConfirm` | Usar `key={torneo_id}` (o limpiar el mensaje) y `showConfirm` con estilo de peligro |
| B-25 | Errores ocultos y sesión vencida mal manejada en las llamadas con `fetch` directo | Baja | Modal Inscritos, acciones y panel del partido; vista del socio | `TournamentBracket.jsx:247-262` (no revisa `res.ok`), `:228-237` y `:281-290`; `AccionesTorneo.jsx:16-20`; `MatchEditPanel.jsx:52-57,77-82`; `socio/Torneos.jsx:42-52,54-63` | Con el backend caído o el token vencido, abrir "Inscritos" o entrar a Torneos como socio | Se muestra "No hay participantes inscritos aún" o "No hay torneos abiertos" en lugar de un error. Con el token vencido no se redirige al login (`apiRequest` sí lo hace) y la acción muestra "Token inválido o expirado" | Usar `apiRequest` en todo el módulo y mostrar un estado de error |
| B-26 | Los byes confunden en la UI | Baja | Bracket → partido bye | `MatchEditPanel.jsx:29-31,266-289,307`; `BracketVisual.jsx:207` | Torneo con 5 inscritos → cerrar inscripciones → clic en un bye | Aparece "Editar resultado", pero no hay botón para guardar. El bye se dibuja como un partido con marcador "- — -" y rival "Por definir" | Rotularlo "Pase directo (bye)" y no ofrecer edición |
| B-27 | `Torneos.css` es global y pisa estilos de otras páginas del socio | Baja | Páginas del socio (Sanciones, Clases, Ludoteca) | `frontend/src/components/SocioLayout.jsx:10-15` (importa todos los CSS del socio de forma global); `frontend/css/socio/Torneos.css` (`.empty-state`, `.info-item`, `.clases-tab-btn`, `.filtros-container`, `.loading-state`); `socio/Torneos.jsx:10` | Comparar el estado vacío de Sanciones y las pestañas de Clases y Ludoteca | **[Código]** Las mismas clases tienen valores distintos en `Sanciones.css`, `Torneos.css` y `Clases.css`, y gana el último import. Por ejemplo, el ícono de `.empty-state` en Sanciones toma el color de Torneos y las pestañas de Clases heredan `flex:1`. El impacto visual está por verificar | Prefijar las clases del módulo (`.torneos-*`) o usar CSS Modules |

---

## 3. Faltantes

| ID | Título | Gravedad | Dónde debería estar | Por qué hace falta |
|---|---|---|---|---|
| F-01 | Eliminar torneo | Media | `DELETE /api/torneos/:id` (solo staff) en `torneos.routes.js` y `torneoService.js`, y un botón en `TournamentBracket` | El ciclo de vida incluye "eliminar", y hoy `DELETE /api/torneos/:id` responde 404 "Ruta no encontrada" **[BD memoria]**. Las FKs de `participantes_torneo` y `encuentros_torneo` no tienen `ON DELETE`, así que falta definir la regla: permitirlo solo sin inscritos ni encuentros, borrar en cascada dentro de una transacción o hacer un borrado lógico. Hoy no hay ningún comportamiento para "eliminar un torneo con participantes" |
| F-02 | Cupo máximo de participantes | Media | Columna `torneos.cupo_maximo` (migración), validación en `inscribirParticipante` e `inscribirSocioPropio` (con bloqueo), campo en el formulario e indicador "X/Y inscritos" en la tarjeta del socio | Hoy no hay tope: se inscribe sin límite y la regla de negocio no existe. El CSS del socio ya tiene la barra de cupo diseñada (`.torneo-participantes`, `.participantes-barra`, `.participantes-fill`), pero nada la usa |
| F-03 | Reporte y resultados en la UI | Media | `TournamentBracket` (staff y socio) | `GET /api/torneos/:id/reporte` funciona (**[API local]**, torneo 33), pero ninguna pantalla en uso lo llama. El componente `ResultadosTorneo` (`GestionTorneos.jsx:378-529`, con campeón, ruta del campeón e historial) quedó sin montar desde el commit `ee2358a` y se puede reutilizar |
| F-04 | Auditoría de las acciones de torneos | Media | `torneosController.js` y `encuentrosController.js`, llamando a `logAudit` (tabla `logs_sistema`) como ya hacen reservas, socios o espacios | Hoy no se registra ninguna acción de torneos (0 filas en `logs_sistema`). Sin esto no se puede saber quién creó, cerró, canceló o editó un resultado (ver el caso del torneo 33 en B-21) |
| F-05 | Arbitraje desde el panel del instructor | Media | `frontend/src/pages/dashboards/DashboardInstructor.jsx:316-320` (hoy monta `TournamentBracket` con `readOnly`) | El backend permite que el instructor registre resultados (`encuentros.routes.js:13`, `encuentroService.js:5`) y SCRUM-107 lo definía como "panel de arbitraje", pero desde el commit `cbcfccb` su vista es de solo lectura. Hay que elegir entre un modo árbitro (solo marcadores) o quitar el rol en el backend. Es una decisión de producto |
| F-06 | Pruebas de reglas de negocio y de permisos | Media | `backend/src/tests`, con pruebas contra una BD real de pruebas (por ejemplo, PGlite o un Postgres local) | Los tests actuales simulan la BD y `checkRole`, y fijan los defectos (ver el Anexo B). E1 necesita pruebas que hoy fallen (estados, permisos, cascada de resultados) y actualizar a propósito los snapshots afectados. Esto pesa en la estimación PERT de E1 |
| F-07 | Validar las fechas de inscripción | Media | `inscribirParticipante`, `inscribirSocioPropio`, la lista "Torneos disponibles" del socio y la creación de torneos | Se puede inscribir en torneos que ya empezaron y crear torneos con fecha pasada. **[Neon-lectura]** 6 de los 7 torneos Abiertos tienen `fecha_inicio` vencida (8, 35, 36, 37, 39 y 40) y el socio los ve como disponibles |
| F-08 | Administrar las categorías de torneo | Baja | CRUD en `/api/torneos/categorias` (hoy solo existe GET) y una pantalla de admin | Las categorías solo se pueden crear por SQL. En Neon, "Libre" está duplicada (ids 3 y 5) y hay categorías de prueba ("Categoria Test Bracket", "Demo Finalizado") que ve todo el mundo |
| F-09 | Programar la fecha y la hora de cada encuentro | Baja | Un endpoint para `hora_programada` y un campo en `MatchEditPanel` | La columna existe y tanto la UI (`MatchEditPanel.jsx:132-137`) como el reporte la muestran, pero no hay forma de asignarla. Al implementarlo hay que considerar que la columna es `TIMESTAMP` sin zona horaria |
| F-10 | Inscribir visitas desde la UI | Baja | `InscribirModal`, que hoy solo ofrece Socio o Externo | El backend ya acepta `visita_id` y valida que la visita esté vigente (`participanteService.js:116-120`), pero la UI no ofrece la opción |

---

## 4. Posibles solicitudes de cambio (SC)

Son funcionalidades nuevas que no forman parte del ciclo de vida pedido. Conviene tratarlas como SC antes de estimarlas.

| ID | Propuesta | Por qué parece fuera del alcance |
|---|---|---|
| SC-01 | Gestión de equipos (miembros y capitán) para los torneos por Equipos | Las tablas `equipos` y `miembros_equipo` existen, pero la app no las usa: hoy un "equipo" es solo un nombre |
| SC-02 | Bloquear la inscripción de socios con una sanción activa | Reservas ya lo hace (`backend/src/services/reservaService.js:172-175`), pero para torneos nunca se definió como regla |
| SC-03 | Que el socio pueda darse de baja él mismo | Hoy solo el staff puede desinscribir; el socio recibe 403 |
| SC-04 | Resultado o posición final de cada participante, e historial del socio | `participantes_torneo.resultado_final` nunca se llena, y "Mis participaciones" solo muestra el estado del torneo |
| SC-05 | Notificaciones de cierre de inscripciones, próximo partido y resultado | No existe infraestructura de notificaciones para torneos |
| SC-06 | Exportar el reporte del torneo a PDF o Excel | El módulo de reportes ya tiene exportadores, pero ninguno es de torneos |
| SC-07 | Costo de inscripción, premio y nivel del torneo | Solo existe el CSS (`.torneo-costo`, `.torneo-premio`, `.nivel-badge`); no hay datos ni backend |
| SC-08 | Cabezas de serie o sorteo manual, y otros formatos (round robin, grupos) | Hoy solo existe la eliminación directa con sorteo aleatorio |
| SC-09 | Validar la categoría contra la edad o el género del socio | No hay reglas definidas por categoría |

---

## 5. Por verificar en local

1. **Escenarios reproducidos solo en BD memoria.** Hay que confirmarlos en una BD local o en un branch de pruebas, nunca en producción: B-01, B-02, B-03, B-04, B-05, B-07, B-08, B-11, B-12, B-13, B-14, B-15, B-16, B-19 y F-01. Los pasos de cada fila sirven tal cual.
2. **B-18 (carrera entre inscripción y cierre).** Requiere dos sesiones al mismo tiempo.
3. **B-06.** El script que desbloquee los torneos 1 y 42 debe probarse primero en una copia o un branch de Neon.
4. **B-21.** Averiguar la causa del dato del torneo 33 (no hay auditoría): confirmar con el equipo si alguien lo editó a mano o mediante `PUT /api/encuentros`.
5. **UI y consola del navegador.** En esta sesión no se abrió un navegador. Hay que confirmar visualmente B-20, B-22, B-23, B-24, B-26 y B-27, y revisar los warnings de la consola. ESLint reporta 25 errores y 4 avisos en los archivos del módulo, la mayoría `no-unused-vars` y `react-hooks/*`; ninguno rompe `vite build`.
6. **B-15 en Neon.** El torneo 44 "Copa talacha cara" (Equipos, Abierto y con categoría) permite hoy que un socio se inscriba como individuo. No se ejecutó.
7. **32 socios activos sin usuario.** No aparecen en el selector de inscripción del staff porque `GET /api/socios` hace un JOIN con `usuarios` (`backend/src/services/socioService.js:72-73`). Confirmar si deberían poder participar.
8. **Torneos con fechas pasadas.** Los torneos 1, 3, 41, 42 y 43 están En_curso con fechas de abril a junio de 2026. Confirmar si son datos de prueba antes de priorizar B-06.

---

## 6. Checklist para ClickUp

```text
[BUG][ALTA] PUT /api/encuentros/:id sin autenticación — PUT /api/encuentros/:id — sin token enviar {participante_1_id, participante_2_id} a un encuentro pendiente → 200 y cambia el cuadro
[BUG][ALTA] Estado del torneo sin control de transiciones — Editar torneo / PATCH confirmar-bracket y finalizar — poner "Abierto" a un Finalizado o confirmar un Abierto sin inscritos → 200
[BUG][ALTA] Reabrir y volver a cerrar duplica el bracket — PATCH cerrar-inscripciones — cerrar, Estado=Abierto, inscribir y cerrar de nuevo → 10 encuentros; desinscribir → 500
[BUG][ALTA] El staff inscribe en torneos no abiertos — POST /api/torneos/:id/inscribir — inscribir en En_curso/Cancelado/Finalizado → 201 y queda fuera del bracket
[BUG][ALTA] Editar un resultado corrompe la ronda siguiente — Bracket "Editar resultado" — editar la ronda 1 después de jugar la final → el ganador de la final no jugó la final
[BUG][ALTA] Torneos 1 y 42 bloqueados por byes antiguos — Bracket de los torneos 1 y 42 — byes "programado" sin rival; la ronda 2 nunca se activa → script de datos
[BUG][ALTA] Recepción e instructores pueden cambiar el campeón — PUT /api/instructor/torneos/encuentro/:id — {ganador:"texto"} como recepción → BracketVisual muestra "texto"
[BUG][ALTA] Textos largos provocan 500 — Crear/Editar torneo, Inscribir, cancha — nombre de 151 caracteres → 500
[BUG][ALTA] Body ausente o ids fuera de rango provocan 500 — 7 endpoints de torneos/encuentros — POST /api/torneos sin body o GET /api/torneos/99999999999/bracket → 500
[BUG][ALTA] Auto-inscripción imposible en torneos sin categoría — Socio > Torneos — "Inscribirse" en los torneos 8/35/36/39/40 → Confirmar deshabilitado / 400
[BUG][MEDIA] Con allowEdit en un partido no jugado no avanza y el torneo cierra sin campeón — PATCH /api/encuentros/:id/resultado — allowEdit:true en la ronda 1 → final con hueco → finalizar 200
[BUG][MEDIA] Resultados en torneos cancelados o finalizados — Bracket "Editar resultado" — editar la final de un torneo Finalizado → 200 y cambia el campeón
[BUG][MEDIA] Mensajes de error engañosos — POST/PUT /api/torneos, inscribir — tipo_torneo="Mixto" → "fecha de fin…"; categoria_id=999 → "La disciplina no existe"
[BUG][MEDIA] Inscripción por staff: la categoría no se precarga ni se valida — Inscritos > Inscribir — sin categoría → 400 "La categoría no existe"; con otra categoría → 201
[BUG][MEDIA] Un socio se inscribe como individuo en un torneo por Equipos — Socio > Torneos — Inscribirse en un torneo de Equipos → 201
[BUG][MEDIA] Los cruces dependen del orden de captura, no del dibujo — Bracket — capturar la ronda 1 en orden 4,1,3,2 → semifinales distintas a las dibujadas
[BUG][MEDIA] El esquema no se reproduce desde las migraciones — GET /bracket, npm run migrate — en una BD nueva el bracket da 500 (column e.ganador) y migrate falla en el primer archivo
[BUG][MEDIA] Carrera entre la inscripción y el cierre — inscribir-me / inscribir / desinscribir — inscribirse mientras se cierran inscripciones → inscrito fuera del bracket
[BUG][MEDIA] Externo o equipo inscrito dos veces — Inscritos > Inscribir — "Águilas FC" dos veces → 201 y 201
[BUG][MEDIA] No se puede asignar cancha a un partido programado — Bracket > partido — elegir cancha en un programado → no aparece "Guardar cancha"
[BUG][MEDIA] Datos heredados inconsistentes en Neon — torneos 2 y 33, participantes de los torneos 1 a 3 — el campeón del 33 perdió la semifinal; el 2 tiene dos brackets; 16 participantes sin categoria_id
[BUG][BAJA] La pestaña Torneos de admin/gerente hace 4 peticiones que descarta — Dashboard admin/gerente > Torneos — al abrir la pestaña hace 9 peticiones y espera a 4 inútiles
[BUG][BAJA] Etiquetas de estado sin formato y Cancelado incompleto — lista, detalle y filtro de torneos — se ve "Inscripciones_cerradas" y no se puede filtrar por Cancelado
[BUG][BAJA] Un mensaje persiste entre torneos y Cancelar usa el confirm nativo — Gestión del torneo — cerrar inscripciones y cambiar de torneo; Cancelar usa window.confirm
[BUG][BAJA] Errores ocultos y sesión vencida mal manejada — Inscritos / acciones / socio — con el backend caído se ve "No hay participantes"; con el token vencido no redirige
[BUG][BAJA] Los byes confunden en la UI — Bracket > bye — "Editar resultado" sin botón para guardar; marcador "- — -"
[BUG][BAJA] Torneos.css global pisa estilos del socio — SocioLayout — .empty-state y .clases-tab-btn redefinidos en 3 archivos CSS
[FALTANTE][MEDIA] Eliminar torneo — DELETE /api/torneos/:id + botón — hoy responde 404; definir la regla cuando hay participantes
[FALTANTE][MEDIA] Cupo máximo de participantes — torneos.cupo_maximo + validación + UI — hoy no hay tope
[FALTANTE][MEDIA] Reporte y resultados en la UI — TournamentBracket — reutilizar ResultadosTorneo con GET /reporte
[FALTANTE][MEDIA] Auditoría de las acciones de torneos — controladores con logAudit — hoy hay 0 registros
[FALTANTE][MEDIA] Arbitraje desde el panel del instructor — DashboardInstructor — decidir entre modo árbitro o quitar el rol en el backend
[FALTANTE][MEDIA] Pruebas de reglas y permisos — backend/src/tests — tests con BD real; actualizar los snapshots que fijan bugs
[FALTANTE][MEDIA] Validar las fechas de inscripción — inscribir / inscribir-me + vista del socio — 6 de los 7 torneos abiertos ya empezaron
[FALTANTE][BAJA] Administrar las categorías de torneo — /api/torneos/categorias + pantalla — hoy solo existe GET; "Libre" está duplicada
[FALTANTE][BAJA] Programar la fecha y hora de los encuentros — endpoint + MatchEditPanel — hora_programada no se puede asignar
[FALTANTE][BAJA] Inscribir visitas desde la UI — InscribirModal — el backend ya acepta visita_id
[SC] Gestión de equipos (miembros y capitán) para torneos por Equipos
[SC] Bloquear la inscripción de socios con sanción activa (como en reservas)
[SC] Baja voluntaria del socio de un torneo
[SC] Resultado o posición final del participante e historial del socio
[SC] Notificaciones de torneo (cierre, próximo partido, resultado)
[SC] Exportar el reporte del torneo a PDF o Excel
[SC] Costo de inscripción, premio y nivel del torneo
[SC] Cabezas de serie, sorteo manual y otros formatos (round robin, grupos)
[SC] Validar la categoría contra la edad o el género del socio
```

---

## Anexo A — Agrupación sugerida para E1

Varios bugs comparten la misma causa raíz. Agruparlos así ayuda a estimar.

| Paquete | Bugs | Comentario |
|---|---|---|
| 1. Seguridad | B-01, B-07 | Agregar `verifyToken`/`checkRole` o eliminar los dos endpoints, que no tienen consumidor. Es un cambio pequeño |
| 2. Máquina de estados | B-02, B-03, B-04, B-11, B-12, B-18 | Una función de transiciones válidas, verificación del estado con `FOR UPDATE` al inscribir, desinscribir y registrar resultados, y un CHECK en la BD |
| 3. Validación y mensajes | B-08, B-09, B-13, B-19 | Casi todo vive en `torneoValidators.js` y en el mapeo de errores del controlador, más `maxLength` en la UI |
| 4. Bracket | B-05, B-16, B-26 | Relación explícita con el "encuentro destino" y edición con cascada o bloqueo |
| 5. Categorías e inscripción | B-10, B-14, B-15 | Categoría obligatoria y fija por torneo, y `tipo_torneo` validado en `inscribir-me` |
| 6. Datos y esquema | B-06, B-17, B-21 | Scripts de datos y una migración consolidada, probados en un branch de Neon |
| 7. UX del frontend | B-20, B-22, B-23, B-24, B-25, B-27 | Cambios locales en los componentes |

## Anexo B — Tests

**Ejecución:**

- `npx jest src/tests/torneos.characterization.test.js src/tests/encuentros.characterization.test.js` → **84/84** (62 + 22) y 42 snapshots.
- `npx jest` (la suite completa) → **496 pasan / 3 fallan** y 241 snapshots. Los fallos son preexistentes y no tocan torneos: `accesoMetricas.test.js` (2, roles recepcion y socio) y `asistenciaQr.test.js` (1, socio no inscrito).

**Qué no cubren y qué fijan:**

- `checkRole` está simulado para dejar pasar siempre y la BD también está simulada. No hay ninguna prueba de permisos ni de las restricciones reales de la BD.
- Estos casos fijan comportamientos que E1 debe cambiar. Habrá que actualizar a propósito sus asserts y snapshots:
  - `torneos.characterization.test.js`:
    - "sin body → errorHandler global" en POST, PUT e inscribir (B-09).
    - "confirma (cualquier estado distinto de En_curso)" (B-02).
    - POST con `estado: 'Cerrado'` → 201 (B-02).
    - "categoria_id no entero se guarda como null sin error".
    - PUT con `disciplina_id: ''` pasa la validación.
  - `encuentros.characterization.test.js`:
    - "PUT /api/encuentros/:id (sin verifyToken)" → 200 (B-01).
    - "edición: … sin ganador previo", que acepta `allowEdit` sobre un partido pendiente (B-11).
    - "sin body → errorHandler" en resultado, cancha y PUT (B-09).

## Anexo C — Código muerto y endpoints sin consumidor (punto 8)

**Backend sin consumidor en el frontend:**

- `PUT /api/encuentros/:encuentro_id` (B-01).
- `GET /api/torneos/:id/reporte`: solo lo usa código muerto (F-03).
- `GET /api/instructor/torneos`, `GET /api/instructor/torneos/:id/encuentros` y `PUT /api/instructor/torneos/encuentro/:id` (B-07).

**Frontend sin uso:**

- En `frontend/src/services/api.js:209-241`:
  - `adminApi.getTorneos`, `saveTorneo`, `getCategoriasTorneo`, `getTorneoParticipantes`, `inscribirParticipante`, `desinscribirParticipante`, `cerrarInscripcionesTorneo`, `cancelarTorneo` y `getTorneoReporte` solo se llaman desde código muerto.
  - `adminApi.finalizarTorneo`, `confirmarBracketTorneo` y `registrarResultadoEncuentro` no se usan en ningún sitio.
- `GestionTorneos.jsx:12-644`: `EstadoBadge`, `TorneoModal`, `InscribirModal`, `ParticipantesPanel`, `ResultadosTorneo`, `rondaLabel`/`RONDA_LABELS` y todo el estado y los handlers del componente.
- `torneoUtils.getParticipantName` (`torneoUtils.js:67-83`): 10 de sus 11 alternativas buscan campos que el backend nunca envía.
- `frontend/css/socio/Torneos.css`: `.nivel-badge*`, `.torneo-participantes`, `.participantes-barra`, `.participantes-fill`, `.torneo-premio`, `.torneo-costo`, `.torneo-desc`, `.resultados-view` y `.resultados-info` no se usan.

**BD sin uso por la app:**

- En `encuentros_torneo`:
  - `participante_1` y `participante_2` son columnas heredadas que la app solo lee como respaldo (B-17).
  - `ganador` solo la escribe el endpoint heredado (B-07).
  - `arbitro`, `gandor_id` (errata) y `equipo_id` no se usan.
- En `participantes_torneo`, `categoria` es heredada y `resultado_final` nunca se escribe.
- Las tablas `equipos` y `miembros_equipo` no se usan.

**Frontend que llama a algo inexistente:** no hay ningún caso.

## Anexo D — Esquema real de Neon (torneos) frente a las migraciones

- **Columnas de `encuentros_torneo` en Neon:** `encuentro_id`, `torneo_id`, `participante_1`, `participante_2`, `ronda`, `ganador`, `cancha_asignada`, `hora_programada`, `arbitro`, `gandor_id`, `participante_1_id`, `participante_2_id`, `estado`, `marcador_1`, `equipo_id`, `ganador_id` y `marcador_2`. La migración solo crea 11 de ellas.
- **`torneos`:**
  - `estado` es `VARCHAR(30)` con DEFAULT 'Abierto' en Neon; la migración no le pone default ni CHECK.
  - El CHECK de `tipo_torneo` sí existe.
  - El CHECK de fechas está duplicado (`torneos_check` y `torneos_fecha_fin_check`).
- **`participantes_torneo`:**
  - Los CHECK de tipo de participante y de `categoria_id NOT NULL` existen como `NOT VALID`.
  - Los índices únicos por socio y por visita sí existen.
  - `torneo_id` admite NULL, aunque `schema.sql` lo declara `NOT NULL`.
- **FKs:** ninguna tiene `ON DELETE`. `participante_1_id` y `participante_2_id` tienen la FK duplicada (`*_fk NOT VALID` y `*_fkey`), y `gandor_id` tiene su propia FK validada.
- **Datos:**
  - 16 torneos: 7 Abierto, 5 En_curso, 2 Finalizado y 2 Cancelado.
  - 10 torneos sin categoría.
  - 44 encuentros: 13 finalizado, 14 pendiente y 17 programado.
  - Hay 0 filas de torneos en `logs_sistema`.

**Consultas usadas para los datos inconsistentes:**

```sql
-- Jugador en la ronda N que no ganó en la ronda N-1 (devuelve torneo 33, encuentro 72, participante 150)
SELECT e.torneo_id, e.encuentro_id, e.ronda, x.pid
FROM encuentros_torneo e
CROSS JOIN LATERAL (VALUES (e.participante_1_id), (e.participante_2_id)) AS x(pid)
WHERE e.ronda > 1 AND x.pid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM encuentros_torneo prev
                  WHERE prev.torneo_id = e.torneo_id AND prev.ronda = e.ronda - 1 AND prev.ganador_id = x.pid);

-- Encuentros por torneo y ronda, con huecos (muestra los byes 'programado' de los torneos 1 y 42)
SELECT torneo_id, ronda, estado, COUNT(*) AS n,
       SUM(CASE WHEN participante_1_id IS NULL OR participante_2_id IS NULL THEN 1 ELSE 0 END) AS con_hueco
FROM encuentros_torneo GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
```

## Anexo E — Método

1. **Lectura completa** del código del módulo y de su historial en git (`ee2358a`, `cbcfccb`, `523b71c`, `1ec8033`).
2. **Neon en solo lectura.** Las consultas corrieron dentro de `BEGIN READ ONLY … ROLLBACK`, con un filtro adicional que descarta cualquier sentencia de escritura.
3. **Backend local** en el puerto 3999 contra Neon.
   - Los JWT se firmaron localmente con el `JWT_SECRET` del `.env`. No se usó `/api/auth/login`, porque escribe en `logs_sistema`.
   - Solo se enviaron GETs y peticiones que se rechazan antes de llegar a la BD.
   - El log del servidor solo contiene las peticiones de las sondas, y los conteos de Neon quedaron iguales.
4. **Flujos de escritura** con las rutas reales del backend (validadores → controladores → servicios) sobre PostgreSQL en memoria (PGlite 0.2.17), con el esquema de Neon. También se probó una BD construida solo con `backend/migrations`.
5. **Frontend:**
   - ESLint en los archivos del módulo.
   - `vite build` con la salida en una carpeta temporal, sin tocar `frontend/dist`.
   - No se abrió un navegador.

Los scripts y sus salidas quedaron fuera del repositorio, en la carpeta temporal de la sesión (`%LOCALAPPDATA%\Temp\claude\…\scratchpad\scripts`): `ro-query.js`, `probe-api.js`, `sim-harness.js`, `sim-escenarios.js`, `sim-migraciones.js` y `sim-instructor.js`.
