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

### 1. Clonar el repositorio
```bash
git clone [https://github.com/tu-usuario/club-deportivo-v2.git](https://github.com/tu-usuario/club-deportivo-v2.git)
cd club-deportivo-v2
```

### 2. Configuración del Backend
Abre una terminal y navega a la carpeta del servidor:
```bash
cd backend
npm install
```

Crea un archivo `.env` en la raíz de `/backend` guiándote con el archivo `.env.example`. Asegúrate de incluir las siguientes variables:
```env
# Conexión a Neon
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
PORT=3000

# Seguridad
JWT_SECRET=tu_secreto_jwt

# Envío de correos y QR
GMAIL_USER=tucorreo@gmail.com
GMAIL_APP_PASSWORD=tu_app_password_de_gmail
```

Inicia el servidor de desarrollo:
```bash
npm run dev
```

### 3. Configuración del Frontend
Abre **otra** terminal y navega a la carpeta del cliente:
```bash
cd frontend
npm install
npm run dev
```

---

## 🔗 Enlaces del Proyecto
* [Carpeta Compartida en Google Drive](https://drive.google.com/drive/folders/17NcHAKCzsRytvKUDfGiXpE0ppu5_KdmY?usp=sharing)
* [Tablero de Gestión en ClickUp](https://sharing.clickup.com/90141624618/b/h/2kydr29a-374/01d9dfa6c6bff36)

## 👥 Equipo de Desarrollo
* **Fernando Villafuerte Ferreyra** - Líder de Proyecto, Base de Datos, Fullstack
* **Aaron Telles Magaña** - Frontend, QA, Base de Datos
* **Joshua Jose Davalos Duran** - Backend, Frontend, QA
