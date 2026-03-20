-- La API (anon key + JWT) solo ve filas que las políticas permiten.
-- Table Editor a veces muestra datos sin RLS: si ahí ves «perfiles» pero el login falla,
-- asegura esta política explícita para el rol authenticated.

DROP POLICY IF EXISTS perfiles_select_self ON public.perfiles;

CREATE POLICY perfiles_select_self
  ON public.perfiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
