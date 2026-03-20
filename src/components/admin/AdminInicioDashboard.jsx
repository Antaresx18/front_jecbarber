import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { addDaysIso, parseHoraToMinutes } from '../../utils/adminFilters';

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

/** Lunes–domingo (UTC) que contiene `fechaYmd`. */
function getUtcWeekRange(fechaYmd) {
  const [y, m, d] = fechaYmd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const wd = date.getUTCDay();
  const mondayOffset = wd === 0 ? -6 : 1 - wd;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

/** @param {string | null | undefined} rangeStr */
function parseStartFromRango(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return { fecha: null, hora: null };
  const inner = rangeStr.replace(/^\[/, '').replace(/\)$/, '');
  const parts = inner.split(',');
  const startRaw = parts[0]?.trim();
  if (!startRaw) return { fecha: null, hora: null };
  const dt = new Date(startRaw);
  if (Number.isNaN(dt.getTime())) return { fecha: null, hora: null };
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

  const today = useMemo(() => isoToday(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const week = getUtcWeekRange(today);
      const desde = addDaysIso(today, -7);
      const hasta = addDaysIso(today, 14);

      const invP = supabase.from('inventario_salon').select('id,nombre,stock,stock_minimo').order('nombre');
      const barbP = supabase
        .from('barberos')
        .select('nombre,cortes_realizados')
        .order('cortes_realizados', { ascending: false })
        .limit(1);

      const { data: invData, error: invErr } = await invP;
      if (invErr) throw invErr;
      const bajo = (invData ?? []).filter((p) => Number(p.stock) < Number(p.stock_minimo ?? 0));

      const { data: barbRows, error: barbErr } = await barbP;
      if (barbErr) throw barbErr;
      const top = barbRows?.[0];
      setBarberoDestacado({
        nombre: top?.nombre ?? '—',
        cortes: Number(top?.cortes_realizados ?? 0),
      });

      setAlertasStock(
        bajo.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          stock: Number(p.stock),
          min: Number(p.stock_minimo ?? 0),
        }))
      );

      const { data: raw, error: rawErr } = await supabase
        .from('citas')
        .select('id,estado,monto,rango_tiempo,nombre_invitado,barberos(nombre),clientes(nombre)')
        .limit(1000);
      if (rawErr) throw rawErr;
      const rows = (raw ?? [])
        .map((row) => {
          const { fecha, hora } = parseStartFromRango(row.rango_tiempo);
          const clienteNombre =
            row.clientes?.nombre ?? row.nombre_invitado ?? 'Invitado';
          return {
            cita_id: row.id,
            fecha: fecha ?? '',
            hora: hora ?? '',
            barbero_nombre: row.barberos?.nombre ?? '—',
            cliente_nombre: clienteNombre,
            estado: row.estado,
            monto: Number(row.monto ?? 0),
          };
        })
        .filter((r) => r.fecha >= desde && r.fecha <= hasta);

      const activosHoy = rows.filter(
        (r) => r.fecha === today && r.estado !== 'CANCELADA'
      );
      setCitasHoy(activosHoy.length);

      const ingresos = rows
        .filter(
          (r) =>
            r.estado === 'COMPLETADA' &&
            r.fecha >= week.start &&
            r.fecha <= week.end
        )
        .reduce((s, r) => s + r.monto, 0);
      setIngresosSemana(ingresos);

      const pendientesHoy = activosHoy
        .filter((r) => r.estado === 'PENDIENTE')
        .sort((a, b) => parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora));

      const nowMin = (() => {
        const n = new Date();
        return n.getUTCHours() * 60 + n.getUTCMinutes();
      })();

      const futuras = pendientesHoy.filter((r) => parseHoraToMinutes(r.hora) >= nowMin);
      setProximas(futuras.length > 0 ? futuras : pendientesHoy);
    } catch (e) {
      setError(mapErr(e));
    } finally {
      setLoading(false);
    }
  }, [today]);

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
          <p className="text-slate-400 text-sm mt-1">
            Resumen del día · {today}
          </p>
        </div>
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
              <p className="text-[11px] text-slate-500 mt-1">Incluye pendientes y completadas</p>
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
              <p className="text-[11px] text-slate-500 mt-1">Bruto · citas COMPLETADA (semana UTC)</p>
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
              <p className="text-[11px] text-slate-500 mt-1">Productos con stock &lt; mínimo</p>
            </article>
          </section>

          <section className="glass-panel rounded-2xl border border-slate-700/50 p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/30">
                <Clock className="text-violet-300" size={20} aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Próximas citas</h2>
                <p className="text-xs text-slate-500">Hoy · pendientes · orden por hora</p>
              </div>
            </div>

            {proximas.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center border border-dashed border-slate-700 rounded-xl">
                No hay citas pendientes para hoy.
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
                        <span className="text-brand-gold font-black text-sm tabular-nums">{c.hora}</span>
                        <span className="text-white font-bold truncate flex items-center gap-1.5">
                          <UserRound size={14} className="text-slate-500 shrink-0" aria-hidden />
                          {c.cliente_nombre}
                        </span>
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
