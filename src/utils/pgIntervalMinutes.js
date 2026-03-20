/**
 * Convierte valor de columna INTERVAL (PostgREST / Postgres) a minutos enteros.
 * @param {unknown} v
 * @returns {number}
 */
export function intervalToMinutes(v) {
  if (v == null || v === '') return 30;
  if (typeof v === 'object' && v !== null) {
    const h = Number(v.hours) || 0;
    const m = Number(v.minutes) || 0;
    const s = Number(v.seconds) || 0;
    if (h || m || s) return Math.max(1, Math.round(h * 60 + m + s / 60));
  }
  const s = String(v).trim();
  const iso = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(s);
  if (iso) {
    const h = parseInt(iso[1] || '0', 10);
    const m = parseInt(iso[2] || '0', 10);
    const sec = parseFloat(iso[3] || '0');
    return Math.max(1, h * 60 + m + Math.round(sec / 60));
  }
  const parts = s.split(':').map((x) => parseFloat(String(x).trim()));
  if (parts.length >= 2 && parts.every((n) => !Number.isNaN(n))) {
    if (parts.length === 3) {
      const [a, b, c] = parts;
      return Math.max(1, Math.round(a * 60 + b + c / 60));
    }
    return Math.max(1, Math.round(parts[0] * 60 + parts[1]));
  }
  const mm = /^(\d+)\s*minutes?$/i.exec(s);
  if (mm) return Math.max(1, parseInt(mm[1], 10));
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n > 0) return Math.min(24 * 60, n);
  return 30;
}

/**
 * Literal aceptado por Postgres para columna INTERVAL vía PostgREST.
 * @param {number|string} min
 */
export function minutesToPgInterval(min) {
  const m = Math.max(1, Math.min(24 * 60, Math.round(Number(min))));
  return `${m} minutes`;
}
