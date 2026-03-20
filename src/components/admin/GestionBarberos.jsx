import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  UserRound,
  X,
  ImageIcon,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
} from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../hooks/useAuth';
import ConfirmDialog from '../ui/ConfirmDialog';

function BarberAvatar({ url, name }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-800 border border-slate-600 shrink-0 flex items-center justify-center">
      {url && !broken ? (
        <img
          src={url}
          alt={name ? `Foto de ${name}` : ''}
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <UserRound className="text-slate-500" size={22} aria-hidden />
      )}
    </div>
  );
}

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
    return 'No se puede eliminar: hay citas u otros registros vinculados a este barbero.';
  }
  if (lower.includes('duplicate') || code === '23505') {
    return 'Ya existe un registro duplicado.';
  }
  return msg || 'Error al guardar en Supabase.';
}

/** Mensaje legible cuando falla supabase.functions.invoke (4xx/5xx). */
async function parseEdgeFunctionError(err) {
  if (!err) return 'Error desconocido.';
  const base = String(err.message || '');
  const ctx = err.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      /* ignore */
    }
  }
  return base || 'No se pudo completar la operación.';
}

const emptyForm = {
  email: '',
  password: '',
  nombre: '',
  foto_url: '',
  especialidad: '',
  esta_activo: true,
  porcentaje: '50',
};

/**
 * Panel de gestión CRUD de barberos (Supabase). Solo ADMIN (ruta ya protegida + comprobación local).
 * @param {{ readOnly?: boolean }} props
 */
export default function GestionBarberos({ readOnly = false }) {
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

  const loadBarberos = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const { data, error } = await supabase.from('barberos').select('*').order('nombre', { ascending: true });
    if (error) {
      setListError(mapSupabaseError(error));
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBarberos();
  }, [loadBarberos]);

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
      email: '',
      password: '',
      nombre: row.nombre ?? '',
      foto_url: row.foto_url ?? '',
      especialidad: row.especialidad ?? '',
      esta_activo: row.activo !== false,
      porcentaje: String(row.porcentaje ?? 50),
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
    const pct = Number(String(form.porcentaje).replace(',', '.'));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setFormError('La comisión debe estar entre 0 y 100.');
      return;
    }
    const foto = form.foto_url.trim();
    const esp = form.especialidad.trim();
    if (foto && !/^https?:\/\//i.test(foto)) {
      setFormError('La foto debe ser una URL que empiece por http:// o https://');
      return;
    }

    if (modalMode === 'create') {
      const email = form.email.trim().toLowerCase();
      const password = form.password;
      if (!email) {
        setFormError('El correo es obligatorio para dar acceso al sistema.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFormError('Introduce un correo electrónico válido.');
        return;
      }
      if (!password || password.length < 6) {
        setFormError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const email = form.email.trim().toLowerCase();
        const password = form.password;
        const datos_que_envio = {
          email,
          password,
          nombre,
          especialidad: esp || null,
        };
        console.log('[crear-barbero] datos_que_envio:', {
          ...datos_que_envio,
          password: datos_que_envio.password ? '[presente]' : '[vacía]',
        });
        console.log(
          'JWT que envío:',
          (await supabase.auth.getSession()).data.session?.access_token
        );
        const { data, error } = await supabase.functions.invoke('crear-barbero', {
          body: datos_que_envio,
        });
        if (error) {
          const msg = await parseEdgeFunctionError(error);
          const lower = msg.toLowerCase();
          if (
            lower.includes('ya existe') ||
            lower.includes('already') ||
            lower.includes('duplicate')
          ) {
            setFormError('Ese correo ya está registrado. Usa otro email o recupera la cuenta.');
          } else {
            setFormError(msg);
          }
          return;
        }
        if (data && data.ok === false) {
          setFormError(data.error || 'No se pudo crear el barbero.');
          return;
        }
        setToast({
          type: 'ok',
          message: data?.message || 'Barbero creado con acceso al sistema.',
        });
      } else {
        const { error } = await supabase
          .from('barberos')
          .update({
            nombre,
            foto_url: foto || null,
            especialidad: esp || null,
            activo: form.esta_activo,
            porcentaje: pct,
          })
          .eq('id', editingId);
        if (error) throw error;
        setToast({ type: 'ok', message: 'Barbero actualizado.' });
      }
      closeModal();
      await loadBarberos();
    } catch (err) {
      setFormError(mapSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const setActivo = async (row, activo) => {
    if (readOnly) return;
    setSaving(true);
    const { error } = await supabase.from('barberos').update({ activo }).eq('id', row.id);
    setSaving(false);
    if (error) {
      setToast({ type: 'err', message: mapSupabaseError(error) });
      return;
    }
    setToast({
      type: 'ok',
      message: activo ? 'Barbero activado.' : 'Barbero desactivado (borrado lógico).',
    });
    await loadBarberos();
  };

  const confirmPhysicalDelete = async () => {
    if (!deleteTarget || readOnly) return;
    setSaving(true);
    const { error } = await supabase.from('barberos').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteTarget(null);
    if (error) {
      setToast({ type: 'err', message: mapSupabaseError(error) });
      return;
    }
    setToast({ type: 'ok', message: 'Barbero eliminado de la base de datos.' });
    await loadBarberos();
  };

  if (user?.rol !== 'ADMIN') {
    return (
      <div
        className="glass-panel border border-red-500/30 bg-red-950/20 p-8 text-center rounded-2xl"
        role="alert"
      >
        <AlertCircle className="mx-auto text-red-400 mb-3" size={40} aria-hidden />
        <p className="text-red-200 font-medium">No tienes permiso para gestionar barberos.</p>
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
          <h3 className="text-2xl font-black text-white tracking-tight">Gestión de barberos</h3>
          <p className="text-slate-400 text-sm mt-1">
            Datos en vivo desde Supabase · Comisión y cortes se conservan del esquema actual
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
            Agregar barbero
          </button>
        )}
      </div>

      {readOnly && (
        <p className="text-amber-400 text-xs font-bold border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
          Modo solo lectura: no puedes crear ni editar barberos.
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
              onClick={loadBarberos}
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
          <span className="text-sm font-medium">Cargando barberos…</span>
        </div>
      ) : (
        <div className="glass-panel border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-900/80 text-slate-400 uppercase text-xs tracking-wider">
                  <th className="px-4 py-3 font-bold">Barbero</th>
                  <th className="px-4 py-3 font-bold">Especialidad</th>
                  <th className="px-4 py-3 font-bold w-24">Comisión</th>
                  <th className="px-4 py-3 font-bold w-28">Estado</th>
                  <th className="px-4 py-3 font-bold w-44 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                      No hay barberos. Pulsa &quot;Agregar barbero&quot; o crea filas en Supabase.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <BarberAvatar url={row.foto_url} name={row.nombre} />
                          <span className="font-bold text-white truncate">{row.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate">
                        {row.especialidad || '—'}
                      </td>
                      <td className="px-4 py-3 text-brand-gold font-bold">{Number(row.porcentaje)}%</td>
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
            className="glass-panel w-full max-w-lg border border-slate-600/60 rounded-2xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-barbero-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
              <h2 id="modal-barbero-title" className="text-lg font-black text-white">
                {modalMode === 'create' ? 'Nuevo barbero' : 'Editar barbero'}
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
              {modalMode === 'create' && (
                <>
                  <div>
                    <label
                      htmlFor="gb-email"
                      className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1"
                    >
                      <Mail size={14} aria-hidden />
                      Correo (acceso al sistema) *
                    </label>
                    <input
                      id="gb-email"
                      type="email"
                      autoComplete="off"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                      placeholder="barbero@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="gb-password"
                      className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1"
                    >
                      <Lock size={14} aria-hidden />
                      Contraseña inicial *
                    </label>
                    <input
                      id="gb-password"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="gb-nombre" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Nombre *
                </label>
                <input
                  id="gb-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  placeholder="Ej. Kevin Barbero"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="gb-foto" className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                  <ImageIcon size={14} aria-hidden />
                  URL de foto (opcional)
                </label>
                <input
                  id="gb-foto"
                  type="url"
                  value={form.foto_url}
                  onChange={(e) => setForm((f) => ({ ...f, foto_url: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  placeholder="https://…"
                />
              </div>
              <div>
                <label htmlFor="gb-esp" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Especialidad (opcional)
                </label>
                <input
                  id="gb-esp"
                  value={form.especialidad}
                  onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  placeholder="Ej. Fade, barba, colorimetría"
                />
              </div>
              <div>
                <label htmlFor="gb-pct" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Comisión % (plantilla interna)
                </label>
                <input
                  id="gb-pct"
                  type="text"
                  inputMode="decimal"
                  value={form.porcentaje}
                  onChange={(e) => setForm((f) => ({ ...f, porcentaje: e.target.value }))}
                  className="w-full max-w-[120px] bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.esta_activo}
                  onChange={(e) => setForm((f) => ({ ...f, esta_activo: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-500 text-brand-gold focus:ring-brand-gold/50"
                />
                <span className="text-sm text-slate-200 font-medium">Está activo</span>
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
                  {saving
                    ? modalMode === 'create'
                      ? 'Creando…'
                      : 'Guardando…'
                    : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar barbero"
        message={
          deleteTarget
            ? `¿Eliminar definitivamente a «${deleteTarget.nombre}»? No podrás recuperarlo si hay restricciones de citas, la operación fallará.`
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
