/**
 * Adapta DTO del backend (UUID, ENUM mayúsculas, tstzrange) ↔ forma que usa el UI mock.
 * Los mocks locales siguen usando números y strings en español; el API usará esto al integrar.
 */

import { estadoCitaApiToUi, estadoCitaUiToApi, rangoApiToUi, rangoUiToApi } from '../config/dbEnums';

/**
 * Convierte "10:30 AM" + fecha YYYY-MM-DD a minutos desde medianoche (ordenar igual que parseHoraToMinutes).
 * @param {string} fechaYmd
 * @param {string} hora12
 */
export function fechaHoraToUtcIsoStart(fechaYmd, hora12) {
  const t = parseHora12ToParts(hora12);
  if (!t) return null;
  const d = new Date(Date.UTC(
    Number(fechaYmd.slice(0, 4)),
    Number(fechaYmd.slice(5, 7)) - 1,
    Number(fechaYmd.slice(8, 10)),
    t.h24,
    t.min,
    0,
    0
  ));
  return d.toISOString();
}

/**
 * Suma minutos a un ISO y devuelve ISO (fin de slot).
 * @param {string} isoStart
 * @param {number} minutes
 */
export function addMinutesIso(isoStart, minutes) {
  const d = new Date(isoStart);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString();
}

/**
 * Rango PostgreSQL tstzrange estándar para enviar al API: `[start,end)`.
 * @param {string} fechaYmd
 * @param {string} hora12
 * @param {number} duracionMin
 */
export function buildTstzRangeLiteral(fechaYmd, hora12, duracionMin) {
  const start = fechaHoraToUtcIsoStart(fechaYmd, hora12);
  if (!start) return null;
  const end = addMinutesIso(start, duracionMin);
  return `[${start},${end})`;
}

function parseHora12ToParts(hora12) {
  const s = String(hora12).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return { h24: h, min };
}

/**
 * @param {object} row — fila API con snake_case
 * @returns {object} — forma cercana a CitaAdmin del front
 */
export function citaApiToUi(row) {
  const estadoRaw = row.estado ?? row.estado_cita;
  const estadoUi =
    typeof estadoRaw === 'string' && estadoRaw === estadoRaw.toUpperCase()
      ? estadoCitaApiToUi[estadoRaw] ?? estadoRaw
      : estadoRaw;

  let fecha = row.fecha;
  let hora = row.hora;
  if (row.rango_tiempo && typeof row.rango_tiempo === 'string') {
    const parsed = parseTstzRangeString(row.rango_tiempo);
    if (parsed) {
      fecha = parsed.fecha;
      hora = parsed.hora;
    }
  }

  return {
    id: row.id,
    fecha,
    hora,
    clienteId: row.cliente_id ?? row.clienteId,
    barberoId: row.barbero_id ?? row.barberoId,
    clienteNombre: row.cliente_nombre ?? row.clienteNombre ?? '',
    barberoNombre: row.barbero_nombre ?? row.barberoNombre ?? '',
    servicio: row.servicio_nombre ?? row.servicio ?? '',
    pedidoCliente: row.pedido_cliente ?? row.pedidoCliente ?? '',
    notas: row.notas ?? '',
    estado: estadoUi,
    monto: Number(row.monto ?? 0),
    nombreInvitado: row.nombre_invitado ?? row.nombreInvitado,
    metodoPago: row.metodo_pago ?? row.metodoPago,
    propina: row.propina != null ? Number(row.propina) : undefined,
    comisionMonto: row.comision_monto != null ? Number(row.comision_monto) : undefined,
    detalles: row.cita_detalles ?? row.detalles,
  };
}

function parseTstzRangeString(rangeStr) {
  const inner = String(rangeStr).replace(/^\[/, '').replace(/\)$/, '');
  const parts = inner.split(',');
  if (parts.length < 2) return null;
  const startRaw = parts[0].trim();
  const d = new Date(startRaw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  let h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const hora = `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
  return { fecha: `${y}-${mo}-${da}`, hora };
}

/**
 * @param {object} c — cita en forma UI (mock)
 * @param {object} opt
 * @param {string} opt.servicioIdUuid — UUID servicio cuando exista API
 * @param {number} opt.duracionMin
 */
export function citaUiToApiPayload(c, opt = {}) {
  const dur = opt.duracionMin ?? 45;
  const rango =
    c.fecha && c.hora ? buildTstzRangeLiteral(c.fecha, c.hora, dur) : null;
  const estadoApi =
    c.estado && estadoCitaUiToApi[c.estado] ? estadoCitaUiToApi[c.estado] : String(c.estado).toUpperCase();

  return {
    barbero_id: c.barberoId,
    cliente_id: c.clienteId ?? null,
    nombre_invitado: c.nombreInvitado || null,
    rango_tiempo: rango,
    pedido_cliente: c.pedidoCliente ?? '',
    notas: c.notas ?? '',
    estado: estadoApi,
    monto: c.monto,
    metodo_pago: c.metodoPago ?? 'EFECTIVO',
    propina: c.propina ?? 0,
    servicio_id: opt.servicioIdUuid,
  };
}

/**
 * @param {object} row cliente API
 */
export function clienteApiToUi(row) {
  const r = row.rango;
  const rangoUi = typeof r === 'string' && r === r.toUpperCase() ? rangoApiToUi[r] ?? r : r;
  return {
    id: row.id,
    nombre: row.nombre,
    rango: rangoUi,
    cortes: row.cortes,
    proximos: row.proximos,
    notas: row.notas ?? '',
    ausencias: row.ausencias,
    email: row.email,
    activo: row.activo,
  };
}

export function clienteUiToApiPatch(patch) {
  const out = { ...patch };
  if (patch.rango && rangoUiToApi[patch.rango]) {
    out.rango = rangoUiToApi[patch.rango];
  }
  return out;
}
