/** Hoy en calendario local YYYY-MM-DD (coherente con input type="date"). */
export function ymdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Convierte fechas desde API/Postgres/Supabase a `YYYY-MM-DD`.
 * Importante: un `Date` de JS no debe pasarse por `String()` (pierde el formato ISO).
 * @param {unknown} v
 * @returns {string | null}
 */
export function coerceToYmd(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const t = v.trim();
    const strict = t.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (strict) return strict[1];
    const prefix = t.match(/^(\d{4}-\d{2}-\d{2})/);
    if (prefix) return prefix[1];
  }
  if (typeof v === 'object' && v !== null && typeof /** @type {Date} */ (v).getTime === 'function') {
    const d = /** @type {Date} */ (v);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Suma días a una fecha YYYY-MM-DD (calendario local).
 * @param {string} fechaYmd
 * @param {number} deltaDays
 * @returns {string}
 */
export function addDaysIso(fechaYmd, deltaDays) {
  const [y, m, d] = fechaYmd.split('-').map(Number);
  const date = new Date(y, m - 1, d + deltaDays);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * @param {string} fecha ISO YYYY-MM-DD
 * @param {string} desde YYYY-MM-DD
 * @param {string} hasta YYYY-MM-DD
 */
export function isFechaInRange(fecha, desde, hasta) {
  if (!desde && !hasta) return true;
  const d = String(fecha).slice(0, 10);
  if (desde && d < desde) return false;
  if (hasta && d > hasta) return false;
  return true;
}

/**
 * @param {{ fecha: string, monto?: number }[]} gastos
 * @param {string} desde
 * @param {string} hasta
 */
export function filterGastosByDateRange(gastos, desde, hasta) {
  return gastos.filter((g) => isFechaInRange(g.fecha, desde, hasta));
}

/** "10:30 AM" -> minutos desde medianoche para ordenar */
export function parseHoraToMinutes(hora) {
  const s = String(hora).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}
