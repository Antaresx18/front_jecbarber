-- =============================================================================
-- RLS + vista "Citas Pro"
-- =============================================================================
-- Asegura acceso ADMIN para el panel:
-- - horarios_trabajo
-- - bloqueos_agenda
-- - inventario_salon
-- - ventas_salon
-- - liquidaciones
-- - gastos
-- - cita_detalles (necesario para la vista)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- RLS: solo ADMIN (panel)
-- ---------------------------------------------------------------------------

ALTER TABLE public.horarios_trabajo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS horarios_trabajo_admin_all ON public.horarios_trabajo;
CREATE POLICY horarios_trabajo_admin_all
  ON public.horarios_trabajo
  FOR ALL TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

ALTER TABLE public.bloqueos_agenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bloqueos_agenda_admin_all ON public.bloqueos_agenda;
CREATE POLICY bloqueos_agenda_admin_all
  ON public.bloqueos_agenda
  FOR ALL TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

ALTER TABLE public.inventario_salon ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventario_salon_admin_all ON public.inventario_salon;
CREATE POLICY inventario_salon_admin_all
  ON public.inventario_salon
  FOR ALL TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

ALTER TABLE public.ventas_salon ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ventas_salon_admin_all ON public.ventas_salon;
CREATE POLICY ventas_salon_admin_all
  ON public.ventas_salon
  FOR ALL TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS liquidaciones_admin_all ON public.liquidaciones;
CREATE POLICY liquidaciones_admin_all
  ON public.liquidaciones
  FOR ALL TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gastos_admin_all ON public.gastos;
CREATE POLICY gastos_admin_all
  ON public.gastos
  FOR ALL TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

ALTER TABLE public.cita_detalles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cita_detalles_admin_all ON public.cita_detalles;
CREATE POLICY cita_detalles_admin_all
  ON public.cita_detalles
  FOR ALL TO authenticated
  USING (public.jec_auth_is_admin())
  WITH CHECK (public.jec_auth_is_admin());

-- ---------------------------------------------------------------------------
-- Vista "Citas Pro"
-- Junta citas con detalles (cita_detalles) para mostrar servicios.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.citas_pro AS
WITH base AS (
  SELECT
    c.*,
    (lower(c.rango_tiempo) AT TIME ZONE 'UTC') AS start_utc
  FROM public.citas c
)
SELECT
  b.id AS cita_id,
  date_trunc('day', b.start_utc)::date AS fecha,
  to_char(b.start_utc, 'FMHH12:MI AM') AS hora,
  b.barbero_id,
  br.nombre AS barbero_nombre,
  b.cliente_id,
  COALESCE(cl.nombre, b.nombre_invitado) AS cliente_nombre,
  b.estado,
  b.pedido_cliente AS pedido_cliente,
  b.notas,
  b.monto,
  b.comision_monto,
  b.metodo_pago,
  b.propina,
  STRING_AGG(DISTINCT s.nombre, ', ' ORDER BY s.nombre) FILTER (WHERE s.nombre IS NOT NULL) AS servicios,
  COUNT(cd.id)::INTEGER AS servicios_count
FROM base b
JOIN public.barberos br ON br.id = b.barbero_id
LEFT JOIN public.clientes cl ON cl.id = b.cliente_id
LEFT JOIN public.cita_detalles cd ON cd.cita_id = b.id
LEFT JOIN public.servicios s ON s.id = cd.servicio_id
GROUP BY
  b.id,
  date_trunc('day', b.start_utc)::date,
  to_char(b.start_utc, 'FMHH12:MI AM'),
  b.barbero_id,
  br.nombre,
  b.cliente_id,
  cl.nombre,
  b.nombre_invitado,
  b.estado,
  b.pedido_cliente,
  b.notas,
  b.monto,
  b.comision_monto,
  b.metodo_pago,
  b.propina;

