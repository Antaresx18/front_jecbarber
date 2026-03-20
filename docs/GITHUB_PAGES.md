# GitHub Pages — pantalla en blanco

En un **repositorio de proyecto**, la URL es `https://TU_USUARIO.github.io/NOMBRE_REPO/`. El navegador debe cargar JS/CSS desde `/NOMBRE_REPO/assets/...`, no desde `/assets/...`. Si el build usa `base: '/'`, los scripts fallan (404) y ves **página en blanco**.

## Qué hace este repo

1. **`vite.config.js`**: `base` = `VITE_BASE_PATH` (p. ej. `/front_jecbarber/`) o `/` en local.
2. **`main.jsx`**: `BrowserRouter` con `basename` acorde a `import.meta.env.BASE_URL`.
3. **`npm run build:gh-pages`**: genera `dist/404.html` = copia de `index.html` para que rutas como `/repo/admin` carguen el SPA.
4. **`public/.nojekyll`**: evita que Jekyll ignore archivos en Pages.
5. **`.github/workflows/deploy-github-pages.yml`**: CI que define `VITE_BASE_PATH: /${{ github.event.repository.name }}/` y sube `dist`.

## Pasos en GitHub

1. **Settings → Pages → Build and deployment → Source**: elige **GitHub Actions** (no solo subir `dist` a una rama sin el `base` correcto).
2. Haz push a `main` (o ejecuta el workflow a mano). La URL publicada será la que muestre el job **deploy**.
3. **Secrets** (recomendado): en **Settings → Secrets and variables → Actions**, añade al menos:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   (o `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` si es lo que usas en `.env.local`)

   Sin ellos, el build puede completar pero la app no tendrá Supabase en producción.

## Build manual (rama `gh-pages`)

```bash
# Debe coincidir con la ruta de la URL (normalmente el nombre del repo en minúsculas)
set VITE_BASE_PATH=/front_jecbarber/
npm run build:gh-pages
```

Para tu sitio **https://antaresx18.github.io/front_jecbarber/** la base tiene que ser exactamente **`/front_jecbarber/`** (mismo texto que en la URL, en minúsculas).

### Comprobar en el navegador (si sigue en blanco)

1. Abre el sitio y pulsa **F12** → pestaña **Red / Network**.
2. Recarga: busca el `.js` del bundle (p. ej. `index-….js`).
3. Si el estado es **404** y la URL empieza por `https://antaresx18.github.io/assets/...` (sin `front_jecbarber`), el build se hizo **sin** `VITE_BASE_PATH` → vuelve a compilar con `build:gh-pages` y la variable correcta.
4. Si el `.js` es **200** pero la página sigue vacía, mira **Consola** por errores en rojo (a veces falta configurar **Secrets** de Supabase en GitHub Actions).

Sube el **contenido** de `dist/` a la rama que uses para Pages.

## Sitio de usuario (`usuario.github.io`)

Si el repo se llama `usuario.github.io`, la web suele estar en la raíz del dominio: no hace falta subpath; compila **sin** `VITE_BASE_PATH` (o `VITE_BASE_PATH=/`).
