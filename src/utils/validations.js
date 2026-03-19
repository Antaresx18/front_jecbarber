/**
 * @param {string} raw
 * @returns {{ ok: true, value: number } | { ok: false, message: string }}
 */
export function parsePrecio(raw) {
  const n = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, message: 'Precio inválido (≥ 0).' };
  }
  return { ok: true, value: n };
}

/**
 * @param {string} raw
 * @returns {{ ok: true, value: number } | { ok: false, message: string }}
 */
export function parseComisionPercent(raw) {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, message: 'Comisión entre 0 y 100%.' };
  }
  return { ok: true, value: Math.round(n) };
}

/**
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}
