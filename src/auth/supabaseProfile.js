import { supabase } from '../supabase';

const VALID_ROLES = new Set(['ADMIN', 'BARBERO', 'CLIENTE']);

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

  if (error) throw error;
  if (!row?.rol || !VALID_ROLES.has(row.rol)) {
    throw new Error(
      'No hay perfil asignado para esta cuenta. Pide al administrador que cree tu fila en «perfiles».'
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
