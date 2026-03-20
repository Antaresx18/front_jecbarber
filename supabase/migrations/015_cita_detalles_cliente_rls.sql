-- =============================================================================
-- El cliente puede leer e insertar líneas de cita_detalles solo de sus propias citas.
-- Sin esto, tras insertar la cita el segundo INSERT falla por RLS (solo admin).
-- =============================================================================

DROP POLICY IF EXISTS cita_detalles_cliente_select ON public.cita_detalles;
CREATE POLICY cita_detalles_cliente_select
  ON public.cita_detalles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.citas c
      WHERE c.id = cita_detalles.cita_id
        AND c.cliente_id = (
          SELECT p.cliente_id
          FROM public.perfiles p
          WHERE p.id = auth.uid() AND p.rol = 'CLIENTE'
        )
    )
  );

DROP POLICY IF EXISTS cita_detalles_cliente_insert ON public.cita_detalles;
CREATE POLICY cita_detalles_cliente_insert
  ON public.cita_detalles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.citas c
      WHERE c.id = cita_detalles.cita_id
        AND c.cliente_id = (
          SELECT p.cliente_id
          FROM public.perfiles p
          WHERE p.id = auth.uid() AND p.rol = 'CLIENTE'
        )
    )
  );
