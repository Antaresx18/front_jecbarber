import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../supabase';
import {
  appendGuestCitaId,
  appendGuestReservaSnapshot,
  readGuestCitaIds,
  readGuestReservasLocal,
  writeGuestReservasLocal,
} from '../auth/guestCliente';
import { addDaysIso, parseHoraToMinutes, ymdLocal } from '../utils/adminFilters';
import {
  buildRangoTiempoUtc,
  intervalToMinutes,
} from '../utils/nuevaCitaHelpers';
import { hora12a24, mapCitaRow } from './useClienteSupabaseData';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(s) {
  return typeof s === 'string' && UUID_RE.test(String(s).trim());
}

/** Evita promesas colgadas (red / proyecto pausado / proxy). */
function withTimeout(ms, promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Tiempo de espera (${ms / 1000}s) al contactar Supabase.`)), ms);
    }),
  ]);
}

/** @param {Record<string, unknown>[]} local */
/** @param {Record<string, unknown>[]} server */
function mergeCitasById(local, server) {
  const m = new Map();
  for (const c of local) {
    if (c?.id) m.set(String(c.id), { ...c });
  }
  for (const c of server) {
    if (!c?.id) continue;
    const id = String(c.id);
    const prev = m.get(id) || {};
    m.set(id, { ...prev, ...c });
  }
  return Array.from(m.values());
}

function sortCitasMapped(arr) {
  return [...arr].sort((a, b) => {
    const df = String(a.fecha).localeCompare(String(b.fecha));
    if (df !== 0) return df;
    return parseHoraToMinutes(String(a.hora)) - parseHoraToMinutes(String(b.hora));
  });
}

/** @param {{ code?: string; message?: string }} err */
function mapErrInvitado(err) {
  if (!err) return 'Error desconocido.';
  const msg = String(err.message || '');
  const code = err.code || '';
  const lower = msg.toLowerCase();
  if (code === '42501' || lower.includes('policy') || lower.includes('permission')) {
    return 'Sin permiso para reservar sin cuenta. Aplica la migración 016 en Supabase (políticas anon + función jec_invitado_mis_citas).';
  }
  if (code === '23P01' || lower.includes('exclusion') || lower.includes('overlap')) {
    return 'Ese horario ya está ocupado para el barbero elegido. Prueba otra hora o barbero.';
  }
  if (code === 'PGRST202' || lower.includes('jec_invitado_mis_citas')) {
    return 'Falta la función jec_invitado_mis_citas (migración 016).';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'No se pudo conectar con Supabase. Revisa internet, que el proyecto no esté pausado y la URL en .env.local.';
  }
  return msg || 'Error de Supabase.';
}

/**
 * Invitado: citas visibles desde sessionStorage al instante; barberos/servicios en segundo plano (solo para reservar).
 * @param {boolean} enabled
 */
export function useInvitadoSupabaseData(enabled) {
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [barberos, setBarberos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [citasMapped, setCitasMapped] = useState([]);

  const hoyYmd = ymdLocal();

  const applyMergedCitas = useCallback((localRows, serverRows) => {
    const merged = sortCitasMapped(mergeCitasById(localRows, serverRows));
    setCitasMapped(merged);
    writeGuestReservasLocal(merged);
  }, []);

  const refresh = useCallback(
    async (opts) => {
      const silent = opts?.silent === true;

      if (!enabled) {
        setBarberos([]);
        setServicios([]);
        setCitasMapped([]);
        setCatalogLoading(false);
        setCatalogError(null);
        return;
      }

      const hoy = ymdLocal();
      const desde = addDaysIso(hoy, -365);
      const hasta = addDaysIso(hoy, 400);

      const localRows = readGuestReservasLocal();
      setCitasMapped(sortCitasMapped(localRows));

      if (!silent) {
        setCatalogLoading(true);
        setCatalogError(null);
      }

      if (!isSupabaseConfigured) {
        if (!silent) {
          setCatalogError(
            'Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (o VITE_*) en .env.local.'
          );
          setBarberos([]);
          setServicios([]);
          setCatalogLoading(false);
        }
      } else {
        const errores = [];

        try {
          const barbRes = await fetchWithRetries(() =>
            supabase.from('barberos').select('id,nombre,activo').eq('activo', true).order('nombre', { ascending: true })
          );
          if (barbRes.error) throw barbRes.error;
          const barbOk = barbRes.data ?? [];
          setBarberos(barbOk);
        } catch (e) {
          errores.push(`Barberos: ${mapErrInvitado(e)}`);
          if (!silent) setBarberos([]);
        }

        try {
          const servRes = await fetchWithRetries(() =>
            supabase.from('servicios').select('id,nombre,precio,duracion,activo').eq('activo', true).order('nombre', { ascending: true })
          );
          if (servRes.error) throw servRes.error;
          const servOk = (servRes.data ?? []).map((s) => ({
            id: s.id,
            nombre: s.nombre,
            precio: Number(s.precio ?? 0),
            duracion: s.duracion,
          }));
          setServicios(servOk);
        } catch (e) {
          errores.push(`Servicios: ${mapErrInvitado(e)}`);
          if (!silent) setServicios([]);
        }

        if (!silent) {
          setCatalogError(errores.length > 0 ? errores.join(' ') : null);
          setCatalogLoading(false);
        }
      }

      if (!isSupabaseConfigured) {
        applyMergedCitas(readGuestReservasLocal(), []);
        return;
      }

      const idsRaw = readGuestCitaIds();
      const ids = idsRaw.filter(isValidUuid);
      if (ids.length === 0) {
        applyMergedCitas(readGuestReservasLocal(), []);
        return;
      }

      let rpcRes = { data: null, error: null };
      try {
        rpcRes = await withTimeout(30_000, supabase.rpc('jec_invitado_mis_citas', { p_cita_ids: ids }));
      } catch (e) {
        rpcRes = { data: null, error: e };
      }

      if (rpcRes.error) {
        console.warn('[invitado] RPC citas no disponible; se muestran solo datos guardados en el navegador.', rpcRes.error);
        applyMergedCitas(readGuestReservasLocal(), []);
        return;
      }

      let d = rpcRes.data;
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d);
        } catch {
          d = null;
        }
      }
      const rawRows = Array.isArray(d) ? d : d != null && typeof d === 'object' ? [d] : [];
      const serverMapped = [];
      for (const row of rawRows) {
        if (!row || typeof row !== 'object') continue;
        const m = mapCitaRow(
          {
            id: row.id,
            barbero_id: row.barbero_id,
            estado: row.estado,
            monto: row.monto,
            rango_tiempo: row.rango_tiempo,
            pedido_cliente: row.pedido_cliente,
            metodo_pago: row.metodo_pago,
            nombre_invitado: row.nombre_invitado,
            created_at: row.created_at,
            barberos: row.barberos,
          },
          desde,
          hasta
        );
        if (m) {
          if (row.servicios_text) m.servicios = row.servicios_text;
          serverMapped.push(m);
        }
      }

      applyMergedCitas(readGuestReservasLocal(), serverMapped);
    },
    [enabled, applyMergedCitas]
  );

  useLayoutEffect(() => {
    if (!enabled) {
      setCitasMapped([]);
      return;
    }
    setCitasMapped(sortCitasMapped(readGuestReservasLocal()));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  const crearReserva = useCallback(
    async ({ barberoId, servicioId, fechaYmd, hora12, pedidoCliente, metodoPago, nombreInvitado }) => {
      const invTrim = String(nombreInvitado ?? '').trim();
      if (!invTrim) throw new Error('Indica tu nombre para la reserva.');

      const serv = servicios.find((s) => s.id === servicioId);
      if (!serv) throw new Error('Servicio no válido.');
      const barb = barberos.find((b) => String(b.id) === String(barberoId));
      const dur = intervalToMinutes(serv.duracion);
      const hora24 = hora12a24(hora12);
      const rango = buildRangoTiempoUtc(fechaYmd, hora24, dur);
      if (!rango) throw new Error('Revisa fecha y hora.');

      const pedidoTrim = String(pedidoCliente ?? '').trim();
      const pedidoFinal =
        pedidoTrim || `Reserva invitado (${invTrim}): ${serv.nombre}.`;

      const payloadCita = {
        barbero_id: barberoId,
        cliente_id: null,
        nombre_invitado: invTrim,
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
      if (errCita) throw new Error(mapErrInvitado(errCita));

      const { error: errDet } = await supabase.from('cita_detalles').insert({
        cita_id: citaCreada.id,
        servicio_id: serv.id,
        precio_cobrado: serv.precio,
      });
      if (errDet) throw new Error(mapErrInvitado(errDet));

      const snap = {
        id: citaCreada.id,
        fecha: fechaYmd,
        hora: hora12,
        barberoNombre: barb?.nombre ?? '—',
        servicios: serv.nombre,
        pedidoCliente: pedidoFinal,
        estado: 'PENDIENTE',
        monto: serv.precio,
        metodo_pago: metodoPago || 'EFECTIVO',
        nombre_invitado: invTrim,
      };

      appendGuestReservaSnapshot(snap);
      appendGuestCitaId(citaCreada.id);
      const nextLocal = sortCitasMapped(readGuestReservasLocal());
      setCitasMapped(nextLocal);

      await refresh({ silent: true });
    },
    [servicios, barberos, refresh]
  );

  return {
    loading: false,
    catalogLoading,
    catalogError,
    error: null,
    refresh,
    hoyYmd,
    clienteRow: null,
    barberos,
    servicios,
    citasMapped,
    crearReserva,
  };
}
