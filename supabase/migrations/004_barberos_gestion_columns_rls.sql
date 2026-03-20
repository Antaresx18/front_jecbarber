-- =============================================================================
-- Gestión de barberos (panel admin): columnas extra + RLS
-- Ejecutar en proyectos que ya tienen 001 aplicado.
-- Requiere función public.jec_auth_is_admin() (001 actualizado o 003).
-- =============================================================================

ALTER TABLE public.barberos
  ADD COLUMN IF NOT EXISTS foto_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS especialidad VARCHAR(255) NULL;

COMMENT ON COLUMN public.barberos.foto_url IS 'URL pública de foto (opcional)';
COMMENT ON COLUMN public.barberos.especialidad IS 'Especialidad o descripción corta (opcional)';

ALTER TABLE public.barberos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS barberos_select_public ON public.barberos;
CREATE POLICY barberos_select_public ON public.barberos FOR SELECT USING (true);

DROP POLICY IF EXISTS barberos_admin_insert ON public.barberos;
CREATE POLICY barberos_admin_insert ON public.barberos FOR INSERT TO authenticated
  WITH CHECK (public.jec_auth_is_admin());

DROP POLICY IF EXISTS barberos_admin_update ON public.barberos;
CREATE POLICY barberos_admin_update ON public.barberos FOR UPDATE TO authenticated
  USING (public.jec_auth_is_admin()) WITH CHECK (public.jec_auth_is_admin());

DROP POLICY IF EXISTS barberos_admin_delete ON public.barberos;
CREATE POLICY barberos_admin_delete ON public.barberos FOR DELETE TO authenticated
  USING (public.jec_auth_is_admin());
