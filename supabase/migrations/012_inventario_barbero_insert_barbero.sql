-- =============================================================================
-- El barbero puede crear filas en su propio inventario (antes solo admin / update).
-- =============================================================================

DROP POLICY IF EXISTS inventario_barbero_insert_own ON public.inventario_barbero;

CREATE POLICY inventario_barbero_insert_own
  ON public.inventario_barbero
  FOR INSERT
  TO authenticated
  WITH CHECK (
    barbero_id = (
      SELECT p.barbero_id
      FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );
