/**
 * Extrae el límite inferior de un tstzrange tal como lo devuelve PostgREST/Supabase:
 * string `"[lower,upper)"`, objeto `{ lower, upper }`, o array `[lower, upper]`.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function extractLowerBoundFromRango(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const lo = /** @type {{ lower?: unknown }} */ (raw).lower;
    if (typeof lo === 'string') return lo;
    if (lo instanceof Date && !Number.isNaN(lo.getTime())) return lo.toISOString();
    return null;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const a = raw[0];
    if (typeof a === 'string') return a;
    if (a instanceof Date && !Number.isNaN(a.getTime())) return a.toISOString();
    return null;
  }
  const s = String(raw).trim();
  if (s.startsWith('[') && (s.endsWith(')') || s.endsWith(']'))) {
    const inner = s.slice(1, -1);
    const idx = inner.indexOf(',');
    if (idx !== -1) {
      const lower = inner.slice(0, idx).trim();
      if (lower && lower.toLowerCase() !== 'empty') return lower;
    }
    return null;
  }
  const inner = s.replace(/^\[/, '').replace(/\)\s*$/, '').replace(/\]\s*$/, '');
  const first = inner.split(',')[0]?.trim();
  return first && first.toLowerCase() !== 'empty' ? first : null;
}

/**
 * @param {string | null | undefined} startRaw
 * @returns {Date | null}
 */
/** YYYY-MM-DD en UTC desde `created_at` u otro timestamp ISO (respaldo de día de la cita). */
export function ymdUtcFromTs(ts) {
  if (ts == null || ts === '') return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function parseRangoStartToDate(startRaw) {
  if (!startRaw) return null;
  let t = String(startRaw).trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d/.test(t)) {
    t = t.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  }
  // Postgres / buildRangoTiempoUtc devuelve offset corto "+00". Con "T" en medio, V8/Chrome
  // no parsean "...T...±HH" sin minutos → Invalid Date y loadCitas descartaba todas las filas.
  t = t.replace(/\+00$/g, '+00:00').replace(/-00$/g, '-00:00');
  const dt = new Date(t);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Inicio del tstzrange en calendario/hora local (alineado con <input type="date">).
 * @param {unknown} rangeVal — string tstzrange, objeto PostgREST, etc.
 */
export function parseStartFromRangoLocal(rangeVal) {
  const startRaw = extractLowerBoundFromRango(rangeVal);
  const dt = parseRangoStartToDate(startRaw);
  if (!dt) return { fecha: null, hora: null };
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  let h = dt.getHours();
  const mi = dt.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const hora = `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
  return { fecha: `${y}-${mo}-${da}`, hora };
}

/**
 * Misma extracción que local pero día/hora en UTC (coincide con citas guardadas vía `buildRangoTiempoUtc`).
 * Útil si el parse local devuelve null o un día distinto al del calendario de la BD.
 */
export function parseStartFromRangoUtc(rangeVal) {
  const startRaw = extractLowerBoundFromRango(rangeVal);
  const dt = parseRangoStartToDate(startRaw);
  if (!dt) return { fecha: null, hora: null };
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  let h = dt.getUTCHours();
  const mi = dt.getUTCMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const hora = `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
  return { fecha: `${y}-${mo}-${da}`, hora };
}

/** Intervalo Postgres / JSON → minutos */
export function intervalToMinutes(dur) {
  if (dur == null) return 30;
  const s = String(dur);
  const mm = s.match(/(\d+)\s*minute/i);
  if (mm) return Math.max(5, Number(mm[1]));
  const iso = s.match(/^(\d+):(\d+):(\d+)/);
  if (iso) {
    const hh = Number(iso[1]);
    const mi = Number(iso[2]);
    return Math.max(5, hh * 60 + mi);
  }
  return 30;
}

/**
 * Literal tstzrange: [inicio, fin) en UTC con :00+00 en cada extremo.
 */
export function buildRangoTiempoUtc(fechaYmd, time24, durationMinutes) {
  const [y, mo, d] = fechaYmd.split('-').map(Number);
  const tm = String(time24 || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!tm || !Number.isFinite(y)) return null;
  const hh = Number(tm[1]);
  const min = Number(tm[2]);
  const start = new Date(Date.UTC(y, mo - 1, d, hh, min, 0));
  const dur = Math.max(5, Number(durationMinutes) || 30);
  const end = new Date(start.getTime() + dur * 60 * 1000);
  const fmt = (dt) => {
    const Y = dt.getUTCFullYear();
    const M = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const D = String(dt.getUTCDate()).padStart(2, '0');
    const H = String(dt.getUTCHours()).padStart(2, '0');
    const Mi = String(dt.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${H}:${Mi}:00+00`;
  };
  return `[${fmt(start)}, ${fmt(end)})`;
}
