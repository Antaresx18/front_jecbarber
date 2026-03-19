import { useMemo, useState, useRef, useEffect } from 'react';
import { Search, LayoutList, Keyboard, X } from 'lucide-react';

export default function AdminToolbar({
  searchInputRef,
  compactMode,
  onCompactChange,
  tabConfig,
  onJumpToSearch,
  clientes,
  servicios,
  gastos,
  inventario,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [q, setQ] = useState('');
  const localRef = useRef(null);
  const inputRef = searchInputRef || localRef;

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out = [];
    clientes.forEach((c) => {
      if (c.nombre.toLowerCase().includes(needle))
        out.push({ type: 'Cliente', label: c.nombre, tab: 'clientes', hint: c.rango });
    });
    servicios.forEach((s) => {
      if (s.nombre.toLowerCase().includes(needle))
        out.push({ type: 'Servicio', label: s.nombre, tab: 'servicios', hint: `$${s.precio}` });
    });
    gastos.forEach((g) => {
      if (g.concepto.toLowerCase().includes(needle))
        out.push({ type: 'Gasto', label: g.concepto, tab: 'finanzas', hint: g.fecha });
    });
    inventario.forEach((i) => {
      if (i.nombre.toLowerCase().includes(needle))
        out.push({ type: 'Stock', label: i.nombre, tab: 'inventario', hint: `${i.stock} uds.` });
    });
    return out.slice(0, 12);
  }, [q, clientes, servicios, gastos, inventario]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setPaletteOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputRef]);

  const pick = (r) => {
    onJumpToSearch(r.tab, r.label);
    setPaletteOpen(false);
    setQ('');
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between glass-panel p-3 border border-slate-700/50">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-colors border border-slate-600"
          >
            <Search size={18} aria-hidden />
            Buscar en el panel
            <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 font-mono">
              /
            </kbd>
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(e) => onCompactChange(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-brand-gold focus:ring-brand-gold/50"
            />
            <LayoutList size={16} aria-hidden />
            Vista compacta
          </label>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Keyboard size={14} aria-hidden />
          Atajos:{' '}
          {tabConfig.slice(0, 9).map((t, i) => (
            <span key={t.id} className="text-slate-400">
              <kbd className="px-1 rounded bg-slate-800 font-mono">{i + 1}</kbd> {t.label}
              {i < Math.min(tabConfig.length, 9) - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      </div>

      {paletteOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-sm"
          role="presentation"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="glass-panel w-full max-w-lg border border-slate-600 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Búsqueda rápida"
          >
            <div className="flex items-center gap-2 border-b border-slate-700 p-3">
              <Search className="text-slate-500 shrink-0" size={20} aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cliente, servicio, gasto, producto…"
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="p-1 text-slate-500 hover:text-white"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <ul className="max-h-72 overflow-y-auto text-sm">
              {results.length === 0 ? (
                <li className="px-4 py-8 text-center text-slate-500">Escribe para filtrar…</li>
              ) : (
                results.map((r, idx) => (
                  <li key={`${r.type}-${r.label}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => pick(r)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-800/80 border-b border-slate-800/50 flex justify-between gap-2"
                    >
                      <span className="text-white font-medium">{r.label}</span>
                      <span className="text-slate-500 shrink-0">
                        {r.type} → {tabConfig.find((t) => t.id === r.tab)?.label ?? r.tab}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
