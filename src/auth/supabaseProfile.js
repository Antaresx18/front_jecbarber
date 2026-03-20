import { supabase } from '../supabase';

const VALID_ROLES = new Set(['ADMIN', 'BARBERO', 'CLIENTE']);

/**
 * PostgREST a veces devuelve objetos que no pasan `instanceof Error`.
 * @param {unknown} err
 * @returns {Error}
 */
export function toProfileLoadError(err) {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object') {
    const o = /** @type {{ message?: string; details?: string; hint?: string; code?: string }} */ (err);
    const parts = [o.message, o.details, o.hint].filter(Boolean);
    if (parts.length) return new Error(parts.join(' — '));
    if (o.code) return new Error(`Error de base de datos (${o.code}).`);
  }
  return new Error('No se pudo cargar tu perfil.');
}

/**
 * Carga `perfiles` para el usuario autenticado y devuelve la forma de sesión del front.
 * @param {import('@supabase/supabase-js').User} supabaseUser
 */
export async function fetchSessionUser(supabaseUser) {
  const { data: row, error } = await supabase
    .from('perfiles')
    .select('rol, cliente_id, barbero_id')
    .eq('id', supabaseUser.id)
    .maybeSingle();

  if (error) throw toProfileLoadError(error);
  if (!row?.rol || !VALID_ROLES.has(row.rol)) {
    throw new Error(
      'No hay fila en la tabla «perfiles» para tu usuario, o el rol no es válido. En SQL Editor ejecuta: INSERT INTO public.perfiles (id, rol) VALUES (\'<tu User UID de Authentication>\', \'ADMIN\');'
    );
  }

  const meta = supabaseUser.user_metadata ?? {};
  const nombre =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    supabaseUser.email?.split('@')[0] ||
    'Usuario';

  const session = {
    rol: /** @type {'ADMIN' | 'BARBERO' | 'CLIENTE'} */ (row.rol),
    nombre,
    email: supabaseUser.email ?? '',
  };

  if (row.barbero_id != null) session.barberoId = row.barbero_id;
  if (row.cliente_id != null) session.clienteId = row.cliente_id;

  return session;
}

/**
 * @param {import('@supabase/supabase-js').AuthError} err
 * @returns {string}
 */
export function mapAuthErrorMessage(err) {
  const msg = err?.message ?? '';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid_credentials') || err.status === 400) {
    return 'Credenciales incorrectas. Revisa el correo y la contraseña.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Debes confirmar el correo antes de entrar (revisa tu bandeja o la configuración del proyecto en Supabase).';
  }
  return msg || 'No se pudo iniciar sesión.';
}
