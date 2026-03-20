import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Calendar,
  CalendarDays,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
  Filter,
  LayoutGrid,
  UserRound,
} from 'lucide-react';
import { supabase } from '../../supabase';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import { addDaysIso, ymdLocal, parseHoraToMinutes, coerceToYmd } from '../../utils/adminFilters';
import {
  parseStartFromRangoLocal,
  parseStartFromRangoUtc,
  ymdUtcFromTs,
} from '../../utils/nuevaCitaHelpers';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** @param {{ code?: string; message?: string }} err */
function mapSupabaseError(err) {
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

function normalizeTimeOrDefault(v, fallback) {
  const s = String(v ?? '').trim();
  return s && /^\d{2}:\d{2}$/.test(s) ? s : fallback;
}

/**
 * Hora para tarjetas: si ya viene mapeada (`hora` 12h), úsala; si no, baja del literal de rango.
 * Formatos típicos: `[2025-03-21 15:00:00+00, ...)` o similar.
 * @param {Record<string, unknown>} cita
 */
function horaCitaParaTarjeta(cita) {
  const h = cita?.hora;
  if (h != null && String(h).trim() !== '' && h !== '—') return String(h);

  const r = cita?.rango_tiempo;
  if (r == null || r === '') return 'Sin hora';

  if (typeof r === 'string') {
    const sinCorchete = r.replace(/^\[/, '');
    const trozoInicio = sinCorchete.split(',')[0]?.trim() ?? '';
    const m24 = trozoInicio.match(/\b(\d{1,2}:\d{2})(?::\d{2})?/);
    if (m24) return m24[1].length >= 5 ? m24[1].slice(0, 5) : m24[1];
    const partes = trozoInicio.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      const candidato = partes[partes.length - 1].replace(/\+.*$/, '');
      if (/^\d{1,2}:\d{2}/.test(candidato)) return candidato.substring(0, 5);
    }
  }

  const parsed = parseStartFromRangoLocal(r);
  return parsed.hora ?? 'Sin hora';
}

/** @param {Record<string, unknown>} cita */
function nombreClienteParaTarjeta(cita) {
  const flat = cita?.cliente_nombre;
  if (flat != null && String(flat).trim() !== '' && flat !== '—') return String(flat);
  const cli = cita?.clientes;
  const nom = cli && typeof cli === 'object' && cli !== null && 'nombre' in cli ? cli.nombre : null;
  if (nom != null && String(nom).trim() !== '') return String(nom);
  const inv = cita?.nombre_invitado;
  if (inv != null && String(inv).trim() !== '') return String(inv);
  return 'Cliente sin nombre';
}

/** @param {Record<string, unknown>} cita */
function fechaCitaParaTarjeta(cita) {
  if (cita?.fecha != null && String(cita.fecha).trim() !== '') return String(cita.fecha);
  const { fecha } = parseStartFromRangoLocal(cita?.rango_tiempo);
  return fecha ?? '—';
}

export default function OperativaDashboard({ readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const [barberos, setBarberos] = useState([]);
  const [barberoId, setBarberoId] = useState('');

  const [horarios, setHorarios] = useState(
    DIAS_SEMANA.map((_, dia_semana) => ({
      dia_semana,
      hora_inicio: '09:00',
      hora_fin: '17:00',
      activo: dia_semana !== 0, // default: activo de lunes a sábado
    }))
  );

  const [bloqueos, setBloqueos] = useState([]);
  const [bloqueosDesde, setBloqueosDesde] = useState(addDaysIso(ymdLocal(), 0));
  const [bloqueosHasta, setBloqueosHasta] = useState(addDaysIso(ymdLocal(), 30));

  const [bloqForm, setBloqForm] = useState({
    fecha_inicio: addDaysIso(ymdLocal(), 1),
    fecha_fin: addDaysIso(ymdLocal(), 1),
    motivo: '',
  });

  const [deleteBloqueoTarget, setDeleteBloqueoTarget] = useState(null);

  const [citasLoading, setCitasLoading] = useState(false);
  const [citasError, setCitasError] = useState(null);
  const [citas, setCitas] = useState([]);
  const [citasDesde, setCitasDesde] = useState(addDaysIso(ymdLocal(), -90));
  const [citasHasta, setCitasHasta] = useState(addDaysIso(ymdLocal(), 90));
  const [citasEstado, setCitasEstado] = useState('');
  const [citasSearch, setCitasSearch] = useState('');
  const [fechaVistaColumnas, setFechaVistaColumnas] = useState(ymdLocal);
  const [filtrarColumnasPorDia, setFiltrarColumnasPorDia] = useState(false);
  const [estadoConfirm, setEstadoConfirm] = useState(null); // { id, nextEstado }

  const showToast = useCallback((t) => {
    setToast(t);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadBarberos = useCallback(async () => {
    const { data, error } = await supabase.from('barberos').select('id,nombre').order('nombre', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, []);

  const loadHorarios = useCallback(async (bid) => {
    if (!bid) return [];
    const { data, error } = await supabase
      .from('horarios_trabajo')
      .select('dia_semana,hora_inicio,hora_fin,activo')
      .eq('barbero_id', bid);
    if (error) throw error;
    return data ?? [];
  }, []);

  const loadBloqueos = useCallback(async (bid, desde, hasta) => {
    if (!bid) return [];
    const { data, error } = await supabase
      .from('bloqueos_agenda')
      .select('id,fecha_inicio,fecha_fin,motivo,created_at')
      .eq('barbero_id', bid)
      .gte('fecha_inicio', desde)
      .lte('fecha_inicio', hasta)
      .order('fecha_inicio', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, []);

  /**
   * Solo tabla `public.citas` (FK `barbero_id` → `barberos`). Fecha/hora desde `rango_tiempo`.
   * El selector de barbero superior es solo para horarios/bloqueos, no filtra esta lista.
   */
  const loadCitas = useCallback(async () => {
    setCitasLoading(true);
    setCitasError(null);
    try {
      const desdeNorm = coerceToYmd(citasDesde) ?? String(citasDesde).slice(0, 10);
      const hastaNorm = coerceToYmd(citasHasta) ?? String(citasHasta).slice(0, 10);

      // Sin embed `cita_detalles`: su RLS era solo ADMIN y podía vaciar o romper la petición para BARBERO.
      const { data: raw, error: rawErr } = await supabase
        .from('citas')
        .select(
          `id, barbero_id, estado, monto, comision_monto, propina, rango_tiempo, nombre_invitado, created_at,
           barberos ( id, nombre ),
           clientes ( nombre )`
        )
        .limit(2000);

      if (rawErr) throw rawErr;

      const mapped = (raw ?? [])
        .map((row) => {
          const loc = parseStartFromRangoLocal(row.rango_tiempo);
          const utc = parseStartFromRangoUtc(row.rango_tiempo);
          let candidatas = [loc.fecha, utc.fecha].filter(Boolean);
          const createdYmd = ymdUtcFromTs(row.created_at);
          if (candidatas.length === 0 && createdYmd) candidatas = [createdYmd];

          if (candidatas.length === 0) {
            return null;
          }
          const enRango = candidatas.some((f) => f >= desdeNorm && f <= hastaNorm);
          if (!enRango) {
            return null;
          }

          const fecha = loc.fecha || utc.fecha || createdYmd;
          const hora =
            loc.fecha ? loc.hora : utc.fecha ? utc.hora : '—';
          /** PostgREST / Supabase: siempre snake_case `barbero_id` en `citas` (no `barberoId`). */
          const barbero_id = row.barbero_id ?? row.barberos?.id ?? null;
          const clienteNombre = row.clientes?.nombre ?? row.nombre_invitado ?? '—';
          const estado = row.estado;

          if (citasEstado && estado !== citasEstado) {
            return null;
          }

          return {
            cita_id: row.id,
            fecha,
            hora,
            barbero_id,
            barbero_nombre: row.barberos?.nombre ?? '—',
            cliente_nombre: clienteNombre,
            servicios: null,
            estado,
            monto: Number(row.monto ?? 0),
            comision_monto: Number(row.comision_monto ?? 0),
            propina: Number(row.propina ?? 0),
            rango_tiempo: row.rango_tiempo,
            clientes: row.clientes ?? null,
            nombre_invitado: row.nombre_invitado ?? null,
          };
        })
        .filter(Boolean);

      const ids = mapped.map((m) => m.cita_id).filter(Boolean);
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
            const list = byCita.get(d.cita_id) ?? [];
            list.push(nom);
            byCita.set(d.cita_id, list);
          }
          for (const m of mapped) {
            const list = byCita.get(m.cita_id);
            if (list?.length) m.servicios = list.join(', ');
          }
        }
      }

      mapped.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
      });

      setCitas(mapped);
    } catch (err) {
      setCitasError(mapSupabaseError(err));
      setCitas([]);
    } finally {
      setCitasLoading(false);
    }
  }, [citasEstado, citasDesde, citasHasta]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const list = await loadBarberos();
        if (cancelled) return;
        setBarberos(list);
        const firstId = list[0]?.id ?? '';
        setBarberoId((prev) => prev || firstId);
      } catch (err) {
        if (cancelled) return;
        setLoadError(mapSupabaseError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBarberos]);

  useEffect(() => {
    if (!barberoId) return;
    let cancelled = false;
    (async () => {
      try {
        const hs = await loadHorarios(barberoId);
        if (cancelled) return;
        const byDia = new Map(hs.map((r) => [r.dia_semana, r]));
        setHorarios((prev) =>
          prev.map((d) => {
            const row = byDia.get(d.dia_semana);
            if (!row) return d;
            return {
              dia_semana: d.dia_semana,
              hora_inicio: normalizeTimeOrDefault(row.hora_inicio, d.hora_inicio),
              hora_fin: normalizeTimeOrDefault(row.hora_fin, d.hora_fin),
              activo: row.activo !== false,
            };
          })
        );

        const bl = await loadBloqueos(barberoId, bloqueosDesde, bloqueosHasta);
        if (cancelled) return;
        setBloqueos(bl);
      } catch (err) {
        if (cancelled) return;
        // fall back without breaking the whole page
        showToast({ type: 'err', message: mapSupabaseError(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barberoId, bloqueosDesde, bloqueosHasta, loadBloqueos, loadHorarios, showToast]);

  useEffect(() => {
    loadCitas();
  }, [loadCitas]);

  const saveHorarios = async () => {
    if (readOnly) return;
    if (!barberoId) return;
    setSaving(true);
    try {
      const payload = horarios.map((h) => ({
        barbero_id: barberoId,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        activo: h.activo,
      }));
      const { error } = await supabase
        .from('horarios_trabajo')
        .upsert(payload, { onConflict: 'barbero_id,dia_semana' });
      if (error) throw error;
      showToast({ type: 'ok', message: 'Turnos guardados.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const createBloqueo = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (!barberoId) return;
    setSaving(true);
    try {
      const fecha_inicio = bloqForm.fecha_inicio;
      const fecha_fin = bloqForm.fecha_fin;
      if (!fecha_inicio || !fecha_fin) throw new Error('Selecciona un rango de fechas.');
      if (fecha_fin < fecha_inicio) throw new Error('La fecha fin no puede ser anterior a la fecha inicio.');

      const motivo = bloqForm.motivo.trim();
      const payload = {
        barbero_id: barberoId,
        fecha_inicio,
        fecha_fin,
        motivo: motivo || null,
      };
      const { error } = await supabase.from('bloqueos_agenda').insert(payload);
      if (error) throw error;
      setBloqForm({ fecha_inicio: addDaysIso(ymdLocal(), 1), fecha_fin: addDaysIso(ymdLocal(), 1), motivo: '' });
      const bl = await loadBloqueos(barberoId, bloqueosDesde, bloqueosHasta);
      setBloqueos(bl);
      showToast({ type: 'ok', message: 'Bloqueo creado.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const deleteBloqueo = async () => {
    if (!deleteBloqueoTarget || readOnly) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('bloqueos_agenda').delete().eq('id', deleteBloqueoTarget.id);
      if (error) throw error;
      showToast({ type: 'ok', message: 'Bloqueo eliminado.' });
      const bl = await loadBloqueos(barberoId, bloqueosDesde, bloqueosHasta);
      setBloqueos(bl);
      setDeleteBloqueoTarget(null);
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const filteredCitas = useMemo(() => {
    const q = citasSearch.trim().toLowerCase();
    if (!q) return citas;
    return citas.filter((c) => {
      const hay = `${c.cliente_nombre ?? ''} ${c.barbero_nombre ?? ''} ${c.servicios ?? ''} ${c.estado ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [citas, citasSearch]);

  const fechaColumnasNorm = coerceToYmd(fechaVistaColumnas) ?? fechaVistaColumnas;

  const citasPorBarberoColumna = useMemo(() => {
    const pool = filtrarColumnasPorDia
      ? citas.filter((c) => c.fecha === fechaColumnasNorm)
      : citas;
    return barberos.map((b) => ({
      barbero: b,
      citas: pool
        .filter((c) => String(c.barbero_id) === String(b.id))
        .sort((a, b2) => {
          if (a.fecha !== b2.fecha) return a.fecha.localeCompare(b2.fecha);
          return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b2.hora);
        }),
    }));
  }, [barberos, citas, fechaColumnasNorm, filtrarColumnasPorDia]);

  const applyCitaEstado = async (citaId, nextEstado) => {
    if (readOnly) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('citas').update({ estado: nextEstado }).eq('id', citaId);
      if (error) throw error;
      showToast({ type: 'ok', message: 'Estado actualizado.' });
      await loadCitas();
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="animate-spin text-brand-gold" size={40} aria-hidden />
          <span className="text-sm font-medium">Cargando operativa…</span>
        </div>
      ) : loadError ? (
        <div className="max-w-2xl mx-auto glass-panel p-6 border border-red-500/30">
          <AlertCircle className="text-red-400" size={24} aria-hidden />
          <p className="text-red-200 mt-3 font-bold">No se pudo cargar</p>
          <p className="text-red-300/90 text-sm mt-1">{loadError}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="glass-panel p-6 border border-slate-700/50 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Gestión operativa</h2>
                  <p className="text-slate-400 text-sm mt-1">Turnos, bloqueos de agenda y citas (tabla citas)</p>
                </div>

                {readOnly && (
                  <div className="text-amber-400 text-xs font-bold border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
                    Modo solo lectura
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <label className="text-sm font-bold text-slate-300">
                    Barbero
                    <select
                      value={barberoId}
                      onChange={(e) => setBarberoId(e.target.value)}
                      className="ml-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      {barberos.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={saveHorarios}
                    disabled={readOnly || saving}
                    className="ml-auto px-5 py-2.5 rounded-xl bg-brand-gold text-brand-dark font-black text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50 shadow-lg shadow-amber-900/20"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" aria-hidden /> : 'Guardar turnos'}
                  </button>
                </div>

                <div className="glass-panel p-4 border border-slate-700/50 rounded-2xl">
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock size={18} className="text-brand-gold" aria-hidden />
                    Horarios de trabajo
                  </p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {horarios.map((h) => (
                      <div key={h.dia_semana} className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-white">{DIAS_SEMANA[h.dia_semana]}</p>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={h.activo}
                              onChange={(e) =>
                                setHorarios((prev) => prev.map((x) => (x.dia_semana === h.dia_semana ? { ...x, activo: e.target.checked } : x)))
                              }
                              disabled={readOnly}
                              className="rounded border-slate-500 text-brand-gold focus:ring-brand-gold/50"
                            />
                            <span className="text-xs font-bold text-slate-300">{h.activo ? 'Activo' : 'Inactivo'}</span>
                          </label>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[11px] text-slate-500 font-bold">Inicio</p>
                            <input
                              type="time"
                              value={h.hora_inicio}
                              onChange={(e) =>
                                setHorarios((prev) =>
                                  prev.map((x) => (x.dia_semana === h.dia_semana ? { ...x, hora_inicio: e.target.value } : x))
                                )
                              }
                              disabled={readOnly}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500 font-bold">Fin</p>
                            <input
                              type="time"
                              value={h.hora_fin}
                              onChange={(e) =>
                                setHorarios((prev) =>
                                  prev.map((x) => (x.dia_semana === h.dia_semana ? { ...x, hora_fin: e.target.value } : x))
                                )
                              }
                              disabled={readOnly}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-panel p-4 border border-slate-700/50 rounded-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      <LayoutGrid size={18} className="text-brand-gold shrink-0" aria-hidden />
                      Citas por barbero
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={filtrarColumnasPorDia}
                          onChange={(e) => setFiltrarColumnasPorDia(e.target.checked)}
                          className="rounded border-slate-500 text-brand-gold focus:ring-brand-gold/50"
                        />
                        <span className="font-bold">Solo un día</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                        <CalendarDays size={16} className="text-brand-gold shrink-0" aria-hidden />
                        Fecha
                        <input
                          type="date"
                          value={fechaVistaColumnas}
                          onChange={(e) =>
                            setFechaVistaColumnas(coerceToYmd(e.target.value) ?? e.target.value)
                          }
                          disabled={!filtrarColumnasPorDia}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-semibold disabled:opacity-40"
                        />
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Citas del rango <span className="text-slate-400">Desde / Hasta</span> de «Citas (lista)».
                    Activa «Solo un día» para ver solo una fecha en las columnas.
                  </p>
                  <div
                    className="mt-4 flex gap-4 overflow-x-auto pb-2 snap-x scrollbar-thin"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    {citasLoading ? (
                      <div className="flex items-center gap-3 text-slate-400 py-8 px-2">
                        <Loader2 className="animate-spin text-brand-gold" size={22} aria-hidden />
                        <span className="text-sm font-medium">Cargando citas…</span>
                      </div>
                    ) : citasError ? (
                      <p className="text-sm text-red-300 py-4">{citasError}</p>
                    ) : (
                      citasPorBarberoColumna.map(({ barbero: b, citas: colCitas }) => (
                        <section
                          key={b.id}
                          className="snap-start shrink-0 w-[min(100%,260px)] flex flex-col gap-2"
                          aria-labelledby={`op-col-${b.id}`}
                        >
                          <h3
                            id={`op-col-${b.id}`}
                            className="text-xs font-black text-white border-b border-slate-700/80 pb-2 truncate"
                            title={b.nombre}
                          >
                            {b.nombre}
                          </h3>
                          <div className="flex flex-col gap-2 min-h-[72px]">
                            {colCitas.length === 0 ? (
                              <p className="text-[11px] text-slate-500 italic">Sin citas en este criterio</p>
                            ) : (
                              colCitas.map((c) => {
                                const horaCita = horaCitaParaTarjeta(c);
                                const nombreCliente = nombreClienteParaTarjeta(c);
                                const fechaTarjeta = fechaCitaParaTarjeta(c);
                                const idCita = c.cita_id ?? c.id;
                                return (
                                  <article
                                    key={`${b.id}-${idCita}`}
                                    className="rounded-xl border border-slate-600/50 bg-slate-900/70 p-3 shadow-sm shadow-black/20 hover:border-slate-500/60 transition-colors"
                                  >
                                    {!filtrarColumnasPorDia ? (
                                      <p className="text-[10px] font-bold text-slate-500 tabular-nums mb-1">
                                        {fechaTarjeta}
                                      </p>
                                    ) : null}
                                    <div className="flex items-center gap-1.5 text-brand-gold font-bold text-xs tabular-nums">
                                      <Clock size={12} className="opacity-80 shrink-0" aria-hidden />
                                      {horaCita}
                                    </div>
                                    <p className="mt-1.5 text-white font-semibold text-xs leading-snug flex items-start gap-1.5">
                                      <UserRound size={12} className="text-slate-500 shrink-0 mt-0.5" aria-hidden />
                                      <span className="break-words">{nombreCliente}</span>
                                    </p>
                                    {c.servicios ? (
                                      <p className="mt-1.5 text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                                        {c.servicios}
                                      </p>
                                    ) : null}
                                    {c.estado ? (
                                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                        {String(c.estado).replace(/_/g, ' ')}
                                      </p>
                                    ) : null}
                                  </article>
                                );
                              })
                            )}
                          </div>
                        </section>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="glass-panel p-4 border border-slate-700/50 rounded-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <Calendar size={18} className="text-brand-gold" aria-hidden />
                        Bloqueos de agenda
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={bloqueosDesde}
                          onChange={(e) => setBloqueosDesde(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                        <input
                          type="date"
                          value={bloqueosHasta}
                          onChange={(e) => setBloqueosHasta(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>

                    <form onSubmit={createBloqueo} className="mt-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] text-slate-500 font-bold">Fecha inicio</p>
                          <input
                            type="date"
                            value={bloqForm.fecha_inicio}
                            onChange={(e) => setBloqForm((p) => ({ ...p, fecha_inicio: e.target.value }))}
                            disabled={readOnly}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500 font-bold">Fecha fin</p>
                          <input
                            type="date"
                            value={bloqForm.fecha_fin}
                            onChange={(e) => setBloqForm((p) => ({ ...p, fecha_fin: e.target.value }))}
                            disabled={readOnly}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 font-bold">Motivo (opcional)</p>
                        <input
                          value={bloqForm.motivo}
                          onChange={(e) => setBloqForm((p) => ({ ...p, motivo: e.target.value }))}
                          disabled={readOnly}
                          placeholder="Ej. Día libre / vacaciones"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={readOnly || saving}
                        className="w-full py-2.5 rounded-xl bg-brand-gold text-brand-dark font-black text-sm hover:bg-yellow-400 disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Guardando…' : 'Crear bloqueo'}
                      </button>
                    </form>

                    <div className="mt-5 space-y-3">
                      {bloqueos.length === 0 ? (
                        <p className="text-xs text-slate-500">Sin bloqueos en el rango.</p>
                      ) : (
                        bloqueos.map((b) => (
                          <div key={b.id} className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-white">
                                  {b.fecha_inicio} → {b.fecha_fin}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">{b.motivo || '—'}</p>
                              </div>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteBloqueoTarget(b)}
                                  className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-red-400 border border-slate-600/80"
                                  aria-label="Eliminar bloqueo"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="glass-panel p-4 border border-slate-700/50 rounded-2xl">
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      <Filter size={18} className="text-brand-gold" aria-hidden />
                      Citas (lista)
                    </p>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-slate-500 font-bold">Desde</p>
                        <input
                          type="date"
                          value={citasDesde}
                          onChange={(e) => setCitasDesde(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 font-bold">Hasta</p>
                        <input
                          type="date"
                          value={citasHasta}
                          onChange={(e) => setCitasHasta(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] text-slate-500 font-bold">Estado</p>
                        <select
                          value={citasEstado}
                          onChange={(e) => setCitasEstado(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                        >
                          <option value="">Todos</option>
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="COMPLETADA">Completada</option>
                          <option value="CANCELADA">Cancelada</option>
                          <option value="NO_ASISTIO">No asistió</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] text-slate-500 font-bold">Buscar</p>
                        <input
                          value={citasSearch}
                          onChange={(e) => setCitasSearch(e.target.value)}
                          placeholder="Cliente, servicio, estado…"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      {citasLoading ? (
                        <div className="flex items-center gap-3 text-slate-400 py-6">
                          <Loader2 className="animate-spin text-brand-gold" size={22} aria-hidden />
                          <span className="text-sm font-medium">Cargando citas…</span>
                        </div>
                      ) : citasError ? (
                        <div className="text-red-200 text-sm">
                          {citasError}
                        </div>
                      ) : filteredCitas.length === 0 ? (
                        <EmptyState
                          title="Sin citas"
                          hint="Crea citas desde Agenda diaria o ajusta rango y filtros."
                        />
                      ) : (
                        <div className="space-y-3">
                          {filteredCitas.slice(0, 20).map((c) => {
                            const horaCita = horaCitaParaTarjeta(c);
                            const nombreCliente = nombreClienteParaTarjeta(c);
                            const fechaTarjeta = fechaCitaParaTarjeta(c);
                            return (
                            <div key={c.cita_id} className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-white">
                                    {nombreCliente}{' '}
                                    <span className="text-slate-500 font-semibold">·</span> {c.servicios || 'Servicio'}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {fechaTarjeta} · {horaCita} · {c.barbero_nombre}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span
                                    className={`text-[11px] font-black uppercase px-2 py-1 rounded-lg border ${
                                      c.estado === 'COMPLETADA'
                                        ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                                        : c.estado === 'CANCELADA' || c.estado === 'NO_ASISTIO'
                                          ? 'border-red-500/30 text-red-300 bg-red-500/10'
                                          : 'border-slate-600 text-slate-300 bg-slate-900/30'
                                    }`}
                                  >
                                    {c.estado}
                                  </span>
                                  <span className="text-sm font-black text-brand-gold tabular-nums">
                                    ${Number(c.monto).toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              {c.estado === 'PENDIENTE' && !readOnly && (
                                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => applyCitaEstado(c.cita_id, 'COMPLETADA')}
                                    disabled={saving}
                                    className="px-4 py-2 bg-brand-gold text-brand-dark font-bold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 shadow-lg shadow-amber-900/20"
                                  >
                                    <CheckCircle2 size={16} className="inline-block" aria-hidden /> Completar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEstadoConfirm({ id: c.cita_id, nextEstado: 'CANCELADA' })}
                                    disabled={saving}
                                    className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-lg hover:text-red-400 border border-slate-600/80 disabled:opacity-50"
                                  >
                                    <X size={16} className="inline-block" aria-hidden /> Cancelar
                                  </button>
                                </div>
                              )}
                            </div>
                            );
                          })}
                          {filteredCitas.length > 20 && (
                            <p className="text-xs text-slate-500">
                              Mostrando las primeras 20 citas. Ajusta filtros para ver más.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteBloqueoTarget}
        title="Eliminar bloqueo"
        message={
          deleteBloqueoTarget ? `¿Eliminar el bloqueo ${deleteBloqueoTarget.fecha_inicio} → ${deleteBloqueoTarget.fecha_fin}?` : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        onConfirm={deleteBloqueo}
        onCancel={() => setDeleteBloqueoTarget(null)}
      />

      <ConfirmDialog
        open={!!estadoConfirm}
        title="Actualizar estado"
        message={
          estadoConfirm
            ? `¿Cambiar el estado de la cita a «${estadoConfirm.nextEstado}»?`
            : ''
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        danger={estadoConfirm?.nextEstado !== 'COMPLETADA'}
        onConfirm={() => {
          if (!estadoConfirm) return;
          applyCitaEstado(estadoConfirm.id, estadoConfirm.nextEstado);
          setEstadoConfirm(null);
        }}
        onCancel={() => setEstadoConfirm(null)}
      />
    </div>
  );
}

