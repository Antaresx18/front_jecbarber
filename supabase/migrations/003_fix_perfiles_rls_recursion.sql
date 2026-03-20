-- =============================================================================
-- Parche: recursión infinita en RLS de perfiles
-- Error: "infinite recursion detected in policy for relation perfiles"
-- Ejecuta este archivo en SQL Editor si ya aplicaste 001 antes del parche.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.jec_auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.rol = 'ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.jec_auth_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jec_auth_is_admin() TO authenticated;

DROP POLICY IF EXISTS perfiles_select_admin ON public.perfiles;
CREATE POLICY perfiles_select_admin ON public.perfiles FOR SELECT USING (public.jec_auth_is_admin());

DROP POLICY IF EXISTS citas_admin_all ON public.citas;
CREATE POLICY citas_admin_all ON public.citas FOR ALL USING (public.jec_auth_is_admin()) WITH CHECK (
  public.jec_auth_is_admin()
);

DROP POLICY IF EXISTS auditoria_admin_only ON public.auditoria_citas;
CREATE POLICY auditoria_admin_only ON public.auditoria_citas FOR SELECT USING (public.jec_auth_is_admin());
