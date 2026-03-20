# JEC Barber — Frontend

Aplicación web en **React** (interfaz y estado con componentes y hooks). El API real será un **backend Spring Boot**; este front se enlaza con `VITE_API_URL` (ver `.env.example`).

### Stack de frontend (React)

| Pieza | Uso en este repo |
|--------|-------------------|
| **React 19** | UI declarativa (`src/components`, hooks). |
| **Vite** | Dev server, HMR y build (`npm run dev` / `build`). |
| **React Router** | Rutas y vistas por rol (`src/App.jsx`). |
| **Tailwind CSS v4** | Estilos en JSX + `src/styles/main.css`. |
| **Lucide React** | Iconos. |

### Integración con Spring Boot

- **URL base**: suele ser algo como `http://localhost:8080/api` si usas puerto por defecto y un prefijo común en los `@RestController` o `server.servlet.context-path`.
- **CORS**: en Spring habilita orígenes del front (p. ej. `http://localhost:5173` en desarrollo) con `WebMvcConfigurer` + `addCorsMappings` o un `CorsConfigurationSource` si usas seguridad.
- **JSON**: conviene que los DTOs del backend coincidan en nombre de campos con lo que ya modela el front (`src/types/domain.js`, listas del admin) para no mapear a mano.
- **Auth**: cuando sustituyas el mock de login, lo habitual es **JWT** (cabecera `Authorization: Bearer …`) o **sesión con cookie** (`credentials: 'include'` en `fetch`). Guarda el token o deja que el navegador envíe la cookie según elijas.
- **Implementación en el front**: centraliza las llamadas en `src/services/api.js` (o divide por dominio) usando `getApiBaseUrl()` y `fetch`; los mocks actuales son el lugar lógico a reemplazar.

## Estructura principal

| Ruta | Uso |
|------|-----|
| `public/images/` | Estáticos por URL (`/images/...`). |
| `public/manifest.webmanifest` | Manifest ligero (instalable / PWA básica). |
| `src/styles/main.css` | Tailwind, tema y utilidades globales. |
| `src/App.jsx` | Rutas (`react-router-dom`). |
| `src/context/` | `AuthProvider`, instancia de contexto de sesión. |
| `src/hooks/` | `useAuth`, `useListFilterPagination`, etc. |
| `src/services/api.js` | Mocks y `getApiBaseUrl()`; sustituir por `fetch` al backend. |
| `src/types/domain.js` | JSDoc de dominio (citas, clientes, roles…). |
| `src/utils/validations.js` | Validaciones reutilizables (+ tests). |
| `src/utils/schemaAdapter.js` | Mapeo DTO API (UUID, ENUM mayúsculas, `tstzrange`) ↔ forma del UI. |
| `src/config/dbEnums.js` | Equivalencias ENUM Postgres SaaS ↔ textos del mock. |
| `src/components/ui/` | `LoadingSpinner`, `ErrorBanner`, `EmptyState`, `ConfirmDialog`, `PaginationBar`. |
| `src/components/admin/` | Panel administrativo (pestañas, CSV, datos mock). |
| `src/config/adminEnv.js` | Flags `VITE_ADMIN_READONLY`, `VITE_ENABLE_HISTORIAL`. |

## Variables de entorno del panel admin

En `.env` o `.env.local` (ver `.env.example`):

- **`VITE_ADMIN_READONLY=true`** — oculta formularios y acciones de edición en el panel (demo de rol restringido).
- **`VITE_ENABLE_HISTORIAL=false`** — oculta la pestaña **Historial** de citas (por defecto la pestaña está visible).

El admin usa `?tab=resumen` o `?tab=barberos` en la URL. Atajos **1** y **2** cambian de pestaña cuando el foco no está en un campo de texto.

## Dónde se ven las citas

| Rol | Ruta | Qué verás |
|-----|------|-----------|
| **Barbero** | `/barbero` | **Agenda** (14 días), **Inventario** privado, **Finanzas** (rango de fechas, total facturado, comisión % y detalle por servicio; mezcla historial mock + citas completadas en agenda). Datos en `adminData` + `barberoId` en la sesión. |
| **Admin** | `/admin` → **Resumen** | Estadísticas del día (KPIs mock) y citas de hoy cuando haya datos locales. |
| **Admin** | `/admin` → **Gestión barberos** | CRUD de barberos vía **Supabase**. |
| **Cliente** | `/cliente` | **Inicio** (hero visual de rangos Bronce/Plata/Oro, próxima cita, recompensas), **Reservar** (formulario mock → `sessionStorage` + lista en **Mis citas**), **Mis citas** (mock + reservas locales), **Historial**. Sesión con `clienteId` (p. ej. 1). |

## Rutas

- `/login` — inicio de sesión con **Supabase Auth**; el rol sale de la tabla `perfiles` (ver `docs/SUPABASE_ONBOARDING.md`).
- `/admin`, `/cliente`, `/barbero` — vistas por rol (protegidas).
- `/` — redirige según sesión o a `/login`.

La última pestaña activa del admin se guarda en `sessionStorage` (`jecbarber_admin_tab`). La vista compacta se guarda en `localStorage` (`jecbarber_admin_compact`).

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — producción
- `npm run preview` — vista previa del build
- `npm run lint` — ESLint (+ Prettier vía `eslint-config-prettier`)
- `npm run test` / `npm run test:run` — Vitest + Testing Library
- `npm run format` — Prettier
