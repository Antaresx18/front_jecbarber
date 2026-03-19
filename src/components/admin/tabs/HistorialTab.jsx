import { useCallback, useMemo, useState } from 'react';
import { Calendar, Search, Download, Filter } from 'lucide-react';
import { useListFilterPagination } from '../../../hooks/useListFilterPagination';
import PaginationBar from '../../ui/PaginationBar';
import EmptyState from '../../ui/EmptyState';
import { downloadHistorialCitasCsv } from '../adminExports';
import { isFechaInRange } from '../../../utils/adminFilters';
import { rangoClass, rangoLabel } from '../rangoClienteUi';

export default function HistorialTab({ citas, barberos, clientes, rangoPorClienteId, compact, onExport }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [barberoId, setBarberoId] = useState('');
  const [estado, setEstado] = useState('');

  const filteredByMeta = useMemo(() => {
    return citas.filter((c) => {
      if (!isFechaInRange(c.fecha, desde, hasta)) return false;
      if (barberoId && String(c.barberoId) !== barberoId) return false;
      if (estado && c.estado !== estado) return false;
      return true;
    });
  }, [citas, desde, hasta, barberoId, estado]);

  const matches = useCallback(
    (c, q) => {
      const r = rangoLabel(rangoPorClienteId, c.clienteId) ?? '';
      const n = `${c.clienteNombre} ${c.barberoNombre} ${c.servicio} ${c.pedidoCliente ?? ''} ${c.estado} ${r}`.toLowerCase();
      return n.includes(q);
    },
    [rangoPorClienteId]
  );

  const { query, setQuery, page, setPage, totalPages, pageItems, filteredCount } =
    useListFilterPagination(filteredByMeta, matches, 6);

  const dense = compact ? 'text-xs p-2' : 'p-4';

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <div className="glass-panel p-4 space-y-3 border border-slate-700/50">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Filter size={18} className="text-brand-accent" aria-hidden />
          Filtros del historial
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <select
            value={barberoId}
            onChange={(e) => setBarberoId(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todos los barberos</option>
            {barberos.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.nombre}
              </option>
            ))}
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todos los estados</option>
            <option value="Completada">Completada</option>
            <option value="Cancelada">Cancelada</option>
            <option value="No asistió">No asistió</option>
          </select>
          <button
            type="button"
            onClick={() => {
              downloadHistorialCitasCsv(filteredByMeta, clientes);
              onExport?.();
            }}
            className="flex items-center justify-center gap-2 py-2 rounded-lg bg-brand-accent text-brand-dark text-sm font-black hover:brightness-110"
          >
            <Download size={18} aria-hidden />
            CSV filtrado
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en resultados…"
          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white"
        />
      </div>

      {pageItems.length === 0 ? (
        <EmptyState title="Sin citas en este criterio" hint="Amplía fechas o quita filtros." />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {filteredCount} cita{filteredCount !== 1 ? 's' : ''} (página {page} de {totalPages})
          </p>
          <div className="space-y-2">
            {pageItems.map((c) => {
              const rangoCli = rangoLabel(rangoPorClienteId, c.clienteId);
              return (
              <div
                key={c.id}
                className={`glass-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${dense}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Calendar className="text-brand-gold shrink-0 mt-0.5" size={18} aria-hidden />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <p className="font-bold text-white truncate">{c.clienteNombre}</p>
                      {rangoCli ? (
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${rangoClass(rangoCli)}`}
                        >
                          {rangoCli}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-slate-400 text-sm">
                      {c.fecha} · {c.hora} · {c.barberoNombre}
                    </p>
                    <p className="text-brand-accent text-xs font-semibold uppercase mt-0.5">{c.servicio}</p>
                    {(c.pedidoCliente ?? '').trim() !== '' && (
                      <p className="text-slate-500 text-xs mt-1 leading-snug border-l-2 border-slate-600 pl-2">
                        <span className="text-slate-600 font-bold">Pedido: </span>
                        {c.pedidoCliente}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-black px-2 py-1 rounded border ${
                      c.estado === 'Completada'
                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                        : c.estado === 'Cancelada'
                          ? 'border-red-500/40 text-red-400 bg-red-500/10'
                          : 'border-slate-600 text-slate-400'
                    }`}
                  >
                    {c.estado}
                  </span>
                  <span className="font-bold text-emerald-400">${Number(c.monto).toFixed(2)}</span>
                </div>
              </div>
            );
            })}
          </div>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
