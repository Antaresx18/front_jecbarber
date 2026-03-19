import { useState } from 'react';
import { Calendar, Clock, CheckCircle2, User, MoreHorizontal, DollarSign } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import EmptyState from './ui/EmptyState';

const INITIAL_CITAS = [
  {
    id: 1,
    hora: '10:30 AM',
    cliente: 'Jorge',
    servicio: 'Corte + Barba VIP',
    estado: 'PENDIENTE',
    precio: 35,
  },
  {
    id: 2,
    hora: '01:00 PM',
    cliente: 'Carlos M.',
    servicio: 'Rasurado clásico',
    estado: 'COMPLETADA',
    precio: 18,
  },
  {
    id: 3,
    hora: '03:45 PM',
    cliente: 'Daniel T.',
    servicio: 'Corte + cejas',
    estado: 'PENDIENTE',
    precio: 28,
  },
];

export default function BarberDashboard() {
  const { user } = useAuth();
  const [citas, setCitas] = useState(INITIAL_CITAS);

  const pendientes = citas.filter((c) => c.estado === 'PENDIENTE').length;
  const comisionMesMock = 1240;

  const marcarLista = (id) => {
    setCitas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, estado: 'COMPLETADA' } : c))
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Calendar className="text-brand-accent" size={32} aria-hidden />
            Mi agenda
          </h1>
          <p className="text-slate-400 mt-2">
            Hola, <span className="text-white font-semibold">{user?.nombre}</span>. Citas de hoy
            (mock).
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
          hint="Con el backend conectado, tu agenda se actualizará sola."
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
                    {cita.cliente}
                  </h2>
                  <p className="text-brand-accent mt-1 text-sm font-semibold tracking-wide uppercase">
                    {cita.servicio}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">~ ${cita.precio} (estimado mock)</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {cita.estado === 'COMPLETADA' ? (
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
                  <MoreHorizontal size={20} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
