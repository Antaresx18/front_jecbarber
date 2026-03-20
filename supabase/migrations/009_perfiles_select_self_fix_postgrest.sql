-- =============================================================================
-- Parche: barberos (y cualquier usuario) no veían su fila en perfiles (filaCruda: null).
-- La política con solo "TO authenticated" a veces no coincide con el rol efectivo
-- de PostgREST + JWT en todos los entornos. La 001 original usaba USING sin TO = PUBLIC.
-- =============================================================================

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Asegurar que la API (anon + JWT) pueda intentar SELECT; RLS sigue filtrando filas.
GRANT SELECT ON TABLE public.perfiles TO anon;
GRANT SELECT ON TABLE public.perfiles TO authenticated;

DROP POLICY IF EXISTS perfiles_select_self ON public.perfiles;

-- Sin TO: aplica a todos los roles; con JWT anónimo sin sesión auth.uid() es NULL → ninguna fila.
-- Con sesión, auth.uid() = id permite leer la propia fila.
CREATE POLICY perfiles_select_self
  ON public.perfiles
  FOR SELECT
  USING (auth.uid() = id);
