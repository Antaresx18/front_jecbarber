import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { addDaysIso, parseHoraToMinutes, ymdLocal } from '../utils/adminFilters';
import {
  parseStartFromRangoLocal,
  parseStartFromRangoUtc,
  ymdUtcFromTs,
  buildRangoTiempoUtc,
  intervalToMinutes,
} from '../utils/nuevaCitaHelpers';

/** @param {{ code?: string; message?: string }} err */
function mapErr(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  const code = err.code || '';
  const lower = msg.toLowerCase();
  if (code === '42501' || lower.includes('policy') || lower.includes('permission')) {
    return 'Sin permiso. Inicia sesión como cliente o, si eres invitado, aplica la migración 016 (reservas sin cuenta). Si falla el detalle del servicio, aplica también la 015.';
  }
  if (code === '23P01' || lower.includes('exclusion') || lower.includes('overlap')) {
    return 'Ese horario ya está ocupado para el barbero elegido. Prueba otra hora o barbero.';
  }
  return msg || 'Error de Supabase.';
}

/** "09:00 AM" → "09:00" 24h */
export function hora12a24(hora12) {
  const s = String(hora12 || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) {
    const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return `${String(Number(m24[1])).padStart(2, '0')}:${m24[2]}`;
    return '10:00';
  }
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} desde
 * @param {string} hasta
 */
export function mapCitaRow(row, desde, hasta) {
  const loc = parseStartFromRangoLocal(row.rango_tiempo);
  const utc = parseStartFromRangoUtc(row.rango_tiempo);
  let fecha = loc.fecha || utc.fecha;
  if (!fecha && row.created_at) fecha = ymdUtcFromTs(row.created_at);
  const hora = loc.fecha ? loc.hora : utc.fecha ? utc.hora : '—';
  if (!fecha || fecha < desde || fecha > hasta) return null;

  const br = row.barberos && typeof row.barberos === 'object' ? row.barberos : null;
  return {
    id: row.id,
    fecha,
    hora,
    barberoNombre: br?.nombre ?? '—',
    pedidoCliente: row.pedido_cliente ?? '',
    estado: String(row.estado ?? 'PENDIENTE'),
    monto: Number(row.monto ?? 0),
    metodo_pago: row.metodo_pago ?? 'EFECTIVO',
    nombre_invitado: row.nombre_invitado ?? null,
    servicios: null,
  };
}

/**
 * @param {string | undefined} clienteId UUID
 * @param {boolean} enabled
 */
export function useClienteSupabaseData(clienteId, enabled) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clienteRow, setClienteRow] = useState(null);
  const [barberos, setBarberos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [citasMapped, setCitasMapped] = useState([]);

  const hoyYmd = ymdLocal();
  const desde = useMemo(() => addDaysIso(hoyYmd, -365), [hoyYmd]);
  const hasta = useMemo(() => addDaysIso(hoyYmd, 400), [hoyYmd]);

  const refresh = useCallback(async () => {
    if (!enabled || !clienteId) {
      setClienteRow(null);
      setBarberos([]);
      setServicios([]);
      setCitasMapped([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [cliRes, barbRes, servRes, citRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id,nombre,rango,cortes,proximos,email')
          .eq('id', clienteId)
          .maybeSingle(),
        supabase.from('barberos').select('id,nombre,activo').eq('activo', true).order('nombre', { ascending: true }),
        supabase.from('servicios').select('id,nombre,precio,duracion,activo').eq('activo', true).order('nombre', { ascending: true }),
        supabase
          .from('citas')
          .select(
            'id,barbero_id,estado,monto,rango_tiempo,pedido_cliente,metodo_pago,nombre_invitado,created_at,barberos(nombre)'
          )
          .eq('cliente_id', clienteId)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (cliRes.error) throw cliRes.error;
      if (barbRes.error) throw barbRes.error;
      if (servRes.error) throw servRes.error;
      if (citRes.error) throw citRes.error;

      setClienteRow(cliRes.data ?? null);
      setBarberos(barbRes.data ?? []);
      setServicios(
        (servRes.data ?? []).map((s) => ({
          id: s.id,
          nombre: s.nombre,
          precio: Number(s.precio ?? 0),
          duracion: s.duracion,
        }))
      );

      const mapped = (citRes.data ?? [])
        .map((row) => mapCitaRow(row, desde, hasta))
        .filter(Boolean);

      const ids = mapped.map((m) => m.id).filter(Boolean);
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
            const list = byCita.get(m.id);
            if (list?.length) m.servicios = list.join(', ');
          }
        }
      }

      mapped.sort((a, b) => {
        const df = a.fecha.localeCompare(b.fecha);
        if (df !== 0) return df;
        return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
      });
      setCitasMapped(mapped);
    } catch (e) {
      setError(mapErr(e));
      setCitasMapped([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, enabled, desde, hasta]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const crearReserva = useCallback(
    async ({
      barberoId,
      servicioId,
      fechaYmd,
      hora12,
      pedidoCliente,
      metodoPago,
      nombreInvitado,
    }) => {
      if (!clienteId) throw new Error('Sin cliente en sesión.');
      const serv = servicios.find((s) => s.id === servicioId);
      if (!serv) throw new Error('Servicio no válido.');
      const dur = intervalToMinutes(serv.duracion);
      const hora24 = hora12a24(hora12);
      const rango = buildRangoTiempoUtc(fechaYmd, hora24, dur);
      if (!rango) throw new Error('Revisa fecha y hora.');

      const pedidoTrim = String(pedidoCliente ?? '').trim();
      const invTrim = String(nombreInvitado ?? '').trim();
      const pedidoFinal =
        pedidoTrim || (invTrim ? `Reserva para ${invTrim}: ${serv.nombre}.` : `Reserva: ${serv.nombre}.`);

      const payloadCita = {
        barbero_id: barberoId,
        cliente_id: clienteId,
        nombre_invitado: invTrim || null,
        rango_tiempo: rango,
        pedido_cliente: pedidoFinal,
        notas: '',
        estado: 'PENDIENTE',
        monto: serv.precio,
        comision_monto: 0,
        metodo_pago: metodoPago || 'EFECTIVO',
        propina: 0,
      };

      const { data: citaCreada, error: errCita } = await supabase
        .from('citas')
        .insert(payloadCita)
        .select('id')
        .single();
      if (errCita) throw new Error(mapErr(errCita));

      const { error: errDet } = await supabase.from('cita_detalles').insert({
        cita_id: citaCreada.id,
        servicio_id: serv.id,
        precio_cobrado: serv.precio,
      });
      if (errDet) throw new Error(mapErr(errDet));

      await refresh();
    },
    [clienteId, servicios, refresh]
  );

  return {
    loading,
    error,
    refresh,
    hoyYmd,
    clienteRow,
    barberos,
    servicios,
    citasMapped,
    crearReserva,
  };
}
