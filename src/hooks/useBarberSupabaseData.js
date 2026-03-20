import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { addDaysIso, coerceToYmd, ymdLocal, parseHoraToMinutes } from '../utils/adminFilters';
import {
  parseStartFromRangoLocal,
  parseStartFromRangoUtc,
  ymdUtcFromTs,
} from '../utils/nuevaCitaHelpers';

/** @param {{ code?: string; message?: string }} err */
function mapErr(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  const code = err.code || '';
  const lower = msg.toLowerCase();
  if (code === '42501' || lower.includes('policy') || lower.includes('permission')) {
    return 'Sin permiso (RLS). Barberos: 011–013 panel; 014 ver liquidaciones / pagos recibidos.';
  }
  if (lower.includes('invalid input value for enum') && lower.includes('en_proceso')) {
    return 'Falta en la base el valor EN_PROCESO en estado_cita_enum. Ejecuta la migración 010_estado_cita_en_proceso.sql.';
  }
  return msg || 'Error de Supabase.';
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} desdeNorm
 * @param {string} hastaNorm
 */
function mapCitaRow(row, desdeNorm, hastaNorm) {
  const loc = parseStartFromRangoLocal(row.rango_tiempo);
  const utc = parseStartFromRangoUtc(row.rango_tiempo);
  let candidatas = [loc.fecha, utc.fecha].filter(Boolean);
  const createdYmd = ymdUtcFromTs(row.created_at);
  if (candidatas.length === 0 && createdYmd) candidatas = [createdYmd];
  if (candidatas.length === 0) return null;
  const enRango = candidatas.some((f) => f >= desdeNorm && f <= hastaNorm);
  if (!enRango) return null;

  const fecha = loc.fecha || utc.fecha || createdYmd;
  const hora = loc.fecha ? loc.hora : utc.fecha ? utc.hora : '—';
  const cli = row.clientes && typeof row.clientes === 'object' ? row.clientes : null;
  const clienteNombre = cli?.nombre ?? row.nombre_invitado ?? 'Invitado';
  const rangoCliente = cli?.rango != null ? String(cli.rango) : null;

  return {
    cita_id: row.id,
    id: row.id,
    fecha,
    hora,
    clienteNombre,
    clienteId: row.cliente_id ?? null,
    rangoCliente,
    pedidoCliente: row.pedido_cliente ?? '',
    notas: row.notas ?? '',
    monto: Number(row.monto ?? 0),
    comision_monto: Number(row.comision_monto ?? 0),
    estado: String(row.estado ?? 'PENDIENTE'),
    servicios: null,
    rango_tiempo: row.rango_tiempo,
  };
}

/**
 * @param {string | undefined} barberoId UUID barbero en sesión
 */
export function useBarberSupabaseData(barberoId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [barberoRow, setBarberoRow] = useState(null);
  const [citas, setCitas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [bloqueos, setBloqueos] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);

  const hoyYmd = ymdLocal();
  const desdeCarga = useMemo(() => addDaysIso(hoyYmd, -120), [hoyYmd]);
  const hastaCarga = useMemo(() => addDaysIso(hoyYmd, 180), [hoyYmd]);

  const refresh = useCallback(async () => {
    if (!barberoId) {
      setBarberoRow(null);
      setCitas([]);
      setHorarios([]);
      setBloqueos([]);
      setInventario([]);
      setLiquidaciones([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const desdeNorm = coerceToYmd(desdeCarga) ?? String(desdeCarga).slice(0, 10);
      const hastaNorm = coerceToYmd(hastaCarga) ?? String(hastaCarga).slice(0, 10);

      const [
        { data: bRow, error: bErr },
        { data: rawCitas, error: cErr },
        { data: hRows, error: hErr },
        { data: blRows, error: blErr },
        { data: invRows, error: invErr },
        { data: liqRows, error: liqErr },
      ] = await Promise.all([
        supabase
          .from('barberos')
          .select('id,nombre,porcentaje,cortes_realizados,activo')
          .eq('id', barberoId)
          .maybeSingle(),
        supabase
          .from('citas')
          .select(
            `id, barbero_id, cliente_id, estado, monto, comision_monto, propina, rango_tiempo, nombre_invitado, notas, pedido_cliente, created_at,
             clientes ( nombre, rango )`
          )
          .eq('barbero_id', barberoId)
          .limit(2000),
        supabase
          .from('horarios_trabajo')
          .select('dia_semana,hora_inicio,hora_fin,activo')
          .eq('barbero_id', barberoId)
          .order('dia_semana', { ascending: true }),
        supabase
          .from('bloqueos_agenda')
          .select('id,fecha_inicio,fecha_fin,motivo')
          .eq('barbero_id', barberoId)
          .gte('fecha_fin', addDaysIso(hoyYmd, -30))
          .lte('fecha_inicio', addDaysIso(hoyYmd, 90))
          .order('fecha_inicio', { ascending: true }),
        supabase
          .from('inventario_barbero')
          .select('id,nombre,stock,stock_minimo')
          .eq('barbero_id', barberoId)
          .order('nombre', { ascending: true }),
        supabase
          .from('liquidaciones')
          .select('id,monto_pagado,fecha_inicio,fecha_fin,fecha_pago,created_at')
          .eq('barbero_id', barberoId)
          .order('fecha_pago', { ascending: false })
          .limit(200),
      ]);

      if (bErr) throw bErr;
      if (cErr) throw cErr;
      if (hErr) throw hErr;
      if (blErr) throw blErr;
      if (invErr) throw invErr;

      setBarberoRow(bRow ?? null);

      const mapped = (rawCitas ?? [])
        .map((row) => mapCitaRow(row, desdeNorm, hastaNorm))
        .filter(Boolean);

      const ids = mapped.map((m) => m.cita_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: dets, error: dErr } = await supabase
          .from('cita_detalles')
          .select('cita_id, servicios ( nombre )')
          .in('cita_id', ids);
        if (!dErr && dets?.length) {
          const byCita = new Map();
          for (const d of dets) {
            const nom = d.servicios?.nombre;
            if (!nom) continue;
            const list = byCita.get(d.cita_id) ?? [];
            list.push(nom);
            byCita.set(d.cita_id, list);
          }
          for (const m of mapped) {
            const list = byCita.get(m.cita_id);
            if (list?.length) m.servicios = list.join(', ');
          }
        }
      }

      mapped.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
      });
      setCitas(mapped);

      setHorarios(hRows ?? []);
      setBloqueos(blRows ?? []);
      setInventario(
        (invRows ?? []).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          stock: Number(r.stock ?? 0),
          stockMinimo: Number(r.stock_minimo ?? 0),
        }))
      );

      if (liqErr) {
        setLiquidaciones([]);
      } else {
        setLiquidaciones(
          (liqRows ?? []).map((r) => ({
            id: r.id,
            montoPagado: Number(r.monto_pagado ?? 0),
            fechaInicio: String(r.fecha_inicio ?? '').slice(0, 10),
            fechaFin: String(r.fecha_fin ?? '').slice(0, 10),
            fechaPago: String(r.fecha_pago ?? '').slice(0, 10),
            createdAt: r.created_at ?? null,
          }))
        );
      }
    } catch (e) {
      setError(mapErr(e));
      setCitas([]);
      setLiquidaciones([]);
    } finally {
      setLoading(false);
    }
  }, [barberoId, desdeCarga, hastaCarga, hoyYmd]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateCita = useCallback(
    async (citaId, patch) => {
      const { error: uErr } = await supabase.from('citas').update(patch).eq('id', citaId);
      if (uErr) throw new Error(mapErr(uErr));
      await refresh();
    },
    [refresh]
  );

  const updateInventarioStock = useCallback(
    async (itemId, nextStock) => {
      const s = Math.max(0, Math.floor(Number(nextStock) || 0));
      const { error: uErr } = await supabase.from('inventario_barbero').update({ stock: s }).eq('id', itemId);
      if (uErr) throw new Error(mapErr(uErr));
      await refresh();
    },
    [refresh]
  );

  const insertInventarioItem = useCallback(
    async ({ nombre, stock = 0, stock_minimo = 5 }) => {
      if (!barberoId) throw new Error('Sin barbero en sesión.');
      const nom = String(nombre ?? '').trim();
      if (!nom) throw new Error('El nombre del producto es obligatorio.');
      const s = Math.max(0, Math.floor(Number(stock) || 0));
      const sm = Math.max(0, Math.floor(Number(stock_minimo) || 0));
      const { error: iErr } = await supabase.from('inventario_barbero').insert({
        barbero_id: barberoId,
        nombre: nom,
        stock: s,
        stock_minimo: sm,
      });
      if (iErr) throw new Error(mapErr(iErr));
      await refresh();
    },
    [barberoId, refresh]
  );

  /**
   * @param {{ dia_semana: number, hora_inicio: string, hora_fin: string, activo: boolean }[]} filas
   */
  const upsertHorariosTrabajo = useCallback(
    async (filas) => {
      if (!barberoId) throw new Error('Sin barbero en sesión.');
      const payload = filas.map((h) => ({
        barbero_id: barberoId,
        dia_semana: h.dia_semana,
        hora_inicio: String(h.hora_inicio || '09:00').slice(0, 8),
        hora_fin: String(h.hora_fin || '17:00').slice(0, 8),
        activo: h.activo !== false,
      }));
      const { error: uErr } = await supabase
        .from('horarios_trabajo')
        .upsert(payload, { onConflict: 'barbero_id,dia_semana' });
      if (uErr) throw new Error(mapErr(uErr));
      await refresh();
    },
    [barberoId, refresh]
  );

  const insertBloqueoAgenda = useCallback(
    async ({ fecha_inicio, fecha_fin, motivo }) => {
      if (!barberoId) throw new Error('Sin barbero en sesión.');
      const fi = String(fecha_inicio || '').slice(0, 10);
      const ff = String(fecha_fin || '').slice(0, 10);
      if (!fi || !ff) throw new Error('Indica fecha inicio y fin.');
      if (ff < fi) throw new Error('La fecha fin no puede ser anterior a la inicio.');
      const m = String(motivo ?? '').trim();
      const { error: iErr } = await supabase.from('bloqueos_agenda').insert({
        barbero_id: barberoId,
        fecha_inicio: fi,
        fecha_fin: ff,
        motivo: m || null,
      });
      if (iErr) throw new Error(mapErr(iErr));
      await refresh();
    },
    [barberoId, refresh]
  );

  const deleteBloqueoAgenda = useCallback(
    async (bloqueoId) => {
      const { error: dErr } = await supabase.from('bloqueos_agenda').delete().eq('id', bloqueoId);
      if (dErr) throw new Error(mapErr(dErr));
      await refresh();
    },
    [refresh]
  );

  return {
    loading,
    error,
    refresh,
    hoyYmd,
    barberoRow,
    citas,
    horarios,
    bloqueos,
    inventario,
    liquidaciones,
    updateCita,
    updateInventarioStock,
    insertInventarioItem,
    upsertHorariosTrabajo,
    insertBloqueoAgenda,
    deleteBloqueoAgenda,
  };
}
