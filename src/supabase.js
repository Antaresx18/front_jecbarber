import { createClient } from '@supabase/supabase-js';

/** Evita peticiones colgadas indefinidamente (Auth/PostgREST lentos o sin respuesta). */
const SUPABASE_FETCH_TIMEOUT_MS = 28000;

/** @param {RequestInfo | URL} input @param {RequestInit} [init] */
function fetchWithTimeout(input, init = {}) {
  const { signal: userSignal, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(id);
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }
    userSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...rest, signal: controller.signal }).finally(() => clearTimeout(id));
}

/** Preferimos NEXT_PUBLIC_*; VITE_* sigue soportado por proyectos que aún no renombraron .env.local. */
const supabaseUrl =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Para mensajes en UI (invitado / reserva) si faltan variables. */
export const isSupabaseConfigured = Boolean(
  String(supabaseUrl ?? '').trim() && String(supabaseAnonKey ?? '').trim()
);

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] Faltan URL y anon key. Define NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
      '(o VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY) en .env.local.'
  );
}

/** Solo URL pública + anon key; la sesión y el JWT para Edge Functions los gestiona el propio cliente. */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  global: { fetch: fetchWithTimeout },
});
