import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages (sitio de proyecto): la app vive en /nombre-del-repo/
 * Build: VITE_BASE_PATH=/nombre-del-repo/ npm run build
 * En local sin variable → raíz /
 */
function appBase() {
  const raw = process.env.VITE_BASE_PATH;
  if (raw == null || String(raw).trim() === '' || raw === '/') return '/';
  let s = String(raw).trim();
  if (!s.startsWith('/')) s = `/${s}`;
  if (!s.endsWith('/')) s = `${s}/`;
  return s;
}

// https://vite.dev/config/
export default defineConfig({
  base: appBase(),
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
