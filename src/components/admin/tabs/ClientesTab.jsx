import { useCallback, useEffect, useMemo, useState } from 'react';
import { User, Search, UserPlus, Download, Pencil } from 'lucide-react';
import { useListFilterPagination } from '../../../hooks/useListFilterPagination';
import PaginationBar from '../../ui/PaginationBar';
import EmptyState from '../../ui/EmptyState';
import { downloadClientesCsv } from '../adminExports';
import { rangoClass } from '../rangoClienteUi';

export default function ClientesTab({
  clientes,
  onAjustarCortes,
  onAddCliente,
  onUpdateCliente,
  filterSeed,
  readOnly,
  compact,
}) {
  const [rangoFilter, setRangoFilter] = useState('');
  const [cortesMin, setCortesMin] = useState('');
  const [cortesMax, setCortesMax] = useState('');
  const [sortKey, setSortKey] = useState('nombre_asc');

  const [editId, setEditId] = useState(null);
  const [draftNombre, setDraftNombre] = useState('');
  const [draftNotas, setDraftNotas] = useState('');

  const preFiltered = useMemo(() => {
    let list = [...clientes];
    if (rangoFilter) list = list.filter((c) => c.rango === rangoFilter);
    const minN = cortesMin === '' ? null : Number(cortesMin);
    const maxN = cortesMax === '' ? null : Number(cortesMax);
    if (minN !== null && Number.isFinite(minN)) list = list.filter((c) => c.cortes >= minN);
    if (maxN !== null && Number.isFinite(maxN)) list = list.filter((c) => c.cortes <= maxN);
    const [field, dir] = sortKey.split('_');
    list.sort((a, b) => {
      let cmp = 0;
      if (field === 'nombre') cmp = a.nombre.localeCompare(b.nombre, 'es');
      else cmp = a.cortes - b.cortes;
      return dir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [clientes, rangoFilter, cortesMin, cortesMax, sortKey]);

  const matches = useCallback((c, q) => {
    const hay = `${c.nombre} ${c.notas ?? ''} ${c.rango}`.toLowerCase();
    return hay.includes(q);
  }, []);

  const { query, setQuery, page, setPage, totalPages, pageItems, filteredCount } =
    useListFilterPagination(preFiltered, matches, compact ? 8 : 5);

  const forExport = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return preFiltered;
    return preFiltered.filter((c) => matches(c, q));
  }, [preFiltered, query, matches]);

  useEffect(() => {
    if (!filterSeed || filterSeed.tab !== 'clientes') return;
    setQuery(filterSeed.value || '');
  }, [filterSeed, setQuery]);

  const [nombre, setNombre] = useState('');
  const [rango, setRango] = useState('Bronce');
  const [proximos, setProximos] = useState('5');
  const [formErr, setFormErr] = useState(null);

  const dense = compact ? 'text-xs p-2' : 'p-4';
  const cell = compact ? 'p-2' : 'p-4';

  const handleAdd = (e) => {
    e.preventDefault();
    setFormErr(null);
    const n = nombre.trim();
    if (!n) {
      setFormErr('El nombre es obligatorio.');
      return;
    }
    const p = parseInt(proximos, 10);
    if (!Number.isFinite(p) || p < 1) {
      setFormErr('Meta de cortes debe ser ≥ 1.');
      return;
    }
    onAddCliente({ nombre: n, rango, proximos: p });
    setNombre('');
    setRango('Bronce');
    setProximos('5');
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setDraftNombre(c.nombre);
    setDraftNotas(c.notas ?? '');
  };

  const saveEdit = () => {
    if (!editId) return;
    const n = draftNombre.trim();
    if (!n) return;
    onUpdateCliente(editId, { nombre: n, notas: draftNotas.trim() });
    setEditId(null);
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      {!readOnly && (
        <form
          onSubmit={handleAdd}
          className="glass-panel p-4 space-y-3 border border-slate-700/50"
        >
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserPlus size={18} className="text-brand-gold" aria-hidden />
            Añadir cliente
          </h3>
          {formErr && (
            <p className="text-xs text-red-400" role="alert">
              {formErr}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
            <select
              value={rango}
              onChange={(e) => setRango(e.target.value)}
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="Bronce">Bronce</option>
              <option value="Plata">Plata</option>
              <option value="Oro">Oro</option>
            </select>
            <input
              type="number"
              min={1}
              value={proximos}
              onChange={(e) => setProximos(e.target.value)}
              placeholder="Meta cortes"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
            <button
              type="submit"
              className="py-2 rounded-lg bg-brand-gold text-brand-dark text-sm font-black hover:bg-yellow-400 transition-colors"
            >
              Guardar cliente
            </button>
          </div>
        </form>
      )}

      <div className="glass-panel p-4 space-y-3 border border-slate-700/50">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtros</span>
          <button
            type="button"
            onClick={() => downloadClientesCsv(forExport)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600"
          >
            <Download size={14} aria-hidden />
            CSV (vista actual)
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={rangoFilter}
            onChange={(e) => setRangoFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Todos los rangos</option>
            <option value="Bronce">Bronce</option>
            <option value="Plata">Plata</option>
            <option value="Oro">Oro</option>
          </select>
          <input
            value={cortesMin}
            onChange={(e) => setCortesMin(e.target.value)}
            placeholder="Cortes mín."
            inputMode="numeric"
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            value={cortesMax}
            onChange={(e) => setCortesMax(e.target.value)}
            placeholder="Cortes máx."
            inputMode="numeric"
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white lg:col-span-2"
          >
            <option value="nombre_asc">Nombre A → Z</option>
            <option value="nombre_desc">Nombre Z → A</option>
            <option value="cortes_asc">Cortes ↑</option>
            <option value="cortes_desc">Cortes ↓</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, notas o rango…"
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            aria-label="Filtrar clientes"
          />
        </div>
        <p className="text-sm text-slate-500">
          {filteredCount} resultado{filteredCount !== 1 ? 's' : ''}
        </p>
      </div>

      <p className="text-sm text-slate-500 md:hidden">
        Vista en tarjetas; en pantallas grandes verás la tabla completa.
      </p>

      {pageItems.length === 0 ? (
        <EmptyState
          title="Sin clientes que coincidan"
          hint="Prueba otro término de búsqueda o ajusta los filtros."
        />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {pageItems.map((c) => (
              <div key={c.id} className={`glass-panel space-y-3 ${dense}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <User size={18} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    {editId === c.id ? (
                      <div className="space-y-2">
                        <input
                          value={draftNombre}
                          onChange={(e) => setDraftNombre(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                        <input
                          value={draftNotas}
                          onChange={(e) => setDraftNotas(e.target.value)}
                          placeholder="Notas internas"
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={readOnly}
                            className="text-xs font-bold px-2 py-1 rounded bg-brand-gold text-brand-dark disabled:opacity-40"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            className="text-xs text-slate-400"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-white truncate">{c.nombre}</p>
                        <span
                          className={`inline-block mt-1 px-3 py-0.5 text-xs font-black uppercase rounded-full border ${rangoClass(c.rango)}`}
                        >
                          {c.rango}
                        </span>
                        {(c.notas ?? '') !== '' && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.notas}</p>
                        )}
                      </>
                    )}
                  </div>
                  {!readOnly && editId !== c.id && (
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="p-2 text-slate-400 hover:text-white shrink-0"
                      aria-label={`Editar ${c.nombre}`}
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Cortes</span>
                  <span className="text-brand-gold font-black text-lg">
                    {c.cortes} / {c.proximos}
                  </span>
                </div>
                {!readOnly && (
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      aria-label={`Restar corte a ${c.nombre}`}
                      onClick={() => onAjustarCortes(c.id, -1)}
                      className="px-4 py-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      aria-label={`Sumar corte a ${c.nombre}`}
                      onClick={() => onAjustarCortes(c.id, 1)}
                      className="px-4 py-2 bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:block glass-panel p-2 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <caption className="sr-only">Listado de clientes y rangos</caption>
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                  <th className={`${cell} font-bold text-left`}>Cliente</th>
                  <th className={`${cell} font-bold text-left`}>Nivel</th>
                  <th className={`${cell} font-bold text-left`}>Notas</th>
                  <th className={`${cell} font-bold text-left`}>Cortes</th>
                  <th className={`${cell} font-bold text-center`}>Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c.id} className="border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors">
                    <td className={`${cell} font-bold text-white`}>
                      {editId === c.id ? (
                        <input
                          value={draftNombre}
                          onChange={(e) => setDraftNombre(e.target.value)}
                          className="w-full max-w-xs bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                            <User size={16} aria-hidden />
                          </div>
                          {c.nombre}
                        </div>
                      )}
                    </td>
                    <td className={cell}>
                      <span
                        className={`px-3 py-1 text-xs font-black uppercase rounded-full border ${rangoClass(c.rango)}`}
                      >
                        {c.rango}
                      </span>
                    </td>
                    <td className={`${cell} text-slate-400 text-sm max-w-[200px]`}>
                      {editId === c.id ? (
                        <input
                          value={draftNotas}
                          onChange={(e) => setDraftNotas(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                      ) : (
                        <span className="line-clamp-2">{c.notas ?? '—'}</span>
                      )}
                    </td>
                    <td className={`${cell} text-slate-300 font-medium`}>
                      <span className="text-brand-gold text-lg font-black">{c.cortes}</span> / {c.proximos}
                    </td>
                    <td className={cell}>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {!readOnly && editId === c.id && (
                          <>
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="text-xs font-bold px-2 py-1 rounded bg-brand-gold text-brand-dark"
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditId(null)}
                              className="text-xs text-slate-400 px-2"
                            >
                              ✕
                            </button>
                          </>
                        )}
                        {!readOnly && editId !== c.id && (
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                            aria-label={`Editar ${c.nombre}`}
                          >
                            <Pencil size={18} />
                          </button>
                        )}
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              aria-label={`Restar corte a ${c.nombre}`}
                              onClick={() => onAjustarCortes(c.id, -1)}
                              className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                            >
                              −
                            </button>
                            <button
                              type="button"
                              aria-label={`Sumar corte a ${c.nombre}`}
                              onClick={() => onAjustarCortes(c.id, 1)}
                              className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                            >
                              +
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
