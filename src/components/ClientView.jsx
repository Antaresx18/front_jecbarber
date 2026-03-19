import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  History,
  Home,
  LayoutList,
  Scissors,
  Sparkles,
  Star,
  Trophy,
  User,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import EmptyState from './ui/EmptyState';
import ClienteRangosHero from './cliente/ClienteRangosHero';
import {
  CITAS_AGENDA_COMPLETA,
  INITIAL_BARBEROS,
  INITIAL_CLIENTES,
  INITIAL_HISTORIAL_CITAS,
  INITIAL_SERVICIOS,
  MOCK_HOY,
} from './admin/adminData';
import { addDaysIso, parseHoraToMinutes } from '../utils/adminFilters';

const STORAGE_PREFIX = 'jecbarber_cliente_reservas_';

const HORAS_RESERVA = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
];

function loadExtraCitas(clienteId) {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${clienteId}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
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

/** @param {'Bronce' | 'Plata' | 'Oro' | string} rango */
function siguienteNivelRango(rango) {
  if (rango === 'Bronce') return 'Plata';
  if (rango === 'Plata') return 'Oro';
  return null;
}

export default function ClientView() {
  const { user } = useAuth();
  const clienteId = user?.clienteId ?? 1;

  const cliente = useMemo(
    () => INITIAL_CLIENTES.find((c) => c.id === clienteId) ?? INITIAL_CLIENTES[0],
    [clienteId]
  );

  const nombreMostrar = cliente?.nombre ?? user?.nombre ?? 'Cliente';

  const [extraCitas, setExtraCitas] = useState(() => loadExtraCitas(clienteId));
  const [reservaMsg, setReservaMsg] = useState(null);
  const [seccion, setSeccion] = useState('inicio');

  useEffect(() => {
    setExtraCitas(loadExtraCitas(clienteId));
  }, [clienteId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${clienteId}`, JSON.stringify(extraCitas));
    } catch {
      /* ignore */
    }
  }, [extraCitas, clienteId]);

  const serviciosActivos = useMemo(
    () => INITIAL_SERVICIOS.filter((s) => s.activo !== false),
    []
  );

  const citasProximas = useMemo(() => {
    const fromMock = CITAS_AGENDA_COMPLETA.filter(
      (c) => c.clienteId === clienteId && c.fecha >= MOCK_HOY
    );
    const fromLocal = extraCitas.filter((c) => c.clienteId === clienteId && c.fecha >= MOCK_HOY);
    const merged = [...fromMock, ...fromLocal];
    merged.sort((a, b) => {
      const df = a.fecha.localeCompare(b.fecha);
      if (df !== 0) return df;
      return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
    });
    return merged;
  }, [clienteId, extraCitas]);

  const historialMio = useMemo(
    () =>
      INITIAL_HISTORIAL_CITAS.filter((c) => c.clienteId === clienteId).sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        return parseHoraToMinutes(b.hora) - parseHoraToMinutes(a.hora);
      }),
    [clienteId]
  );

  const siguiente = siguienteNivelRango(cliente.rango);
  const cortesHechos = cliente.cortes;
  const meta = Math.max(1, cliente.proximos);
  const progresoPct = Math.min(100, (cortesHechos / meta) * 100);
  const faltan = Math.max(0, meta - cortesHechos);

  const proximaCita = citasProximas[0];

  const defaultFechaReserva = useMemo(() => addDaysIso(MOCK_HOY, 3), []);

  const [formFecha, setFormFecha] = useState(defaultFechaReserva);
  const [formHora, setFormHora] = useState(HORAS_RESERVA[2]);
  const [formBarberoId, setFormBarberoId] = useState(String(INITIAL_BARBEROS[0]?.id ?? 1));
  const [formServicioId, setFormServicioId] = useState(String(serviciosActivos[0]?.id ?? 1));
  const [formPedido, setFormPedido] = useState('');

  useEffect(() => {
    setFormFecha(defaultFechaReserva);
  }, [defaultFechaReserva, clienteId]);

  const enviarReserva = useCallback(
    (e) => {
      e.preventDefault();
      const barbero = INITIAL_BARBEROS.find((b) => b.id === Number(formBarberoId));
      const servicio = serviciosActivos.find((s) => s.id === Number(formServicioId));
      if (!barbero || !servicio || !formFecha) return;

      const pedidoTrim = formPedido.trim();
      const nueva = {
        id: -Date.now(),
        fecha: formFecha,
        hora: formHora,
        clienteId,
        barberoId: barbero.id,
        clienteNombre: cliente.nombre,
        barberoNombre: barbero.nombre,
        servicio: servicio.nombre,
        pedidoCliente: pedidoTrim || `Reserva desde la app: ${servicio.nombre}.`,
        estado: 'Pendiente',
        monto: servicio.precio,
        notas: '',
      };
      setExtraCitas((prev) => [...prev, nueva]);
      setReservaMsg('Cita agendada. La verás en «Mis citas» (guardado en este navegador, demo).');
      setFormPedido('');
      setSeccion('citas');
    },
    [
      formBarberoId,
      formFecha,
      formHora,
      formPedido,
      formServicioId,
      cliente,
      clienteId,
      serviciosActivos,
    ]
  );

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500 pb-12">
      <details className="glass-panel border border-slate-700/60 group">
        <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-3 text-sm text-slate-400 hover:text-slate-300 select-none">
          <span className="flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-400 shrink-0" aria-hidden />
            <span className="font-bold text-white">Modo demo</span>
            <span className="hidden sm:inline text-slate-500">
              Reservas locales en <span className="font-mono text-slate-400">sessionStorage</span> · día ref.{' '}
              <span className="font-mono text-slate-400">{MOCK_HOY}</span>
            </span>
          </span>
        </summary>
        <p className="px-4 pb-4 text-xs text-slate-500 border-t border-slate-700/50 pt-3">
          Las citas que agendes aquí no se sincronizan con el panel admin en este prototipo; con API real irán al
          backend.
        </p>
      </details>

      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-6 bg-brand-card shadow-[0_0_50px_rgba(234,179,8,0.12)] rounded-full border border-slate-700/50 mb-2 transition-transform hover:scale-105 duration-300">
          <Award size={56} className="text-brand-gold" aria-hidden />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-gold to-yellow-200">
          ¡Hola, {nombreMostrar.split(' ')[0]}!
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto">
          Reserva cita, revisa tu historial y brilla con tu rango en el club.
        </p>
        <div className="flex justify-center items-center gap-2 flex-wrap">
          <Star className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" size={18} aria-hidden />
          <span
            className="text-sm font-black uppercase tracking-[0.2em] cliente-rango-shimmer px-4 py-1.5 rounded-full border border-amber-500/30 bg-slate-900/60"
            style={{
              backgroundImage: 'linear-gradient(90deg, #fde68a, #ffffff, #a5f3fc, #fde68a)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Nivel {cliente.rango}
          </span>
        </div>
      </div>

      <div
        className="flex flex-wrap p-1 bg-slate-900/80 rounded-xl border border-slate-700/50 gap-1"
        role="tablist"
        aria-label="Secciones cliente"
      >
        {[
          { id: 'inicio', label: 'Inicio', icon: Home },
          { id: 'reservar', label: 'Reservar', icon: CalendarPlus },
          { id: 'citas', label: 'Mis citas', icon: CalendarDays },
          { id: 'historial', label: 'Historial', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={seccion === tab.id}
              onClick={() => {
                setSeccion(tab.id);
                if (tab.id !== 'reservar') setReservaMsg(null);
              }}
              className={`flex-1 min-w-[5.5rem] py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                seccion === tab.id ? 'bg-emerald-500 text-brand-dark shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={15} className="shrink-0 sm:w-4 sm:h-4" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      {reservaMsg && seccion === 'citas' && (
        <div
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-start gap-2"
          role="status"
        >
          <CheckCircle2 className="shrink-0 mt-0.5" size={18} aria-hidden />
          {reservaMsg}
        </div>
      )}

      {seccion === 'inicio' && (
        <div className="space-y-6">
          <ClienteRangosHero rangoActual={cliente.rango} />

          <div className="glass-panel p-6 border-l-4 border-l-brand-accent">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="text-brand-accent shrink-0" size={22} aria-hidden />
              <h2 className="text-lg font-bold text-white">Próxima cita</h2>
            </div>
            {proximaCita ? (
              <div className="space-y-2">
                <p className="text-slate-300">
                  <span className="text-white font-semibold">{proximaCita.servicio}</span>
                </p>
                <p className="text-sm text-slate-400">
                  <span className="capitalize">{formatFechaEtiqueta(proximaCita.fecha)}</span>
                  <span className="text-slate-600 mx-2">·</span>
                  <span className="font-mono tabular-nums">{proximaCita.hora}</span>
                </p>
                <p className="text-sm text-slate-500">Con {proximaCita.barberoNombre}</p>
                {(proximaCita.pedidoCliente ?? '').trim() !== '' && (
                  <div className="rounded-lg bg-slate-950/60 border border-slate-700/80 px-3 py-2 mt-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-brand-accent">
                      Lo que pediste
                    </p>
                    <p className="text-sm text-slate-200 mt-1 leading-snug">{proximaCita.pedidoCliente}</p>
                  </div>
                )}
                {citasProximas.length > 1 && (
                  <p className="text-xs text-slate-500 pt-1">
                    Tienes <strong className="text-slate-400">{citasProximas.length}</strong> citas desde el día mock;
                    revisa <strong className="text-slate-400">Mis citas</strong> o agenda otra en{' '}
                    <strong className="text-slate-400">Reservar</strong>.
                  </p>
                )}
              </div>
            ) : (
              <EmptyState
                title="Sin citas próximas"
                hint="Usa la pestaña Reservar para agendar (demo en este navegador)."
              />
            )}
          </div>

          <div className="glass-panel p-8 relative overflow-hidden border border-slate-700/50">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 relative">
              <div>
                <p className="text-slate-400 font-medium mb-1">Progreso de recompensas</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 flex-wrap">
                  <Scissors className="text-brand-gold shrink-0" size={26} aria-hidden />
                  {cortesHechos} cortes registrados
                </h2>
              </div>
              {siguiente ? (
                <div className="text-left sm:text-right">
                  <p className="text-slate-400 font-medium mb-1">Siguiente nivel: {siguiente}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 bg-brand-dark rounded-full border border-slate-700">
                    Faltan <strong className="text-brand-gold mx-1">{faltan}</strong> cortes
                    <span className="text-slate-500 font-normal">(meta {meta})</span>
                  </span>
                </div>
              ) : (
                <div className="text-left sm:text-right">
                  <p className="text-emerald-400 font-bold text-sm">Nivel máximo alcanzado</p>
                </div>
              )}
            </div>

            {siguiente ? (
              <>
                <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden shadow-inner mb-4">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-600 via-brand-gold to-yellow-300 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progresoPct}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full h-full custom-progress-shine" />
                  </div>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-500">
                  <span>0</span>
                  <span>
                    {cortesHechos} / {meta}
                  </span>
                  <span>{meta}</span>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm relative">
                Sigue disfrutando beneficios Oro. Los datos de cortes vienen del catálogo mock del salón.
              </p>
            )}
          </div>

          <div className="glass-panel p-6 flex items-start gap-4 border-l-4 border-l-brand-gold">
            <div className="p-3 bg-brand-dark rounded-xl shrink-0">
              <Trophy className="text-brand-gold" size={24} aria-hidden />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Recompensas</h3>
              <p className="text-slate-400 text-sm mt-1">
                Al subir de rango desbloqueas mejores beneficios. En el mock, Oro incluye promos demo (corte gratis o
                descuentos en servicios combinados).
              </p>
            </div>
          </div>
        </div>
      )}

      {seccion === 'reservar' && (
        <section className="space-y-4" aria-labelledby="cliente-reserva-heading">
          <div className="flex items-center gap-2">
            <CalendarPlus className="text-emerald-400" size={24} aria-hidden />
            <h2 id="cliente-reserva-heading" className="text-xl font-bold text-white">
              Agendar cita
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Elige fecha (desde el día mock), hora, barbero y servicio. La reserva se guarda solo en este navegador hasta
            que exista API.
          </p>
          <form
            onSubmit={enviarReserva}
            className="glass-panel p-6 border border-slate-700/60 space-y-4 rounded-2xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Fecha
                <input
                  type="date"
                  required
                  min={MOCK_HOY}
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white"
                />
              </label>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Hora
                <select
                  value={formHora}
                  onChange={(e) => setFormHora(e.target.value)}
                  className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  {HORAS_RESERVA.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Barbero
              <select
                value={formBarberoId}
                onChange={(e) => setFormBarberoId(e.target.value)}
                className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white"
              >
                {INITIAL_BARBEROS.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Servicio
              <select
                value={formServicioId}
                onChange={(e) => setFormServicioId(e.target.value)}
                className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white"
              >
                {serviciosActivos.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.nombre} — ${s.precio.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Detalle de lo que quieres (opcional)
              <textarea
                value={formPedido}
                onChange={(e) => setFormPedido(e.target.value)}
                rows={3}
                placeholder="Ej. fade bajo, barba con contorno natural…"
                className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 resize-y min-h-[5rem]"
              />
            </label>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-brand-dark font-black text-sm shadow-lg shadow-emerald-500/25 hover:brightness-110 transition-all"
            >
              Confirmar reserva
            </button>
          </form>
        </section>
      )}

      {seccion === 'citas' && (
        <section className="space-y-4" aria-labelledby="cliente-citas-heading">
          <div className="flex items-center gap-2">
            <LayoutList className="text-brand-accent" size={22} aria-hidden />
            <h2 id="cliente-citas-heading" className="text-xl font-bold text-white">
              Tus citas agendadas
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Mock del salón + tus reservas desde <strong className="text-slate-400">Reservar</strong> (fecha ≥{' '}
            <span className="font-mono text-slate-400">{MOCK_HOY}</span>).
          </p>
          {citasProximas.length === 0 ? (
            <EmptyState title="No hay citas" hint="Ve a Reservar y crea tu primera cita de demo." />
          ) : (
            <ul className="space-y-3">
              {citasProximas.map((c) => {
                const hecha = c.estado === 'Completada';
                const esLocal = c.id < 0;
                return (
                  <li
                    key={c.id}
                    className={`glass-panel p-5 border ${
                      hecha ? 'border-emerald-500/25 bg-emerald-500/[0.03]' : 'border-slate-700/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex gap-3 min-w-0">
                        <div className="flex flex-col items-center justify-center p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 w-[4.75rem] shrink-0">
                          <Clock className="text-slate-500 mb-0.5" size={16} aria-hidden />
                          <span className="font-black text-white text-xs tabular-nums">{c.hora}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-white">{c.servicio}</p>
                            {esLocal && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                                Tu reserva
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 capitalize mt-0.5">
                            {formatFechaEtiqueta(c.fecha)}
                            <span className="text-slate-600 mx-1">·</span>
                            <span className="font-mono text-slate-400">{c.fecha}</span>
                          </p>
                          <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                            <User size={14} className="text-slate-500 shrink-0" aria-hidden />
                            {c.barberoNombre}
                          </p>
                          {(c.pedidoCliente ?? '').trim() !== '' && (
                            <p className="text-xs text-slate-500 mt-2 border-l-2 border-brand-accent/40 pl-2 leading-relaxed">
                              <span className="text-slate-600 font-bold uppercase">Pedido: </span>
                              {c.pedidoCliente}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-slate-400 font-semibold text-sm">${c.monto.toFixed(2)}</span>
                        {hecha ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                            <CheckCircle2 size={14} aria-hidden />
                            Completada
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-brand-accent px-2 py-1 rounded-lg border border-brand-accent/30 bg-brand-accent/10">
                            Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {seccion === 'historial' && (
        <section className="space-y-4" aria-labelledby="cliente-hist-heading">
          <div className="flex items-center gap-2">
            <History className="text-slate-400" size={22} aria-hidden />
            <h2 id="cliente-hist-heading" className="text-xl font-bold text-white">
              Visitas anteriores
            </h2>
          </div>
          {historialMio.length === 0 ? (
            <EmptyState title="Sin historial en el mock" hint="Las citas pasadas del demo aparecerán aquí." />
          ) : (
            <ul className="space-y-2">
              {historialMio.map((c) => (
                <li
                  key={c.id}
                  className="glass-panel px-4 py-3.5 border border-slate-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-white">{c.servicio}</p>
                    <p className="text-xs text-slate-500">
                      <span className="capitalize">{formatFechaEtiqueta(c.fecha)}</span>
                      <span className="mx-2">·</span>
                      <span className="font-mono">{c.fecha}</span>
                      <span className="mx-2">·</span>
                      {c.hora}
                      <span className="mx-2">·</span>
                      {c.barberoNombre}
                    </p>
                    {(c.pedidoCliente ?? '').trim() !== '' && (
                      <p className="text-xs text-slate-500 border-l-2 border-slate-600 pl-2 mt-1">
                        <span className="text-slate-600 font-bold">Pedido: </span>
                        {c.pedidoCliente}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                    <span
                      className={`font-black px-2 py-1 rounded border ${
                        c.estado === 'Completada'
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                          : c.estado === 'Cancelada'
                            ? 'border-red-500/40 text-red-400 bg-red-500/10'
                            : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {c.estado}
                    </span>
                    {c.monto > 0 && (
                      <span className="font-bold text-brand-gold">${Number(c.monto).toFixed(2)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
