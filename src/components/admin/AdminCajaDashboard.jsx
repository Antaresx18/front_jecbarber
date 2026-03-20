import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  BadgeDollarSign,
} from 'lucide-react';
import { supabase } from '../../supabase';
import ConfirmDialog from '../ui/ConfirmDialog';
import FinanzasTab from './tabs/FinanzasTab';
import EmptyState from '../ui/EmptyState';
import { downloadGastosCsv } from './exportCsv';

function mapSupabaseError(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  const code = err.code || '';
  const lower = msg.toLowerCase();
  if (code === '42501' || lower.includes('policy') || lower.includes('permission')) {
    return 'No tienes permiso (hace falta rol ADMIN en «perfiles»).';
  }
  if (code === '23503' || lower.includes('foreign key')) {
    return 'No se puede eliminar: hay restricciones en la base de datos.';
  }
  return msg || 'Error al guardar en Supabase.';
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatMes(isoDate) {
  const s = String(isoDate ?? '').slice(0, 7);
  return s || '—';
}

/** Misma lógica de mes que la vista SQL (YYYY-MM); alinea KPI con la lista de gastos del panel. */
function gastosMontoEnMes(lista, mesFacturacion) {
  const mk = String(mesFacturacion ?? '').slice(0, 7);
  if (mk.length < 7) return 0;
  return lista.reduce((s, g) => {
    if (String(g.fecha).slice(0, 7) !== mk) return s;
    return s + Number(g.monto ?? 0);
  }, 0);
}

export default function AdminCajaDashboard({ readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const [barberos, setBarberos] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [liqDesde, setLiqDesde] = useState(isoToday());
  const [liqHasta, setLiqHasta] = useState(addDaysIso(isoToday(), 30));
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [bloqueoConfirm, setBloqueoConfirm] = useState(null); // {id, label}

  const [gastos, setGastos] = useState([]);

  const [resumen, setResumen] = useState([]);
  const [resumenError, setResumenError] = useState(null);

  const showToast = useCallback((t) => setToast(t), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadBarberos = useCallback(async () => {
    const { data, error } = await supabase.from('barberos').select('id,nombre').order('nombre', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }, []);

  const loadLiquidaciones = useCallback(async (desde, hasta) => {
    let q = supabase.from('liquidaciones').select('id,barbero_id,monto_pagado,fecha_inicio,fecha_fin,fecha_pago').order('fecha_pago', { ascending: false });
    if (desde) q = q.gte('fecha_pago', desde);
    if (hasta) q = q.lte('fecha_pago', hasta);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, monto_pagado: Number(r.monto_pagado ?? 0) }));
  }, []);

  const loadGastos = useCallback(async () => {
    const { data, error } = await supabase.from('gastos').select('*').order('fecha', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, monto: Number(r.monto ?? 0) }));
  }, []);

  const loadResumen = useCallback(async () => {
    const { data, error } = await supabase.from('resumen_financiero_mensual').select('*').order('mes_facturacion', { ascending: false }).limit(12);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      ...r,
      ingresos_brutos: Number(r.ingresos_brutos ?? 0),
      total_comisiones_barberos: Number(r.total_comisiones_barberos ?? 0),
      total_gastos_operativos: Number(r.total_gastos_operativos ?? 0),
      utilidad_neta: Number(r.utilidad_neta ?? 0),
      total_cortes: Number(r.total_cortes ?? 0),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setResumenError(null);
      try {
        const [b, l, g, r] = await Promise.all([loadBarberos(), loadLiquidaciones(liqDesde, liqHasta), loadGastos(), loadResumen()]);
        if (cancelled) return;
        setBarberos(b);
        setLiquidaciones(l);
        setGastos(g);
        setResumen(r);
      } catch (err) {
        if (cancelled) return;
        setLoadError(mapSupabaseError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liqDesde, liqHasta, loadBarberos, loadGastos, loadLiquidaciones, loadResumen]);

  // utilidades rápidas
  const barberoPorId = useMemo(() => new Map(barberos.map((b) => [b.id, b.nombre])), [barberos]);

  const resumenAlineado = useMemo(
    () =>
      resumen.map((row) => {
        const totalGastos = gastosMontoEnMes(gastos, row.mes_facturacion);
        return {
          ...row,
          total_gastos_operativos: totalGastos,
          utilidad_neta: row.ingresos_brutos - row.total_comisiones_barberos - totalGastos,
        };
      }),
    [resumen, gastos]
  );

  const resumenLatest = resumenAlineado[0] ?? null;

  const liquidacionResumenPorBarbero = useMemo(() => {
    const m = new Map();
    for (const liq of liquidaciones) {
      const name = barberoPorId.get(liq.barbero_id) ?? liq.barbero_id;
      m.set(name, (m.get(name) ?? 0) + (liq.monto_pagado ?? 0));
    }
    return Array.from(m.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total);
  }, [barberoPorId, liquidaciones]);

  const [liqForm, setLiqForm] = useState({
    barbero_id: '',
    monto_pagado: '0',
    fecha_inicio: isoToday(),
    fecha_fin: isoToday(),
    fecha_pago: isoToday(),
  });

  useEffect(() => {
    if (barberos.length === 0) return;
    setLiqForm((prev) => ({ ...prev, barbero_id: prev.barbero_id || barberos[0]?.id || '' }));
  }, [barberos]);

  const onAddLiquidacion = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    try {
      const monto = Number(String(liqForm.monto_pagado).replace(',', '.'));
      if (!Number.isFinite(monto) || monto < 0) throw new Error('Monto pagado inválido.');
      if (!liqForm.barbero_id) throw new Error('Selecciona un barbero.');
      if (!liqForm.fecha_inicio || !liqForm.fecha_fin || liqForm.fecha_fin < liqForm.fecha_inicio) {
        throw new Error('Rango de fechas inválido.');
      }
      const payload = {
        barbero_id: liqForm.barbero_id,
        monto_pagado: monto,
        fecha_inicio: liqForm.fecha_inicio,
        fecha_fin: liqForm.fecha_fin,
        fecha_pago: liqForm.fecha_pago || isoToday(),
      };
      const { error } = await supabase.from('liquidaciones').insert(payload);
      if (error) throw error;
      const l = await loadLiquidaciones(liqDesde, liqHasta);
      setLiquidaciones(l);
      showToast({ type: 'ok', message: 'Liquidación registrada.' });
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteLiq = async () => {
    if (!deleteTarget || readOnly) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('liquidaciones').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      const l = await loadLiquidaciones(liqDesde, liqHasta);
      setLiquidaciones(l);
      showToast({ type: 'ok', message: 'Liquidación eliminada.' });
      setDeleteTarget(null);
    } catch (err) {
      showToast({ type: 'err', message: mapSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  };

  // callbacks para FinanzasTab (gastos)

  const onRemoveGasto = useCallback(
    async (id) => {
      if (readOnly) return;
      setSaving(true);
      try {
        const { error } = await supabase.from('gastos').delete().eq('id', id);
        if (error) throw error;
        const [g, r] = await Promise.all([loadGastos(), loadResumen()]);
        setGastos(g);
        setResumen(r);
        showToast({ type: 'ok', message: 'Gasto eliminado.' });
      } catch (err) {
        showToast({ type: 'err', message: mapSupabaseError(err) });
      } finally {
        setSaving(false);
      }
    },
    [loadGastos, loadResumen, readOnly, showToast]
  );

  const onAddGasto = useCallback(
    async (payload) => {
      if (readOnly) return;
      setSaving(true);
      try {
        const { error } = await supabase.from('gastos').insert(payload);
        if (error) throw error;
        const [g, r] = await Promise.all([loadGastos(), loadResumen()]);
        setGastos(g);
        setResumen(r);
        showToast({ type: 'ok', message: 'Gasto registrado.' });
      } catch (err) {
        showToast({ type: 'err', message: mapSupabaseError(err) });
      } finally {
        setSaving(false);
      }
    },
    [loadGastos, loadResumen, readOnly, showToast]
  );

  const onDuplicateGasto = useCallback(
    async (id) => {
      if (readOnly) return;
      const src = gastos.find((g) => g.id === id);
      if (!src) return;
      setSaving(true);
      try {
        const { error } = await supabase.from('gastos').insert({
          concepto: src.concepto,
          monto: src.monto,
          categoria: src.categoria,
          fecha: src.fecha,
        });
        if (error) throw error;
        const [g, r] = await Promise.all([loadGastos(), loadResumen()]);
        setGastos(g);
        setResumen(r);
        showToast({ type: 'ok', message: 'Gasto duplicado.' });
      } catch (err) {
        showToast({ type: 'err', message: mapSupabaseError(err) });
      } finally {
        setSaving(false);
      }
    },
    [gastos, loadGastos, loadResumen, readOnly, showToast]
  );

  // chart simple (gastos por mes coherentes con el centro contable)
  const resumenChartMonths = useMemo(() => resumenAlineado.slice(0, 6).reverse(), [resumenAlineado]);
  const chartMax = useMemo(() => Math.max(...resumenChartMonths.map((m) => m.ingresos_brutos), 1), [resumenChartMonths]);

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
          <h2 className="text-2xl font-black text-white tracking-tight">Cierre de caja + pagos</h2>
          <p className="text-slate-400 text-sm mt-1">Liquidaciones, gastos y resumen financiero mensual</p>
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
          <span className="text-sm font-medium">Cargando caja…</span>
        </div>
      ) : loadError ? (
        <div className="max-w-2xl mx-auto glass-panel p-6 border border-red-500/30">
          <AlertCircle className="text-red-400" size={24} aria-hidden />
          <p className="text-red-200 mt-3 font-bold">No se pudo cargar</p>
          <p className="text-red-300/90 text-sm mt-1">{loadError}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="glass-panel p-6 border border-slate-700/50">
              <div className="flex items-center gap-2">
                <BadgeDollarSign size={20} className="text-brand-gold" aria-hidden />
                <h3 className="text-xl font-bold text-white">Liquidaciones por barbero</h3>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 items-center">
                <div>
                  <p className="text-[11px] text-slate-500 font-bold">Desde</p>
                  <input
                    type="date"
                    value={liqDesde}
                    onChange={(e) => setLiqDesde(e.target.value)}
                    disabled={saving}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-bold">Hasta</p>
                  <input
                    type="date"
                    value={liqHasta}
                    onChange={(e) => setLiqHasta(e.target.value)}
                    disabled={saving}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                {liquidaciones.length === 0 ? (
                  <EmptyState title="Sin liquidaciones" hint="Registra pagos de barberos para que aparezcan aquí." />
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/60 bg-slate-900/80 text-slate-400 uppercase text-xs tracking-wider">
                        <th className="px-2 sm:px-4 py-3 font-bold">Barbero</th>
                        <th className="px-2 sm:px-4 py-3 font-bold">Periodo</th>
                        <th className="px-2 sm:px-4 py-3 font-bold hidden sm:table-cell">Fecha pago</th>
                        <th className="px-2 sm:px-4 py-3 font-bold text-right">Monto</th>
                        {!readOnly ? <th className="px-2 sm:px-4 py-3 font-bold w-12 sm:w-16 text-right">Acción</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {liquidaciones.slice(0, 12).map((li) => (
                        <tr key={li.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                          <td className="px-2 sm:px-4 py-3 font-bold text-white max-w-[80px] sm:max-w-none truncate" title={barberoPorId.get(li.barbero_id) ?? li.barbero_id}>
                            {barberoPorId.get(li.barbero_id) ?? li.barbero_id}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-slate-300 text-xs sm:text-sm">
                            <span className="block sm:inline">{li.fecha_inicio}</span>
                            <span className="hidden sm:inline mx-1 text-slate-500">→</span>
                            <span className="block sm:inline">{li.fecha_fin}</span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-slate-300 hidden sm:table-cell">{li.fecha_pago}</td>
                          <td className="px-2 sm:px-4 py-3 text-brand-gold font-bold tabular-nums text-right">
                            ${Number(li.monto_pagado).toFixed(2)}
                          </td>
                          {!readOnly ? (
                            <td className="px-2 sm:px-4 py-3 text-right">
                               <button
                                type="button"
                                onClick={() => setDeleteTarget(li)}
                                disabled={saving}
                                className="p-1.5 sm:p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-red-400 border border-slate-600/80 disabled:opacity-50"
                                aria-label="Eliminar liquidación"
                              >
                                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-5">
                <p className="text-sm font-bold text-white">Total por barbero (rango seleccionado)</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {liquidacionResumenPorBarbero.slice(0, 6).map((it) => (
                    <div key={it.nombre} className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3 min-w-0">
                      <p className="text-sm font-bold text-white break-words">{it.nombre}</p>
                      <p className="text-brand-gold font-black text-lg sm:text-xl tabular-nums break-all">${it.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-panel p-6 border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <DollarSign size={20} className="text-brand-gold" aria-hidden />
                  <h3 className="text-xl font-bold text-white">Registrar pago (liquidación)</h3>
                </div>

                <form onSubmit={onAddLiquidacion} className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-400 mb-1.5 block">Barbero *</label>
                      <select
                        value={liqForm.barbero_id}
                        onChange={(e) => setLiqForm((p) => ({ ...p, barbero_id: e.target.value }))}
                        disabled={readOnly || saving}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                      >
                        {barberos.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 mb-1.5 block">Monto pagado *</label>
                      <input
                        value={liqForm.monto_pagado}
                        onChange={(e) => setLiqForm((p) => ({ ...p, monto_pagado: e.target.value }))}
                        disabled={readOnly || saving}
                        inputMode="decimal"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 mb-1.5 block">Fecha pago</label>
                      <input
                        type="date"
                        value={liqForm.fecha_pago}
                        onChange={(e) => setLiqForm((p) => ({ ...p, fecha_pago: e.target.value }))}
                        disabled={readOnly || saving}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 mb-1.5 block">Fecha inicio *</label>
                      <input
                        type="date"
                        value={liqForm.fecha_inicio}
                        onChange={(e) => setLiqForm((p) => ({ ...p, fecha_inicio: e.target.value }))}
                        disabled={readOnly || saving}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 mb-1.5 block">Fecha fin *</label>
                      <input
                        type="date"
                        value={liqForm.fecha_fin}
                        onChange={(e) => setLiqForm((p) => ({ ...p, fecha_fin: e.target.value }))}
                        disabled={readOnly || saving}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={readOnly || saving}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-gold text-brand-dark font-black text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50 shadow-lg shadow-amber-900/20"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Plus size={18} aria-hidden />}
                    Registrar liquidación
                  </button>
                </form>
              </div>

              <div className="glass-panel p-6 border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-brand-gold" aria-hidden />
                  <h3 className="text-xl font-bold text-white">Resumen financiero</h3>
                </div>

                {resumenError ? (
                  <p className="text-red-200 text-sm mt-3">{resumenError}</p>
                ) : resumen.length === 0 ? (
                  <EmptyState title="Sin datos del resumen" hint="Registra citas completadas y/o ventas y gastos para ver la gráfica." />
                ) : (
                  <>
                    <div className="mt-4 flex flex-col gap-3">
                      <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3 flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 font-bold">Ingresos (bruto)</p>
                        <p className="text-brand-gold font-black text-lg tabular-nums text-right break-all">${resumenLatest.ingresos_brutos.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3 flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 font-bold">Comisiones barberos</p>
                        <p className="text-emerald-300 font-black text-lg tabular-nums text-right break-all">${resumenLatest.total_comisiones_barberos.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3 flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 font-bold">Gastos</p>
                        <p className="text-red-300 font-black text-lg tabular-nums text-right break-all">${resumenLatest.total_gastos_operativos.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3 flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 font-bold">Utilidad neta</p>
                        <p
                          className={`font-black text-lg tabular-nums text-right break-all ${
                            resumenLatest.utilidad_neta >= 0 ? 'text-emerald-300' : 'text-red-300'
                          }`}
                        >
                          ${resumenLatest.utilidad_neta.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-sm font-bold text-white">Últimos 6 meses (ingresos vs gastos)</p>
                      <div className="mt-3 h-44 flex items-end gap-3">
                        {resumenChartMonths.map((m) => {
                          const hIng = Math.round((m.ingresos_brutos / chartMax) * 100);
                          const maxG = Math.max(...resumenChartMonths.map((x) => x.total_gastos_operativos), 1);
                          const hGas = Math.round((m.total_gastos_operativos / maxG) * 100);
                          return (
                            <div key={m.mes_facturacion} className="flex flex-col items-center gap-2 w-[3.2rem]">
                              <div className="w-full h-full flex items-end justify-center gap-1">
                                <div
                                  className="w-3 bg-brand-gold/70 rounded-t-sm"
                                  style={{ height: `${Math.max(2, hIng)}%` }}
                                  title={`Ingresos: ${m.ingresos_brutos}`}
                                />
                                <div
                                  className="w-3 bg-red-500/30 rounded-t-sm"
                                  style={{ height: `${Math.max(2, hGas)}%` }}
                                  title={`Gastos: ${m.total_gastos_operativos}`}
                                />
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">{formatMes(m.mes_facturacion)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 border border-slate-700/50">
            <FinanzasTab
              gastos={gastos}
              readOnly={readOnly}
              compact={false}
              filterSeed={null}
              onExportCsv={() => downloadGastosCsv(gastos)}
              onRemoveGasto={async (id) => {
                if (saving) return;
                await (async () => onRemoveGasto(id))();
              }}
              onAddGasto={async (payload) => {
                if (saving) return;
                await (async () => onAddGasto(payload))();
              }}
              onDuplicateGasto={async (id) => {
                if (saving) return;
                await (async () => onDuplicateGasto(id))();
              }}
            />
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar liquidación"
        message={deleteTarget ? `¿Eliminar la liquidación de «${barberoPorId.get(deleteTarget.barbero_id) ?? deleteTarget.barbero_id}» por $${Number(deleteTarget.monto_pagado).toFixed(2)}?` : ''}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmDeleteLiq}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!bloqueoConfirm}
        title="Confirmación"
        message={bloqueoConfirm ? bloqueoConfirm.label : ''}
        confirmLabel="Aceptar"
        cancelLabel="Cancelar"
        onConfirm={() => setBloqueoConfirm(null)}
        onCancel={() => setBloqueoConfirm(null)}
      />
    </div>
  );
}

function addDaysIso(fechaYmd, deltaDays) {
  const [y, m, d] = String(fechaYmd).split('-').map(Number);
  const date = new Date(y, m - 1, d + deltaDays);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

