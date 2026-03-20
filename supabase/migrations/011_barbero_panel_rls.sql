-- =============================================================================
-- Panel barbero: leer horarios, bloqueos e inventario propio (antes solo ADMIN).
-- inventario_barbero: activar RLS + admin + barbero dueño.
-- =============================================================================

-- Horarios de trabajo: lectura del propio barbero
DROP POLICY IF EXISTS horarios_trabajo_barbero_select ON public.horarios_trabajo;
CREATE POLICY horarios_trabajo_barbero_select
  ON public.horarios_trabajo
  FOR SELECT
  TO authenticated
  USING (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );

-- Bloqueos de agenda
DROP POLICY IF EXISTS bloqueos_agenda_barbero_select ON public.bloqueos_agenda;
CREATE POLICY bloqueos_agenda_barbero_select
  ON public.bloqueos_agenda
  FOR SELECT
  TO authenticated
  USING (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );

-- Inventario por barbero
ALTER TABLE public.inventario_barbero ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventario_barbero_admin_all ON public.inventario_barbero;
CREATE POLICY inventario_barbero_admin_all
  ON public.inventario_barbero
  FOR ALL
  TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

DROP POLICY IF EXISTS inventario_barbero_select_own ON public.inventario_barbero;
CREATE POLICY inventario_barbero_select_own
  ON public.inventario_barbero
  FOR SELECT
  TO authenticated
  USING (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );

DROP POLICY IF EXISTS inventario_barbero_update_own ON public.inventario_barbero;
CREATE POLICY inventario_barbero_update_own
  ON public.inventario_barbero
  FOR UPDATE
  TO authenticated
  USING (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  )
  WITH CHECK (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );
