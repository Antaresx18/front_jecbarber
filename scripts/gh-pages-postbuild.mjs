/**
 * GitHub Pages sirve 404.html cuando la ruta no es un archivo.
 * Copiar index.html → 404.html hace que el SPA (React Router) cargue y lea la URL.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(__dirname, '../dist');
const indexHtml = resolve(dist, 'index.html');
const notFound = resolve(dist, '404.html');

if (!existsSync(indexHtml)) {
  console.error('No existe dist/index.html. Ejecuta primero: vite build');
  process.exit(1);
}
copyFileSync(indexHtml, notFound);
console.log('OK: dist/404.html (fallback SPA para GitHub Pages)');
