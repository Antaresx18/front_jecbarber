/**
 * Capa de acceso a datos. Hoy devuelve mocks; sustituir por fetch al API Spring Boot
 * (base URL en VITE_API_URL, p. ej. http://localhost:8080/api).
 * @module services/api
 */

import { INITIAL_STATS } from '../components/admin/adminData';

/** @returns {string} */
export function getApiBaseUrl() {
  const base = import.meta.env.VITE_API_URL;
  return typeof base === 'string' ? base.replace(/\/$/, '') : '';
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Carga inicial de KPIs del admin (mock).
 * @returns {Promise<typeof INITIAL_STATS>}
 */
export async function loadAdminDashboardStats() {
  await delay(650);
  if (import.meta.env.VITE_MOCK_ERROR === 'true') {
    throw new Error('No se pudo cargar el panel (mock de error).');
  }
  return { ...INITIAL_STATS };
}
