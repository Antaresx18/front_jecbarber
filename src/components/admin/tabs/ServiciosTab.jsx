import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Edit2,
  Save,
  X,
  Search,
  Plus,
  Download,
  Copy,
  Power,
  PowerOff,
} from 'lucide-react';
import { useListFilterPagination } from '../../../hooks/useListFilterPagination';
import PaginationBar from '../../ui/PaginationBar';
import EmptyState from '../../ui/EmptyState';
import { downloadServiciosCsv } from '../adminExports';

export default function ServiciosTab({
  servicios,
  editingId,
  precioDraft,
  error,
  onStartEdit,
  onChangeDraft,
  onSave,
  onCancel,
  onAddServicio,
  onUpdateServicio,
  onToggleActivo,
  onDuplicate,
  filterSeed,
  readOnly,
  compact,
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [durMin, setDurMin] = useState('');
  const [durMax, setDurMax] = useState('');

  const [rowEditId, setRowEditId] = useState(null);
  const [rowNombre, setRowNombre] = useState('');
  const [rowDur, setRowDur] = useState('');
  const [rowPrecio, setRowPrecio] = useState('');

  const preFiltered = useMemo(() => {
    return servicios.filter((s) => {
      if (!showInactive && s.activo === false) return false;
      const pmin = precioMin === '' ? null : Number(precioMin);
      const pmax = precioMax === '' ? null : Number(precioMax);
      if (pmin !== null && Number.isFinite(pmin) && s.precio < pmin) return false;
      if (pmax !== null && Number.isFinite(pmax) && s.precio > pmax) return false;
      const dmin = durMin === '' ? null : Number(durMin);
      const dmax = durMax === '' ? null : Number(durMax);
      if (dmin !== null && Number.isFinite(dmin) && s.duracion < dmin) return false;
      if (dmax !== null && Number.isFinite(dmax) && s.duracion > dmax) return false;
      return true;
    });
  }, [servicios, showInactive, precioMin, precioMax, durMin, durMax]);

  const matches = useCallback((s, q) => s.nombre.toLowerCase().includes(q), []);
  const { query, setQuery, page, setPage, totalPages, pageItems, filteredCount } =
    useListFilterPagination(preFiltered, matches, compact ? 8 : 5);

  const forExport = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return preFiltered;
    return preFiltered.filter((s) => matches(s, q));
  }, [preFiltered, query, matches]);

  useEffect(() => {
    if (!filterSeed || filterSeed.tab !== 'servicios') return;
    setQuery(filterSeed.value || '');
  }, [filterSeed, setQuery]);

  const [nombre, setNombre] = useState('');
  const [duracion, setDuracion] = useState('30');
  const [precioNuevo, setPrecioNuevo] = useState('');
  const [formErr, setFormErr] = useState(null);

  const cell = compact ? 'p-2' : 'p-4';

  const handleAdd = (e) => {
    e.preventDefault();
    setFormErr(null);
    const n = nombre.trim();
    if (!n) {
      setFormErr('Nombre del servicio obligatorio.');
      return;
    }
    const d = parseInt(duracion, 10);
    if (!Number.isFinite(d) || d < 1) {
      setFormErr('Duración inválida (minutos ≥ 1).');
      return;
    }
    const raw = precioNuevo.trim().replace(',', '.');
    const p = Number(raw);
    if (!Number.isFinite(p) || p < 0) {
      setFormErr('Precio inválido (≥ 0).');
      return;
    }
    onAddServicio({ nombre: n, duracion: d, precio: p });
    setNombre('');
    setDuracion('30');
    setPrecioNuevo('');
  };

  const openRowEdit = (s) => {
    setRowEditId(s.id);
    setRowNombre(s.nombre);
    setRowDur(String(s.duracion));
    setRowPrecio(String(s.precio));
  };

  const saveRowEdit = (id) => {
    const n = rowNombre.trim();
    const d = parseInt(rowDur, 10);
    const p = Number(String(rowPrecio).trim().replace(',', '.'));
    if (!n || !Number.isFinite(d) || d < 1 || !Number.isFinite(p) || p < 0) return;
    onUpdateServicio(id, { nombre: n, duracion: d, precio: p });
    setRowEditId(null);
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      {!readOnly && (
        <form onSubmit={handleAdd} className="glass-panel p-4 space-y-3 border border-slate-700/50">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus size={18} className="text-brand-accent" aria-hidden />
            Añadir servicio
          </h3>
          {formErr && (
            <p className="text-xs text-red-400" role="alert">
              {formErr}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del servicio"
              className="lg:col-span-2 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            />
            <input
              type="number"
              min={1}
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              placeholder="Minutos"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            />
            <input
              value={precioNuevo}
              onChange={(e) => setPrecioNuevo(e.target.value)}
              placeholder="Precio"
              inputMode="decimal"
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            />
            <button
              type="submit"
              className="py-2 rounded-lg bg-brand-accent text-brand-dark text-sm font-black hover:brightness-110 transition-all"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      <div className="glass-panel p-4 space-y-3 border border-slate-700/50">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-600"
            />
            Mostrar inactivos
          </label>
          <button
            type="button"
            onClick={() => downloadServiciosCsv(forExport)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600"
          >
            <Download size={14} aria-hidden />
            CSV
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <input
            value={precioMin}
            onChange={(e) => setPrecioMin(e.target.value)}
            placeholder="Precio min"
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            value={precioMax}
            onChange={(e) => setPrecioMax(e.target.value)}
            placeholder="Precio max"
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            value={durMin}
            onChange={(e) => setDurMin(e.target.value)}
            placeholder="Dur. min (min)"
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            value={durMax}
            onChange={(e) => setDurMax(e.target.value)}
            placeholder="Dur. max (min)"
            className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar servicio…"
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
            aria-label="Filtrar servicios"
          />
        </div>
        <p className="text-sm text-slate-500">
          {filteredCount} resultado{filteredCount !== 1 ? 's' : ''}
        </p>
      </div>

      <p className="text-sm text-slate-500 md:hidden">Catálogo en tarjetas.</p>

      {pageItems.length === 0 ? (
        <EmptyState title="Sin servicios" hint="Ajusta el filtro o añade uno nuevo al catálogo." />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {pageItems.map((s) => (
              <div key={s.id} className="glass-panel p-4 space-y-3">
                {rowEditId === s.id ? (
                  <div className="space-y-2">
                    <input
                      value={rowNombre}
                      onChange={(e) => setRowNombre(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={rowDur}
                        onChange={(e) => setRowDur(e.target.value)}
                        className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                      />
                      <input
                        value={rowPrecio}
                        onChange={(e) => setRowPrecio(e.target.value)}
                        className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                      />
                    </div>
                    {!readOnly && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveRowEdit(s.id)}
                          className="text-xs font-bold px-2 py-1 rounded bg-emerald-600 text-white"
                        >
                          Guardar fila
                        </button>
                        <button type="button" onClick={() => setRowEditId(null)} className="text-xs text-slate-400">
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-2">
                      <p className="font-medium text-white text-lg">{s.nombre}</p>
                      {s.activo === false && (
                        <span className="text-[10px] font-black uppercase text-red-400 border border-red-500/40 px-2 py-0.5 rounded">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{s.duracion} min</p>
                    {editingId === s.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-400">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={precioDraft}
                          onChange={(e) => onChangeDraft(e.target.value)}
                          className="w-28 bg-slate-900 border border-brand-accent text-white px-2 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                          aria-invalid={!!error}
                        />
                        <button
                          type="button"
                          onClick={() => onSave(s.id)}
                          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-brand-dark transition-colors"
                          aria-label="Guardar precio"
                        >
                          <Save size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={onCancel}
                          className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
                          aria-label="Cancelar edición"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <span className="text-brand-accent font-bold text-lg">${s.precio.toFixed(2)}</span>
                        {!readOnly && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => onStartEdit(s)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
                              aria-label={`Editar precio de ${s.nombre}`}
                            >
                              <Edit2 size={20} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openRowEdit(s)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white text-xs font-bold px-2"
                            >
                              Fila
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicate(s.id)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white"
                              aria-label="Duplicar"
                            >
                              <Copy size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleActivo(s.id)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white"
                              aria-label={s.activo === false ? 'Activar' : 'Desactivar'}
                            >
                              {s.activo === false ? <Power size={18} /> : <PowerOff size={18} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:block glass-panel p-2 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <caption className="sr-only">Catálogo de servicios</caption>
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                  <th className={`${cell} font-bold`}>Servicio</th>
                  <th className={`${cell} font-bold`}>Duración</th>
                  <th className={`${cell} font-bold`}>Precio</th>
                  <th className={`${cell} font-bold`}>Estado</th>
                  <th className={`${cell} font-bold text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((s) => (
                  <tr key={s.id} className="border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors">
                    <td className={`${cell} font-medium text-white`}>
                      {rowEditId === s.id ? (
                        <input
                          value={rowNombre}
                          onChange={(e) => setRowNombre(e.target.value)}
                          className="w-full max-w-[200px] bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                        />
                      ) : (
                        s.nombre
                      )}
                    </td>
                    <td className={`${cell} text-slate-400`}>
                      {rowEditId === s.id ? (
                        <input
                          type="number"
                          value={rowDur}
                          onChange={(e) => setRowDur(e.target.value)}
                          className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                        />
                      ) : (
                        `${s.duracion} min`
                      )}
                    </td>
                    <td className={cell}>
                      {rowEditId === s.id ? (
                        <input
                          value={rowPrecio}
                          onChange={(e) => setRowPrecio(e.target.value)}
                          className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                        />
                      ) : editingId === s.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={precioDraft}
                            onChange={(e) => onChangeDraft(e.target.value)}
                            className="w-24 bg-slate-900 border border-brand-accent text-white px-2 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                            aria-invalid={!!error}
                          />
                        </div>
                      ) : (
                        <span className="text-brand-accent font-bold text-lg">${s.precio.toFixed(2)}</span>
                      )}
                    </td>
                    <td className={cell}>
                      {s.activo === false ? (
                        <span className="text-xs font-bold text-red-400">Inactivo</span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400">Activo</span>
                      )}
                    </td>
                    <td className={cell}>
                      <div className="flex gap-1 justify-center flex-wrap">
                        {rowEditId === s.id && !readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => saveRowEdit(s.id)}
                              className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"
                              aria-label="Guardar fila"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRowEditId(null)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg"
                            >
                              <X size={18} />
                            </button>
                          </>
                        )}
                        {rowEditId !== s.id && !readOnly && (
                          <>
                            {editingId === s.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onSave(s.id)}
                                  className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-brand-dark transition-colors"
                                  aria-label="Guardar"
                                >
                                  <Save size={20} />
                                </button>
                                <button
                                  type="button"
                                  onClick={onCancel}
                                  className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
                                  aria-label="Cancelar"
                                >
                                  <X size={20} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onStartEdit(s)}
                                  className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
                                  aria-label={`Editar precio ${s.nombre}`}
                                >
                                  <Edit2 size={20} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openRowEdit(s)}
                                  className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white text-[10px] font-black"
                                  title="Editar nombre/duración/precio"
                                >
                                  Fila
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDuplicate(s.id)}
                                  className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white"
                                  aria-label="Duplicar"
                                >
                                  <Copy size={18} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onToggleActivo(s.id)}
                                  className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white"
                                  aria-label="Activo/inactivo"
                                >
                                  {s.activo === false ? <Power size={18} /> : <PowerOff size={18} />}
                                </button>
                              </>
                            )}
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
