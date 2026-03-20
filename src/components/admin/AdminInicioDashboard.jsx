import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Calendar,
  TrendingUp,
  Award,
  Package,
  Clock,
  UserRound,
  Scissors,
} from 'lucide-react';
import { supabase } from '../../supabase';
import { addDaysIso, parseHoraToMinutes, ymdLocal } from '../../utils/adminFilters';
import {
  parseStartFromRangoLocal,
  parseStartFromRangoUtc,
  ymdUtcFromTs,
  extractLowerBoundFromRango,
  parseRangoStartToDate,
} from '../../utils/nuevaCitaHelpers';

/**
 * Hora en 12h (ej. "10:30 AM") desde tstzrange/tsrange u objeto PostgREST.
 * Respaldo cuando parseStartFromRango* no rellena hora pero el rango sí trae datos.
 */
function horaLegibleDesdeRango(rangeVal) {
  const startRaw = extractLowerBoundFromRango(rangeVal);
  if (!startRaw) return null;
  const s = typeof startRaw === 'string' ? startRaw : String(startRaw);
  const dt = parseRangoStartToDate(s);
  if (dt && !Number.isNaN(dt.getTime())) {
    let h = dt.getHours();
    const mi = dt.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
  }
  const m24 = s.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (!m24) return null;
  let h = parseInt(m24[1], 10) % 24;
  const mi = parseInt(m24[2], 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
}

function horaDesdeCreatedAt(ts) {
  if (ts == null || ts === '') return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  let h = d.getHours();
  const mi = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
}

/** Lunes–domingo (calendario local) que contiene `fechaYmd`. */
function getLocalWeekRange(fechaYmd) {
  const [y, m, d] = fechaYmd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const wd = date.getDay();
  const mondayOffset = wd === 0 ? -6 : 1 - wd;
  const monday = new Date(y, m - 1, d + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} desde
 * @param {string} hasta
 */
function mapCitaFromRow(row, desde, hasta) {
  const loc = parseStartFromRangoLocal(row.rango_tiempo);
  const utc = parseStartFromRangoUtc(row.rango_tiempo);
  let fecha = loc.fecha || utc.fecha;
  if (!fecha && row.created_at) fecha = ymdUtcFromTs(row.created_at);

  let hora = loc.fecha ? loc.hora : utc.fecha ? utc.hora : null;
  if (!hora || hora === '—') {
    const hRango = horaLegibleDesdeRango(row.rango_tiempo);
    if (hRango) hora = hRango;
  }
  if (!hora || hora === '—') {
    const hCre = horaDesdeCreatedAt(row.created_at);
    if (hCre) hora = hCre;
  }
  if (!hora) hora = 'Sin hora';

  if (!fecha || fecha < desde || fecha > hasta) return null;

  const clienteNombre = row.clientes?.nombre ?? row.nombre_invitado ?? 'Invitado';
  const br = row.barberos && typeof row.barberos === 'object' ? row.barberos : null;
  return {
    cita_id: row.id,
    fecha,
    hora,
    barbero_nombre: br?.nombre ?? '—',
    cliente_nombre: clienteNombre,
    estado: String(row.estado ?? ''),
    monto: Number(row.monto ?? 0),
  };
}

function mapErr(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  if (err.code === '42501' || msg.toLowerCase().includes('permission')) {
    return 'No tienes permiso (rol ADMIN).';
  }
  return msg;
}

/**
 * @typedef {object} CitaRow
 * @property {string} cita_id
 * @property {string} fecha
 * @property {string} hora
 * @property {string} barbero_nombre
 * @property {string} cliente_nombre
 * @property {string} estado
 * @property {number} monto
 */

export default function AdminInicioDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [citasHoy, setCitasHoy] = useState(0);
  const [ingresosSemana, setIngresosSemana] = useState(0);
  const [barberoDestacado, setBarberoDestacado] = useState({ nombre: '—', cortes: 0 });
  const [alertasStock, setAlertasStock] = useState([]);
  const [proximas, setProximas] = useState(/** @type {CitaRow[]} */ ([]));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hoy = ymdLocal();
      const week = getLocalWeekRange(hoy);
      const desde = addDaysIso(hoy, -120);
      const hasta = addDaysIso(hoy, 180);

      const [invSalonRes, invBarbRes, barbRes, rawRes] = await Promise.all([
        supabase.from('inventario_salon').select('id,nombre,stock,stock_minimo').order('nombre'),
        supabase
          .from('inventario_barbero')
          .select('id,nombre,stock,stock_minimo,barberos(nombre)')
          .order('nombre'),
        supabase
          .from('barberos')
          .select('nombre,cortes_realizados')
          .order('cortes_realizados', { ascending: false })
          .limit(1),
        supabase
          .from('citas')
          .select('id,estado,monto,rango_tiempo,nombre_invitado,created_at,barberos(nombre),clientes(nombre)')
          .limit(3000),
      ]);

      if (invSalonRes.error) throw invSalonRes.error;
      if (invBarbRes.error) throw invBarbRes.error;
      if (barbRes.error) throw barbRes.error;
      if (rawRes.error) throw rawRes.error;

      const bajoSalon = (invSalonRes.data ?? []).filter(
        (p) => Number(p.stock) < Number(p.stock_minimo ?? 0)
      );
      const bajoBarbero = (invBarbRes.data ?? []).filter(
        (p) => Number(p.stock) < Number(p.stock_minimo ?? 0)
      );

      const top = barbRes.data?.[0];
      setBarberoDestacado({
        nombre: top?.nombre ?? '—',
        cortes: Number(top?.cortes_realizados ?? 0),
      });

      setAlertasStock([
        ...bajoSalon.map((p) => ({
          id: `salon-${p.id}`,
          nombre: p.nombre,
          stock: Number(p.stock),
          min: Number(p.stock_minimo ?? 0),
          origen: 'Salón',
        })),
        ...bajoBarbero.map((p) => {
          const bn = p.barberos && typeof p.barberos === 'object' ? p.barberos.nombre : null;
          return {
            id: `barb-${p.id}`,
            nombre: bn ? `${p.nombre} (${bn})` : p.nombre,
            stock: Number(p.stock),
            min: Number(p.stock_minimo ?? 0),
            origen: 'Barbero',
          };
        }),
      ]);

      const rows = (rawRes.data ?? [])
        .map((row) => mapCitaFromRow(row, desde, hasta))
        .filter(Boolean);

      const activosHoy = rows.filter((r) => r.fecha === hoy && r.estado !== 'CANCELADA');
      setCitasHoy(activosHoy.length);

      const ingresos = rows
        .filter(
          (r) =>
            r.estado === 'COMPLETADA' && r.fecha >= week.start && r.fecha <= week.end && r.monto > 0
        )
        .reduce((s, r) => s + r.monto, 0);
      setIngresosSemana(ingresos);

      const colaHoy = activosHoy
        .filter((r) => r.estado === 'PENDIENTE' || r.estado === 'EN_PROCESO')
        .sort((a, b) => parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora));

      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      const futuras = colaHoy.filter((r) => parseHoraToMinutes(r.hora) >= nowMin);
      setProximas(futuras.length > 0 ? futuras : colaHoy);
    } catch (e) {
      setError(mapErr(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cardBase =
    'glass-panel rounded-2xl border p-5 min-h-[7.5rem] flex flex-col justify-between ' +
    'border-slate-700/55 bg-slate-900/35 shadow-lg shadow-black/20';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Inicio</h1>
          <p className="text-slate-400 text-sm mt-1">Resumen del día · {ymdLocal()}</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="text-xs font-bold text-brand-accent hover:underline disabled:opacity-50 self-start sm:self-auto"
        >
          Actualizar
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="animate-spin text-brand-gold" size={40} aria-hidden />
          <span className="text-sm font-medium">Cargando panel…</span>
        </div>
      ) : error ? (
        <div
          className="glass-panel border border-red-500/35 bg-red-950/20 rounded-2xl p-6 flex gap-3 items-start"
          role="alert"
        >
          <AlertCircle className="text-red-400 shrink-0" size={22} />
          <div>
            <p className="font-bold text-red-200">No se pudo cargar el inicio</p>
            <p className="text-sm text-red-300/90 mt-1">{error}</p>
            <button
              type="button"
              onClick={() => load()}
              className="mt-3 text-sm font-bold text-brand-accent hover:underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <>
          <section
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            aria-label="Indicadores"
          >
            <article className={`${cardBase} border-brand-gold/25`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Citas hoy
                </span>
                <Calendar className="text-brand-gold/90 shrink-0" size={22} aria-hidden />
              </div>
              <p className="text-3xl font-black text-brand-gold tabular-nums mt-2">{citasHoy}</p>
              <p className="text-[11px] text-slate-500 mt-1">Incluye pendientes y completadas (hoy local)</p>
            </article>

            <article className={`${cardBase} border-violet-500/25`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ingresos semanales
                </span>
                <TrendingUp className="text-violet-400 shrink-0" size={22} aria-hidden />
              </div>
              <p className="text-3xl font-black text-violet-300 tabular-nums mt-2">
                ${ingresosSemana.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Bruto · citas finalizadas · semana local (lun–dom)</p>
            </article>

            <article className={`${cardBase} border-amber-500/20`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Barbero destacado
                </span>
                <Award className="text-amber-400 shrink-0" size={22} aria-hidden />
              </div>
              <p className="text-lg font-black text-white mt-2 truncate" title={barberoDestacado.nombre}>
                {barberoDestacado.nombre}
              </p>
              <p className="text-sm text-brand-gold font-bold tabular-nums">
                {barberoDestacado.cortes} cortes
              </p>
            </article>

            <article className={`${cardBase} border-rose-500/20`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Alertas inventario
                </span>
                <Package className="text-rose-400 shrink-0" size={22} aria-hidden />
              </div>
              <p className="text-3xl font-black text-rose-300 tabular-nums mt-2">
                {alertasStock.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Salón + stock por barbero bajo el mínimo</p>
            </article>
          </section>

          {alertasStock.length > 0 && (
            <section className="glass-panel rounded-2xl border border-rose-500/20 bg-rose-950/10 p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-300/90 mb-3">Detalle alertas</p>
              <ul className="flex flex-wrap gap-2">
                {alertasStock.slice(0, 12).map((a) => (
                  <li
                    key={a.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 border border-rose-500/25 text-slate-300"
                  >
                    <span className="text-rose-200 font-semibold">{a.nombre}</span>
                    <span className="text-slate-500 mx-1">·</span>
                    <span className="tabular-nums">
                      {a.stock} &lt; {a.min}
                    </span>
                  </li>
                ))}
              </ul>
              {alertasStock.length > 12 && (
                <p className="text-[11px] text-slate-500 mt-2">+{alertasStock.length - 12} más</p>
              )}
            </section>
          )}

          <section className="glass-panel rounded-2xl border border-slate-700/50 p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/30">
                <Clock className="text-violet-300" size={20} aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Próximas citas</h2>
                <p className="text-xs text-slate-500">Hoy · pendientes y en curso · orden por hora (local)</p>
              </div>
            </div>

            {proximas.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center border border-dashed border-slate-700 rounded-xl">
                No hay citas pendientes ni en curso para hoy.
              </p>
            ) : (
              <ul className="relative pl-2 sm:pl-4">
                <li
                  className="absolute left-[11px] sm:left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-500/50 via-brand-gold/30 to-transparent"
                  aria-hidden
                />
                {proximas.map((c, i) => (
                  <li key={c.cita_id} className="relative flex gap-4 pb-6 last:pb-0">
                    <div
                      className={`z-10 mt-1.5 h-3 w-3 rounded-full border-2 shrink-0 ${
                        i === 0
                          ? 'bg-brand-gold border-amber-300 shadow shadow-amber-500/40'
                          : 'bg-slate-800 border-violet-500/60'
                      }`}
                    />
                    <div className="flex-1 min-w-0 rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-brand-gold font-black text-sm tabular-nums min-w-[5.25rem] inline-block shrink-0">
                          {c.hora}
                        </span>
                        <span className="text-white font-bold truncate flex items-center gap-1.5">
                          <UserRound size={14} className="text-slate-500 shrink-0" aria-hidden />
                          {c.cliente_nombre}
                        </span>
                        {c.estado === 'EN_PROCESO' && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/35">
                            En curso
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                        <Scissors size={12} className="text-violet-400/80 shrink-0" aria-hidden />
                        {c.barbero_nombre}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
