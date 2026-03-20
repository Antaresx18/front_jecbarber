-- =============================================================================
-- Reservas sin cuenta (rol anon): INSERT en citas + cita_detalles, y lectura
-- acotada vía RPC usando UUID guardados en el navegador del invitado.
-- =============================================================================

GRANT INSERT ON TABLE public.citas TO anon;
GRANT INSERT ON TABLE public.cita_detalles TO anon;

DROP POLICY IF EXISTS citas_anon_insert_invitado ON public.citas;
CREATE POLICY citas_anon_insert_invitado
  ON public.citas
  FOR INSERT
  TO anon
  WITH CHECK (
    cliente_id IS NULL
    AND nombre_invitado IS NOT NULL
    AND char_length(trim(nombre_invitado)) > 0
    AND estado = 'PENDIENTE'::public.estado_cita_enum
  );

DROP POLICY IF EXISTS cita_detalles_anon_insert_invitado ON public.cita_detalles;
CREATE POLICY cita_detalles_anon_insert_invitado
  ON public.cita_detalles
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.citas c
      WHERE c.id = cita_detalles.cita_id
        AND c.cliente_id IS NULL
        AND c.nombre_invitado IS NOT NULL
        AND char_length(trim(c.nombre_invitado)) > 0
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.cita_detalles d
      WHERE d.cita_id = cita_detalles.cita_id
    )
  );

CREATE OR REPLACE FUNCTION public.jec_invitado_mis_citas(p_cita_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  ids uuid[];
  slice_len int;
BEGIN
  IF p_cita_ids IS NULL OR cardinality(p_cita_ids) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  slice_len := LEAST(cardinality(p_cita_ids), 50);
  ids := p_cita_ids[1:slice_len];

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data ORDER BY ord)
      FROM (
        SELECT
          jsonb_build_object(
            'id', c.id,
            'barbero_id', c.barbero_id,
            'estado', c.estado,
            'monto', c.monto,
            'rango_tiempo', c.rango_tiempo::text,
            'pedido_cliente', c.pedido_cliente,
            'metodo_pago', c.metodo_pago,
            'nombre_invitado', c.nombre_invitado,
            'created_at', c.created_at,
            'barberos', jsonb_build_object('nombre', br.nombre),
            'servicios_text', (
              SELECT string_agg(s.nombre, ', ' ORDER BY s.nombre)
              FROM public.cita_detalles cd
              JOIN public.servicios s ON s.id = cd.servicio_id
              WHERE cd.cita_id = c.id
            )
          ) AS row_data,
          c.created_at AS ord
        FROM public.citas c
        LEFT JOIN public.barberos br ON br.id = c.barbero_id
        WHERE c.id = ANY (ids)
          AND c.cliente_id IS NULL
      ) sub
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.jec_invitado_mis_citas(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jec_invitado_mis_citas(uuid[]) TO anon;
