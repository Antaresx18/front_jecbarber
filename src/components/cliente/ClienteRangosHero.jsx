import { Crown, Gem, Medal } from 'lucide-react';

const TIERS = [
  {
    key: 'Bronce',
    label: 'Bronce',
    subtitle: 'Inicio del club',
    Icon: Medal,
    gradient: 'from-amber-900/90 via-amber-700/80 to-orange-900/90',
    text: 'text-amber-100',
    border: 'border-amber-500/50',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.35)]',
    ring: 'ring-amber-400/60',
    mesh: 'from-amber-600/20 via-transparent to-orange-600/10',
  },
  {
    key: 'Plata',
    label: 'Plata',
    subtitle: 'Cliente frecuente',
    Icon: Gem,
    gradient: 'from-slate-400/90 via-slate-300/70 to-slate-500/90',
    text: 'text-slate-900',
    border: 'border-slate-200/50',
    glow: 'shadow-[0_0_45px_rgba(226,232,240,0.45)]',
    ring: 'ring-cyan-200/50',
    mesh: 'from-slate-300/25 via-transparent to-cyan-400/15',
  },
  {
    key: 'Oro',
    label: 'Oro',
    subtitle: 'VIP del salón',
    Icon: Crown,
    gradient: 'from-yellow-500 via-amber-400 to-yellow-600',
    text: 'text-yellow-950',
    border: 'border-yellow-200/70',
    glow: 'shadow-[0_0_55px_rgba(234,179,8,0.55)]',
    ring: 'ring-yellow-300/80',
    mesh: 'from-yellow-400/30 via-amber-500/15 to-yellow-600/20',
  },
];

/**
 * @param {{ rangoActual: string }} props
 */
export default function ClienteRangosHero({ rangoActual }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-600/40 bg-slate-950/60 p-1 shadow-2xl">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-accent/15 via-brand-gold/20 to-purple-500/15 blur-3xl"
        aria-hidden
      />
      <div className="relative rounded-[1.35rem] bg-slate-900/80 p-5 sm:p-7 backdrop-blur-sm">
        <p className="text-center text-[10px] font-black uppercase tracking-[0.35em] text-slate-500 mb-2">
          Programa de rangos
        </p>
        <h2 className="text-center text-xl sm:text-2xl font-black text-white mb-6">
          Sube de nivel con cada visita
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIERS.map((t) => {
            const active = t.key === rangoActual;
            const Icon = t.Icon;
            return (
              <div
                key={t.key}
                className={`relative rounded-2xl border-2 p-4 sm:p-5 transition-all duration-500 ${
                  active
                    ? `bg-gradient-to-br ${t.gradient} ${t.border} ${t.glow} ring-2 ${t.ring} scale-[1.02] sm:scale-105 z-10`
                    : 'border-slate-700/60 bg-slate-800/40 opacity-75 hover:opacity-100'
                }`}
              >
                {active && (
                  <>
                    <span
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none animate-pulse"
                      aria-hidden
                    />
                    <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-black text-amber-600 shadow-lg">
                      Tú
                    </span>
                  </>
                )}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${t.mesh} pointer-events-none opacity-80`}
                  aria-hidden
                />
                <div className="relative flex flex-col items-center text-center gap-3">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                      active ? 'bg-black/25 shadow-inner' : 'bg-slate-900/80 border border-slate-600/50'
                    }`}
                  >
                    <Icon
                      className={active ? t.text : 'text-slate-400'}
                      size={32}
                      strokeWidth={active ? 2.25 : 2}
                      aria-hidden
                    />
                  </div>
                  <div>
                    <p
                      className={`text-lg font-black tracking-tight ${active ? t.text : 'text-slate-300'}`}
                    >
                      {t.label}
                    </p>
                    <p
                      className={`text-xs font-semibold mt-0.5 ${active ? `${t.text} opacity-90` : 'text-slate-500'}`}
                    >
                      {t.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-center text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Cada cita completada te acerca al siguiente nivel. En <strong className="text-slate-400">Oro</strong> desbloqueas
          las mejores promos del salón.
        </p>
      </div>
    </div>
  );
}
