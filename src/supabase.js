import { createClient } from '@supabase/supabase-js';

/** Preferimos NEXT_PUBLIC_*; VITE_* sigue soportado por proyectos que aún no renombraron .env.local. */
const supabaseUrl =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Faltan URL y anon key. Define NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
      '(o VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY) en .env.local.'
  );
}

/** Solo URL pública + anon key; la sesión y el JWT para Edge Functions los gestiona el propio cliente. */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
