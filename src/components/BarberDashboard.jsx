import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Banknote,
  DollarSign,
  History,
  LayoutList,
  Loader2,
  Minus,
  Package,
  Play,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBarberSupabaseData } from '../hooks/useBarberSupabaseData';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import { rangoClass } from './admin/rangoClienteUi';
import { addDaysIso, isFechaInRange, parseHoraToMinutes, ymdLocal } from '../utils/adminFilters';

const HISTORIAL_VISIBLE = 6;

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Primer y último día del mes calendario de una fecha YYYY-MM-DD. */
function monthBoundsYmd(anchorYmd) {
  const [y, m] = anchorYmd.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function formatHoyEs() {
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString('es');
  }
}

function formatFechaEtiqueta(iso) {
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

/** YYYY-MM-DD → texto corto en español */
function formatYmdCorto(ymd) {
  if (!ymd || String(ymd).length < 10) return ymd ?? '—';
  try {
    return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${String(ymd).slice(0, 10)}T12:00:00`)
    );
  } catch {
    return String(ymd).slice(0, 10);
  }
}

/** @param {string | null | undefined} raw */
function rangoDisplay(raw) {
  if (raw == null || raw === '') return null;
  const u = String(raw).toUpperCase();
  if (u === 'ORO') return 'Oro';
  if (u === 'PLATA') return 'Plata';
  if (u === 'BRONCE') return 'Bronce';
  return String(raw);
}

/** @param {string} estado */
function labelEstado(estado) {
  switch (estado) {
    case 'PENDIENTE':
      return 'Pendiente';
    case 'EN_PROCESO':
      return 'En curso';
    case 'COMPLETADA':
      return 'Finalizada';
    case 'CANCELADA':
      return 'Cancelada';
    case 'NO_ASISTIO':
      return 'No asistió';
    default:
      return estado;
  }
}

/** @param {string} estado */
function estadoBadgeClass(estado) {
  switch (estado) {
    case 'COMPLETADA':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
    case 'EN_PROCESO':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/35';
    case 'PENDIENTE':
      return 'bg-amber-500/10 text-amber-200 border-amber-500/30';
    case 'CANCELADA':
      return 'bg-slate-600/30 text-slate-300 border-slate-500/40';
    case 'NO_ASISTIO':
      return 'bg-red-500/10 text-red-300 border-red-500/30';
    default:
      return 'bg-slate-700/50 text-slate-300 border-slate-600';
  }
}

/** TIME de Postgres / string → valor para <input type="time"> */
function hhmmFromDb(t) {
  if (t == null || t === '') return '09:00';
  const s = String(t);
  if (s.length >= 5 && /^\d{1,2}:\d{2}/.test(s)) {
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      const h = String(Number(m[1])).padStart(2, '0');
      const mi = String(Number(m[2])).padStart(2, '0');
      return `${h}:${mi}`;
    }
  }
  return '09:00';
}

function minutosDesdeMedianoche(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function defaultHorarioSemana() {
  return [0, 1, 2, 3, 4, 5, 6].map((dia_semana) => ({
    dia_semana,
    hora_inicio: '09:00',
    hora_fin: '17:00',
    activo: dia_semana !== 0,
  }));
}

export default function BarberDashboard() {
  const { user } = useAuth();
  const barberoId = user?.barberoId;

  const [seccion, setSeccion] = useState('agenda');
  const [toast, setToast] = useState(null);
  const [queryAgenda, setQueryAgenda] = useState('');
  const [queryHistorial, setQueryHistorial] = useState('');
  const [historialExpanded, setHistorialExpanded] = useState(false);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const menuRef = useRef(null);
  const [notasDraft, setNotasDraft] = useState({});
  const [finalizarModal, setFinalizarModal] = useState(null);
  const [montoFinalInput, setMontoFinalInput] = useState('');
  const [accionPending, setAccionPending] = useState(false);
  const [invNombre, setInvNombre] = useState('');
  const [invStock, setInvStock] = useState('0');
  const [invStockMin, setInvStockMin] = useState('5');
  const [horariosEdit, setHorariosEdit] = useState(defaultHorarioSemana);
  const [bloqIni, setBloqIni] = useState(() => addDaysIso(ymdLocal(), 1));
  const [bloqFin, setBloqFin] = useState(() => addDaysIso(ymdLocal(), 1));
  const [bloqMotivo, setBloqMotivo] = useState('');
  const [bloqueoBorrar, setBloqueoBorrar] = useState(null);

  const {
    loading,
    error,
    refresh,
    hoyYmd,
    barberoRow,
    citas: citasRaw,
    horarios,
    bloqueos,
    inventario,
    liquidaciones,
    updateCita,
    updateInventarioStock,
    insertInventarioItem,
    upsertHorariosTrabajo,
    insertBloqueoAgenda,
    deleteBloqueoAgenda,
  } = useBarberSupabaseData(barberoId);

  const showToast = useCallback((t) => setToast(t), []);

  useEffect(() => {
    if (!toast) return undefined;
    const tm = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(tm);
  }, [toast]);

  useEffect(() => {
    setNotasDraft((prev) => {
      const next = { ...prev };
      for (const c of citasRaw) {
        if (next[c.id] === undefined) next[c.id] = c.notas ?? '';
      }
      for (const id of Object.keys(next)) {
        if (!citasRaw.some((c) => c.id === id)) delete next[id];
      }
      return next;
    });
  }, [citasRaw]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuAbiertoId(null);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const agendaFinYmd = useMemo(() => addDaysIso(hoyYmd, 14), [hoyYmd]);

  const perfilBarbero = useMemo(() => {
    if (barberoRow) {
      return {
        nombre: barberoRow.nombre ?? user?.nombre ?? 'Barbero',
        porcentaje: Number(barberoRow.porcentaje ?? 0),
        cortesRealizados: Number(barberoRow.cortes_realizados ?? 0),
      };
    }
    return {
      nombre: user?.nombre ?? 'Barbero',
      porcentaje: 0,
      cortesRealizados: 0,
    };
  }, [barberoRow, user?.nombre]);

  const citasVentana = useMemo(
    () =>
      citasRaw.filter((c) => c.fecha >= hoyYmd && c.fecha <= agendaFinYmd).sort((a, b) => {
        const df = a.fecha.localeCompare(b.fecha);
        if (df !== 0) return df;
        return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
      }),
    [citasRaw, hoyYmd, agendaFinYmd]
  );

  const citasHistorial = useMemo(
    () =>
      citasRaw
        .filter((c) => c.fecha < hoyYmd)
        .sort((a, b) => {
          const df = b.fecha.localeCompare(a.fecha);
          if (df !== 0) return df;
          return parseHoraToMinutes(b.hora) - parseHoraToMinutes(a.hora);
        }),
    [citasRaw, hoyYmd]
  );

  const boundsMes = useMemo(() => monthBoundsYmd(hoyYmd), [hoyYmd]);
  const [finDesde, setFinDesde] = useState(boundsMes.start);
  const [finHasta, setFinHasta] = useState(boundsMes.end);

  useEffect(() => {
    setFinDesde(boundsMes.start);
    setFinHasta(boundsMes.end);
  }, [boundsMes.start, boundsMes.end]);

  const citasHoyList = useMemo(() => citasRaw.filter((c) => c.fecha === hoyYmd), [citasRaw, hoyYmd]);

  const pendientesHoy = citasHoyList.filter((c) => c.estado === 'PENDIENTE').length;
  const completadasHoy = citasHoyList.filter((c) => c.estado === 'COMPLETADA').length;
  const enProcesoHoy = citasHoyList.filter((c) => c.estado === 'EN_PROCESO').length;

  const comisionPct = perfilBarbero.porcentaje / 100;

  const facturacionHoy = useMemo(
    () =>
      citasHoyList.reduce((acc, c) => {
        if (c.estado !== 'COMPLETADA') return acc;
        return acc + Number(c.monto ?? 0);
      }, 0),
    [citasHoyList]
  );

  const comisionHoyRegistrada = useMemo(
    () =>
      citasHoyList.reduce((acc, c) => {
        if (c.estado !== 'COMPLETADA') return acc;
        const cm = Number(c.comision_monto ?? 0);
        if (cm > 0) return acc + cm;
        return acc + Number(c.monto ?? 0) * comisionPct;
      }, 0),
    [citasHoyList, comisionPct]
  );

  const historialFiltrado = useMemo(() => {
    const q = queryHistorial.trim().toLowerCase();
    if (!q) return citasHistorial;
    return citasHistorial.filter((c) =>
      `${c.clienteNombre} ${c.servicios ?? ''} ${c.pedidoCliente ?? ''} ${c.estado} ${c.fecha} ${rangoDisplay(c.rangoCliente) ?? ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [citasHistorial, queryHistorial]);

  const historialVisible = historialExpanded
    ? historialFiltrado
    : historialFiltrado.slice(0, HISTORIAL_VISIBLE);

  const citasFiltradas = useMemo(() => {
    const q = queryAgenda.trim().toLowerCase();
    if (!q) return citasVentana;
    return citasVentana.filter((c) =>
      `${c.clienteNombre} ${c.servicios ?? ''} ${c.pedidoCliente ?? ''} ${notasDraft[c.id] ?? c.notas ?? ''} ${c.fecha} ${rangoDisplay(c.rangoCliente) ?? ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [citasVentana, queryAgenda, notasDraft]);

  const citasPorDia = useMemo(() => {
    const map = new Map();
    for (const c of citasFiltradas) {
      if (!map.has(c.fecha)) map.set(c.fecha, []);
      map.get(c.fecha).push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [citasFiltradas]);

  const movimientosCobrados = useMemo(() => {
    const rows = [];
    for (const c of citasRaw) {
      if (c.estado !== 'COMPLETADA' || !(Number(c.monto) > 0)) continue;
      rows.push({
        key: String(c.id),
        fecha: c.fecha,
        hora: c.hora,
        clienteId: c.clienteId,
        clienteNombre: c.clienteNombre,
        servicio: c.servicios ?? '—',
        monto: Number(c.monto),
        comision_monto: Number(c.comision_monto ?? 0),
        rangoCliente: c.rangoCliente,
      });
    }
    rows.sort((a, b) => {
      const df = b.fecha.localeCompare(a.fecha);
      if (df !== 0) return df;
      return parseHoraToMinutes(b.hora) - parseHoraToMinutes(a.hora);
    });
    return rows;
  }, [citasRaw]);

  const movimientosEnRango = useMemo(
    () => movimientosCobrados.filter((m) => isFechaInRange(m.fecha, finDesde, finHasta)),
    [movimientosCobrados, finDesde, finHasta]
  );

  const totalFacturadoRango = useMemo(
    () => movimientosEnRango.reduce((s, m) => s + m.monto, 0),
    [movimientosEnRango]
  );

  const totalComisionRango = useMemo(
    () =>
      movimientosEnRango.reduce((s, m) => {
        if (m.comision_monto > 0) return s + m.comision_monto;
        return s + m.monto * comisionPct;
      }, 0),
    [movimientosEnRango, comisionPct]
  );

  const totalPagosLiquidaciones = useMemo(
    () => liquidaciones.reduce((s, l) => s + l.montoPagado, 0),
    [liquidaciones]
  );

  const aplicarRangoMesActual = useCallback(() => {
    setFinDesde(boundsMes.start);
    setFinHasta(boundsMes.end);
  }, [boundsMes]);

  const aplicarUltimosDias = useCallback((n) => {
    const hasta = hoyYmd;
    const desde = addDaysIso(hoyYmd, -(n - 1));
    setFinDesde(desde);
    setFinHasta(hasta);
  }, [hoyYmd]);

  const copiarTexto = useCallback(async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      showToast({ type: 'ok', message: 'Copiado al portapapeles.' });
    } catch {
      showToast({ type: 'err', message: 'No se pudo copiar.' });
    }
    setMenuAbiertoId(null);
  }, [showToast]);

  const handleIniciar = useCallback(
    async (citaId) => {
      setAccionPending(true);
      try {
        await updateCita(citaId, { estado: 'EN_PROCESO' });
        showToast({ type: 'ok', message: 'Cita en curso.' });
        setMenuAbiertoId(null);
      } catch (e) {
        showToast({ type: 'err', message: e instanceof Error ? e.message : 'Error al actualizar.' });
      } finally {
        setAccionPending(false);
      }
    },
    [updateCita, showToast]
  );

  const abrirFinalizar = useCallback((cita) => {
    setMontoFinalInput(cita.monto > 0 ? String(cita.monto) : '');
    setFinalizarModal(cita);
  }, []);

  const confirmarFinalizar = useCallback(async () => {
    if (!finalizarModal) return;
    const monto = Math.max(0, Number.parseFloat(String(montoFinalInput).replace(',', '.')) || 0);
    const pct = perfilBarbero.porcentaje / 100;
    const comision_monto = Math.round(monto * pct * 100) / 100;
    setAccionPending(true);
    try {
      await updateCita(finalizarModal.id, {
        estado: 'COMPLETADA',
        monto,
        comision_monto: comision_monto,
      });
      showToast({ type: 'ok', message: 'Cita finalizada y monto registrado.' });
      setFinalizarModal(null);
      setMenuAbiertoId(null);
    } catch (e) {
      showToast({ type: 'err', message: e instanceof Error ? e.message : 'Error al finalizar.' });
    } finally {
      setAccionPending(false);
    }
  }, [finalizarModal, montoFinalInput, perfilBarbero.porcentaje, updateCita, showToast]);

  const guardarNotas = useCallback(
    async (citaId) => {
      const texto = notasDraft[citaId] ?? '';
      setAccionPending(true);
      try {
        await updateCita(citaId, { notas: texto });
        showToast({ type: 'ok', message: 'Notas guardadas.' });
      } catch (e) {
        showToast({ type: 'err', message: e instanceof Error ? e.message : 'Error al guardar notas.' });
      } finally {
        setAccionPending(false);
      }
    },
    [notasDraft, updateCita, showToast]
  );

  const ajustarStock = useCallback(
    async (itemId, delta) => {
      const item = inventario.find((i) => i.id === itemId);
      if (!item) return;
      const next = Math.max(0, item.stock + delta);
      setAccionPending(true);
      try {
        await updateInventarioStock(itemId, next);
        showToast({ type: 'ok', message: 'Stock actualizado.' });
      } catch (e) {
        showToast({ type: 'err', message: e instanceof Error ? e.message : 'Error de inventario.' });
      } finally {
        setAccionPending(false);
      }
    },
    [inventario, updateInventarioStock, showToast]
  );

  const anhadirProducto = useCallback(async () => {
    setAccionPending(true);
    try {
      await insertInventarioItem({
        nombre: invNombre,
        stock: invStock,
        stock_minimo: invStockMin,
      });
      showToast({ type: 'ok', message: 'Producto añadido a tu inventario.' });
      setInvNombre('');
      setInvStock('0');
      setInvStockMin('5');
    } catch (e) {
      showToast({ type: 'err', message: e instanceof Error ? e.message : 'No se pudo crear el producto.' });
    } finally {
      setAccionPending(false);
    }
  }, [insertInventarioItem, invNombre, invStock, invStockMin, showToast]);

  useEffect(() => {
    const base = defaultHorarioSemana();
    const byDia = new Map((horarios || []).map((h) => [h.dia_semana, h]));
    setHorariosEdit(
      base.map((d) => {
        const row = byDia.get(d.dia_semana);
        if (!row) return d;
        return {
          dia_semana: d.dia_semana,
          hora_inicio: hhmmFromDb(row.hora_inicio),
          hora_fin: hhmmFromDb(row.hora_fin),
          activo: row.activo !== false,
        };
      })
    );
  }, [horarios]);

  const horariosOrdenadosEdicion = useMemo(
    () => [...horariosEdit].sort((a, b) => a.dia_semana - b.dia_semana),
    [horariosEdit]
  );

  const guardarHorariosDisponibilidad = useCallback(async () => {
    for (const h of horariosEdit) {
      if (!h.activo) continue;
      if (minutosDesdeMedianoche(h.hora_fin) <= minutosDesdeMedianoche(h.hora_inicio)) {
        showToast({ type: 'err', message: `Hora fin debe ser posterior al inicio (${DIAS_SEMANA[h.dia_semana] ?? h.dia_semana}).` });
        return;
      }
    }
    setAccionPending(true);
    try {
      await upsertHorariosTrabajo(horariosEdit);
      showToast({ type: 'ok', message: 'Horarios guardados.' });
    } catch (e) {
      showToast({ type: 'err', message: e instanceof Error ? e.message : 'No se pudieron guardar los horarios.' });
    } finally {
      setAccionPending(false);
    }
  }, [horariosEdit, upsertHorariosTrabajo, showToast]);

  const crearBloqueoBarbero = useCallback(
    async (e) => {
      e.preventDefault();
      setAccionPending(true);
      try {
        await insertBloqueoAgenda({
          fecha_inicio: bloqIni,
          fecha_fin: bloqFin,
          motivo: bloqMotivo,
        });
        showToast({ type: 'ok', message: 'Bloqueo creado.' });
        setBloqMotivo('');
        setBloqIni(addDaysIso(hoyYmd, 1));
        setBloqFin(addDaysIso(hoyYmd, 1));
      } catch (err) {
        showToast({ type: 'err', message: err instanceof Error ? err.message : 'Error al crear bloqueo.' });
      } finally {
        setAccionPending(false);
      }
    },
    [bloqIni, bloqFin, bloqMotivo, hoyYmd, insertBloqueoAgenda, showToast]
  );

  const confirmarBorrarBloqueo = useCallback(async () => {
    if (!bloqueoBorrar?.id) return;
    setAccionPending(true);
    try {
      await deleteBloqueoAgenda(bloqueoBorrar.id);
      showToast({ type: 'ok', message: 'Bloqueo eliminado.' });
      setBloqueoBorrar(null);
    } catch (e) {
      showToast({ type: 'err', message: e instanceof Error ? e.message : 'No se pudo eliminar.' });
    } finally {
      setAccionPending(false);
    }
  }, [bloqueoBorrar, deleteBloqueoAgenda, showToast]);

  if (!barberoId) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="mx-auto text-amber-400" size={40} aria-hidden />
        <h1 className="text-xl font-bold text-white">Perfil sin barbero</h1>
        <p className="text-slate-400 text-sm">
          Tu cuenta no tiene un <code className="text-slate-300">barbero_id</code> en perfiles. Pide al administrador que
          vincule tu usuario a un registro en la tabla <strong className="text-slate-300">barberos</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-5xl mx-auto pb-12">
      <ConfirmDialog
        open={!!bloqueoBorrar}
        title="Eliminar bloqueo"
        message={
          bloqueoBorrar
            ? `¿Quitar el bloqueo del ${bloqueoBorrar.fecha_inicio} al ${bloqueoBorrar.fecha_fin}?`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmarBorrarBloqueo}
        onCancel={() => setBloqueoBorrar(null)}
      />
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-md ${
            toast.type === 'ok' ? 'bg-slate-900 border-emerald-500/40 text-emerald-100' : 'bg-slate-900 border-red-500/40 text-red-200'
          }`}
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

      {finalizarModal && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal
          aria-labelledby="finalizar-titulo"
        >
          <div className="glass-panel border border-slate-600 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 id="finalizar-titulo" className="text-lg font-bold text-white">
              Finalizar cita
            </h2>
            <p className="text-sm text-slate-400">
              Cliente: <span className="text-white font-semibold">{finalizarModal.clienteNombre}</span>
            </p>
            <div>
              <label htmlFor="monto-final" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Monto cobrado
              </label>
              <input
                id="monto-final"
                type="number"
                min={0}
                step="0.01"
                value={montoFinalInput}
                onChange={(e) => setMontoFinalInput(e.target.value)}
                className="mt-1 w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                placeholder="0.00"
              />
              <p className="text-xs text-slate-500 mt-2">
                Comisión estimada ({perfilBarbero.porcentaje}%):{' '}
                <span className="text-brand-gold font-bold">
                  $
                  {(
                    Math.max(0, Number.parseFloat(String(montoFinalInput).replace(',', '.')) || 0) * comisionPct
                  ).toFixed(2)}
                </span>
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setFinalizarModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800 border border-slate-600"
                disabled={accionPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarFinalizar}
                disabled={accionPending}
                className="px-4 py-2 rounded-xl text-sm font-black bg-brand-gold text-brand-dark hover:brightness-110 disabled:opacity-50"
              >
                {accionPending ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="animate-spin text-brand-gold" size={40} aria-hidden />
          <span className="text-sm font-medium">Cargando tu panel…</span>
        </div>
      ) : error ? (
        <div className="glass-panel p-6 border border-red-500/30 max-w-2xl mx-auto">
          <AlertCircle className="text-red-400" size={24} aria-hidden />
          <p className="text-red-200 mt-3 font-bold">No se pudieron cargar los datos</p>
          <p className="text-red-300/90 text-sm mt-1">{error}</p>
          <button
            type="button"
            onClick={() => refresh()}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold border border-slate-600 hover:bg-slate-700"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <details className="glass-panel border border-slate-700/60 group">
            <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-3 text-sm text-slate-400 hover:text-slate-300 select-none">
              <span className="flex items-center gap-2">
                <CalendarDays size={18} className="text-brand-accent shrink-0" aria-hidden />
                <span className="font-bold text-white">Datos en vivo</span>
                <span className="hidden sm:inline text-slate-500">
                  — RLS: 010–013 panel; 014 ver pagos (liquidaciones) en Finanzas.
                </span>
              </span>
              <ChevronDown
                size={18}
                className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="px-4 pb-4 pt-0 text-sm text-slate-400 border-t border-slate-700/50 space-y-2">
              <p>
                Estados: <strong className="text-slate-300">Pendiente</strong> → <strong className="text-slate-300">En curso</strong> (Iniciar) →{' '}
                <strong className="text-slate-300">Finalizada</strong> (Finalizar + monto). Las notas se guardan en{' '}
                <code className="text-slate-500">citas.notas</code>.
              </p>
              <p>
                Si la agenda sale vacía pero en el admin sí hay citas, casi siempre el <code className="text-slate-500">barbero_id</code> de la
                cita no coincide con el de tu perfil. Comprueba en Supabase Table Editor.
              </p>
            </div>
          </details>

          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} aria-hidden />
                <span className="capitalize">{formatHoyEs()}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight flex items-center gap-3 flex-wrap">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 border border-brand-accent/30">
                  <Calendar className="text-brand-accent" size={26} aria-hidden />
                </span>
                Panel barbero
              </h1>
              <p className="text-slate-400 max-w-xl">
                Hola, <span className="text-white font-semibold">{user?.nombre}</span>. Aquí ves solo las citas asignadas a ti,
                tu disponibilidad y tu inventario.
              </p>
            </div>

            <div
              className="glass-panel p-4 border border-slate-700/60 flex items-center gap-4 min-w-[min(100%,280px)]"
              aria-label="Tu perfil"
            >
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-brand-accent/30 to-slate-800 border border-slate-600 flex items-center justify-center shrink-0">
                <User className="text-brand-accent" size={28} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{perfilBarbero.nombre}</p>
                <p className="text-sm text-slate-400">
                  Comisión <span className="text-brand-gold font-black">{perfilBarbero.porcentaje}%</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-500">{perfilBarbero.cortesRealizados} cortes (total histórico)</span>
                </p>
              </div>
            </div>
          </header>

          <div
            className="flex flex-wrap p-1 bg-slate-900/80 rounded-xl border border-slate-700/50 w-full max-w-4xl gap-1"
            role="tablist"
            aria-label="Secciones"
          >
            {[
              { id: 'agenda', label: 'Agenda' },
              { id: 'disponibilidad', label: 'Disponibilidad' },
              { id: 'inventario', label: 'Inventario', icon: Package },
              { id: 'finanzas', label: 'Finanzas', icon: Wallet, gold: true },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={seccion === tab.id}
                onClick={() => setSeccion(tab.id)}
                className={`flex-1 min-w-[6.5rem] py-2.5 px-3 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${
                  seccion === tab.id
                    ? tab.gold
                      ? 'bg-brand-gold text-brand-dark shadow-lg'
                      : 'bg-brand-accent text-brand-dark shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {TabIcon ? <TabIcon size={16} aria-hidden /> : null}
                {tab.label}
              </button>
            );
            })}
          </div>

          {seccion === 'agenda' && (
            <>
              <section aria-label="Resumen" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Citas 15 días</p>
                  <p className="text-2xl font-black text-white">{citasVentana.length}</p>
                  <p className="text-xs text-slate-500">
                    {hoyYmd} → {agendaFinYmd}
                  </p>
                </div>
                <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Hoy</p>
                  <p className="text-2xl font-black text-brand-accent">{pendientesHoy}</p>
                  <p className="text-xs text-slate-500">
                    pendientes · {enProcesoHoy} en curso · {completadasHoy} finalizadas
                  </p>
                </div>
                <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cobrado hoy</p>
                  <p className="text-2xl font-black text-white">${facturacionHoy.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">citas finalizadas</p>
                </div>
                <div className="glass-panel p-4 border border-brand-gold/25 bg-brand-gold/5 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    Comisiones hoy
                  </p>
                  <p className="text-2xl font-black text-brand-gold">${comisionHoyRegistrada.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">según monto y tu {perfilBarbero.porcentaje}%</p>
                </div>
              </section>

              <section className="space-y-4" aria-labelledby="agenda-2sem-heading">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 id="agenda-2sem-heading" className="text-xl font-bold text-white flex items-center gap-2">
                      <LayoutList className="text-brand-accent" size={22} aria-hidden />
                      Próximas dos semanas
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Del <span className="font-mono text-slate-400">{hoyYmd}</span> al{' '}
                      <span className="font-mono text-slate-400">{agendaFinYmd}</span> (inclusive).
                    </p>
                  </div>
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
                    <input
                      type="search"
                      value={queryAgenda}
                      onChange={(e) => setQueryAgenda(e.target.value)}
                      placeholder="Buscar cliente, servicio o fecha…"
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                      aria-label="Buscar en la agenda"
                    />
                  </div>
                </div>

                {citasVentana.length === 0 ? (
                  <div className="space-y-4">
                    <EmptyState
                      title="Sin citas en estas dos semanas"
                      hint="O no hay citas en la base para este rango, o ninguna está asignada a tu barbero_id."
                    />
                    <div className="glass-panel p-4 border border-slate-700/50 text-sm text-slate-400 space-y-3">
                      <p className="text-slate-300 font-bold">Qué revisar</p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>
                          En <strong className="text-white">Operativa / admin</strong>, al crear la cita elige como barbero a{' '}
                          <strong className="text-white">{perfilBarbero.nombre}</strong> (mismo registro que tu usuario).
                        </li>
                        <li>
                          Tu UUID en base de datos (debe ser el <code className="text-slate-500">barbero_id</code> de cada cita):
                        </li>
                      </ul>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-xs font-mono bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-700 break-all text-brand-accent">
                          {barberoId}
                        </code>
                        <button
                          type="button"
                          onClick={() => copiarTexto(barberoId)}
                          className="text-xs font-bold text-brand-accent hover:underline shrink-0"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : citasFiltradas.length === 0 ? (
                  <EmptyState title="Nada coincide con la búsqueda" hint="Prueba otro término." />
                ) : (
                  <div className="space-y-10">
                    {citasPorDia.map(([fecha, lista]) => (
                      <div key={fecha} className="space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-black text-white capitalize">{formatFechaEtiqueta(fecha)}</h3>
                          {fecha === hoyYmd && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-brand-accent/20 text-brand-accent border border-brand-accent/40">
                              Hoy
                            </span>
                          )}
                          <span className="text-xs text-slate-500 font-mono">{fecha}</span>
                        </div>
                        <div className="relative pl-4 sm:pl-6 space-y-4 before:absolute before:left-[11px] sm:before:left-[15px] before:top-3 before:bottom-3 before:w-px before:bg-gradient-to-b before:from-brand-accent/50 before:via-slate-600 before:to-slate-700">
                          {lista.map((cita) => {
                            const hecha = cita.estado === 'COMPLETADA';
                            const enCurso = cita.estado === 'EN_PROCESO';
                            const rangoCli = rangoDisplay(cita.rangoCliente);
                            const puedeIniciar = cita.estado === 'PENDIENTE';
                            const puedeFinalizar =
                              cita.estado === 'PENDIENTE' || cita.estado === 'EN_PROCESO';

                            return (
                              <article
                                key={cita.id}
                                className={`relative glass-panel p-5 sm:p-6 border transition-all ${
                                  hecha
                                    ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                                    : enCurso
                                      ? 'border-sky-500/25 bg-sky-500/[0.04]'
                                      : 'border-slate-700/60 hover:border-brand-accent/40'
                                }`}
                              >
                                <span
                                  className={`absolute -left-[5px] sm:-left-[7px] top-8 h-3 w-3 rounded-full border-2 border-brand-dark ${
                                    hecha
                                      ? 'bg-emerald-400'
                                      : enCurso
                                        ? 'bg-sky-400'
                                        : 'bg-brand-accent shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                                  }`}
                                  aria-hidden
                                />
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                                  <div className="flex gap-4 min-w-0 flex-1">
                                    <div className="flex flex-col items-center justify-center p-3 bg-slate-900/90 rounded-xl border border-slate-700 w-[5.5rem] shrink-0">
                                      <Clock className="text-slate-500 mb-1" size={18} aria-hidden />
                                      <span className="font-black text-white text-sm tabular-nums">{cita.hora}</span>
                                    </div>
                                    <div className="min-w-0 space-y-2 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap break-words min-w-0 w-full">
                                          <User size={16} className="text-slate-500 shrink-0" aria-hidden />
                                          {cita.clienteNombre}
                                        </h4>
                                        <span
                                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${estadoBadgeClass(cita.estado)}`}
                                        >
                                          {labelEstado(cita.estado)}
                                        </span>
                                        {rangoCli ? (
                                          <span
                                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${rangoClass(rangoCli)}`}
                                            title="Rango del cliente"
                                          >
                                            {rangoCli}
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="rounded-xl bg-slate-950/70 border border-slate-600/50 px-3 py-2.5">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-brand-accent">
                                          Lo que pidió el cliente
                                        </p>
                                        <p className="text-white text-sm font-medium leading-snug mt-1.5 break-words">
                                          {(cita.pedidoCliente ?? '').trim() || cita.servicios || '—'}
                                        </p>
                                        {(cita.pedidoCliente ?? '').trim() && cita.servicios ? (
                                          <p className="text-xs text-slate-500 mt-1.5">
                                            Servicios: <span className="text-slate-400 font-medium">{cita.servicios}</span>
                                          </p>
                                        ) : null}
                                      </div>
                                      <p className="text-slate-500 text-sm">
                                        <span className="text-slate-400 font-semibold">${Number(cita.monto).toFixed(2)}</span>
                                        {hecha && Number(cita.monto) > 0 && (
                                          <span className="text-brand-gold ml-2">
                                            · comisión{' '}
                                            {Number(cita.comision_monto) > 0
                                              ? `$${Number(cita.comision_monto).toFixed(2)}`
                                              : `~$${(Number(cita.monto) * comisionPct).toFixed(2)}`}
                                          </span>
                                        )}
                                      </p>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500" htmlFor={`notas-${cita.id}`}>
                                          Notas (solo tú / staff)
                                        </label>
                                        <textarea
                                          id={`notas-${cita.id}`}
                                          rows={2}
                                          value={notasDraft[cita.id] ?? ''}
                                          onChange={(e) => setNotasDraft((p) => ({ ...p, [cita.id]: e.target.value }))}
                                          placeholder="Detalles del corte, preferencias…"
                                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 resize-y min-h-[2.75rem]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => guardarNotas(cita.id)}
                                          disabled={accionPending}
                                          className="text-xs font-bold text-brand-accent hover:underline disabled:opacity-50"
                                        >
                                          Guardar notas
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  <div
                                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 flex-wrap justify-end"
                                    ref={menuAbiertoId === cita.id ? menuRef : undefined}
                                  >
                                    {puedeIniciar && (
                                      <button
                                        type="button"
                                        onClick={() => handleIniciar(cita.id)}
                                        disabled={accionPending}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 text-white font-black text-sm rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
                                      >
                                        <Play size={18} aria-hidden />
                                        Iniciar
                                      </button>
                                    )}
                                    {puedeFinalizar && (
                                      <button
                                        type="button"
                                        onClick={() => abrirFinalizar(cita)}
                                        disabled={accionPending}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-gold text-brand-dark font-black text-sm rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
                                      >
                                        <CheckCircle2 size={18} aria-hidden />
                                        Finalizar
                                      </button>
                                    )}
                                    {hecha && (
                                      <span className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 font-bold rounded-xl border border-emerald-500/25 text-sm">
                                        <CheckCircle2 size={18} aria-hidden /> Finalizada
                                      </span>
                                    )}
                                    {!puedeFinalizar && !hecha && (
                                      <span className="text-xs text-slate-500 px-2 py-2 text-center">{labelEstado(cita.estado)}</span>
                                    )}
                                    <div className="relative self-end sm:self-center">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMenuAbiertoId((id) => (id === cita.id ? null : cita.id));
                                        }}
                                        className="p-2.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/80"
                                        aria-expanded={menuAbiertoId === cita.id}
                                        aria-label={`Más acciones para ${cita.clienteNombre}`}
                                      >
                                        <span className="sr-only">Más</span>
                                        <span className="text-lg leading-none">⋯</span>
                                      </button>
                                      {menuAbiertoId === cita.id && (
                                        <div
                                          className="absolute right-0 top-full mt-1 z-30 min-w-[180px] py-1 rounded-xl border border-slate-600 bg-slate-900 shadow-2xl"
                                          role="menu"
                                        >
                                          <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => copiarTexto(cita.clienteNombre)}
                                            className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                          >
                                            <Copy size={16} aria-hidden />
                                            Copiar cliente
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4" aria-labelledby="barber-historial-heading">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <h2 id="barber-historial-heading" className="text-xl font-bold text-white flex items-center gap-2">
                      <History className="text-slate-400" size={22} aria-hidden />
                      Historial
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Citas con fecha anterior a hoy ({hoyYmd}).</p>
                  </div>
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
                    <input
                      type="search"
                      value={queryHistorial}
                      onChange={(e) => setQueryHistorial(e.target.value)}
                      placeholder="Filtrar historial…"
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
                      aria-label="Buscar en historial"
                    />
                  </div>
                </div>

                {historialFiltrado.length === 0 ? (
                  <EmptyState
                    title={citasHistorial.length === 0 ? 'Sin historial' : 'Sin resultados'}
                    hint={citasHistorial.length === 0 ? 'Aún no hay citas pasadas cargadas.' : 'Prueba otro término de búsqueda.'}
                  />
                ) : (
                  <>
                    <ul className="space-y-2">
                      {historialVisible.map((c) => {
                        const rangoCli = rangoDisplay(c.rangoCliente);
                        return (
                          <li
                            key={c.id}
                            className="glass-panel px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-700/50"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-white font-semibold">{c.clienteNombre}</span>
                                {rangoCli ? (
                                  <span
                                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${rangoClass(rangoCli)}`}
                                  >
                                    {rangoCli}
                                  </span>
                                ) : null}
                                <span className="text-slate-600 hidden sm:inline">·</span>
                                <span className="text-slate-400 text-sm">{c.servicios ?? '—'}</span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed border-l-2 border-brand-accent/30 pl-2 break-words">
                                <span className="text-slate-600 font-bold uppercase text-[10px]">Pidió: </span>
                                {(c.pedidoCliente ?? '').trim() || c.servicios || '—'}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                              <span className="text-slate-500 font-mono tabular-nums">
                                {c.fecha} · {c.hora}
                              </span>
                              <span
                                className={
                                  c.estado === 'COMPLETADA'
                                    ? 'text-emerald-400 font-bold'
                                    : c.estado === 'CANCELADA' || c.estado === 'NO_ASISTIO'
                                      ? 'text-amber-400 font-bold'
                                      : 'text-slate-400'
                                }
                              >
                                {labelEstado(c.estado)}
                              </span>
                              {Number(c.monto) > 0 && (
                                <span className="text-brand-gold font-bold">${Number(c.monto).toFixed(2)}</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {historialFiltrado.length > HISTORIAL_VISIBLE && (
                      <button
                        type="button"
                        onClick={() => setHistorialExpanded((v) => !v)}
                        className="text-sm font-bold text-brand-accent hover:underline w-full text-center py-2"
                      >
                        {historialExpanded ? 'Mostrar menos' : `Ver todas (${historialFiltrado.length})`}
                      </button>
                    )}
                  </>
                )}
              </section>
            </>
          )}

          {seccion === 'disponibilidad' && (
            <section className="space-y-8" aria-labelledby="disp-heading">
              <div>
                <h2 id="disp-heading" className="text-xl font-bold text-white flex items-center gap-2">
                  <CalendarDays className="text-brand-accent" size={22} aria-hidden />
                  Tu disponibilidad
                </h2>
                <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                  Edita tus horarios por día y añade bloqueos (vacaciones, almuerzo, etc.). Los cambios se guardan en Supabase. Si al guardar ves
                  error de permisos, ejecuta la migración <strong className="text-slate-400">013</strong> en el SQL Editor.
                </p>
              </div>

              <div className="glass-panel border border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-sm font-bold text-white">Horarios de trabajo</h3>
                  <button
                    type="button"
                    onClick={guardarHorariosDisponibilidad}
                    disabled={accionPending}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-accent text-brand-dark font-black text-sm hover:brightness-110 disabled:opacity-50"
                  >
                    <Save size={18} aria-hidden />
                    Guardar horarios
                  </button>
                </div>
                <ul className="divide-y divide-slate-700/40">
                  {horariosOrdenadosEdicion.map((h) => (
                    <li key={h.dia_semana} className="px-4 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
                      <label className="flex items-center gap-3 min-w-[11rem] cursor-pointer group">
                        <div className="relative flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={h.activo}
                            onChange={(e) =>
                              setHorariosEdit((prev) =>
                                prev.map((row) =>
                                  row.dia_semana === h.dia_semana ? { ...row, activo: e.target.checked } : row
                                )
                              )
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-700/80 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-accent/80 shadow-inner border border-slate-600/50 peer-checked:border-brand-accent/50 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-accent/50"></div>
                        </div>
                        <span className="text-slate-300 group-hover:text-white transition-colors font-semibold text-sm">
                          {DIAS_SEMANA[h.dia_semana] ?? `Día ${h.dia_semana}`}
                        </span>
                      </label>
                      <div className="flex flex-wrap items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 uppercase font-bold">Desde</span>
                          <input
                            type="time"
                            value={h.hora_inicio}
                            disabled={!h.activo}
                            onChange={(e) =>
                              setHorariosEdit((prev) =>
                                prev.map((row) =>
                                  row.dia_semana === h.dia_semana ? { ...row, hora_inicio: e.target.value } : row
                                )
                              )
                            }
                            className="bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white disabled:opacity-40"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 uppercase font-bold">Hasta</span>
                          <input
                            type="time"
                            value={h.hora_fin}
                            disabled={!h.activo}
                            onChange={(e) =>
                              setHorariosEdit((prev) =>
                                prev.map((row) =>
                                  row.dia_semana === h.dia_semana ? { ...row, hora_fin: e.target.value } : row
                                )
                              )
                            }
                            className="bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white disabled:opacity-40"
                          />
                        </div>
                        {!h.activo && <span className="text-xs text-amber-400/90">Día cerrado — no se ofrecen citas este día.</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="glass-panel border border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/40">
                  <h3 className="text-sm font-bold text-white">Bloqueos de agenda</h3>
                  <p className="text-xs text-slate-500 mt-1">Rango de fechas en los que no aceptas citas (además de tus horarios).</p>
                </div>
                <form onSubmit={crearBloqueoBarbero} className="p-4 border-b border-slate-700/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div>
                    <label htmlFor="bloq-ini" className="text-xs font-bold text-slate-500 uppercase">
                      Desde
                    </label>
                    <input
                      id="bloq-ini"
                      type="date"
                      value={bloqIni}
                      onChange={(e) => setBloqIni(e.target.value)}
                      className="mt-1 w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="bloq-fin" className="text-xs font-bold text-slate-500 uppercase">
                      Hasta
                    </label>
                    <input
                      id="bloq-fin"
                      type="date"
                      value={bloqFin}
                      onChange={(e) => setBloqFin(e.target.value)}
                      className="mt-1 w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label htmlFor="bloq-motivo" className="text-xs font-bold text-slate-500 uppercase">
                      Motivo
                    </label>
                    <input
                      id="bloq-motivo"
                      type="text"
                      value={bloqMotivo}
                      onChange={(e) => setBloqMotivo(e.target.value)}
                      placeholder="Ej. Vacaciones, curso…"
                      className="mt-1 w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={accionPending}
                    className="w-full sm:col-span-2 lg:col-span-1 py-2.5 rounded-xl bg-slate-800 text-white font-black text-sm border border-slate-600 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Añadir bloqueo
                  </button>
                </form>
                {bloqueos.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No tienes bloqueos en el rango mostrado. Crea uno con el formulario de arriba.</p>
                ) : (
                  <ul className="divide-y divide-slate-700/40">
                    {bloqueos.map((b) => (
                      <li
                        key={b.id}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="text-white font-medium">{b.motivo || 'Bloqueo'}</p>
                          <p className="text-slate-500 font-mono text-xs">
                            {b.fecha_inicio} → {b.fecha_fin}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setBloqueoBorrar({
                              id: b.id,
                              fecha_inicio: b.fecha_inicio,
                              fecha_fin: b.fecha_fin,
                            })
                          }
                          disabled={accionPending}
                          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/40 text-red-300 text-xs font-bold hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 size={16} aria-hidden />
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {seccion === 'inventario' && (
            <section className="space-y-4" aria-labelledby="inv-priv-heading">
              <div>
                <h2 id="inv-priv-heading" className="text-xl font-bold text-white flex items-center gap-2">
                  <Package className="text-brand-accent" size={22} aria-hidden />
                  Tu inventario
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Añade productos tú mismo o ajusta stock. Si al guardar ves error de permisos, ejecuta en Supabase la migración{' '}
                  <strong className="text-slate-400">012_inventario_barbero_insert_barbero.sql</strong>.
                </p>
              </div>

              <div className="glass-panel p-4 sm:p-5 border border-slate-700/50 space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Añadir producto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="inv-nombre" className="text-xs font-bold text-slate-500 uppercase">
                      Nombre
                    </label>
                    <input
                      id="inv-nombre"
                      type="text"
                      value={invNombre}
                      onChange={(e) => setInvNombre(e.target.value)}
                      placeholder="Ej. Cera, tijeras desechables…"
                      className="mt-1 w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-stock" className="text-xs font-bold text-slate-500 uppercase">
                      Stock inicial
                    </label>
                    <input
                      id="inv-stock"
                      type="number"
                      min={0}
                      value={invStock}
                      onChange={(e) => setInvStock(e.target.value)}
                      className="mt-1 w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-min" className="text-xs font-bold text-slate-500 uppercase">
                      Stock mínimo (alerta)
                    </label>
                    <input
                      id="inv-min"
                      type="number"
                      min={0}
                      value={invStockMin}
                      onChange={(e) => setInvStockMin(e.target.value)}
                      className="mt-1 w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={anhadirProducto}
                  disabled={accionPending || !invNombre.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-accent text-brand-dark font-black text-sm hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  <Plus size={18} aria-hidden />
                  Añadir a mi inventario
                </button>
              </div>

              {inventario.length === 0 ? (
                <EmptyState
                  title="Aún no tienes productos listados"
                  hint="Usa el formulario de arriba. Si Supabase rechaza el INSERT, falta la política RLS de la migración 012."
                />
              ) : (
                <div className="glass-panel border border-slate-700/50 overflow-hidden">
                  <ul className="divide-y divide-slate-700/40">
                    {inventario.map((item) => {
                      const low = item.stock <= item.stockMinimo;
                      return (
                        <li
                          key={item.id}
                          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 ${
                            low ? 'bg-amber-500/[0.04]' : ''
                          }`}
                        >
                          <div className="min-w-0 flex items-start gap-3">
                            <Package className="text-slate-500 shrink-0 mt-0.5" size={20} aria-hidden />
                            <div>
                              <p className="font-bold text-white">{item.nombre}</p>
                              <p className="text-sm text-slate-500">
                                Stock <span className="text-white font-black">{item.stock}</span> · mín. {item.stockMinimo}
                                {low && (
                                  <span className="ml-2 text-amber-400 font-bold inline-flex items-center gap-1">
                                    <AlertTriangle size={14} aria-hidden />
                                    Bajo mínimo
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => ajustarStock(item.id, -1)}
                              disabled={accionPending || item.stock <= 0}
                              className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-700 disabled:opacity-40"
                              aria-label="Menos stock"
                            >
                              <Minus size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => ajustarStock(item.id, 1)}
                              disabled={accionPending}
                              className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-700"
                              aria-label="Más stock"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}

          {seccion === 'finanzas' && (
            <section className="space-y-6" aria-labelledby="barber-finanzas-heading">
              <div>
                <h2 id="barber-finanzas-heading" className="text-xl font-bold text-white flex items-center gap-2">
                  <Wallet className="text-brand-gold" size={22} aria-hidden />
                  Tus finanzas
                </h2>
                <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                  <strong className="text-slate-400">Pagos recibidos</strong> abajo: lo que la caja registró en{' '}
                  <code className="text-slate-600">liquidaciones</code>. Más abajo, el detalle por citas es tu comisión generada en el periodo
                  que elijas (no sustituye al pago real hasta que exista una liquidación).
                </p>
              </div>

              <div className="glass-panel border border-emerald-500/20 bg-emerald-500/[0.04] overflow-hidden">
                <div className="px-4 py-3 border-b border-emerald-500/15 bg-slate-900/40 flex flex-wrap items-center gap-2">
                  <Banknote className="text-emerald-400 shrink-0" size={20} aria-hidden />
                  <h3 className="text-sm font-bold text-white">Pagos recibidos (liquidaciones)</h3>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Cada fila es un pago que el <strong className="text-slate-400">administrador</strong> registró en el panel{' '}
                    <strong className="text-slate-400">Caja</strong> por un periodo concreto. Si no ves nada aquí, o no hay pagos
                    registrados, o falta ejecutar la migración <strong className="text-slate-400">014</strong> en Supabase (RLS de lectura).
                  </p>
                  <div className="flex flex-wrap gap-4 items-baseline">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total abonado (lista cargada)</p>
                      <p className="text-2xl font-black text-emerald-400">${totalPagosLiquidaciones.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-600 mt-1">Suma de hasta 200 últimas liquidaciones</p>
                    </div>
                  </div>
                  {liquidaciones.length === 0 ? (
                    <EmptyState
                      title="Sin liquidaciones visibles"
                      hint="Cuando la caja registre un pago a tu nombre, aparecerá aquí. Si ya existen en la base y no las ves, aplica 014_liquidaciones_barbero_select.sql."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-700/60">
                      <table className="w-full text-sm text-left min-w-[480px]">
                        <thead>
                          <tr className="border-b border-slate-700/50 text-slate-500 text-xs uppercase tracking-wider bg-slate-900/50">
                            <th className="p-3 font-bold">Fecha de pago</th>
                            <th className="p-3 font-bold">Periodo liquidado</th>
                            <th className="p-3 font-bold text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liquidaciones.map((liq) => (
                            <tr key={liq.id} className="border-b border-slate-700/25 hover:bg-slate-800/40">
                              <td className="p-3 text-white font-medium">{formatYmdCorto(liq.fechaPago)}</td>
                              <td className="p-3 text-slate-400 text-xs">
                                <span className="font-mono tabular-nums">{liq.fechaInicio}</span>
                                <span className="text-slate-600 mx-1">→</span>
                                <span className="font-mono tabular-nums">{liq.fechaFin}</span>
                              </td>
                              <td className="p-3 text-right font-black text-emerald-400 tabular-nums">
                                ${liq.montoPagado.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-panel p-4 border border-slate-700/50 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Atajos de periodo (comisiones por citas)</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={aplicarRangoMesActual}
                    className="px-3 py-2 rounded-lg text-xs font-black bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                  >
                    Mes actual ({boundsMes.start} → {boundsMes.end})
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarUltimosDias(7)}
                    className="px-3 py-2 rounded-lg text-xs font-black bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                  >
                    Últimos 7 días
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarUltimosDias(14)}
                    className="px-3 py-2 rounded-lg text-xs font-black bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                  >
                    Últimos 14 días
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarUltimosDias(30)}
                    className="px-3 py-2 rounded-lg text-xs font-black bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                  >
                    Últimos 30 días
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700/50">
                  <div>
                    <label htmlFor="fin-desde" className="text-xs text-slate-500 block mb-1 font-bold">
                      Desde
                    </label>
                    <input
                      id="fin-desde"
                      type="date"
                      value={finDesde}
                      onChange={(e) => setFinDesde(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="fin-hasta" className="text-xs text-slate-500 block mb-1 font-bold">
                      Hasta
                    </label>
                    <input
                      id="fin-hasta"
                      type="date"
                      value={finHasta}
                      onChange={(e) => setFinHasta(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Servicios en el rango</p>
                  <p className="text-2xl font-black text-white">{movimientosEnRango.length}</p>
                  <p className="text-xs text-slate-500">citas finalizadas con cobro</p>
                </div>
                <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total facturado</p>
                  <p className="text-2xl font-black text-brand-accent">${totalFacturadoRango.toFixed(2)}</p>
                </div>
                <div className="glass-panel p-4 border border-brand-gold/30 bg-brand-gold/5 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    Tu comisión
                  </p>
                  <p className="text-2xl font-black text-brand-gold">${totalComisionRango.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{perfilBarbero.porcentaje}% si no hay comisión guardada</p>
                </div>
              </div>

              {movimientosEnRango.length === 0 ? (
                <EmptyState
                  title="Sin movimientos en este periodo"
                  hint="Amplía las fechas o finaliza citas con monto en la agenda."
                />
              ) : (
                <div className="glass-panel border border-slate-700/50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/40">
                    <h3 className="text-sm font-bold text-white">Detalle por cita (comisiones)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-700/50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="p-3 font-bold">Fecha</th>
                          <th className="p-3 font-bold">Cliente</th>
                          <th className="p-3 font-bold">Rango</th>
                          <th className="p-3 font-bold">Servicio</th>
                          <th className="p-3 font-bold text-right">Ticket</th>
                          <th className="p-3 font-bold text-right">Tu parte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientosEnRango.map((m) => {
                          const rM = rangoDisplay(m.rangoCliente);
                          const parte =
                            m.comision_monto > 0 ? m.comision_monto : m.monto * comisionPct;
                          return (
                            <tr key={m.key} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                              <td className="p-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                                {m.fecha} · {m.hora}
                              </td>
                              <td className="p-3 text-white font-medium">{m.clienteNombre}</td>
                              <td className="p-3">
                                {rM ? (
                                  <span
                                    className={`inline-flex text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${rangoClass(rM)}`}
                                  >
                                    {rM}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="p-3 text-slate-400">{m.servicio}</td>
                              <td className="p-3 text-right font-semibold text-slate-200 tabular-nums">
                                ${m.monto.toFixed(2)}
                              </td>
                              <td className="p-3 text-right font-bold text-brand-gold tabular-nums">
                                ${parte.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          <footer className="text-center text-xs text-slate-600 pt-4 border-t border-slate-800/80">
            <DollarSign className="inline align-middle text-slate-600 mr-1" size={14} aria-hidden />
            Datos desde Supabase · comisiones según monto y porcentaje del barbero
          </footer>
        </>
      )}
    </div>
  );
}
