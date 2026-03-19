# JEC Barber — Frontend

Solo la aplicación web (React + Vite). Código de API, base de datos u otros servicios vive en otros repositorios o carpetas.

## Estructura del proyecto

| Ruta | Uso |
|------|-----|
| `public/images/` | Estáticos por URL (`/images/...`). Por ejemplo el favicon. |
| `src/styles/` | CSS global (Tailwind, `@theme`, utilidades). Punto de entrada: `main.css`. |
| `src/components/` | Componentes React por pantalla o dominio. |
| `src/App.jsx`, `src/main.jsx` | Raíz de la app y montaje en el DOM. |

Archivos de configuración en la raíz (`vite.config.js`, `eslint.config.js`, `postcss.config.js`, `index.html`) son propios del front.

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — producción
- `npm run preview` — vista previa del build
