-- =============================================================================
-- El barbero puede gestionar su propia disponibilidad (horarios + bloqueos).
-- 011 solo añadía SELECT; aquí INSERT / UPDATE / DELETE sobre sus filas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- horarios_trabajo
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS horarios_trabajo_barbero_insert ON public.horarios_trabajo;
CREATE POLICY horarios_trabajo_barbero_insert
  ON public.horarios_trabajo
  FOR INSERT
  TO authenticated
  WITH CHECK (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );

DROP POLICY IF EXISTS horarios_trabajo_barbero_update ON public.horarios_trabajo;
CREATE POLICY horarios_trabajo_barbero_update
  ON public.horarios_trabajo
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

DROP POLICY IF EXISTS horarios_trabajo_barbero_delete ON public.horarios_trabajo;
CREATE POLICY horarios_trabajo_barbero_delete
  ON public.horarios_trabajo
  FOR DELETE
  TO authenticated
  USING (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );

-- ---------------------------------------------------------------------------
-- bloqueos_agenda
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS bloqueos_agenda_barbero_insert ON public.bloqueos_agenda;
CREATE POLICY bloqueos_agenda_barbero_insert
  ON public.bloqueos_agenda
  FOR INSERT
  TO authenticated
  WITH CHECK (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );

DROP POLICY IF EXISTS bloqueos_agenda_barbero_delete ON public.bloqueos_agenda;
CREATE POLICY bloqueos_agenda_barbero_delete
  ON public.bloqueos_agenda
  FOR DELETE
  TO authenticated
  USING (
    barbero_id = (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'BARBERO'
    )
  );
