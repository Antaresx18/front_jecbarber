-- =============================================================================
-- RLS en public.clientes: admin gestiona todo; cliente lee su fila; barbero
-- lee clientes vinculados a sus citas (joins en panel barbero / citas).
-- Sin políticas, tras ENABLE RLS nadie con anon key podría leer/escribir.
-- =============================================================================

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_admin_all ON public.clientes;
CREATE POLICY clientes_admin_all
  ON public.clientes
  FOR ALL
  TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

DROP POLICY IF EXISTS clientes_select_own ON public.clientes;
CREATE POLICY clientes_select_own
  ON public.clientes
  FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT p.cliente_id
      FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'CLIENTE'
    )
  );

DROP POLICY IF EXISTS clientes_select_barbero_citas ON public.clientes;
CREATE POLICY clientes_select_barbero_citas
  ON public.clientes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.citas c
      WHERE c.cliente_id = clientes.id
        AND c.barbero_id = (
          SELECT p.barbero_id
          FROM public.perfiles p
          WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
        )
    )
  );
