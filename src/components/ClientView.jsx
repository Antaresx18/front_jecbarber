import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  History,
  Home,
  LayoutList,
  Loader2,
  Scissors,
  Sparkles,
  Star,
  Trophy,
  User,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { GUEST_CLIENTE_STORAGE_KEY } from '../auth/guestCliente';
import { isSupabaseConfigured } from '../supabase';
import { useClienteSupabaseData } from '../hooks/useClienteSupabaseData';
import { useInvitadoSupabaseData } from '../hooks/useInvitadoSupabaseData';
import EmptyState from './ui/EmptyState';
import ClienteRangosHero from './cliente/ClienteRangosHero';
import { addDaysIso, parseHoraToMinutes, ymdLocal } from '../utils/adminFilters';
import { metodoPagoApiToUi, metodoPagoUiLabel, rangoApiToUi, estadoCitaApiToUi } from '../config/dbEnums';

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

function labelEstadoCliente(estadoDb) {
  const u = String(estadoDb || '').toUpperCase();
  return estadoCitaApiToUi[u] ?? String(estadoDb ?? '');
}

export default function ClientView() {
  const { user } = useAuth();
  const esRegistrado = Boolean(user && !user.isGuest && user.rol === 'CLIENTE' && user.clienteId);
  const esInvitado = Boolean(user?.isGuest && user?.rol === 'CLIENTE');
  const puedeUsarPanelCliente = esRegistrado || esInvitado;

  const dataReg = useClienteSupabaseData(user?.clienteId, esRegistrado);
  const dataInv = useInvitadoSupabaseData(esInvitado);

  const loading = esRegistrado ? dataReg.loading : false;
  const error = esRegistrado ? dataReg.error : null;
  const catalogLoading = esInvitado ? dataInv.catalogLoading : false;
  const catalogError = esInvitado ? dataInv.catalogError : null;
  const refresh = esRegistrado ? dataReg.refresh : dataInv.refresh;
  const hoyYmd = esRegistrado ? dataReg.hoyYmd : dataInv.hoyYmd;
  const clienteRow = esRegistrado ? dataReg.clienteRow : null;
  const barberos = esRegistrado ? dataReg.barberos : dataInv.barberos;
  const servicios = esRegistrado ? dataReg.servicios : dataInv.servicios;
  const citasMapped = esRegistrado ? dataReg.citasMapped : dataInv.citasMapped;
  const crearReserva = esRegistrado ? dataReg.crearReserva : dataInv.crearReserva;

  const rangoUi = useMemo(() => {
    if (esInvitado) return 'Bronce';
    const raw = clienteRow?.rango;
    if (raw == null) return 'Bronce';
    const key = String(raw).toUpperCase();
    return rangoApiToUi[key] ?? (typeof raw === 'string' ? raw : 'Bronce');
  }, [esInvitado, clienteRow?.rango]);

  const nombreMostrar = esInvitado ? user?.nombre ?? 'Invitado' : clienteRow?.nombre ?? user?.nombre ?? 'Cliente';
  const cortesHechos = esInvitado ? 0 : Number(clienteRow?.cortes ?? 0);
  const meta = esInvitado ? 5 : Math.max(1, Number(clienteRow?.proximos ?? 5));

  const [reservaMsg, setReservaMsg] = useState(null);
  const [reservaErr, setReservaErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seccion, setSeccion] = useState(() => {
    try {
      return sessionStorage.getItem(GUEST_CLIENTE_STORAGE_KEY) === '1' ? 'reservar' : 'inicio';
    } catch {
      return 'inicio';
    }
  });

  const citasProximas = useMemo(() => {
    return citasMapped
      .filter((c) => c.fecha >= hoyYmd && ['PENDIENTE', 'EN_PROCESO'].includes(c.estado))
      .sort((a, b) => {
        const df = a.fecha.localeCompare(b.fecha);
        if (df !== 0) return df;
        return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
      });
  }, [citasMapped, hoyYmd]);

  const historialMio = useMemo(() => {
    return citasMapped
      .filter((c) => {
        if (c.fecha < hoyYmd) return true;
        return ['COMPLETADA', 'CANCELADA', 'NO_ASISTIO'].includes(c.estado);
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        return parseHoraToMinutes(b.hora) - parseHoraToMinutes(a.hora);
      });
  }, [citasMapped, hoyYmd]);

  /** Invitado: una sola lista (sin pestaña Historial): próximas primero, luego el resto por fecha. */
  const citasListaInvitado = useMemo(() => {
    if (!esInvitado) return [];
    const prox = citasMapped
      .filter((c) => c.fecha >= hoyYmd && ['PENDIENTE', 'EN_PROCESO'].includes(c.estado))
      .sort((a, b) => {
        const df = a.fecha.localeCompare(b.fecha);
        if (df !== 0) return df;
        return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
      });
    const resto = citasMapped.filter((c) => !prox.some((p) => p.id === c.id));
    resto.sort((a, b) => {
      const df = b.fecha.localeCompare(a.fecha);
      if (df !== 0) return df;
      return parseHoraToMinutes(b.hora) - parseHoraToMinutes(a.hora);
    });
    return [...prox, ...resto];
  }, [esInvitado, citasMapped, hoyYmd]);

  const clienteTabs = useMemo(() => {
    if (esInvitado) {
      return [
        { id: 'reservar', label: 'Reservar', icon: CalendarPlus },
        { id: 'citas', label: 'Mis citas', icon: CalendarDays },
      ];
    }
    return [
      { id: 'inicio', label: 'Inicio', icon: Home },
      { id: 'reservar', label: 'Reservar', icon: CalendarPlus },
      { id: 'citas', label: 'Mis citas', icon: CalendarDays },
      { id: 'historial', label: 'Historial', icon: History },
    ];
  }, [esInvitado]);

  const proximaCita = citasProximas[0] ?? null;

  const defaultFechaReserva = useMemo(() => addDaysIso(ymdLocal(), 1), []);

  const [formFecha, setFormFecha] = useState(defaultFechaReserva);
  const [formHora, setFormHora] = useState(HORAS_RESERVA[2]);
  const [formBarberoId, setFormBarberoId] = useState('');
  const [formServicioId, setFormServicioId] = useState('');
  const [formPedido, setFormPedido] = useState('');
  const [formMetodoPago, setFormMetodoPago] = useState('EFECTIVO');
  const [formNombreInvitado, setFormNombreInvitado] = useState('');

  useEffect(() => {
    setFormFecha(defaultFechaReserva);
  }, [defaultFechaReserva, esRegistrado, esInvitado]);

  useEffect(() => {
    if (barberos.length > 0 && !formBarberoId) setFormBarberoId(String(barberos[0].id));
  }, [barberos, formBarberoId]);

  useEffect(() => {
    if (servicios.length > 0 && !formServicioId) setFormServicioId(String(servicios[0].id));
  }, [servicios, formServicioId]);

  useEffect(() => {
    if (!esInvitado) return;
    if (seccion !== 'inicio' && seccion !== 'historial') return;
    setSeccion('reservar');
  }, [esInvitado, seccion]);

  const siguiente = siguienteNivelRango(rangoUi);
  const progresoPct = Math.min(100, (cortesHechos / meta) * 100);
  const faltan = Math.max(0, meta - cortesHechos);

  const enviarReserva = useCallback(
    async (e) => {
      e.preventDefault();
      setReservaErr(null);
      setReservaMsg(null);
      if (!formBarberoId || !formServicioId || !formFecha) {
        setReservaErr('Completa barbero, servicio y fecha.');
        return;
      }
      if (esInvitado && !String(formNombreInvitado ?? '').trim()) {
        setReservaErr('Indica tu nombre para que el salón te reconozca.');
        return;
      }
      setSaving(true);
      try {
        await crearReserva({
          barberoId: formBarberoId,
          servicioId: formServicioId,
          fechaYmd: formFecha,
          hora12: formHora,
          pedidoCliente: formPedido,
          metodoPago: formMetodoPago,
          nombreInvitado: formNombreInvitado,
        });
        setReservaMsg(
          esInvitado
            ? 'Cita guardada en el salón. La verás en «Mis citas» en este navegador.'
            : 'Cita agendada. Ya está en Supabase; la verás en «Mis citas».'
        );
        setFormPedido('');
        setFormNombreInvitado('');
        setSeccion('citas');
      } catch (err) {
        setReservaErr(err instanceof Error ? err.message : 'No se pudo agendar.');
      } finally {
        setSaving(false);
      }
    },
    [
      crearReserva,
      formBarberoId,
      formFecha,
      formHora,
      formMetodoPago,
      formNombreInvitado,
      formPedido,
      formServicioId,
      esInvitado,
    ]
  );

  if (!puedeUsarPanelCliente) {
    return (
      <div className="space-y-8 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-500 pb-12 text-center">
        <div className="inline-flex items-center justify-center p-6 bg-brand-card rounded-full border border-slate-700/50 mb-2">
          <User size={48} className="text-brand-gold" aria-hidden />
        </div>
        <h1 className="text-2xl font-black text-white">Área de clientes</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Tu perfil es <strong className="text-slate-300">cliente</strong> pero no está vinculado a un registro en{' '}
          <code className="text-slate-500 text-xs">clientes</code> (<code className="text-slate-500 text-xs">cliente_id</code>
          ). Pide al salón que lo asocie o usa <strong className="text-slate-300">Continuar sin cuenta</strong> en el
          inicio de sesión para reservar como invitado.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-500 text-brand-dark font-black text-sm hover:brightness-110"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500 pb-12">
      <details className="glass-panel border border-slate-700/60 group">
        <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-3 text-sm text-slate-400 hover:text-slate-300 select-none">
          <span className="flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-400 shrink-0" aria-hidden />
            <span className="font-bold text-white">Conectado a Supabase</span>
            <span className="hidden sm:inline text-slate-500">
              {esInvitado
                ? 'Invitado: citas en este navegador; reserva necesita barberos/servicios desde Supabase (016/017).'
                : 'Reservas y citas reales · migración 015 si falla el detalle del servicio'}
            </span>
          </span>
        </summary>
        <p className="px-4 pb-4 text-xs text-slate-500 border-t border-slate-700/50 pt-3">
          Tus citas se guardan en la misma base que usa el administrador. Si un horario ya está ocupado para ese barbero,
          el sistema te avisará.
          {esInvitado && (
            <>
              {' '}
              Como invitado, ves aquí tus citas desde este navegador. Reservar nuevo necesita conexión al salón; si falla,
              reintenta en la pestaña Reservar.
            </>
          )}
        </p>
      </details>

      {esRegistrado && loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="animate-spin text-brand-gold" size={40} aria-hidden />
          <span className="text-sm font-medium">Cargando tu perfil y citas…</span>
        </div>
      ) : esRegistrado && error ? (
        <div className="glass-panel border border-red-500/35 rounded-2xl p-6 flex gap-3 items-start" role="alert">
          <AlertCircle className="text-red-400 shrink-0" size={22} />
          <div>
            <p className="font-bold text-red-200">No se pudieron cargar los datos</p>
            <p className="text-sm text-red-300/90 mt-1">{error}</p>
            <button
              type="button"
              onClick={() => refresh()}
              className="mt-3 text-sm font-bold text-brand-accent hover:underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-center space-y-4">
            {esInvitado ? (
              <>
                <div className="inline-flex items-center justify-center p-5 bg-brand-card shadow-[0_0_40px_rgba(16,185,129,0.12)] rounded-full border border-emerald-500/25 mb-1">
                  <CalendarPlus size={48} className="text-emerald-400" aria-hidden />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">Reservas sin cuenta</h1>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  Agenda una cita o revisa las que tienes en este dispositivo.
                </p>
              </>
            ) : (
              <>
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
                    Nivel {rangoUi}
                  </span>
                </div>
              </>
            )}
          </div>

          <div
            className="flex flex-wrap p-1 bg-slate-900/80 rounded-xl border border-slate-700/50 gap-1"
            role="tablist"
            aria-label={esInvitado ? 'Reservar y mis citas' : 'Secciones cliente'}
          >
            {clienteTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={seccion === tab.id}
                  onClick={() => {
                    setSeccion(tab.id);
                    if (tab.id !== 'reservar') {
                      setReservaMsg(null);
                      setReservaErr(null);
                    }
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

          {!esInvitado && seccion === 'inicio' && (
            <div className="space-y-6">
              <ClienteRangosHero rangoActual={rangoUi} />

              <div className="glass-panel p-6 border-l-4 border-l-brand-accent">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="text-brand-accent shrink-0" size={22} aria-hidden />
                  <h2 className="text-lg font-bold text-white">Próxima cita</h2>
                </div>
                {proximaCita ? (
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      <span className="text-white font-semibold">
                        {proximaCita.servicios ?? 'Servicio'}
                      </span>
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
                        <p className="text-sm text-slate-200 mt-1 leading-snug break-words">{proximaCita.pedidoCliente}</p>
                      </div>
                    )}
                    {citasProximas.length > 1 && (
                      <p className="text-xs text-slate-500 pt-1">
                        Tienes <strong className="text-slate-400">{citasProximas.length}</strong> citas pendientes o en
                        curso; revisa <strong className="text-slate-400">Mis citas</strong>.
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="Sin citas próximas"
                    hint="Usa la pestaña Reservar para agendar con el salón."
                  />
                )}
              </div>

              {!esInvitado && (
                <>
                  <div className="glass-panel p-8 relative overflow-hidden border border-slate-700/50">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 blur-[100px] rounded-full pointer-events-none" />
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 relative">
                      <div>
                        <p className="text-slate-400 font-medium mb-1">Progreso de recompensas</p>
                        <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 flex-wrap">
                          <Scissors className="text-brand-gold shrink-0" size={26} aria-hidden />
                          {`${cortesHechos} cortes registrados`}
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
                        Sigue disfrutando beneficios Oro. Los cortes los actualiza el salón al completar tus citas.
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
                        Al subir de rango desbloqueas mejores beneficios. Oro incluye las mejores promos del salón.
                      </p>
                    </div>
                  </div>
                </>
              )}

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
                {esInvitado
                  ? 'Elige fecha, hora, barbero y servicio. Tu nombre es obligatorio para que el salón te identifique.'
                  : 'Elige fecha, hora, barbero y servicio. Opcional: método de pago previsto y nombre si la cita es para otra persona.'}
              </p>
              {!esInvitado && (barberos.length === 0 || servicios.length === 0) ? (
                <EmptyState
                  title="No hay barberos o servicios activos"
                  hint="El administrador debe tener barberos y servicios activos en Supabase."
                />
              ) : (
                <form
                  onSubmit={enviarReserva}
                  className="glass-panel p-6 border border-slate-700/60 space-y-4 rounded-2xl"
                >
                  {esInvitado && !isSupabaseConfigured && (
                    <div
                      className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                      role="alert"
                    >
                      Configura <span className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</span> y{' '}
                      <span className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> en{' '}
                      <span className="font-mono text-xs">.env.local</span> y reinicia Vite.
                    </div>
                  )}
                  {esInvitado && catalogError && (
                    <div
                      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-100/95 space-y-2"
                      role="status"
                    >
                      <p>{catalogError}</p>
                      <button
                        type="button"
                        onClick={() => refresh()}
                        className="text-sm font-black text-brand-accent hover:underline"
                      >
                        Reintentar carga de barberos y servicios
                      </button>
                      <p className="text-xs text-amber-200/70">
                        Se reintenta hasta 3 veces por lista. Comprueba que el proyecto Supabase no esté pausado y la
                        migración <span className="font-mono">017</span> (permiso de lectura a anon).
                      </p>
                    </div>
                  )}
                  {esInvitado && catalogLoading && (
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <Loader2 className="animate-spin text-brand-gold shrink-0" size={16} aria-hidden />
                      Descargando barberos y servicios del salón (puede tardar si la red es lenta)…
                    </p>
                  )}
                  {reservaErr && (
                    <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                      {reservaErr}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Fecha
                      <input
                        type="date"
                        required
                        min={hoyYmd}
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
                      disabled={esInvitado && catalogLoading && barberos.length === 0}
                      className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white disabled:opacity-60"
                    >
                      {esInvitado && catalogLoading && barberos.length === 0 ? (
                        <option value="">Cargando barberos…</option>
                      ) : barberos.length === 0 ? (
                        <option value="">— Elige barbero (espera la carga o reintenta) —</option>
                      ) : (
                        barberos.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.nombre}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Servicio
                    <select
                      value={formServicioId}
                      onChange={(e) => setFormServicioId(e.target.value)}
                      disabled={esInvitado && catalogLoading && servicios.length === 0}
                      className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white disabled:opacity-60"
                    >
                      {esInvitado && catalogLoading && servicios.length === 0 ? (
                        <option value="">Cargando servicios…</option>
                      ) : servicios.length === 0 ? (
                        <option value="">— Elige servicio (espera la carga o reintenta) —</option>
                      ) : (
                        servicios.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            {s.nombre} — ${s.precio.toFixed(2)}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Método de pago previsto
                    <select
                      value={formMetodoPago}
                      onChange={(e) => setFormMetodoPago(e.target.value)}
                      className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white"
                    >
                      {metodoPagoUiLabel.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {esInvitado ? 'Tu nombre (obligatorio)' : 'Reservo para otra persona (opcional)'}
                    <input
                      type="text"
                      value={formNombreInvitado}
                      onChange={(e) => setFormNombreInvitado(e.target.value)}
                      placeholder={esInvitado ? 'Ej. Jorge Pérez' : 'Nombre del invitado'}
                      required={esInvitado}
                      className="mt-1.5 w-full bg-slate-900/90 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
                    />
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
                    disabled={
                      saving ||
                      !isSupabaseConfigured ||
                      (esInvitado && (barberos.length === 0 || servicios.length === 0 || catalogLoading))
                    }
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-brand-dark font-black text-sm shadow-lg shadow-emerald-500/25 hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {saving ? 'Guardando…' : 'Confirmar reserva'}
                  </button>
                  {esInvitado && !catalogLoading && (barberos.length === 0 || servicios.length === 0) && (
                    <p className="text-center text-xs text-slate-500">
                      Cuando aparezcan barbero y servicio en las listas, podrás confirmar la reserva.
                    </p>
                  )}
                </form>
              )}
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
                {esInvitado
                  ? 'Próximas citas primero; debajo, citas pasadas o ya cerradas. Todo queda guardado en este navegador y se actualiza con el salón si hay conexión.'
                  : 'Citas desde hoy en adelante con estado pendiente o en curso.'}
              </p>
              {(esInvitado ? citasListaInvitado : citasProximas).length === 0 ? (
                <EmptyState title="No hay citas" hint="Ve a Reservar y crea tu primera cita." />
              ) : (
                <ul className="space-y-3">
                  {(esInvitado ? citasListaInvitado : citasProximas).map((c) => {
                    const enCurso = c.estado === 'EN_PROCESO';
                    const esPasadaOcerrada =
                      esInvitado &&
                      (c.fecha < hoyYmd ||
                        ['COMPLETADA', 'CANCELADA', 'NO_ASISTIO'].includes(c.estado));
                    return (
                      <li key={c.id} className="glass-panel p-5 border border-slate-700/60">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex gap-3 min-w-0">
                            <div className="flex flex-col items-center justify-center p-2.5 bg-slate-900/90 rounded-xl border border-slate-700 w-[4.75rem] shrink-0">
                              <Clock className="text-slate-500 mb-0.5" size={16} aria-hidden />
                              <span className="font-black text-white text-xs tabular-nums">{c.hora}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-white">{c.servicios ?? 'Servicio'}</p>
                                {enCurso && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-sky-500/40 text-sky-300 bg-sky-500/10">
                                    En curso
                                  </span>
                                )}
                                {esInvitado && esPasadaOcerrada && (
                                  <span
                                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                      c.estado === 'COMPLETADA'
                                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                                        : c.estado === 'CANCELADA'
                                          ? 'border-red-500/40 text-red-400 bg-red-500/10'
                                          : c.estado === 'NO_ASISTIO'
                                            ? 'border-orange-500/40 text-orange-300 bg-orange-500/10'
                                            : 'border-slate-600 text-slate-400'
                                    }`}
                                  >
                                    {labelEstadoCliente(c.estado)}
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
                                <p className="text-xs text-slate-500 mt-2 border-l-2 border-brand-accent/40 pl-2 leading-relaxed break-words">
                                  <span className="text-slate-600 font-bold uppercase">Pedido: </span>
                                  {c.pedidoCliente}
                                </p>
                              )}
                              {(c.nombre_invitado || c.metodo_pago) && (
                                <p className="text-[10px] text-slate-500 mt-2 flex flex-wrap items-center gap-2">
                                  {c.nombre_invitado ? (
                                    <span>
                                      <span className="text-slate-600 font-bold uppercase">Invitado:</span>{' '}
                                      {c.nombre_invitado}
                                    </span>
                                  ) : null}
                                  {c.metodo_pago ? (
                                    <span className="inline-flex px-2 py-0.5 rounded border border-slate-600 text-slate-400">
                                      {metodoPagoApiToUi[c.metodo_pago] ?? c.metodo_pago}
                                    </span>
                                  ) : null}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-slate-400 font-semibold text-sm">${c.monto.toFixed(2)}</span>
                            {!esPasadaOcerrada &&
                              (enCurso ? (
                                <span className="text-xs font-bold text-sky-300 px-2 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10">
                                  En curso
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-brand-accent px-2 py-1 rounded-lg border border-brand-accent/30 bg-brand-accent/10">
                                  Pendiente
                                </span>
                              ))}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {!esInvitado && seccion === 'historial' && (
            <section className="space-y-4" aria-labelledby="cliente-hist-heading">
              <div className="flex items-center gap-2">
                <History className="text-slate-400" size={22} aria-hidden />
                <h2 id="cliente-hist-heading" className="text-xl font-bold text-white">
                  Visitas anteriores
                </h2>
              </div>
              {historialMio.length === 0 ? (
                <EmptyState title="Sin historial" hint="Cuando completes o canceles citas, aparecerán aquí." />
              ) : (
                <ul className="space-y-2">
                  {historialMio.map((c) => (
                    <li
                      key={c.id}
                      className="glass-panel px-4 py-3.5 border border-slate-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-white">{c.servicios ?? 'Servicio'}</p>
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
                          <p className="text-xs text-slate-500 border-l-2 border-slate-600 pl-2 mt-1 break-words">
                            <span className="text-slate-600 font-bold">Pedido: </span>
                            {c.pedidoCliente}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                        <span
                          className={`font-black px-2 py-1 rounded border ${
                            c.estado === 'COMPLETADA'
                              ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                              : c.estado === 'CANCELADA'
                                ? 'border-red-500/40 text-red-400 bg-red-500/10'
                                : c.estado === 'NO_ASISTIO'
                                  ? 'border-orange-500/40 text-orange-300 bg-orange-500/10'
                                  : 'border-slate-600 text-slate-400'
                          }`}
                        >
                          {labelEstadoCliente(c.estado)}
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
        </>
      )}
    </div>
  );
}
