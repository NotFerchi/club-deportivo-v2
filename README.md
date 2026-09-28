# Club Social y Deportivo V2

Versión 2 del sistema integral para la gestión del club social y deportivo. Este proyecto refactoriza y mejora la Versión 1, incluyendo gestión de usuarios, clases, reservas de espacios, ludoteca, control de accesos (QR) y reportes (Excel/PDF).

##  Stack Tecnológico
* **Frontend:** React (Vite)
* **Backend:** Node.js (Express)
* **Base de Datos:** PostgreSQL (Alojada en Neon)

##  Tecnologías y Librerías Clave
* **Seguridad y Auth:** `bcryptjs` (encriptación de contraseñas), JWT.
* **Interfaz (UI):** `lucide-react` (íconos), `react-calendar` (calendarios).
* **Utilidades (Backend):** 
  * `qrcode`: Generación de códigos QR para accesos.
  * `exceljs`: Importación y exportación masiva de usuarios en Excel.
  * `pdfkit`: Exportación de reportes y métricas en PDF.

---

##  Instalación y Ejecución Local

### Requisitos
* Node.js **24** (ver `.nvmrc`). Se recomienda usar [nvm-windows](https://github.com/coreybutler/nvm-windows) para manejar versiones.

### 1. Clonar el repositorio
```bash
git clone https://github.com/NotFerchi/club-deportivo-v2.git
cd club-deportivo-v2
```

### 2. Usar la versión de Node del proyecto
```bash
nvm install 24
nvm use 24
node -v   # debe coincidir con el contenido de .nvmrc
```

### 3. Configuración del Backend
```bash
cd backend
npm install
```

Copia `backend/.env.example` a `backend/.env` y completa los valores reales:
```powershell
Copy-Item .env.example .env
```

Pide las credenciales reales (`DATABASE_URL`, `JWT_SECRET`, `QR_SECRET`, `GMAIL_APP_PASSWORD`) al líder del equipo por un canal privado — **nunca** se suben al repositorio.

Inicia el servidor:
```bash
npm run dev
```

### 4. Configuración del Frontend
Abre **otra** terminal:
```bash
cd frontend
npm install
```

Copia `frontend/.env.example` a `frontend/.env`:
```powershell
Copy-Item .env.example .env
```

Inicia el cliente:
```bash
npm run dev
```
El frontend corre en `http://localhost:3001` y espera al backend en `http://localhost:3000`.

### Reglas del proyecto
* Ninguna credencial va en el código fuente: todo se lee con `process.env.*`.
* `.env` está en `.gitignore`; solo `.env.example` se versiona en el repositorio.
* Todos los integrantes deben usar la misma versión de Node.js indicada en `.nvmrc`.

---

## 🔗 Enlaces del Proyecto
* [Carpeta Compartida en Google Drive](https://drive.google.com/drive/folders/17NcHAKCzsRytvKUDfGiXpE0ppu5_KdmY?usp=sharing)
* [Tablero de Gestión en ClickUp](https://sharing.clickup.com/90141624618/b/h/2kydr29a-374/01d9dfa6c6bff36)

## 👥 Equipo de Desarrollo
* **Fernando Villafuerte Ferreyra** - Líder de Proyecto, Base de Datos, Fullstack
* **Aaron Telles Magaña** - Frontend, QA, Base de Datos
* **Joshua Jose Davalos Duran** - Backend, Frontend, QA
