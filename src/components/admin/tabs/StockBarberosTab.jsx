import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Download, Minus, Package, Plus, Search, User } from 'lucide-react';
import { downloadInventarioBarberosCsv } from '../adminExports';

export default function StockBarberosTab({
  barberos,
  items,
  onAdjustStock,
  readOnly,
  compact,
}) {
  const [barberoFiltro, setBarberoFiltro] = useState('');
  const [query, setQuery] = useState('');

  const filtrados = useMemo(() => {
    let list = items;
    if (barberoFiltro) {
      const id = Number(barberoFiltro);
      list = list.filter((i) => i.barberoId === id);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => i.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [items, barberoFiltro, query]);

  const porBarbero = useMemo(() => {
    const map = new Map();
    for (const b of barberos) {
      map.set(b.id, { barbero: b, items: [] });
    }
    for (const it of filtrados) {
      const row = map.get(it.barberoId);
      if (row) row.items.push(it);
    }
    return barberos.map((b) => map.get(b.id)).filter(Boolean);
  }, [barberos, filtrados]);

  const cell = compact ? 'p-2' : 'p-3';

  const exportCsv = useCallback(() => {
    downloadInventarioBarberosCsv(filtrados, barberos);
  }, [filtrados, barberos]);

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="glass-panel p-4 border border-slate-700/50 space-y-3">
        <p className="text-sm text-slate-400">
          Inventario <strong className="text-white">privado de cada barbero</strong> (herramientas, consumibles de
          puesto, etc.). El apartado <strong className="text-brand-accent">Inventario</strong> del panel es el stock
          general del salón.
        </p>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <select
              value={barberoFiltro}
              onChange={(e) => setBarberoFiltro(e.target.value)}
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white min-w-[200px]"
              aria-label="Filtrar por barbero"
            >
              <option value="">Todos los barberos</option>
              {barberos.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.nombre}
                </option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto…"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white"
                aria-label="Buscar en inventarios"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold border border-slate-600 hover:bg-slate-700 shrink-0"
          >
            <Download size={18} aria-hidden />
            CSV
          </button>
        </div>
      </div>

      {porBarbero.every((g) => g.items.length === 0) ? (
        <div className="glass-panel p-12 text-center text-slate-500 border border-slate-700/50">
          No hay ítems que coincidan con el filtro.
        </div>
      ) : (
        <div className="space-y-8">
          {porBarbero.map(
            ({ barbero: b, items: group }) =>
              group.length > 0 && (
                <section
                  key={b.id}
                  className="glass-panel border border-slate-700/50 overflow-hidden"
                  aria-labelledby={`stock-barbero-${b.id}`}
                >
                  <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/40 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
                      <User className="text-slate-400" size={20} aria-hidden />
                    </div>
                    <div>
                      <h3 id={`stock-barbero-${b.id}`} className="font-bold text-white text-lg">
                        {b.nombre}
                      </h3>
                      <p className="text-xs text-slate-500">{group.length} producto{group.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[480px]">
                      <thead>
                        <tr className="border-b border-slate-700/50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className={`${cell} font-bold`}>Producto</th>
                          <th className={`${cell} font-bold w-28`}>Stock</th>
                          <th className={`${cell} font-bold w-28`}>Mínimo</th>
                          <th className={`${cell} font-bold text-center w-36`}>Ajuste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.map((item) => {
                          const low = item.stock <= item.stockMinimo;
                          return (
                            <tr
                              key={item.id}
                              className={`border-b border-slate-700/20 ${low ? 'bg-amber-500/[0.06]' : ''}`}
                            >
                              <td className={`${cell} text-white font-medium`}>
                                <div className="flex items-center gap-2">
                                  <Package size={16} className="text-slate-500 shrink-0" aria-hidden />
                                  {item.nombre}
                                  {low && (
                                    <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                                      <AlertTriangle size={14} aria-hidden />
                                      Bajo
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className={`${cell} font-black text-white tabular-nums`}>{item.stock}</td>
                              <td className={`${cell} text-slate-400 tabular-nums`}>{item.stockMinimo}</td>
                              <td className={cell}>
                                {!readOnly ? (
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      type="button"
                                      onClick={() => onAdjustStock(item.id, -1)}
                                      className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400"
                                      aria-label="Menos"
                                    >
                                      <Minus size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onAdjustStock(item.id, 1)}
                                      className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400"
                                      aria-label="Más"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-xs text-center block">Solo lectura</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
          )}
        </div>
      )}
    </div>
  );
}
