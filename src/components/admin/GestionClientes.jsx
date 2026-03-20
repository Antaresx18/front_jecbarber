import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  UserRound,
  X,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
  Search,
  Mail,
  Phone,
  Lock,
} from 'lucide-react';
import { supabase } from '../../supabase';
import ConfirmDialog from '../ui/ConfirmDialog';
import { isValidEmail } from '../../utils/validations';

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
    return 'No se puede eliminar: hay citas u otros registros vinculados a este cliente.';
  }
  if (lower.includes('duplicate') || code === '23505') {
    return 'Ya existe otro cliente con ese correo.';
  }
  if (lower.includes('chk_email') || lower.includes('email')) {
    return 'El correo no tiene un formato válido.';
  }
  return msg || 'Error al guardar en Supabase.';
}

/** Mensaje legible cuando falla supabase.functions.invoke. */
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

const RANGOS = [
  { value: 'BRONCE', label: 'Bronce' },
  { value: 'PLATA', label: 'Plata' },
  { value: 'ORO', label: 'Oro' },
];

const emptyForm = {
  nombre: '',
  email: '',
  password: '',
  telefono: '',
  notas: '',
  rango: 'BRONCE',
  proximos: '5',
  cortes: '0',
  ausencias: '0',
  activo: true,
};

/**
 * CRUD de clientes en Supabase (solo ADMIN).
 * @param {{ readOnly?: boolean }} props
 */
export default function GestionClientes({ readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  /** True cuando falla invoke por función no desplegada / 404 / red. */
  const [showEdgeDeploySteps, setShowEdgeDeploySteps] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(
          'id,nombre,email,telefono,rango,cortes,proximos,ausencias,notas,activo,created_at,updated_at'
        )
        .order('nombre', { ascending: true });
      if (error) {
        setListError(mapSupabaseError(error));
        setRows([]);
      } else {
        setRows(data ?? []);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Error al cargar clientes.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.nombre ?? ''} ${r.email ?? ''} ${r.telefono ?? ''} ${r.notas ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const openCreate = () => {
    setFormError(null);
    setShowEdgeDeploySteps(false);
    setForm(emptyForm);
    setEditingId(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setFormError(null);
    setShowEdgeDeploySteps(false);
    setEditingId(row.id);
    setForm({
      nombre: row.nombre ?? '',
      email: row.email ?? '',
      password: '',
      telefono: row.telefono ?? '',
      notas: row.notas ?? '',
      rango: row.rango ?? 'BRONCE',
      proximos: String(row.proximos ?? 5),
      cortes: String(row.cortes ?? 0),
      ausencias: String(row.ausencias ?? 0),
      activo: row.activo !== false,
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormError(null);
    setShowEdgeDeploySteps(false);
    setEditingId(null);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setFormError(null);
    setShowEdgeDeploySteps(false);
    const nombre = form.nombre.trim();
    if (!nombre) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    const emailTrim = form.email.trim();
    const password = form.password;
    const telefono = form.telefono.trim() || null;
    const notas = form.notas.trim();
    const prox = parseInt(String(form.proximos).trim(), 10);
    const cortes = parseInt(String(form.cortes).trim(), 10);
    const ausencias = parseInt(String(form.ausencias).trim(), 10);
    if (!Number.isFinite(prox) || prox < 1) {
      setFormError('«Próximo corte en» debe ser un entero ≥ 1.');
      return;
    }
    if (!Number.isFinite(cortes) || cortes < 0) {
      setFormError('Cortes debe ser un entero ≥ 0.');
      return;
    }
    if (!Number.isFinite(ausencias) || ausencias < 0) {
      setFormError('Ausencias debe ser un entero ≥ 0.');
      return;
    }
    if (!RANGOS.some((r) => r.value === form.rango)) {
      setFormError('Rango no válido.');
      return;
    }

    const payload = {
      nombre,
      email: emailTrim ? emailTrim.toLowerCase() : null,
      telefono,
      notas,
      rango: form.rango,
      proximos: prox,
      cortes,
      ausencias,
      activo: form.activo,
    };

    if (modalMode === 'create' && password.trim()) {
      if (!emailTrim || !isValidEmail(emailTrim)) {
        setFormError('Para dar acceso a la app el correo es obligatorio y debe ser válido.');
        return;
      }
      if (password.length < 6) {
        setFormError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        if (password.trim()) {
          const datos = {
            email: emailTrim.toLowerCase(),
            password,
            nombre,
            telefono,
            notas,
            rango: form.rango,
            proximos: prox,
            cortes,
            ausencias,
            activo: form.activo,
          };
          const { data, error } = await supabase.functions.invoke('crear-cliente', { body: datos });
          if (error) {
            let msg = await parseEdgeFunctionError(error);
            const bundle = String(error.message || '').toLowerCase();
            const m = msg.toLowerCase();
            const looksMissing =
              bundle.includes('failed to send') ||
              bundle.includes('network') ||
              m.includes('functions relay') ||
              m.includes('edge function') ||
              bundle.includes('404') ||
              bundle.includes('not found');
            if (looksMissing) {
              setShowEdgeDeploySteps(true);
              setFormError(
                'La Edge Function «crear-cliente» no está desplegada en este proyecto de Supabase (o no responde). Despliégala una vez con la CLI o deja la contraseña vacía para crear solo la ficha en la base.'
              );
            } else {
              setFormError(msg);
            }
            return;
          }
          if (data && data.ok === false) {
            setFormError(data.error || 'No se pudo crear el cliente con acceso.');
            return;
          }
          setToast({
            type: 'ok',
            message:
              data?.message ||
              'Cliente creado con acceso: puede iniciar sesión en el área «Cliente» con ese correo.',
          });
        } else {
          const { error } = await supabase.from('clientes').insert(payload);
          if (error) throw error;
          setToast({
            type: 'ok',
            message:
              'Ficha de cliente creada (sin acceso a la app). Rellena correo y contraseña en un nuevo alta si debe entrar por «Cliente».',
          });
        }
      } else {
        const { error } = await supabase.from('clientes').update(payload).eq('id', editingId);
        if (error) throw error;
        setToast({ type: 'ok', message: 'Cliente actualizado.' });
      }
      closeModal();
      await loadClientes();
    } catch (err) {
      setFormError(mapSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const setActivo = async (row, activo) => {
    if (readOnly) return;
    setSaving(true);
    const { error } = await supabase.from('clientes').update({ activo }).eq('id', row.id);
    setSaving(false);
    if (error) {
      setToast({ type: 'err', message: mapSupabaseError(error) });
      return;
    }
    setToast({
      type: 'ok',
      message: activo ? 'Cliente activado.' : 'Cliente desactivado (no se elimina del historial).',
    });
    await loadClientes();
  };

  const confirmPhysicalDelete = async () => {
    if (!deleteTarget || readOnly) return;
    setSaving(true);
    const { error } = await supabase.from('clientes').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteTarget(null);
    if (error) {
      setToast({ type: 'err', message: mapSupabaseError(error) });
      return;
    }
    setToast({ type: 'ok', message: 'Cliente eliminado de la base de datos.' });
    await loadClientes();
  };

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
          <h3 className="text-2xl font-black text-white tracking-tight">Gestión de clientes</h3>
          <p className="text-slate-400 text-sm mt-1">
            Alta y edición en Supabase · Los que se registran solos también aparecen aquí
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
            Añadir cliente
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={18}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, correo, teléfono…"
            className="w-full bg-slate-900/70 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
          />
        </div>
      </div>

      {readOnly && (
        <p className="text-amber-400 text-xs font-bold border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
          Modo solo lectura: no puedes crear ni editar clientes.
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
            <p className="mt-2 text-xs text-red-300/70">
              Ejecuta en el SQL Editor: <code className="text-brand-gold">019_clientes_rls.sql</code> y{' '}
              <code className="text-brand-gold">020_clientes_grants_authenticated.sql</code> (permisos RLS +
              GRANT).
            </p>
            <button
              type="button"
              onClick={loadClientes}
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
          <span className="text-sm font-medium">Cargando clientes…</span>
        </div>
      ) : (
        <div className="glass-panel border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-900/80 text-slate-400 uppercase text-xs tracking-wider">
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Contacto</th>
                  <th className="px-4 py-3 font-bold w-24">Rango</th>
                  <th className="px-4 py-3 font-bold w-28">Cortes</th>
                  <th className="px-4 py-3 font-bold w-28">Estado</th>
                  <th className="px-4 py-3 font-bold w-44 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                      {rows.length === 0
                        ? 'No hay clientes. Pulsa «Añadir cliente» o espera registros desde la app.'
                        : 'Ningún resultado para tu búsqueda.'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center shrink-0">
                            <UserRound className="text-slate-500" size={20} aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white truncate block">{row.nombre}</span>
                            {row.notas ? (
                              <span className="text-xs text-slate-500 truncate block">{row.notas}</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <div className="space-y-0.5">
                          {row.email ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <Mail size={12} className="text-slate-500 shrink-0" aria-hidden />
                              {row.email}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                          {row.telefono ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <Phone size={12} className="text-slate-500 shrink-0" aria-hidden />
                              {row.telefono}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-brand-gold font-bold text-xs">
                        {RANGOS.find((r) => r.value === row.rango)?.label ?? row.rango}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <span className="font-mono text-xs">
                          {row.cortes} / meta {row.proximos}
                        </span>
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
            aria-labelledby="modal-cliente-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-900/50 sticky top-0 z-10">
              <h2 id="modal-cliente-title" className="text-lg font-black text-white">
                {modalMode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}
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
                <div className="space-y-2">
                  <p className="text-sm text-red-200 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 leading-relaxed">
                    {formError}
                  </p>
                  {showEdgeDeploySteps && (
                    <details
                      className="text-xs bg-slate-900/90 border border-amber-500/30 rounded-lg px-3 py-2 text-slate-300"
                      open
                    >
                      <summary className="cursor-pointer font-bold text-amber-400 list-none flex items-center gap-2 select-none">
                        <span className="text-slate-500">▶</span>
                        Pasos para desplegar «crear-cliente» (Windows / terminal en la carpeta del proyecto)
                      </summary>
                      <ol className="mt-3 space-y-2 pl-4 list-decimal text-slate-400 [&_code]:text-amber-200/90 [&_code]:text-[11px]">
                        <li>
                          Instala la CLI si no la tienes:{' '}
                          <code className="whitespace-nowrap">npm i -g supabase</code> o{' '}
                          <code className="whitespace-nowrap">npx supabase --version</code>
                        </li>
                        <li>
                          <code>supabase login</code>
                        </li>
                        <li>
                          <code>
                            supabase link --project-ref TU_REF
                          </code>{' '}
                          (el ref sale en Supabase → Project Settings → General → Reference ID)
                        </li>
                        <li>
                          <code>supabase secrets set SERVICE_ROLE_KEY=tu_service_role</code> (API → service_role,
                          una sola vez si no lo hiciste para crear-barbero)
                        </li>
                        <li>
                          <code>supabase functions deploy crear-cliente</code>
                        </li>
                        <li>
                          En{' '}
                          <a
                            href="https://supabase.com/dashboard"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-gold font-bold hover:underline"
                          >
                            supabase.com/dashboard
                          </a>
                          : tu proyecto → <strong className="text-slate-200">Edge Functions</strong> → debe
                          aparecer <code>crear-cliente</code>.
                        </li>
                      </ol>
                      <p className="mt-2 text-slate-500 border-t border-slate-700/60 pt-2">
                        Mientras tanto: borra la contraseña en este formulario y guarda → solo ficha en «clientes»
                        (agenda), sin acceso a la app cliente.
                      </p>
                    </details>
                  )}
                </div>
              )}
              <div>
                <label htmlFor="gc-nombre" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Nombre *
                </label>
                <input
                  id="gc-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  placeholder="Ej. Ana García"
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="gc-email" className="block text-xs font-bold text-slate-400 mb-1.5">
                  {modalMode === 'create'
                    ? 'Correo (obligatorio si pones contraseña; único en la base de datos)'
                    : 'Correo (opcional; único si lo rellenas)'}
                </label>
                <input
                  id="gc-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  placeholder="cliente@ejemplo.com"
                  autoComplete="off"
                />
              </div>
              {modalMode === 'create' && (
                <>
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-100/90 leading-relaxed space-y-2">
                    <p>
                      <strong className="text-emerald-300">Acceso al área «Cliente»:</strong> si defines una
                      contraseña, el servidor ejecuta la Edge Function <code className="text-white">crear-cliente</code>{' '}
                      (debe estar desplegada en Supabase). El usuario podrá entrar con{' '}
                      <em className="not-italic text-white">Cliente → Ya tengo cuenta</em>.
                    </p>
                    <p className="text-slate-400">
                      Sin contraseña solo se guarda la ficha en la base (agenda); no hace falta desplegar la función.
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="gc-password"
                      className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1"
                    >
                      <Lock size={14} aria-hidden />
                      Contraseña inicial (opcional)
                    </label>
                    <input
                      id="gc-password"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                      placeholder="Mínimo 6 caracteres para acceso a la app"
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="gc-tel" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Teléfono (opcional)
                </label>
                <input
                  id="gc-tel"
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  placeholder="Ej. 612 345 678"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label htmlFor="gc-rango" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Rango fidelización
                </label>
                <select
                  id="gc-rango"
                  value={form.rango}
                  onChange={(e) => setForm((f) => ({ ...f, rango: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                >
                  {RANGOS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="gc-prox" className="block text-xs font-bold text-slate-400 mb-1.5">
                    Meta cortes
                  </label>
                  <input
                    id="gc-prox"
                    type="number"
                    min={1}
                    value={form.proximos}
                    onChange={(e) => setForm((f) => ({ ...f, proximos: e.target.value }))}
                    className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  />
                </div>
                <div>
                  <label htmlFor="gc-cortes" className="block text-xs font-bold text-slate-400 mb-1.5">
                    Cortes
                  </label>
                  <input
                    id="gc-cortes"
                    type="number"
                    min={0}
                    value={form.cortes}
                    onChange={(e) => setForm((f) => ({ ...f, cortes: e.target.value }))}
                    className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  />
                </div>
                <div>
                  <label htmlFor="gc-aus" className="block text-xs font-bold text-slate-400 mb-1.5">
                    Ausencias
                  </label>
                  <input
                    id="gc-aus"
                    type="number"
                    min={0}
                    value={form.ausencias}
                    onChange={(e) => setForm((f) => ({ ...f, ausencias: e.target.value }))}
                    className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/45"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="gc-notas" className="block text-xs font-bold text-slate-400 mb-1.5">
                  Notas internas
                </label>
                <textarea
                  id="gc-notas"
                  rows={2}
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/45 resize-y min-h-[72px]"
                  placeholder="Preferencias, alergias, comentarios…"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-500 text-brand-gold focus:ring-brand-gold/50"
                />
                <span className="text-sm text-slate-200 font-medium">Cliente activo</span>
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
                  {saving ? (modalMode === 'create' ? 'Creando…' : 'Guardando…') : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar cliente"
        message={
          deleteTarget
            ? `¿Eliminar definitivamente a «${deleteTarget.nombre}»? Solo funcionará si no tiene citas u otros vínculos obligatorios.`
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
