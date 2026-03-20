import { supabase } from '../supabase';

const VALID_ROLES = new Set(['ADMIN', 'BARBERO', 'CLIENTE']);

/** @param {unknown} rol */
function normalizeRol(rol) {
  if (rol == null) return null;
  const s = String(rol).trim();
  if (!s) return null;
  return s.toUpperCase();
}

/** Falta fila en `perfiles`; el front puede mostrar `sqlSuggestion` en pantalla. */
export class ProfileMissingError extends Error {
  /** @param {string} message */
  /** @param {string} sqlSuggestion */
  constructor(message, sqlSuggestion) {
    super(message);
    this.name = 'ProfileMissingError';
    this.sqlSuggestion = sqlSuggestion;
  }
}

/**
 * PostgREST a veces devuelve objetos que no pasan `instanceof Error`.
 * @param {unknown} err
 * @returns {Error}
 */
export function toProfileLoadError(err) {
  if (err instanceof ProfileMissingError) return err;
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
 * La consulta PostgREST **no** filtra por rol: solo `.eq('id', supabaseUser.id)`.
 * Si `row` viene null sin error, suele ser RLS (la API no ve la fila) o proyecto .env distinto.
 *
 * @param {import('@supabase/supabase-js').User} supabaseUser
 */
export async function fetchSessionUser(supabaseUser) {
  const { data: row, error } = await supabase
    .from('perfiles')
    .select('rol, cliente_id, barbero_id')
    .eq('id', supabaseUser.id)
    .maybeSingle();

  const rolNorm = normalizeRol(row?.rol);

  console.log('[fetchSessionUser] PostgREST perfiles', {
    authUserId: supabaseUser.id,
    authEmail: supabaseUser.email,
    postgrestError: error,
    filaCruda: row,
    rolNormalizado: rolNorm,
    pasaValidacionRol: rolNorm ? VALID_ROLES.has(rolNorm) : false,
  });

  if (error) throw toProfileLoadError(error);

  if (!row || !rolNorm || !VALID_ROLES.has(rolNorm)) {
    const uid = supabaseUser.id;
    const sqlEjemplos = [
      `-- Tu usuario (Auth) id = ${uid}`,
      ``,
      `-- Si la fila YA aparece en Table Editor pero la app sigue fallando:`,
      `-- el editor a menudo NO aplica RLS; la app sí. Comprueba política SELECT en «perfiles»`,
      `-- (debe permitir leer la fila donde id = auth.uid()).`,
      `-- Ver fila en SQL Editor (rol postgres):`,
      `SELECT id, rol, cliente_id, barbero_id FROM public.perfiles WHERE id = '${uid}';`,
      ``,
      `-- Si no devuelve fila: falta INSERT. Si devuelve fila pero la app no: revisa RLS o que`,
      `-- NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en .env.local sean de ESTE proyecto.`,
      ``,
      `-- Si falta la fila, ejecuta solo UNA variante:`,
      ``,
      `-- Administrador:`,
      `INSERT INTO public.perfiles (id, rol, cliente_id, barbero_id) VALUES ('${uid}', 'ADMIN', NULL, NULL);`,
      ``,
      `-- Barbero (sustituye el UUID real de public.barberos, no el texto <UUID_BARBERO>):`,
      `INSERT INTO public.perfiles (id, rol, cliente_id, barbero_id) VALUES ('${uid}', 'BARBERO', NULL, 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');`,
      ``,
      `-- Cliente (UUID real de public.clientes):`,
      `INSERT INTO public.perfiles (id, rol, cliente_id, barbero_id) VALUES ('${uid}', 'CLIENTE', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', NULL);`,
      ``,
      `-- Arreglo RLS (ejecuta en SQL Editor el archivo 009_perfiles_select_self_fix_postgrest.sql del repo).`,
    ].join('\n');

    console.warn(
      '[fetchSessionUser] Sin perfil usable: fila ausente (0 filas visibles para el JWT) o rol no es ADMIN/BARBERO/CLIENTE. Revisa RLS en public.perfiles y política SELECT propia fila.'
    );

    throw new ProfileMissingError(
      'La app no pudo leer tu fila en «perfiles». Si ya la ves en Table Editor, suele ser RLS (el editor no filtra igual que la API) o un .env apuntando a otro proyecto. Despliega «Ver SQL sugerido» para comprobar con SELECT y revisar políticas.',
      sqlEjemplos
    );
  }

  const meta = supabaseUser.user_metadata ?? {};
  const nombre =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    supabaseUser.email?.split('@')[0] ||
    'Usuario';

  const session = {
    rol: /** @type {'ADMIN' | 'BARBERO' | 'CLIENTE'} */ (rolNorm),
    nombre,
    email: supabaseUser.email ?? '',
  };

  if (row.barbero_id != null) session.barberoId = row.barbero_id;
  if (row.cliente_id != null) session.clienteId = row.cliente_id;

  const perfil = session;
  console.log('Perfil encontrado:', perfil);

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
