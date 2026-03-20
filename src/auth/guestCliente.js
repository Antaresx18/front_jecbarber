/** sessionStorage: cliente navega sin cuenta Supabase */
export const GUEST_CLIENTE_STORAGE_KEY = 'jecbarber_cliente_invitado';

/** UUIDs de citas creadas como invitado (solo este navegador; la RPC valida que sean sin cliente_id) */
export const GUEST_CITA_IDS_KEY = 'jecbarber_guest_cita_ids';

/** Copia local de cada reserva (fecha, hora, barbero…) para ver citas sin depender de la red ni de la RPC */
export const GUEST_RESERVAS_LOCAL_KEY = 'jecbarber_guest_reservas_local';

function safeParseIds(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

export function readGuestCitaIds() {
  try {
    return safeParseIds(sessionStorage.getItem(GUEST_CITA_IDS_KEY));
  } catch {
    return [];
  }
}

/** @param {string} citaId */
export function appendGuestCitaId(citaId) {
  const id = String(citaId || '').trim();
  if (!id) return;
  const prev = readGuestCitaIds();
  if (prev.includes(id)) return;
  const next = [...prev, id];
  try {
    sessionStorage.setItem(GUEST_CITA_IDS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearGuestCitaIds() {
  try {
    sessionStorage.removeItem(GUEST_CITA_IDS_KEY);
    sessionStorage.removeItem(GUEST_RESERVAS_LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

function safeParseReservas(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && typeof x === 'object' && typeof x.id === 'string');
  } catch {
    return [];
  }
}

/** @returns {Array<{ id: string, fecha: string, hora: string, barberoNombre: string, servicios?: string | null, pedidoCliente?: string, estado: string, monto: number, metodo_pago?: string, nombre_invitado?: string | null }>} */
export function readGuestReservasLocal() {
  try {
    return safeParseReservas(sessionStorage.getItem(GUEST_RESERVAS_LOCAL_KEY));
  } catch {
    return [];
  }
}

/** @param {ReturnType<typeof readGuestReservasLocal>} rows */
export function writeGuestReservasLocal(rows) {
  try {
    sessionStorage.setItem(GUEST_RESERVAS_LOCAL_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

/** @param {ReturnType<typeof readGuestReservasLocal>[number]} row */
export function appendGuestReservaSnapshot(row) {
  const id = String(row?.id || '').trim();
  if (!id) return;
  const prev = readGuestReservasLocal();
  if (prev.some((r) => r.id === id)) return;
  writeGuestReservasLocal([...prev, row]);
}

/** Usuario sintético para /cliente sin sesión Auth */
export function createGuestClienteUser() {
  return {
    isGuest: true,
    rol: 'CLIENTE',
    nombre: 'Invitado',
    email: '',
  };
}
