export default function AdminPanelSkeleton() {
  return (
    <div className="space-y-8 animate-pulse p-4 max-w-7xl mx-auto" aria-busy="true" aria-label="Cargando panel">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-3">
          <div className="h-9 bg-slate-800 rounded-lg w-64" />
          <div className="h-4 bg-slate-800/80 rounded w-96 max-w-full" />
        </div>
        <div className="h-12 bg-slate-800 rounded-xl w-full md:w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-panel p-6 space-y-3">
            <div className="h-4 bg-slate-800 rounded w-24" />
            <div className="h-10 bg-slate-800 rounded w-36" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 h-64 space-y-3">
          <div className="h-6 bg-slate-800 rounded w-40" />
          <div className="h-20 bg-slate-800/60 rounded-xl" />
          <div className="h-20 bg-slate-800/60 rounded-xl" />
        </div>
        <div className="glass-panel p-6 h-64 space-y-3">
          <div className="h-6 bg-slate-800 rounded w-48" />
          <div className="h-40 bg-slate-800/40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
