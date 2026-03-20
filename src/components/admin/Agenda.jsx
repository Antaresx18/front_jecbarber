import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  CalendarDays,
  Plus,
  LayoutGrid,
  UserRound,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../supabase';
import { parseHoraToMinutes, ymdLocal } from '../../utils/adminFilters';
import {
  parseStartFromRangoLocal,
  parseStartFromRangoUtc,
  intervalToMinutes,
  buildRangoTiempoUtc,
  ymdUtcFromTs,
} from '../../utils/nuevaCitaHelpers';

function mapErr(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  if (err.code === '42501' || msg.toLowerCase().includes('permission')) {
    return 'No tienes permiso (rol ADMIN).';
  }
  return msg;
}

function mapSaveErr(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  const code = err.code || '';
  const lower = msg.toLowerCase();
  if (code === '42501' || lower.includes('policy') || lower.includes('permission')) {
    return 'No tienes permiso (hace falta rol ADMIN en «perfiles»).';
  }
  if (code === '23503' || lower.includes('foreign key')) {
    return 'No se puede completar la operación por restricciones en la base de datos.';
  }
  if (lower.includes('duplicate') || code === '23505') {
    return 'Ya existe un registro duplicado.';
  }
  return msg || 'Error al guardar en Supabase.';
}

/** @param {string} estado */
function estadoBadge(estado) {
  const e = String(estado || '').toUpperCase();
  if (e === 'COMPLETADA') {
    return {
      label: 'Completada',
      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    };
  }
  if (e === 'CANCELADA') {
    return {
      label: 'Cancelada',
      className: 'bg-red-500/20 text-red-300 border-red-500/45',
    };
  }
  if (e === 'NO_ASISTIO') {
    return {
      label: 'No asistió',
      className: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
    };
  }
  return {
    label: 'Pendiente',
    className: 'bg-amber-500/20 text-amber-300 border-amber-500/45',
  };
}

/**
 * @typedef {object} CitaAgenda
 * @property {string} cita_id
 * @property {string} barbero_id
 * @property {string} barbero_nombre
 * @property {string} hora
 * @property {string} cliente_nombre
 * @property {string} estado
 * @property {string} [servicios_text]
 */

/** @typedef {{ id: string; nombre: string; activo?: boolean }} BarberoCatalogo */

/** UUID / id estable para Map (evita desajustes por mayúsculas/espacios). */
function keyBarbero(id) {
  return String(id ?? '').trim().toLowerCase();
}

export default function Agenda({ readOnly = false }) {
  const [fecha, setFecha] = useState(ymdLocal);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [barberosCatalogo, setBarberosCatalogo] = useState(/** @type {BarberoCatalogo[]} */ ([]));
  const [citas, setCitas] = useState(/** @type {CitaAgenda[]} */ ([]));

  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [servicios, setServicios] = useState(
    /** @type {{ id: string; nombre: string; precio: number; duracion: unknown }[]} */ ([])
  );
  const [clientes, setClientes] = useState(/** @type {{ id: string; nombre: string }[]} */ ([]));
  const [ncFecha, setNcFecha] = useState(ymdLocal);
  const [ncHora, setNcHora] = useState('10:00');
  const [ncBarberoId, setNcBarberoId] = useState('');
  const [ncServicioIds, setNcServicioIds] = useState(/** @type {string[]} */ ([]));
  const [ncClienteId, setNcClienteId] = useState('');
  const [ncNombreInvitado, setNcNombreInvitado] = useState('');
  const [ncFormErr, setNcFormErr] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  /** Columnas: barberos activos + cualquier barbero con cita ese día (p. ej. inactivo). */
  const barberosColumnas = useMemo(() => {
    const activos = barberosCatalogo.filter((b) => b.activo !== false);
    const byKey = new Map(barberosCatalogo.map((b) => [keyBarbero(b.id), b]));
    const seen = new Set(activos.map((b) => keyBarbero(b.id)));
    const out = [...activos];
    for (const c of citas) {
      const kb = keyBarbero(c.barbero_id);
      if (!kb || seen.has(kb)) continue;
      seen.add(kb);
      const row = byKey.get(kb);
      out.push({
        id: c.barbero_id,
        nombre:
          row?.nombre ??
          (c.barbero_nombre && c.barbero_nombre !== '—' ? c.barbero_nombre : 'Barbero'),
      });
    }
    out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return out;
  }, [barberosCatalogo, citas]);

  const citasPorBarbero = useMemo(() => {
    const m = new Map();
    for (const b of barberosColumnas) {
      m.set(keyBarbero(b.id), []);
    }
    for (const c of citas) {
      const arr = m.get(keyBarbero(c.barbero_id));
      if (arr) arr.push(c);
    }
    return m;
  }, [barberosColumnas, citas]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: barbRows, error: barbErr } = await supabase
        .from('barberos')
        .select('id,nombre,activo')
        .order('nombre', { ascending: true });
      if (barbErr) throw barbErr;
      setBarberosCatalogo(barbRows ?? []);

      const { data: raw, error: rawErr } = await supabase
        .from('citas')
        .select(
          'id,estado,rango_tiempo,nombre_invitado,barbero_id,created_at,barberos(id,nombre),clientes(nombre)'
        )
        .limit(1200);
      if (rawErr) throw rawErr;
      const list = (raw ?? [])
        .map((row) => {
          const loc = parseStartFromRangoLocal(row.rango_tiempo);
          const utc = parseStartFromRangoUtc(row.rango_tiempo);
          const createdYmd = ymdUtcFromTs(row.created_at);
          const enEsteDia =
            loc.fecha === fecha || utc.fecha === fecha || createdYmd === fecha;
          if (!enEsteDia) return null;
          const hora =
            loc.fecha === fecha ? loc.hora : utc.fecha === fecha ? utc.hora : '—';
          const clienteNombre =
            row.clientes?.nombre ?? row.nombre_invitado ?? 'Invitado';
          const barberoId =
            row.barbero_id ?? row.barberos?.id ?? null;
          return {
            cita_id: row.id,
            barbero_id: barberoId,
            barbero_nombre: row.barberos?.nombre ?? '—',
            hora,
            cliente_nombre: clienteNombre,
            estado: row.estado,
            servicios_text: undefined,
          };
        })
        .filter(Boolean);

      const ids = list.map((c) => c.cita_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: detRows, error: detErr } = await supabase
          .from('cita_detalles')
          .select('cita_id, servicios ( nombre )')
          .in('cita_id', ids);
        if (!detErr && detRows?.length) {
          const byCita = new Map();
          for (const d of detRows) {
            const nom = d.servicios?.nombre;
            if (!nom) continue;
            const prev = byCita.get(d.cita_id) ?? [];
            prev.push(nom);
            byCita.set(d.cita_id, prev);
          }
          for (const c of list) {
            const parts = byCita.get(c.cita_id);
            if (parts?.length) c.servicios_text = parts.join(', ');
          }
        }
      }

      list.sort((a, b) => parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora));
      setCitas(list);
    } catch (e) {
      setError(mapErr(e));
      setCitas([]);
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setNcFecha(fecha);
  }, [fecha]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: sRows, error: sErr }, { data: cRows, error: cErr }] = await Promise.all([
        supabase.from('servicios').select('id,nombre,precio,duracion').eq('activo', true).order('nombre'),
        supabase.from('clientes').select('id,nombre').order('nombre').limit(300),
      ]);
      if (cancelled) return;
      if (!sErr && sRows) {
        const list = (sRows ?? []).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          precio: Number(r.precio ?? 0),
          duracion: r.duracion,
        }));
        setServicios(list);
        setNcServicioIds((prev) => (prev.length > 0 ? prev : list[0]?.id ? [list[0].id] : []));
      }
      if (!cErr && cRows) setClientes(cRows ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ncBarberoId) return;
    const first = barberosCatalogo[0];
    if (first) setNcBarberoId(first.id);
  }, [barberosCatalogo, ncBarberoId]);

  const toggleNcServicio = (id) => {
    setNcServicioIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const crearNuevaCita = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setNcFormErr(null);

    if (!ncBarberoId) {
      setNcFormErr('Indica el barbero asignado a esta cita.');
      return;
    }
    if (ncServicioIds.length === 0) {
      setNcFormErr('Marca al menos un servicio.');
      return;
    }

    const elegidos = servicios.filter((s) => ncServicioIds.includes(s.id));
    if (elegidos.length !== ncServicioIds.length) {
      setNcFormErr('Hay servicios no válidos; vuelve a elegir.');
      return;
    }

    const cid = ncClienteId.trim();
    const inv = ncNombreInvitado.trim();
    if (!cid && !inv) {
      setNcFormErr('Selecciona un cliente registrado o escribe el nombre del invitado.');
      return;
    }

    const duracionTotalMin = elegidos.reduce(
      (acc, s) => acc + intervalToMinutes(s.duracion),
      0
    );
    const duracionBloque = duracionTotalMin > 0 ? duracionTotalMin : 30;
    const montoTotal = elegidos.reduce((acc, s) => acc + Number(s.precio ?? 0), 0);
    const rangoTiempo = buildRangoTiempoUtc(ncFecha, ncHora, duracionBloque);
    if (!rangoTiempo) {
      setNcFormErr('Revisa la fecha y la hora.');
      return;
    }

    setSaving(true);
    try {
      const payloadCita = {
        barbero_id: ncBarberoId,
        cliente_id: cid || null,
        nombre_invitado: cid ? null : inv,
        rango_tiempo: rangoTiempo,
        pedido_cliente: '',
        notas: '',
        estado: 'PENDIENTE',
        monto: montoTotal,
        comision_monto: 0,
        metodo_pago: 'EFECTIVO',
        propina: 0,
      };

      const { data: citaCreada, error: errCita } = await supabase
        .from('citas')
        .insert(payloadCita)
        .select('id')
        .single();
      if (errCita) throw errCita;

      const filasDetalle = elegidos.map((s) => ({
        cita_id: citaCreada.id,
        servicio_id: s.id,
        precio_cobrado: Number(s.precio ?? 0),
      }));
      const { error: errDet } = await supabase.from('cita_detalles').insert(filasDetalle);
      if (errDet) throw errDet;

      setToast({ type: 'ok', message: 'Cita creada correctamente.' });
      setNcNombreInvitado('');
      if (ncFecha === fecha) await load();
      else setFecha(ncFecha);
    } catch (err) {
      const msg = mapSaveErr(err);
      setNcFormErr(msg);
      setToast({ type: 'err', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const barberosSelect = barberosCatalogo;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl max-w-[min(90vw,28rem)]
          ${toast.type === 'ok' ? 'bg-slate-900 border-emerald-500/40 text-emerald-100' : 'bg-slate-900 border-red-500/40 text-red-200'}`}
          role="status"
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="text-emerald-400 shrink-0" size={20} aria-hidden />
          ) : (
            <AlertCircle className="text-red-400 shrink-0" size={20} aria-hidden />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-gold/15 border border-brand-gold/30">
            <LayoutGrid className="text-brand-gold" size={24} aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Agenda diaria</h1>
            <p className="text-slate-400 text-sm mt-0.5">Vista por barbero · citas del día · alta de cita</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
            <CalendarDays size={16} className="text-brand-gold shrink-0" aria-hidden />
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </label>
        </div>
      </div>

      {!readOnly && (
        <div className="glass-panel p-5 border border-slate-700/50 rounded-2xl">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Plus size={18} className="text-violet-400" aria-hidden />
            Nueva cita
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Elige barbero, servicios y cliente o invitado. Se guarda en la tabla{' '}
            <code className="text-slate-400">citas</code>.
          </p>
          <form onSubmit={crearNuevaCita} className="mt-4 space-y-3">
            {ncFormErr && (
              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                {ncFormErr}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-[11px] text-slate-500 font-bold mb-1">Barbero asignado a esta cita *</p>
                <select
                  value={ncBarberoId}
                  onChange={(e) => setNcBarberoId(e.target.value)}
                  className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold"
                  required
                >
                  {barberosSelect.length === 0 ? (
                    <option value="">Cargando barberos…</option>
                  ) : (
                    barberosSelect.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-bold mb-1">Fecha</p>
                <input
                  type="date"
                  value={ncFecha}
                  onChange={(e) => setNcFecha(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  required
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-bold mb-1">Hora</p>
                <input
                  type="time"
                  value={ncHora}
                  onChange={(e) => setNcHora(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  required
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-[11px] text-slate-500 font-bold mb-2">Servicios (uno o varios)</p>
                {servicios.length === 0 ? (
                  <p className="text-xs text-slate-500">No hay servicios activos.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {servicios.map((s) => (
                      <li key={s.id}>
                        <label
                          className={`inline-flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                            ncServicioIds.includes(s.id)
                              ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                              : 'border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={ncServicioIds.includes(s.id)}
                            onChange={() => toggleNcServicio(s.id)}
                            className="rounded border-slate-500 text-violet-500 focus:ring-violet-500/40"
                          />
                          <span>
                            {s.nombre}{' '}
                            <span className="text-brand-gold tabular-nums">${s.precio.toFixed(2)}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] text-slate-500 font-bold mb-1">Cliente registrado</p>
                <p className="text-[10px] text-slate-600 mb-1">
                  Si no está en la lista, deja esto vacío y escribe el nombre como invitado.
                </p>
                <select
                  value={ncClienteId}
                  onChange={(e) => {
                    setNcClienteId(e.target.value);
                    if (e.target.value) setNcNombreInvitado('');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">— Invitado (no registrado) —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] text-slate-500 font-bold mb-1">Nombre invitado (si no hay cliente)</p>
                <input
                  type="text"
                  value={ncNombreInvitado}
                  onChange={(e) => setNcNombreInvitado(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  disabled={!!ncClienteId}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 disabled:opacity-50"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={
                saving || servicios.length === 0 || ncServicioIds.length === 0 || !ncBarberoId
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              Guardar cita
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="animate-spin text-brand-gold" size={40} aria-hidden />
          <span className="text-sm font-medium">Cargando agenda…</span>
        </div>
      ) : error ? (
        <div
          className="glass-panel border border-red-500/35 bg-red-950/20 rounded-2xl p-6 flex gap-3 items-start"
          role="alert"
        >
          <AlertCircle className="text-red-400 shrink-0" size={22} />
          <div>
            <p className="font-bold text-red-200">No se pudo cargar la agenda</p>
            <p className="text-sm text-red-300/90 mt-1">{error}</p>
          </div>
        </div>
      ) : barberosColumnas.length === 0 ? (
        <p className="text-slate-500 text-sm py-12 text-center border border-dashed border-slate-700 rounded-2xl">
          No hay barberos en el catálogo. Añade barberos en gestión; si hay citas huérfanas, revisa{' '}
          <code className="text-slate-400">barbero_id</code> en la base de datos.
        </p>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin"
          style={{ scrollbarGutter: 'stable' }}
        >
          {barberosColumnas.map((b) => {
            const delDia = citasPorBarbero.get(keyBarbero(b.id)) ?? [];
            return (
              <section
                key={b.id}
                className="snap-start shrink-0 w-[min(100%,280px)] flex flex-col gap-3"
                aria-labelledby={`agenda-col-${b.id}`}
              >
                <h2
                  id={`agenda-col-${b.id}`}
                  className="text-sm font-black text-white tracking-tight px-1 truncate border-b border-slate-700/80 pb-2"
                  title={b.nombre}
                >
                  {b.nombre}
                </h2>
                <div className="flex flex-col gap-3 min-h-[120px]">
                  {delDia.length === 0 ? (
                    <p className="text-xs text-slate-500 italic px-1">Sin citas</p>
                  ) : (
                    delDia.map((c) => {
                      const badge = estadoBadge(c.estado);
                      return (
                        <article
                          key={c.cita_id}
                          className="rounded-xl border border-slate-600/60 p-3.5 shadow-md shadow-black/25"
                          style={{ backgroundColor: '#1E293B' }}
                        >
                          <div className="flex items-center gap-2 text-brand-gold font-black text-sm tabular-nums">
                            <Clock size={14} className="opacity-80 shrink-0" aria-hidden />
                            {c.hora}
                          </div>
                          <p className="mt-2 text-white font-bold text-sm leading-snug flex items-start gap-1.5">
                            <UserRound
                              size={15}
                              className="text-slate-500 shrink-0 mt-0.5"
                              aria-hidden
                            />
                            <span className="break-words">{c.cliente_nombre}</span>
                          </p>
                          {c.servicios_text ? (
                            <p className="mt-1.5 text-xs text-slate-400 leading-snug line-clamp-2">
                              {c.servicios_text}
                            </p>
                          ) : null}
                          <span
                            className={`inline-flex mt-2.5 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
