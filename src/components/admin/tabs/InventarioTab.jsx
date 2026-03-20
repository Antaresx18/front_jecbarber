import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, AlertTriangle, Minus, Plus, Search, Boxes, Download, Pencil, Trash2 } from 'lucide-react';
import { useListFilterPagination } from '../../../hooks/useListFilterPagination';
import PaginationBar from '../../ui/PaginationBar';
import EmptyState from '../../ui/EmptyState';
import { downloadInventarioCsv } from '../adminExports';
import ConfirmDialog from '../../ui/ConfirmDialog';

export default function InventarioTab({
  inventario,
  onAdjustStock,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  filterSeed,
  readOnly,
  compact,
}) {
  const [soloBajo, setSoloBajo] = useState(false);
  const [sortKey, setSortKey] = useState('nombre');

  const [editId, setEditId] = useState(null);
  const [draftNombre, setDraftNombre] = useState('');
  const [draftPrecio, setDraftPrecio] = useState('');
  const [draftStock, setDraftStock] = useState('');
  const [draftMin, setDraftMin] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const preSorted = useMemo(() => {
    let list = [...inventario];
    if (soloBajo) list = list.filter((i) => i.stock <= i.stockMinimo);
    list.sort((a, b) => {
      if (sortKey === 'nombre') return a.nombre.localeCompare(b.nombre, 'es');
      if (sortKey === 'stock') return a.stock - b.stock;
      return a.precio - b.precio;
    });
    return list;
  }, [inventario, soloBajo, sortKey]);

  const matches = useCallback((item, q) => item.nombre.toLowerCase().includes(q), []);
  const { query, setQuery, page, setPage, totalPages, pageItems, filteredCount } =
    useListFilterPagination(preSorted, matches, compact ? 8 : 5);

  const forExport = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return preSorted;
    return preSorted.filter((i) => matches(i, q));
  }, [preSorted, query, matches]);

  useEffect(() => {
    if (!filterSeed || filterSeed.tab !== 'inventario') return;
    setQuery(filterSeed.value || '');
  }, [filterSeed, setQuery]);

  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('0');
  const [stockMinimo, setStockMinimo] = useState('2');
  const [formErr, setFormErr] = useState(null);

  const cell = compact ? 'p-2' : 'p-4';

  const handleAdd = (e) => {
    e.preventDefault();
    setFormErr(null);
    const n = nombre.trim();
    if (!n) {
      setFormErr('Nombre del producto obligatorio.');
      return;
    }
    const p = Number(String(precio).trim().replace(',', '.'));
    if (!Number.isFinite(p) || p < 0) {
      setFormErr('Precio inválido.');
      return;
    }
    const s = parseInt(stock, 10);
    const sm = parseInt(stockMinimo, 10);
    if (!Number.isFinite(s) || s < 0 || !Number.isFinite(sm) || sm < 0) {
      setFormErr('Stock y mínimo deben ser números ≥ 0.');
      return;
    }
    onAddItem({ nombre: n, precio: p, stock: s, stockMinimo: sm });
    setNombre('');
    setPrecio('');
    setStock('0');
    setStockMinimo('2');
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setDraftNombre(item.nombre);
    setDraftPrecio(String(item.precio));
    setDraftStock(String(item.stock));
    setDraftMin(String(item.stockMinimo));
  };

  const saveEdit = () => {
    if (!editId) return;
    const n = draftNombre.trim();
    const p = Number(String(draftPrecio).trim().replace(',', '.'));
    const s = parseInt(draftStock, 10);
    const sm = parseInt(draftMin, 10);
    if (!n || !Number.isFinite(p) || p < 0 || !Number.isFinite(s) || s < 0 || !Number.isFinite(sm) || sm < 0)
      return;
    onUpdateItem(editId, { nombre: n, precio: p, stock: s, stockMinimo: sm });
    setEditId(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget || !onRemoveItem) return;
    onRemoveItem(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="animate-in fade-in duration-300 space-y-4">
        {!readOnly && (
          <form onSubmit={handleAdd} className="glass-panel p-4 space-y-3 border border-slate-700/50">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Boxes size={18} className="text-brand-accent" aria-hidden />
              Añadir producto
            </h3>
            {formErr && (
              <p className="text-xs text-red-400" role="alert">
                {formErr}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Producto"
                className="lg:col-span-2 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="Precio"
                inputMode="decimal"
                className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="Stock"
                className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
              <input
                type="number"
                min={0}
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                placeholder="Mínimo"
                className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
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

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* SWITCH DORADO PREMIUM */}
            <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-700/50 px-3 py-2 rounded-xl shadow-inner">
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={soloBajo}
                    onChange={(e) => setSoloBajo(e.target.checked)}
                    className="sr-only peer"
                  />
                  {/* Fondo del Switch */}
                  <div className="w-10 h-5 bg-slate-700 rounded-full peer 
          peer-checked:after:translate-x-5 peer-checked:after:border-white 
          after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
          after:bg-slate-400 peer-checked:after:bg-white 
          after:rounded-full after:h-4 after:w-4 after:transition-all 
          peer-checked:bg-brand-accent shadow-lg">
                  </div>
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">
                  Solo stock bajo
                </span>
              </label>
            </div>

            {/* CONTENEDOR DE ORDEN Y EXPORTACIÓN */}
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-brand-accent/40 outline-none"
              >
                <option value="nombre">Orden: nombre</option>
                <option value="stock">Orden: stock</option>
                <option value="precio">Orden: precio</option>
              </select>

              <button
                type="button"
                onClick={() => downloadInventarioCsv(forExport)}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600 transition-colors shadow-sm"
              >
                <Download size={14} aria-hidden />
                EXPORTAR CSV
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 text-slate-400 text-sm glass-panel p-4">
          <Package className="text-brand-accent shrink-0 mt-0.5" size={20} aria-hidden />
          <p>
            Ajusta stock con los botones. Los productos por debajo del mínimo se resaltan y aparecen en el resumen.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              aria-label="Filtrar inventario"
            />
          </div>
          <p className="text-sm text-slate-500">
            {filteredCount} resultado{filteredCount !== 1 ? 's' : ''}
          </p>
        </div>

        {pageItems.length === 0 ? (
          <EmptyState title="Sin productos" hint="Cambia el filtro o registra un artículo nuevo." />
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {pageItems.map((item) => {
                const low = item.stock <= item.stockMinimo;
                return (
                  <div
                    key={item.id}
                    className={`glass-panel p-4 space-y-3 ${low ? 'border border-amber-500/40 bg-amber-500/5' : ''}`}
                  >
                    {editId === item.id ? (
                      <div className="space-y-2">
                        <input
                          value={draftNombre}
                          onChange={(e) => setDraftNombre(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            value={draftPrecio}
                            onChange={(e) => setDraftPrecio(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                          />
                          <input
                            type="number"
                            value={draftStock}
                            onChange={(e) => setDraftStock(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                          />
                          <input
                            type="number"
                            value={draftMin}
                            onChange={(e) => setDraftMin(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                          />
                        </div>
                        {!readOnly && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="text-xs font-bold px-2 py-1 rounded bg-brand-accent text-brand-dark"
                            >
                              Guardar
                            </button>
                            <button type="button" onClick={() => setEditId(null)} className="text-xs text-slate-400">
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-bold text-white">{item.nombre}</p>
                            <p className="text-sm text-slate-400 mt-1">${item.precio.toFixed(2)}</p>
                          </div>
                          {low && (
                            <span className="flex items-center gap-1 text-xs font-bold text-amber-400 shrink-0">
                              <AlertTriangle size={14} aria-hidden />
                              Bajo
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">
                            Stock: <span className="text-white font-bold text-lg">{item.stock}</span>
                            <span className="text-slate-500"> / mín. {item.stockMinimo}</span>
                          </span>
                          {!readOnly && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                                aria-label="Editar producto"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onAdjustStock(item.id, -1)}
                                className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                aria-label={`Quitar unidad de ${item.nombre}`}
                              >
                                <Minus size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onAdjustStock(item.id, 1)}
                                className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                                aria-label={`Añadir unidad a ${item.nombre}`}
                              >
                                <Plus size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-red-400 border border-slate-600/80 disabled:opacity-50"
                                aria-label={`Eliminar ${item.nombre}`}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block glass-panel p-2 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <caption className="sr-only">Inventario de productos</caption>
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                    <th className={`${cell} font-bold`}>Producto</th>
                    <th className={`${cell} font-bold`}>P. venta</th>
                    <th className={`${cell} font-bold`}>Stock</th>
                    <th className={`${cell} font-bold`}>Mínimo</th>
                    <th className={`${cell} font-bold text-center`}>Ajuste / editar</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => {
                    const low = item.stock <= item.stockMinimo;
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors ${low ? 'bg-amber-500/5' : ''
                          }`}
                      >
                        <td className={`${cell} font-medium text-white`}>
                          {editId === item.id ? (
                            <input
                              value={draftNombre}
                              onChange={(e) => setDraftNombre(e.target.value)}
                              className="w-full max-w-xs bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              {item.nombre}
                              {low && <AlertTriangle className="text-amber-400 shrink-0" size={16} aria-hidden />}
                            </div>
                          )}
                        </td>
                        <td className={cell}>
                          {editId === item.id ? (
                            <input
                              value={draftPrecio}
                              onChange={(e) => setDraftPrecio(e.target.value)}
                              className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                            />
                          ) : (
                            <span className="text-brand-accent font-semibold">${item.precio.toFixed(2)}</span>
                          )}
                        </td>
                        <td className={cell}>
                          {editId === item.id ? (
                            <input
                              type="number"
                              value={draftStock}
                              onChange={(e) => setDraftStock(e.target.value)}
                              className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                            />
                          ) : (
                            <span className="text-white font-bold">{item.stock}</span>
                          )}
                        </td>
                        <td className={cell}>
                          {editId === item.id ? (
                            <input
                              type="number"
                              value={draftMin}
                              onChange={(e) => setDraftMin(e.target.value)}
                              className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                            />
                          ) : (
                            <span className="text-slate-400">{item.stockMinimo}</span>
                          )}
                        </td>
                        <td className={cell}>
                          {!readOnly && (
                            <div className="flex gap-2 justify-center flex-wrap">
                              {editId === item.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={saveEdit}
                                    className="text-xs font-bold px-2 py-1 rounded bg-brand-accent text-brand-dark"
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
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(item)}
                                    className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                                    aria-label="Editar"
                                  >
                                    <Pencil size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onAdjustStock(item.id, -1)}
                                    className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                    aria-label={`Menos stock ${item.nombre}`}
                                  >
                                    <Minus size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onAdjustStock(item.id, 1)}
                                    className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                                    aria-label={`Más stock ${item.nombre}`}
                                  >
                                    <Plus size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(item)}
                                    className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                    aria-label={`Eliminar ${item.nombre}`}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar producto"
        message={
          deleteTarget
            ? `¿Eliminar definitivamente «${deleteTarget.nombre}»? Si tiene ventas vinculadas, la operación puede fallar.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
