import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../hooks/useAuth';
import ConfirmDialog from '../ui/ConfirmDialog';
import { intervalToMinutes, minutesToPgInterval } from '../../utils/pgIntervalMinutes';

/** @param {{ code?: string; message?: string; details?: string }} err */
function mapSupabaseError(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  const code = err.code || '';
  const lower = msg.toLowerCase();
  if (code === '42501' || lower.includes('policy') || lower.includes('permission')) {
    return 'No tienes permiso (hace falta rol ADMIN en «perfiles»).';
  }
  if (code === '23503' || lower.includes('foreign key')) {
    return 'No se puede eliminar: hay citas u otros registros vinculados a este servicio.';
  }
  if (lower.includes('duplicate') || code === '23505') {
    return 'Ya existe un registro duplicado.';
  }
  return msg || 'Error al guardar en Supabase.';
}

const emptyForm = {
  nombre: '',
  descripcion: '',
  precio: '',
  duracion_minutos: '30',
  activo: true,
};

/**
 * CRUD de servicios (Supabase). Columna `duracion` en BD es INTERVAL; en UI solo minutos.
 * @param {{ readOnly?: boolean }} props
 */
export default function GestionServicios({ readOnly = false }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadServicios = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const { data, error } = await supabase.from('servicios').select('*').order('nombre', { ascending: true });
    if (error) {
      setListError(mapSupabaseError(error));
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadServicios();
  }, [loadServicios]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setFormError(null);
    setForm(emptyForm);
    setEditingId(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setFormError(null);
    setEditingId(row.id);
    setForm({
      nombre: row.nombre ?? '',
      descripcion: row.descripcion ?? '',
      precio: row.precio != null ? String(row.precio) : '',
      duracion_minutos: String(intervalToMinutes(row.duracion)),
      activo: row.activo !== false,
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormError(null);
    setEditingId(null);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setFormError(null);
    const nombre = form.nombre.trim();
    if (!nombre) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    const precio = Number(String(form.precio).replace(',', '.'));
    if (!Number.isFinite(precio) || precio < 0) {
      setFormError('El precio debe ser un número mayor o igual a 0.');
      return;
    }
    const dm = Math.round(Number(String(form.duracion_minutos).replace(',', '.')));
    if (!Number.isFinite(dm) || dm < 1 || dm > 24 * 60) {
      setFormError('La duración debe estar entre 1 y 1440 minutos.');
      return;
    }
    const desc = form.descripcion.trim();

    setSaving(true);
    try {
      const payload = {
        nombre,
        descripcion: desc || null,
        precio,
        duracion: minutesToPgInterval(dm),
        activo: form.activo,
      };
      if (modalMode === 'create') {
        const { error } = await supabase.from('servicios').insert(payload);
        if (error) throw error;
        setToast({ type: 'ok', message: 'Servicio creado correctamente.' });
      } else {
        const { error } = await supabase.from('servicios').update(payload).eq('id', editingId);
        if (error) throw error;
        setToast({ type: 'ok', message: 'Servicio actualizado.' });
      }
      closeModal();
      await loadServicios();
    } catch (err) {
      setFormError(mapSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const setActivo = async (row, activo) => {
    if (readOnly) return;
    setSaving(true);
    const { error } = await supabase.from('servicios').update({ activo }).eq('id', row.id);
    setSaving(false);
    if (error) {
      setToast({ type: 'err', message: mapSupabaseError(error) });
      return;
    }
    setToast({
      type: 'ok',
      message: activo ? 'Servicio activado.' : 'Servicio desactivado.',
    });
    await loadServicios();
  };

  const confirmPhysicalDelete = async () => {
    if (!deleteTarget || readOnly) return;
    setSaving(true);
    const { error } = await supabase.from('servicios').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteTarget(null);
    if (error) {
      setToast({ type: 'err', message: mapSupabaseError(error) });
      return;
    }
    setToast({ type: 'ok', message: 'Servicio eliminado.' });
    await loadServicios();
  };

  if (user?.rol !== 'ADMIN') {
    return (
      <div
        className="glass-panel border border-red-500/30 bg-red-950/20 p-8 text-center rounded-2xl"
        role="alert"
      >
        <AlertCircle className="mx-auto text-red-400 mb-3" size={40} aria-hidden />
        <p className="text-red-200 font-medium">No tienes permiso para gestionar servicios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl max-w-[min(90vw,28rem)] ${
            toast.type === 'ok'
              ? 'bg-slate-900 border-emerald-500/40 text-emerald-100'
              : 'bg-slate-900 border-red-500/40 text-red-200'
          }`}
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Gestión de servicios</h2>
          <p className="text-slate-400 text-sm mt-1">
            Tabla <span className="text-slate-300">servicios</span> en Supabase · precio y duración en minutos
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openCreate}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-gold text-brand-dark font-black text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50 shadow-lg shadow-amber-900/20"
          >
            <Plus size={20} aria-hidden />
            Agregar servicio
          </button>
        )}
      </div>

      {readOnly && (
        <p className="text-amber-400 text-xs font-bold border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
          Modo solo lectura: no puedes crear ni editar servicios.
        </p>
      )}

      {listError && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl border border-red-500/40 bg-red-950/30 text-red-200 text-sm"
          role="alert"
        >
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold">No se pudo cargar la lista</p>
            <p className="mt-1 text-red-300/90">{listError}</p>
            <button
              type="button"
              onClick={loadServicios}
              className="mt-3 text-xs font-bold text-brand-gold hover:underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="animate-spin text-brand-gold" size={40} aria-hidden />
          <span className="text-sm font-medium">Cargando servicios…</span>
        </div>
      ) : (
        <div className="glass-panel border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-900/80 text-slate-400 uppercase text-xs tracking-wider">
                  <th className="px-4 py-3 font-bold">Nombre</th>
                  <th className="px-4 py-3 font-bold">Descripción</th>
                  <th className="px-4 py-3 font-bold w-28">Precio</th>
                  <th className="px-4 py-3 font-bold w-28">Duración</th>
                  <th className="px-4 py-3 font-bold w-28">Estado</th>
                  <th className="px-4 py-3 font-bold w-44 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                      No hay servicios. Pulsa &quot;Agregar servicio&quot; o crea filas en Supabase.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-white">{row.nombre}</td>
                      <td className="px-4 py-3 text-slate-300 max-w-[220px]">
                        <span className="line-clamp-2">{row.descripcion || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-brand-gold font-bold tabular-nums">
                        {Number(row.precio).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-200 tabular-nums">
                        {intervalToMinutes(row.duracion)} min
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                            row.activo !== false
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                          }`}
                        >
                          {row.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-brand-gold hover:bg-slate-700 border border-slate-600/80"
                                aria-label={`Editar ${row.nombre}`}
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivo(row, row.activo === false)}
                                disabled={saving}
                                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-600/80 disabled:opacity-50"
                                title={row.activo === false ? 'Activar' : 'Desactivar'}
                                aria-label={row.activo === false ? 'Activar' : 'Desactivar'}
                              >
                                {row.activo === false ? (
                                  <ToggleRight size={18} className="text-emerald-400" />
                                ) : (
                                  <ToggleLeft size={18} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                disabled={saving}
                                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-red-400 border border-slate-600/80 disabled:opacity-50"
                                aria-label={`Eliminar ${row.nombre}`}
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="glass-panel w-full max-w-lg border border-slate-600/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-servicio-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-900/50 sticky top-0">
              <h2 id="modal-servicio-title" className="text-lg font-black text-white">
                {modalMode === 'create' ? 'Nuevo servicio' : 'Editar servicio'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
            </div>
            <form onSubmit={submitForm} className="p-6 space-y-4">
              {formError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}
              <div>
                <label htmlFor="gs-nombre" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Nombre *
                </label>
                <input
                  id="gs-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  placeholder="Ej. Corte clásico"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="gs-desc" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Descripción
                </label>
                <textarea
                  id="gs-desc"
                  rows={3}
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45 resize-y min-h-[5rem]"
                  placeholder="Detalle opcional del servicio"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gs-precio" className="block text-xs font-bold text-slate-400 mb-1.5">
                    Precio *
                  </label>
                  <input
                    id="gs-precio"
                    type="text"
                    inputMode="decimal"
                    value={form.precio}
                    onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                    className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45 tabular-nums"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="gs-dur" className="block text-xs font-bold text-slate-400 mb-1.5">
                    Duración (minutos) *
                  </label>
                  <input
                    id="gs-dur"
                    type="text"
                    inputMode="numeric"
                    value={form.duracion_minutos}
                    onChange={(e) => setForm((f) => ({ ...f, duracion_minutos: e.target.value }))}
                    className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45 tabular-nums"
                    placeholder="30"
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-500 text-brand-gold focus:ring-brand-gold/50"
                />
                <span className="text-sm text-slate-200 font-medium">Servicio activo</span>
              </label>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gold text-brand-dark font-black text-sm hover:bg-yellow-400 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                  {modalMode === 'create' ? 'Crear' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar servicio"
        message={
          deleteTarget
            ? `¿Eliminar definitivamente «${deleteTarget.nombre}»? Si hay citas vinculadas, la operación puede fallar.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmPhysicalDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
