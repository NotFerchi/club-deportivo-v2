# Despliegue de la simulación: Render (backend) + Vercel (frontend)

Entorno de pruebas para el Director de Operaciones (U5-07). Backend en Render (plan gratuito), frontend en
Vercel (plan gratuito) y base en el branch de Neon `simulacion-u5`. **Ninguno de los dos servicios usa la
base de production.**

> Requisito: #47 (U5-05) y #48 (U5-06) fusionados en `develop`. Se despliega `develop`.

## Variables por servicio

### Render: `club-deportivo-api-simulacion` (definido en `render.yaml`)

| Variable | Tipo | Valor |
|---|---|---|
| `DATABASE_URL` | **Secreto** | URL del branch `simulacion-u5` (la misma que `SIMULACION_DATABASE_URL`) |
| `JWT_SECRET` | **Secreto** | Nuevo, distinto al de production (ver abajo cómo generarlo) |
| `QR_SECRET` | **Secreto** | Nuevo, distinto al de production |
| `CORS_ORIGIN` | Pública | URL de Vercel, p. ej. `https://club-simulacion.vercel.app` (sin `/` final; varias, separadas por comas) |
| `NODE_ENV` | Pública | `production` (ya en `render.yaml`) |
| `NODE_VERSION` | Pública | `24` (ya en `render.yaml`) |
| `CLUB_HORA_CIERRE` | Pública | `22:00` (ya en `render.yaml`) |
| `RESERVAS_DURACION_MINUTOS` | Pública | `60` (ya en `render.yaml`) |
| `RESERVAS_MAX_ACTIVAS_SOCIO` | Pública | `2` (ya en `render.yaml`) |
| `RESERVAS_MISMO_DIA` | Pública | `true` (ya en `render.yaml`) |
| `RESERVAS_PERMITIR_PASADAS` | Pública | `false` (ya en `render.yaml`) |

**No definir:**
- `NEON_DATABASE_URL`: `src/config/database.js` la usa antes que `DATABASE_URL`.
- `GMAIL_USER` y `GMAIL_APP_PASSWORD`: la simulación no manda correos.
- `PORT`: lo pone Render.

### Vercel: proyecto del frontend

| Variable | Tipo | Valor |
|---|---|---|
| `VITE_API_URL` | Pública | `https://<servicio>.onrender.com/api` |
| `VITE_FOTOS_DEMO_EMAILS` | Pública | vacía |

Las variables `VITE_*` quedan dentro del JavaScript publicado: **nunca** pongas un secreto ahí.

## Pasos

1. **Secretos nuevos.** En tu terminal (no los pegues en ningún chat ni en el repo), corre esto dos veces,
   una para `JWT_SECRET` y otra para `QR_SECRET`:
   ```sh
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. **Render.**
   - New → Blueprint → elige el repo: Render lee `render.yaml`.
   - Captura `DATABASE_URL`, `JWT_SECRET` y `QR_SECRET`.
   - Deja `CORS_ORIGIN` con un valor provisional (p. ej. `https://pendiente.invalid`); lo cambias en el paso 4.
   - Cuando termine, abre `https://<servicio>.onrender.com/api/health`: debe responder OK.
3. **Vercel.**
   - Add New → Project → el repo, con *Root Directory* `frontend` (framework Vite, build `npm run build`, salida `dist`).
   - Agrega `VITE_API_URL` y haz el deploy.
   - `frontend/vercel.json` ya redirige todas las rutas a `index.html`, así que recargar en `/dashboard-socio` no da 404.
4. **CORS.** En Render, cambia `CORS_ORIGIN` por la URL final de Vercel y redespliega (Manual Deploy).
5. **Base.** En la laptop, con `backend/.env.simulacion`:
   - migraciones pendientes (cuando #47 esté fusionado);
   - `node scripts/semillaSimulacion.js --simulacion --inicio=YYYY-MM-DD` (primero con `--ensayo`).
6. **Documentos.** `node scripts/generarDocsSimulacion.js --url-app=https://<app>.vercel.app --inicio=YYYY-MM-DD`
   regenera la hoja de acceso y la guía con la URL y la semana.
7. **Prueba de humo.** Entra con cada usuario de la hoja de acceso; las contraseñas las da U5-08.

## Notas

- `autoDeploy: false`: Render no redespliega solo a mitad de la semana. Para publicar un arreglo: Manual Deploy.
- Plan gratuito de Render: el servicio se duerme tras unos 15 minutos sin uso; la primera petición tarda
  hasta un minuto. Ya está avisado en la hoja de acceso.
- La región de Render es `ohio`, la misma de AWS que Neon (us-east-2), para que la base responda rápido.
- El backend acepta además, en el código, `localhost:3001`, `localhost:5173` y `https://club-snowy.vercel.app`
  (`backend/index.js`). No afecta a la simulación.
