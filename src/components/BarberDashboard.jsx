import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  DollarSign,
  History,
  LayoutList,
  Minus,
  Package,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import EmptyState from './ui/EmptyState';
import {
  INITIAL_BARBEROS,
  INITIAL_CLIENTES,
  CITAS_AGENDA_COMPLETA,
  MOCK_HOY,
  MOCK_AGENDA_2SEM_FIN,
  INITIAL_HISTORIAL_CITAS,
  INITIAL_INVENTARIO_BARBERO,
} from './admin/adminData';
import { mapRangoPorClienteId, rangoClass, rangoLabel } from './admin/rangoClienteUi';
import { addDaysIso, isFechaInRange, parseHoraToMinutes } from '../utils/adminFilters';

const HISTORIAL_VISIBLE = 6;

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

export default function BarberDashboard() {
  const { user } = useAuth();
  const barberoId = user?.barberoId ?? 1;

  const [seccion, setSeccion] = useState('agenda');

  const perfilBarbero = useMemo(() => {
    const found = INITIAL_BARBEROS.find((b) => b.id === barberoId) ?? INITIAL_BARBEROS[0];
    return (
      found ?? {
        id: barberoId,
        nombre: user?.nombre ?? 'Barbero',
        porcentaje: 50,
        cortesRealizados: 0,
      }
    );
  }, [barberoId, user?.nombre]);

  const rangoPorClienteId = useMemo(() => mapRangoPorClienteId(INITIAL_CLIENTES), []);

  const baseVentana = useMemo(
    () =>
      CITAS_AGENDA_COMPLETA.filter(
        (c) =>
          c.barberoId === barberoId &&
          c.fecha >= MOCK_HOY &&
          c.fecha <= MOCK_AGENDA_2SEM_FIN
      ).sort((a, b) => {
        const df = a.fecha.localeCompare(b.fecha);
        if (df !== 0) return df;
        return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
      }),
    [barberoId]
  );

  const [citas, setCitas] = useState(baseVentana);
  const [itemsInv, setItemsInv] = useState(() =>
    INITIAL_INVENTARIO_BARBERO.filter((i) => i.barberoId === barberoId)
  );

  const [queryAgenda, setQueryAgenda] = useState('');
  const [queryHistorial, setQueryHistorial] = useState('');
  const [historialExpanded, setHistorialExpanded] = useState(false);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const menuRef = useRef(null);

  const boundsMesMock = useMemo(() => monthBoundsYmd(MOCK_HOY), []);
  const [finDesde, setFinDesde] = useState(boundsMesMock.start);
  const [finHasta, setFinHasta] = useState(boundsMesMock.end);

  useEffect(() => {
    setCitas(baseVentana);
  }, [baseVentana]);

  useEffect(() => {
    setItemsInv(INITIAL_INVENTARIO_BARBERO.filter((i) => i.barberoId === barberoId));
  }, [barberoId]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuAbiertoId(null);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const historialMio = useMemo(
    () =>
      INITIAL_HISTORIAL_CITAS.filter((c) => c.barberoId === barberoId).sort((a, b) =>
        a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0
      ),
    [barberoId]
  );

  const historialFiltrado = useMemo(() => {
    const q = queryHistorial.trim().toLowerCase();
    if (!q) return historialMio;
    return historialMio.filter((c) =>
      `${c.clienteNombre} ${c.servicio} ${c.pedidoCliente ?? ''} ${c.estado} ${c.fecha} ${rangoLabel(rangoPorClienteId, c.clienteId) ?? ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [historialMio, queryHistorial, rangoPorClienteId]);

  const historialVisible = historialExpanded
    ? historialFiltrado
    : historialFiltrado.slice(0, HISTORIAL_VISIBLE);

  const citasFiltradas = useMemo(() => {
    const q = queryAgenda.trim().toLowerCase();
    if (!q) return citas;
    return citas.filter((c) =>
      `${c.clienteNombre} ${c.servicio} ${c.pedidoCliente ?? ''} ${c.notas ?? ''} ${c.fecha} ${rangoLabel(rangoPorClienteId, c.clienteId) ?? ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [citas, queryAgenda, rangoPorClienteId]);

  const citasPorDia = useMemo(() => {
    const map = new Map();
    for (const c of citasFiltradas) {
      if (!map.has(c.fecha)) map.set(c.fecha, []);
      map.get(c.fecha).push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [citasFiltradas]);

  const citasHoyList = useMemo(() => citas.filter((c) => c.fecha === MOCK_HOY), [citas]);

  const pendientes = citasHoyList.filter((c) => c.estado === 'Pendiente').length;
  const completadasHoy = citasHoyList.filter((c) => c.estado === 'Completada').length;
  const totalVentana = citas.length;

  const facturacionHoy = useMemo(
    () =>
      citasHoyList.reduce((acc, c) => acc + (c.estado === 'Completada' ? c.monto : 0), 0),
    [citasHoyList]
  );

  const comisionPct = perfilBarbero.porcentaje / 100;
  const comisionHoyEstimada = facturacionHoy * comisionPct;
  const comisionMesMock = 0;

  const movimientosCobrados = useMemo(() => {
    const rows = [];
    for (const c of historialMio) {
      if (c.estado !== 'Completada' || !(c.monto > 0)) continue;
      rows.push({
        key: `h-${c.id}`,
        fecha: c.fecha,
        hora: c.hora,
        clienteId: c.clienteId,
        clienteNombre: c.clienteNombre,
        servicio: c.servicio,
        monto: c.monto,
      });
    }
    for (const c of citas) {
      if (c.estado !== 'Completada' || !(c.monto > 0)) continue;
      rows.push({
        key: `a-${c.id}`,
        fecha: c.fecha,
        hora: c.hora,
        clienteId: c.clienteId,
        clienteNombre: c.clienteNombre,
        servicio: c.servicio,
        monto: c.monto,
      });
    }
    rows.sort((a, b) => {
      const df = b.fecha.localeCompare(a.fecha);
      if (df !== 0) return df;
      return parseHoraToMinutes(b.hora) - parseHoraToMinutes(a.hora);
    });
    return rows;
  }, [historialMio, citas]);

  const movimientosEnRango = useMemo(
    () => movimientosCobrados.filter((m) => isFechaInRange(m.fecha, finDesde, finHasta)),
    [movimientosCobrados, finDesde, finHasta]
  );

  const totalFacturadoRango = useMemo(
    () => movimientosEnRango.reduce((s, m) => s + m.monto, 0),
    [movimientosEnRango]
  );
  const totalComisionRango = totalFacturadoRango * comisionPct;

  const aplicarRangoMesMock = useCallback(() => {
    setFinDesde(boundsMesMock.start);
    setFinHasta(boundsMesMock.end);
  }, [boundsMesMock]);

  const aplicarUltimosDias = useCallback(
    (n) => {
      const hasta = MOCK_HOY;
      const desde = addDaysIso(MOCK_HOY, -(n - 1));
      setFinDesde(desde);
      setFinHasta(hasta);
    },
    []
  );

  const marcarLista = useCallback((id) => {
    setCitas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, estado: 'Completada' } : c))
    );
    setMenuAbiertoId(null);
  }, []);

  const copiarTexto = useCallback(async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      /* ignore */
    }
    setMenuAbiertoId(null);
  }, []);

  const ajustarStock = useCallback((id, delta) => {
    setItemsInv((prev) =>
      prev.map((it) => (it.id === id ? { ...it, stock: Math.max(0, it.stock + delta) } : it))
    );
  }, []);

  const rangoTexto = `${MOCK_HOY.replaceAll('-', '.')} → ${MOCK_AGENDA_2SEM_FIN.replaceAll('-', '.')}`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-5xl mx-auto pb-12">
      <details className="glass-panel border border-slate-700/60 group">
        <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-3 text-sm text-slate-400 hover:text-slate-300 select-none">
          <span className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand-accent shrink-0" aria-hidden />
            <span className="font-bold text-white">Modo demo</span>
            <span className="hidden sm:inline">
              — agenda 14 días e inventario privado; fechas fijas en mock ({rangoTexto})
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
            El <strong className="text-slate-300">administrador</strong> ve el inventario general en{' '}
            <strong className="text-brand-gold">Inventario</strong> y el de cada barbero en{' '}
            <strong className="text-brand-gold">Stock barberos</strong>.
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
            Hola, <span className="text-white font-semibold">{user?.nombre}</span>. Agenda, inventario de puesto y
            resumen de lo cobrado en el periodo que elijas.
          </p>
        </div>

        <div
          className="glass-panel p-4 border border-slate-700/60 flex items-center gap-4 min-w-[min(100%,280px)]"
          aria-label="Tu perfil en el mock"
        >
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-brand-accent/30 to-slate-800 border border-slate-600 flex items-center justify-center shrink-0">
            <User className="text-brand-accent" size={28} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white truncate">{perfilBarbero.nombre}</p>
            <p className="text-sm text-slate-400">
              Comisión <span className="text-brand-gold font-black">{perfilBarbero.porcentaje}%</span>
              <span className="text-slate-600 mx-1">·</span>
              <span className="text-slate-500">{perfilBarbero.cortesRealizados} cortes (mes mock)</span>
            </p>
          </div>
        </div>
      </header>

      <div
        className="flex flex-wrap p-1 bg-slate-900/80 rounded-xl border border-slate-700/50 w-full max-w-3xl gap-1"
        role="tablist"
        aria-label="Secciones"
      >
        <button
          type="button"
          role="tab"
          aria-selected={seccion === 'agenda'}
          onClick={() => setSeccion('agenda')}
          className={`flex-1 min-w-[7.5rem] py-2.5 px-3 rounded-lg text-sm font-black transition-all ${
            seccion === 'agenda' ? 'bg-brand-accent text-brand-dark shadow-lg' : 'text-slate-400 hover:text-white'
          }`}
        >
          Agenda
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seccion === 'inventario'}
          onClick={() => setSeccion('inventario')}
          className={`flex-1 min-w-[7.5rem] py-2.5 px-3 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${
            seccion === 'inventario' ? 'bg-brand-accent text-brand-dark shadow-lg' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package size={16} aria-hidden />
          Inventario
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seccion === 'finanzas'}
          onClick={() => setSeccion('finanzas')}
          className={`flex-1 min-w-[7.5rem] py-2.5 px-3 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${
            seccion === 'finanzas' ? 'bg-brand-gold text-brand-dark shadow-lg' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wallet size={16} aria-hidden />
          Finanzas
        </button>
      </div>

      {seccion === 'agenda' && (
        <>
          <section aria-label="Resumen" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Citas 14 días</p>
              <p className="text-2xl font-black text-white">{totalVentana}</p>
              <p className="text-xs text-slate-500">en tu ventana</p>
            </div>
            <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Hoy pendientes</p>
              <p className="text-2xl font-black text-brand-accent">{pendientes}</p>
              <p className="text-xs text-slate-500">{completadasHoy} hechas hoy</p>
            </div>
            <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cobrado hoy</p>
              <p className="text-2xl font-black text-white">${facturacionHoy.toFixed(0)}</p>
              <p className="text-xs text-slate-500">completadas · día mock</p>
            </div>
            <div className="glass-panel p-4 border border-brand-gold/25 bg-brand-gold/5 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <TrendingUp size={12} aria-hidden />
                Tu parte hoy
              </p>
              <p className="text-2xl font-black text-brand-gold">${comisionHoyEstimada.toFixed(0)}</p>
              <p className="text-xs text-slate-500">estim. {perfilBarbero.porcentaje}% · mes demo ${comisionMesMock}</p>
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
                  Del <span className="font-mono text-slate-400">{MOCK_HOY}</span> al{' '}
                  <span className="font-mono text-slate-400">{MOCK_AGENDA_2SEM_FIN}</span> (inclusive).
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

            {citas.length === 0 ? (
              <EmptyState
                title="Sin citas en estas dos semanas"
                hint="Cuando conectes el backend, aquí verás tu ventana de 14 días."
              />
            ) : citasFiltradas.length === 0 ? (
              <EmptyState title="Nada coincide con la búsqueda" hint="Prueba otro término." />
            ) : (
              <div className="space-y-10">
                {citasPorDia.map(([fecha, lista]) => (
                  <div key={fecha} className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-black text-white capitalize">
                        {formatFechaEtiqueta(fecha)}
                      </h3>
                      {fecha === MOCK_HOY && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-brand-accent/20 text-brand-accent border border-brand-accent/40">
                          Hoy (mock)
                        </span>
                      )}
                      <span className="text-xs text-slate-500 font-mono">{fecha}</span>
                    </div>
                    <div className="relative pl-4 sm:pl-6 space-y-4 before:absolute before:left-[11px] sm:before:left-[15px] before:top-3 before:bottom-3 before:w-px before:bg-gradient-to-b before:from-brand-accent/50 before:via-slate-600 before:to-slate-700">
                      {lista.map((cita) => {
                        const hecha = cita.estado === 'Completada';
                        const rangoCli = rangoLabel(rangoPorClienteId, cita.clienteId);
                        return (
                          <article
                            key={cita.id}
                            className={`relative glass-panel p-5 sm:p-6 border transition-all ${
                              hecha
                                ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                                : 'border-slate-700/60 hover:border-brand-accent/40'
                            }`}
                          >
                            <span
                              className={`absolute -left-[5px] sm:-left-[7px] top-8 h-3 w-3 rounded-full border-2 border-brand-dark ${
                                hecha ? 'bg-emerald-400' : 'bg-brand-accent shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                              }`}
                              aria-hidden
                            />
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                              <div className="flex gap-4 min-w-0">
                                <div className="flex flex-col items-center justify-center p-3 bg-slate-900/90 rounded-xl border border-slate-700 w-[5.5rem] shrink-0">
                                  <Clock className="text-slate-500 mb-1" size={18} aria-hidden />
                                  <span className="font-black text-white text-sm tabular-nums">{cita.hora}</span>
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <h4 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                                    <User size={16} className="text-slate-500 shrink-0" aria-hidden />
                                    {cita.clienteNombre}
                                    {rangoCli ? (
                                      <span
                                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${rangoClass(rangoCli)}`}
                                        title="Rango del cliente"
                                      >
                                        {rangoCli}
                                      </span>
                                    ) : null}
                                  </h4>
                                  <div className="rounded-xl bg-slate-950/70 border border-slate-600/50 px-3 py-2.5 mt-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-brand-accent">
                                      Lo que pidió el cliente
                                    </p>
                                    <p className="text-white text-sm font-medium leading-snug mt-1.5">
                                      {(cita.pedidoCliente ?? '').trim() || cita.servicio}
                                    </p>
                                    {(cita.pedidoCliente ?? '').trim() ? (
                                      <p className="text-xs text-slate-500 mt-1.5">
                                        Servicio reservado:{' '}
                                        <span className="text-slate-400 font-medium">{cita.servicio}</span>
                                      </p>
                                    ) : null}
                                  </div>
                                  <p className="text-slate-500 text-sm mt-2">
                                    <span className="text-slate-400 font-semibold">${cita.monto.toFixed(2)}</span>
                                    {hecha && (
                                      <span className="text-brand-gold ml-2">
                                        · tu parte ~${(cita.monto * comisionPct).toFixed(2)}
                                      </span>
                                    )}
                                  </p>
                                  {(cita.notas ?? '').trim() !== '' && (
                                    <p className="text-slate-400 text-xs mt-2 border-l-2 border-brand-accent/40 pl-2.5 leading-relaxed">
                                      {cita.notas}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div
                                className="flex items-center gap-2 shrink-0 flex-wrap justify-end"
                                ref={menuAbiertoId === cita.id ? menuRef : undefined}
                              >
                                {hecha ? (
                                  <span className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 font-bold rounded-xl border border-emerald-500/25 text-sm">
                                    <CheckCircle2 size={18} aria-hidden /> Completada
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => marcarLista(cita.id)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-brand-dark font-black text-sm rounded-xl hover:brightness-110 transition-all shadow-lg shadow-brand-accent/20"
                                  >
                                    <CheckCircle2 size={18} aria-hidden />
                                    Marcar lista
                                  </button>
                                )}
                                <div className="relative">
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
                  Historial (antes de la ventana)
                </h2>
                <p className="text-sm text-slate-500 mt-1">Citas pasadas en mock, fuera de las 2 semanas mostradas.</p>
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
                title={historialMio.length === 0 ? 'Sin historial' : 'Sin resultados'}
                hint={
                  historialMio.length === 0
                    ? 'Conecta el API o amplía los datos mock.'
                    : 'Prueba otro término de búsqueda.'
                }
              />
            ) : (
              <>
                <ul className="space-y-2">
                  {historialVisible.map((c) => {
                    const rangoCli = rangoLabel(rangoPorClienteId, c.clienteId);
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
                          <span className="text-slate-400 text-sm">{c.servicio}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed border-l-2 border-brand-accent/30 pl-2">
                          <span className="text-slate-600 font-bold uppercase text-[10px]">Pidió: </span>
                          {(c.pedidoCliente ?? '').trim() || c.servicio}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="text-slate-500 font-mono tabular-nums">
                          {c.fecha} · {c.hora}
                        </span>
                        <span
                          className={
                            c.estado === 'Completada'
                              ? 'text-emerald-400 font-bold'
                              : c.estado === 'Cancelada'
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-400'
                          }
                        >
                          {c.estado}
                        </span>
                        {c.monto > 0 && (
                          <span className="text-brand-gold font-bold">${c.monto.toFixed(2)}</span>
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
                    {historialExpanded
                      ? 'Mostrar menos'
                      : `Ver todas (${historialFiltrado.length})`}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}

      {seccion === 'inventario' && (
        <section className="space-y-4" aria-labelledby="inv-priv-heading">
          <div>
            <h2 id="inv-priv-heading" className="text-xl font-bold text-white flex items-center gap-2">
              <Package className="text-brand-accent" size={22} aria-hidden />
              Tu inventario privado
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Material de tu puesto. El administrador puede revisarlo en <strong className="text-slate-400">Stock barberos</strong>.
            </p>
          </div>
          {itemsInv.length === 0 ? (
            <EmptyState title="Sin productos" hint="No hay ítems mock para tu barbero." />
          ) : (
            <div className="glass-panel border border-slate-700/50 overflow-hidden">
              <ul className="divide-y divide-slate-700/40">
                {itemsInv.map((item) => {
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
                            Stock <span className="text-white font-black">{item.stock}</span> · mín.{' '}
                            {item.stockMinimo}
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
                          className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-700"
                          aria-label="Menos stock"
                        >
                          <Minus size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => ajustarStock(item.id, 1)}
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
              Suma de servicios <strong className="text-slate-400">completados y cobrados</strong> en el rango elegido y
              tu parte según tu comisión del <strong className="text-brand-gold">{perfilBarbero.porcentaje}%</strong>.
              Combina el historial mock con las citas que marques como lista en tu agenda.
            </p>
          </div>

          <div className="glass-panel p-4 border border-slate-700/50 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Atajos de periodo</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={aplicarRangoMesMock}
                className="px-3 py-2 rounded-lg text-xs font-black bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
              >
                Mes del mock ({boundsMesMock.start} → {boundsMesMock.end})
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
            <p className="text-xs text-slate-600">
              Los atajos «últimos N días» terminan en el día mock de referencia{' '}
              <span className="font-mono text-slate-500">{MOCK_HOY}</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Servicios en el rango</p>
              <p className="text-2xl font-black text-white">{movimientosEnRango.length}</p>
              <p className="text-xs text-slate-500">citas completadas con cobro</p>
            </div>
            <div className="glass-panel p-4 border border-slate-700/50 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total facturado</p>
              <p className="text-2xl font-black text-brand-accent">${totalFacturadoRango.toFixed(2)}</p>
              <p className="text-xs text-slate-500">tickets del salón (mock)</p>
            </div>
            <div className="glass-panel p-4 border border-brand-gold/30 bg-brand-gold/5 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <TrendingUp size={12} aria-hidden />
                Tu comisión estimada
              </p>
              <p className="text-2xl font-black text-brand-gold">${totalComisionRango.toFixed(2)}</p>
              <p className="text-xs text-slate-500">
                {perfilBarbero.porcentaje}% sobre lo facturado en el periodo
              </p>
            </div>
          </div>

          {movimientosEnRango.length === 0 ? (
            <EmptyState
              title="Sin movimientos en este periodo"
              hint="Amplía las fechas o marca citas como completadas en la agenda. El historial mock también cuenta."
            />
          ) : (
            <div className="glass-panel border border-slate-700/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/40">
                <h3 className="text-sm font-bold text-white">Detalle</h3>
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
                      const rM = rangoLabel(rangoPorClienteId, m.clienteId);
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
                          ${(m.monto * comisionPct).toFixed(2)}
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
        Cifras de comisión y cortes del mes son <strong className="text-slate-500">solo demostración</strong> hasta
        enlazar el backend.
      </footer>
    </div>
  );
}
