import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, AlertCircle, CheckCircle2, Receipt, Boxes } from 'lucide-react';
import { supabase } from '../../supabase';
import InventarioTab from './tabs/InventarioTab';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';

/** @param {{ code?: string; message?: string }} err */
function mapSupabaseError(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  const code = err.code || '';
  const lower = msg.toLowerCase();
  if (code === '42501' || lower.includes('policy') || lower.includes('permission')) {
    return 'No tienes permiso (hace falta rol ADMIN en «perfiles»).';
  }
  if (code === '23503' || lower.includes('foreign key')) {
    return 'No se puede eliminar por restricciones (hay ventas vinculadas).';
  }
  return msg || 'Error al guardar en Supabase.';
}

export default function AdminVentasDashboard({ readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);

  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');

  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = useCallback((t) => setToast(t), []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadProductos = useCallback(async () => {
    const { data, error } = await supabase.from('inventario_salon').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    const list = (data ?? []).map((r) => ({
      ...r,
      precio: Number(r.precio ?? 0),
      stock: Number(r.stock ?? 0),
      stockMinimo: Number(r.stock_minimo ?? r.stockMinimo ?? 0),
    }));
    return list;
  }, []);

  const loadVentas = useCallback(async () => {
    const { data, error } = await supabase
      .from('ventas_salon')
      .select('id,producto_id,cantidad,total,created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      ...r,
      total: Number(r.total ?? 0),
      cantidad: Number(r.cantidad ?? 0),
    }));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [p, v] = await Promise.all([loadProductos(), loadVentas()]);
      setProductos(p);
      setVentas(v);
      setProductoId((prev) => prev || p[0]?.id || '');
    } catch (err) {
      setListError(mapSupabaseError(err));
      setProductos([]);
      setVentas([]);
    } finally {
      setLoading(false);
    }
  }, [loadProductos, loadVentas]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const productoSel = useMemo(() => productos.find((p) => p.id === productoId), [productos, productoId]);
  const precioSel = productoSel?.precio ?? 0;
  const totalVenta = useMemo(() => {
    const c = Number(String(cantidad).replace(',', '.'));
    if (!Number.isFinite(c) || c <= 0) return 0;
    return c * precioSel;
  }, [cantidad, precioSel]);

  const onAdjustStock = async (id, delta) => {
    if (readOnly) return;
    const item = productos.find((p) => p.id === id);
    if (!item) return;
    const nextStock = item.stock + delta;
    if (nextStock < 0) {
      showToast({ type: 'err', message: 'No puedes dejar el stock en negativo.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('inventario_salon').update({ stock: nextStock }).eq('id', id);
      if (error) throw error;
      await refresh();
      showToast({ type: 'ok', message: 'Stock actualizado.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const onAddItem = async (payload) => {
    if (readOnly) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('inventario_salon').insert({
        nombre: payload.nombre,
        precio: payload.precio,
        stock: payload.stock,
        stock_minimo: payload.stockMinimo,
      });
      if (error) throw error;
      await refresh();
      showToast({ type: 'ok', message: 'Producto creado.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const onUpdateItem = async (id, payload) => {
    if (readOnly) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('inventario_salon').update({
        nombre: payload.nombre,
        precio: payload.precio,
        stock: payload.stock,
        stock_minimo: payload.stockMinimo,
      }).eq('id', id);
      if (error) throw error;
      await refresh();
      showToast({ type: 'ok', message: 'Producto actualizado.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const onRemoveItem = async (id) => {
    if (readOnly) return;
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('inventario_salon').delete().eq('id', id);
      if (error) throw error;
      await refresh();
      showToast({ type: 'ok', message: 'Producto eliminado.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const createVenta = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (!productoId) return;
    const q = Number(String(cantidad).replace(',', '.'));
    if (!Number.isFinite(q) || q <= 0) {
      showToast({ type: 'err', message: 'Cantidad inválida.' });
      return;
    }
    if (!productoSel || productoSel.stock < q) {
      showToast({ type: 'err', message: 'Stock insuficiente para esta venta.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('ventas_salon').insert({
        producto_id: productoId,
        cantidad: q,
        total: q * precioSel,
      });
      if (error) throw error;
      setCantidad('1');
      await refresh();
      showToast({ type: 'ok', message: 'Venta registrada. Stock descontado.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const deleteVenta = async () => {
    if (!deleteTarget || readOnly) return;
    setSaving(true);
    try {
      // OJO: borrar ventas puede no ser deseado; lo dejamos como opcional por requerimiento de CRUD.
      const { error } = await supabase.from('ventas_salon').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      await refresh();
      showToast({ type: 'ok', message: 'Venta eliminada.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl max-w-[min(90vw,28rem)]
          ${toast.type === 'ok' ? 'bg-slate-900 border-emerald-500/40 text-emerald-100' : 'bg-slate-900 border-red-500/40 text-red-200'}`}
          role="status"
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="text-emerald-400 shrink-0" size={20} aria-hidden />
          ) : (
            <AlertCircle className="text-red-400 shrink-0" size={20} aria-hidden />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Punto de venta e inventario</h2>
          <p className="text-slate-400 text-sm mt-1">Ventas_salon descuenta automáticamente inventario_salon</p>
        </div>
        {readOnly && (
          <div className="text-amber-400 text-xs font-bold border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
            Modo solo lectura
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="animate-spin text-brand-gold" size={40} aria-hidden />
          <span className="text-sm font-medium">Cargando inventario y ventas…</span>
        </div>
      ) : listError ? (
        <div className="max-w-2xl mx-auto glass-panel p-6 border border-red-500/30">
          <AlertCircle className="text-red-400" size={24} aria-hidden />
          <p className="text-red-200 mt-3 font-bold">No se pudo cargar</p>
          <p className="text-red-300/90 text-sm mt-1">{listError}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="glass-panel p-6 border border-slate-700/50">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-brand-gold" aria-hidden />
                <h3 className="text-xl font-bold text-white">Registrar venta</h3>
              </div>

              <form onSubmit={createVenta} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1.5 block">Producto *</label>
                  <select
                    value={productoId}
                    onChange={(e) => setProductoId(e.target.value)}
                    disabled={readOnly || productos.length === 0}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                  >
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} · ${p.precio.toFixed(2)} · Stock {p.stock}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-1.5 block">Cantidad *</label>
                    <input
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      inputMode="numeric"
                      disabled={readOnly}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                      placeholder="1"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="text-xs text-slate-500">Total</div>
                    <div className="text-2xl font-black text-brand-gold tabular-nums">
                      ${totalVenta.toFixed(2)}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={readOnly || saving || !productoId}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-gold text-brand-dark font-black text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50 shadow-lg shadow-amber-900/20"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Plus size={18} aria-hidden />}
                  Registrar venta
                </button>
              </form>
            </div>

            <div className="glass-panel p-6 border border-slate-700/50">
              <div className="flex items-center gap-2">
                <Boxes size={20} className="text-brand-gold" aria-hidden />
                <h3 className="text-xl font-bold text-white">Últimas ventas</h3>
              </div>
              {ventas.length === 0 ? (
                <EmptyState title="Sin ventas" hint="Registra la primera venta para descontar stock automáticamente." />
              ) : (
                <div className="mt-4 space-y-3">
                  {ventas.map((v) => {
                    const prod = productos.find((p) => p.id === v.producto_id);
                    return (
                      <div key={v.id} className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {prod?.nombre ?? v.producto_id}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Cantidad: {v.cantidad} · Total: ${v.total.toFixed(2)}
                            </p>
                            {v.created_at ? (
                              <p className="text-[11px] text-slate-500 mt-1">
                                {String(v.created_at).slice(0, 19).replace('T', ' ')}
                              </p>
                            ) : null}
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(v)}
                              disabled={saving}
                              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-red-400 border border-slate-600/80 disabled:opacity-50"
                              aria-label="Eliminar venta"
                              title="Eliminar (si hay impacto de stock, la base podría no deshacer el descuento)"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <InventarioTab
            inventario={productos}
            onAdjustStock={onAdjustStock}
            onAddItem={onAddItem}
            onUpdateItem={onUpdateItem}
            onRemoveItem={onRemoveItem}
            readOnly={readOnly}
            compact={false}
          />
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar venta"
        message={deleteTarget ? `¿Eliminar la venta (${deleteTarget.cantidad} uds.)?` : ''}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        onConfirm={deleteVenta}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}


