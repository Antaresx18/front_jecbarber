import { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  User,
  MoreHorizontal,
  DollarSign,
  History,
  Info,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import EmptyState from './ui/EmptyState';
import { INITIAL_CITAS, INITIAL_HISTORIAL_CITAS } from './admin/adminData';
import { parseHoraToMinutes } from '../utils/adminFilters';

export default function BarberDashboard() {
  const { user } = useAuth();
  const barberoId = user?.barberoId ?? 1;

  const citasIniciales = useMemo(
    () =>
      INITIAL_CITAS.filter((c) => c.barberoId === barberoId).sort(
        (a, b) => parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora)
      ),
    [barberoId]
  );

  const [citas, setCitas] = useState(citasIniciales);

  const historialMio = useMemo(
    () =>
      INITIAL_HISTORIAL_CITAS.filter((c) => c.barberoId === barberoId).sort((a, b) =>
        a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0
      ),
    [barberoId]
  );

  const pendientes = citas.filter((c) => c.estado === 'Pendiente').length;
  const comisionMesMock = 1240;

  const marcarLista = (id) => {
    setCitas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, estado: 'Completada' } : c))
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-4xl mx-auto">
      <div className="glass-panel p-4 border border-slate-700/60 flex gap-3 items-start">
        <Info className="text-brand-accent shrink-0 mt-0.5" size={20} aria-hidden />
        <div className="text-sm text-slate-300 space-y-1">
          <p className="font-bold text-white">¿Dónde están las citas?</p>
          <ul className="list-disc list-inside text-slate-400 space-y-1">
            <li>
              <strong className="text-slate-300">Tú (barbero):</strong> aquí, solo las citas asignadas a tu perfil
              (mock: coincide con el barbero de la sesión).
            </li>
            <li>
              <strong className="text-slate-300">Administrador:</strong> en{' '}
              <span className="text-brand-gold font-semibold">Panel admin → Resumen</span>, bloque «Citas de hoy»
              (filtro por barbero), y en la pestaña <span className="text-brand-gold font-semibold">Historial</span>{' '}
              para citas pasadas.
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Calendar className="text-brand-accent" size={32} aria-hidden />
            Mi agenda
          </h1>
          <p className="text-slate-400 mt-2">
            Hola, <span className="text-white font-semibold">{user?.nombre}</span>. Estas son tus citas de hoy
            (datos alineados con el mock del panel admin).
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="px-5 py-2.5 bg-brand-dark border border-brand-accent/30 text-brand-accent font-bold rounded-lg shadow-lg">
            {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
          </div>
          <div className="px-5 py-2.5 glass-panel border border-slate-700 flex items-center gap-2 text-slate-300 text-sm font-bold">
            <DollarSign size={18} className="text-brand-gold" aria-hidden />
            Comisión mes (demo): ${comisionMesMock.toLocaleString()}
          </div>
        </div>
      </div>

      {citas.length === 0 ? (
        <EmptyState
          title="No tienes citas hoy"
          hint="Cuando conectes el backend, aquí aparecerán solo las reservas de tu agenda."
        />
      ) : (
        <div className="grid gap-4">
          {citas.map((cita) => (
            <div
              key={cita.id}
              className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-brand-accent/50 transition-colors"
            >
              <div className="flex items-center gap-6 min-w-0">
                <div className="flex flex-col items-center justify-center p-3 bg-slate-900 rounded-xl border border-slate-700 w-24 shrink-0">
                  <Clock className="text-slate-500 mb-1" size={20} aria-hidden />
                  <span className="font-bold text-slate-200 text-sm">{cita.hora}</span>
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
                    <User size={18} className="text-slate-500 shrink-0" aria-hidden />
                    {cita.clienteNombre}
                  </h2>
                  <p className="text-brand-accent mt-1 text-sm font-semibold tracking-wide uppercase">
                    {cita.servicio}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">${cita.monto.toFixed(2)}</p>
                  {(cita.notas ?? '').trim() !== '' && (
                    <p className="text-slate-500 text-xs mt-2 border-l-2 border-slate-600 pl-2 italic">
                      {cita.notas}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {cita.estado === 'Completada' ? (
                  <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg border border-emerald-500/20">
                    <CheckCircle2 size={18} aria-hidden /> Completada
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => marcarLista(cita.id)}
                    className="flex items-center gap-2 px-6 py-2 bg-brand-accent/10 text-brand-accent font-bold hover:bg-brand-accent hover:text-brand-dark transition-all rounded-lg border border-brand-accent/50 shadow-[0_0_15px_rgba(56,189,248,0.15)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.3)]"
                  >
                    Marcar cita lista
                  </button>
                )}
                <button
                  type="button"
                  className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-lg"
                  aria-label="Más opciones"
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-4" aria-labelledby="barber-historial-heading">
        <h2
          id="barber-historial-heading"
          className="text-lg font-bold text-white flex items-center gap-2"
        >
          <History className="text-slate-400" size={22} aria-hidden />
          Historial reciente (mock)
        </h2>
        <p className="text-sm text-slate-500">
          Mismas citas pasadas que el admin puede ver en la pestaña Historial, filtradas por tu barbero.
        </p>
        {historialMio.length === 0 ? (
          <EmptyState title="Sin historial mock" hint="Añade entradas en adminData o conecta el API." />
        ) : (
          <ul className="space-y-2">
            {historialMio.map((c) => (
              <li
                key={c.id}
                className="glass-panel px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-700/50"
              >
                <div>
                  <span className="text-white font-medium">{c.clienteNombre}</span>
                  <span className="text-slate-500 text-sm mx-2">·</span>
                  <span className="text-slate-400 text-sm">{c.servicio}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 font-mono">
                  <span>
                    {c.fecha} {c.hora}
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
                  {c.monto > 0 && <span className="text-brand-gold">${c.monto.toFixed(2)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
