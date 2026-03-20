-- =============================================================================
-- El barbero puede ver las liquidaciones (pagos) registrados a su nombre.
-- La escritura sigue siendo solo ADMIN (panel Caja).
-- =============================================================================

DROP POLICY IF EXISTS liquidaciones_barbero_select_own ON public.liquidaciones;

CREATE POLICY liquidaciones_barbero_select_own
  ON public.liquidaciones
  FOR SELECT
  TO authenticated
  USING (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );
