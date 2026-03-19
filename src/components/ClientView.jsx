import { Star, Award, Scissors, Trophy, Calendar } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import EmptyState from './ui/EmptyState';

export default function ClientView() {
  const { user } = useAuth();
  const nombre = user?.nombre ?? 'Cliente';

  const rangoActual = 'Plata';
  const cortesHechos = 8;
  const proximoRango = 'Oro';
  const cortesParaProximo = 10;
  const progresoPorcentaje = (cortesHechos / cortesParaProximo) * 100;

  const proximaCita = {
    fecha: '22 mar 2026',
    hora: '16:30',
    servicio: 'Corte Fade VIP',
    barbero: 'Kevin Barbero',
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-6 bg-brand-card shadow-[0_0_50px_rgba(234,179,8,0.15)] rounded-full border border-slate-700/50 mb-4 transition-transform hover:scale-105 duration-300">
          <Award size={64} className="text-brand-gold animate-pulse" aria-hidden />
        </div>
        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-gold to-yellow-200">
          ¡Hola, {nombre}!
        </h1>
        <p className="text-lg text-slate-400">Progreso en el programa de recompensas</p>
      </div>

      <div className="glass-panel p-6 border-l-4 border-l-brand-accent">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="text-brand-accent shrink-0" size={22} aria-hidden />
          <h2 className="text-lg font-bold text-white">Próxima cita (mock)</h2>
        </div>
        <p className="text-slate-300">
          <span className="text-white font-semibold">{proximaCita.servicio}</span>
          {' · '}
          {proximaCita.fecha} a las {proximaCita.hora}
        </p>
        <p className="text-sm text-slate-500 mt-1">Con {proximaCita.barbero}</p>
      </div>

      <div className="glass-panel p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-slate-400 font-medium mb-1">Rango actual</p>
            <h2 className="text-3xl font-black text-white flex items-center gap-3">
              <Star className="text-brand-gold fill-brand-gold" size={28} aria-hidden /> {rangoActual}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-slate-400 font-medium mb-1">Siguiente: {proximoRango}</p>
            <span className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 bg-brand-dark rounded-full border border-slate-700">
              <Scissors size={14} className="text-brand-gold" aria-hidden /> Faltan{' '}
              {cortesParaProximo - cortesHechos} cortes
            </span>
          </div>
        </div>

        <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden shadow-inner mb-4">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-600 via-brand-gold to-yellow-300 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progresoPorcentaje}%` }}
          >
            <div className="absolute inset-0 bg-white/20 w-full h-full custom-progress-shine" />
          </div>
        </div>

        <div className="flex justify-between text-sm font-bold text-slate-500">
          <span>0</span>
          <span>{cortesHechos} cortes hechos</span>
          <span>{cortesParaProximo}</span>
        </div>
      </div>

      <div className="glass-panel p-6 flex items-center gap-4 border-l-4 border-l-brand-gold">
        <div className="p-3 bg-brand-dark rounded-xl">
          <Trophy className="text-brand-gold" size={24} aria-hidden />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg">Recompensa al llegar a Oro</h3>
          <p className="text-slate-400 text-sm">Corte gratis o -50% en Beard Trim + Tinte</p>
        </div>
      </div>

      <EmptyState
        title="Historial de visitas"
        hint="Cuando exista API, aquí verás tus últimos cortes y puntos."
      />
    </div>
  );
}
