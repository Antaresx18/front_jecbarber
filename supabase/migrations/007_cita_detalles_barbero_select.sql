-- Los barberos pueden leer líneas de detalle solo de citas asignadas a ellos
-- (el embed en PostgREST / supabase-js fallaba o vaciaba resultados sin esto).
DROP POLICY IF EXISTS cita_detalles_barbero_select ON public.cita_detalles;
CREATE POLICY cita_detalles_barbero_select
  ON public.cita_detalles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.citas c
      WHERE c.id = cita_detalles.cita_id
        AND c.barbero_id = (
          SELECT p.barbero_id
          FROM public.perfiles p
          WHERE p.id = auth.uid()
            AND p.rol = 'BARBERO'
        )
    )
  );
