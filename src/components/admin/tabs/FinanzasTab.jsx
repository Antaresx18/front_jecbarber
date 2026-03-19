import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, Trash2, Download, Search, Receipt, Copy } from 'lucide-react';
import { useListFilterPagination } from '../../../hooks/useListFilterPagination';
import PaginationBar from '../../ui/PaginationBar';
import EmptyState from '../../ui/EmptyState';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { filterGastosByDateRange } from '../../../utils/adminFilters';
import { downloadGastosCsv } from '../exportCsv';

export default function FinanzasTab({
  gastos,
  onExportCsv,
  onRemoveGasto,
  onAddGasto,
  onDuplicateGasto,
  filterSeed,
  readOnly,
  compact,
}) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const porFecha = useMemo(
    () => filterGastosByDateRange(gastos, desde, hasta),
    [gastos, desde, hasta]
  );

  const matches = useCallback((g, q) => {
    const n = `${g.concepto} ${g.categoria} ${g.fecha}`.toLowerCase();
    return n.includes(q);
  }, []);

  const { query, setQuery, page, setPage, totalPages, pageItems, filteredCount } =
    useListFilterPagination(porFecha, matches, compact ? 8 : 5);

  const forExport = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return porFecha;
    return porFecha.filter((g) => matches(g, q));
  }, [porFecha, query, matches]);

  useEffect(() => {
    if (!filterSeed || filterSeed.tab !== 'finanzas') return;
    setQuery(filterSeed.value || '');
  }, [filterSeed, setQuery]);

  const [pending, setPending] = useState(null);

  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Fijo');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [formErr, setFormErr] = useState(null);

  const handleAdd = (e) => {
    e.preventDefault();
    setFormErr(null);
    const c = concepto.trim();
    if (!c) {
      setFormErr('Concepto obligatorio.');
      return;
    }
    const m = Number(String(monto).trim().replace(',', '.'));
    if (!Number.isFinite(m) || m <= 0) {
      setFormErr('Monto debe ser mayor que 0.');
      return;
    }
    if (!fecha) {
      setFormErr('Selecciona una fecha.');
      return;
    }
    onAddGasto({ concepto: c, monto: m, categoria, fecha });
    setConcepto('');
    setMonto('');
    setCategoria('Fijo');
    setFecha(new Date().toISOString().slice(0, 10));
  };

  const exportTodo = () => {
    onExportCsv();
  };

  const exportFiltrado = () => {
    downloadGastosCsv(
      forExport,
      `gastos_filtrado_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <ConfirmDialog
        open={!!pending}
        title="Eliminar gasto"
        message={
          pending
            ? `¿Eliminar «${pending.concepto}» por $${pending.monto.toFixed(2)}? Tras confirmar podrás usar «Deshacer» en el aviso inferior unos segundos.`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) onRemoveGasto(pending.id);
          setPending(null);
        }}
      />

      {!readOnly && (
        <form onSubmit={handleAdd} className="glass-panel p-4 space-y-3 border border-slate-700/50">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt size={18} className="text-indigo-400" aria-hidden />
            Registrar gasto
          </h3>
          {formErr && (
            <p className="text-xs text-red-400" role="alert">
              {formErr}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Concepto"
              className="lg:col-span-2 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Monto"
              inputMode="decimal"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="Fijo">Fijo</option>
              <option value="Marketing">Marketing</option>
              <option value="Operativo">Operativo</option>
              <option value="Otro">Otro</option>
            </select>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              type="submit"
              className="py-2 rounded-lg bg-indigo-600 text-white text-sm font-black hover:bg-indigo-500 transition-colors"
            >
              Añadir
            </button>
          </div>
        </form>
      )}

      <div className="glass-panel p-4 space-y-3 border border-slate-700/50">
        <h3 className="text-sm font-bold text-white">Rango de fechas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
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
        </div>
        <p className="text-xs text-slate-500">Vacío = sin filtrar por fecha. La búsqueda de texto se aplica después.</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-md">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Centro contable</h3>
          <p className="text-slate-400 text-sm">Egresos, duplicados y exportación</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={exportFiltrado}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors text-sm"
          >
            <Download size={18} aria-hidden />
            CSV filtrado
          </button>
          <button
            type="button"
            onClick={exportTodo}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20 text-sm"
          >
            <Download size={18} aria-hidden />
            CSV todos
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por concepto, categoría o fecha…"
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            aria-label="Filtrar gastos"
          />
        </div>
        <p className="text-sm text-slate-500">
          {filteredCount} resultado{filteredCount !== 1 ? 's' : ''}
        </p>
      </div>

      {gastos.length === 0 ? (
        <EmptyState
          title="No hay gastos registrados"
          hint="Añade tu primer egreso con el formulario superior."
        />
      ) : pageItems.length === 0 ? (
        <EmptyState title="Nada coincide con el filtro" hint="Prueba otro término o amplía el rango de fechas." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {pageItems.map((g) => (
              <div
                key={g.id}
                className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 shrink-0">
                    <ArrowDownCircle size={24} className="text-red-400" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-white font-bold text-lg">{g.concepto}</h4>
                    <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                      {g.categoria} • {g.fecha}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                  <span className="text-2xl font-black text-red-400">-${g.monto.toFixed(2)}</span>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onDuplicateGasto(g.id)}
                        className="p-2 text-slate-600 hover:text-indigo-400 transition-colors rounded-lg hover:bg-indigo-500/10"
                        aria-label={`Duplicar gasto: ${g.concepto}`}
                      >
                        <Copy size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPending(g)}
                        className="p-2 text-slate-600 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                        aria-label={`Eliminar gasto: ${g.concepto}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
