-- =============================================================================
-- Servicios: descripción + RLS (lectura pública, escritura solo ADMIN)
-- Requiere public.jec_auth_is_admin()
-- =============================================================================

ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS descripcion TEXT NULL;

COMMENT ON COLUMN public.servicios.descripcion IS 'Detalle opcional del servicio para el panel y la app';

ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_select_public ON public.servicios;
CREATE POLICY servicios_select_public ON public.servicios FOR SELECT USING (true);

DROP POLICY IF EXISTS servicios_admin_insert ON public.servicios;
CREATE POLICY servicios_admin_insert ON public.servicios FOR INSERT TO authenticated
  WITH CHECK (public.jec_auth_is_admin());

DROP POLICY IF EXISTS servicios_admin_update ON public.servicios;
CREATE POLICY servicios_admin_update ON public.servicios FOR UPDATE TO authenticated
  USING (public.jec_auth_is_admin()) WITH CHECK (public.jec_auth_is_admin());

DROP POLICY IF EXISTS servicios_admin_delete ON public.servicios;
CREATE POLICY servicios_admin_delete ON public.servicios FOR DELETE TO authenticated
  USING (public.jec_auth_is_admin());
