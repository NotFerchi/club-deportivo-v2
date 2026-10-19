# Club Social y Deportivo V2 — reglas del proyecto

## Stack
React (frontend) · Node.js/Express (backend) · PostgreSQL en Neon.

## Reglas obligatorias (Plan de Calidad F8)
- Toda rama nace de `develop`. NUNCA tocar `main`.
- Prefijos de rama: feat/, fix/, refactor/, docs/, chore/, test/.
- Commits pequeños con formato: `feat(torneos): ...`, `docs: ...`, `refactor(kit): ...`.
- Credenciales SOLO en `.env` (nunca hardcodeadas). Usar el connection pool existente; no abrir conexiones sueltas.
- Entradas inválidas → error controlado 4xx con mensaje claro, NUNCA 500 ni caída del servidor.
- Operaciones delicadas en try/catch con log del error; transacción si se toca más de una tabla.
- Frontend: solo componentes del kit UI (Button, Input, Modal, Table). Prohibido CSS ad-hoc.
- Cualquier cambio de esquema en Neon: script SQL versionado en el repo y avisarme para hacer pg_dump ANTES de correrlo.

## Cómo trabajar conmigo
- Antes de programar, dime tu plan en pasos y espera mi OK.
- No hagas push ni abras PR: deja los commits locales para que yo los revise.
- Al terminar, explícame qué cambiaste, archivo por archivo, y cómo probarlo en Postman.