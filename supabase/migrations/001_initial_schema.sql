-- =============================================================================
-- 001_initial_schema.sql — JEC Barber (Supabase / PostgreSQL)
-- UUID, TSTZRANGE, carrito (cita_detalles), auditoría, RLS, vista financiera.
-- Ejecutar una vez en proyecto nuevo (SQL Editor de Supabase).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pg_cron: en muchos proyectos Supabase hay que habilitarlo en Dashboard o no está en plan free.
-- Descomenta tras verificar:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- ENUMS (API puede mapear a camelCase / capitalización del front)
-- =============================================================================
CREATE TYPE public.rol_enum AS ENUM ('ADMIN', 'BARBERO', 'CLIENTE');
CREATE TYPE public.rango_cliente_enum AS ENUM ('BRONCE', 'PLATA', 'ORO');
CREATE TYPE public.estado_cita_enum AS ENUM ('PENDIENTE', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO');
CREATE TYPE public.metodo_pago_enum AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO');

-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  telefono VARCHAR(50),
  rango public.rango_cliente_enum NOT NULL DEFAULT 'BRONCE',
  cortes INTEGER NOT NULL DEFAULT 0 CHECK (cortes >= 0),
  proximos INTEGER NOT NULL DEFAULT 5 CHECK (proximos > 0),
  ausencias INTEGER NOT NULL DEFAULT 0 CHECK (ausencias >= 0),
  notas TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_email_format CHECK (
    email IS NULL OR email ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

CREATE TABLE public.barberos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  foto_url TEXT NULL,
  especialidad VARCHAR(255) NULL,
  porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 50.00 CHECK (porcentaje BETWEEN 0 AND 100),
  cortes_realizados INTEGER NOT NULL DEFAULT 0 CHECK (cortes_realizados >= 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.servicios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT NULL,
  precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
  duracion INTERVAL NOT NULL DEFAULT INTERVAL '30 minutes',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  rol public.rol_enum NOT NULL,
  cliente_id UUID REFERENCES public.clientes (id) ON DELETE SET NULL,
  barbero_id UUID REFERENCES public.barberos (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rol_fk CHECK (
    (rol = 'CLIENTE' AND cliente_id IS NOT NULL AND barbero_id IS NULL)
    OR (rol = 'BARBERO' AND barbero_id IS NOT NULL AND cliente_id IS NULL)
    OR (rol = 'ADMIN' AND cliente_id IS NULL AND barbero_id IS NULL)
  )
);

CREATE TABLE public.citas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbero_id UUID NOT NULL REFERENCES public.barberos (id) ON DELETE RESTRICT,
  cliente_id UUID REFERENCES public.clientes (id) ON DELETE RESTRICT,
  nombre_invitado VARCHAR(255),
  rango_tiempo TSTZRANGE NOT NULL,
  pedido_cliente TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  estado public.estado_cita_enum NOT NULL DEFAULT 'PENDIENTE',
  monto NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (monto >= 0),
  comision_monto NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (comision_monto >= 0),
  metodo_pago public.metodo_pago_enum NOT NULL DEFAULT 'EFECTIVO',
  propina NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (propina >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_invitado_o_cliente CHECK (
    cliente_id IS NOT NULL OR (nombre_invitado IS NOT NULL AND LENGTH(TRIM(nombre_invitado)) > 0)
  ),
  CONSTRAINT sin_citas_solapadas EXCLUDE USING gist (
    barbero_id WITH =,
    rango_tiempo WITH &&
  )
);

CREATE TABLE public.cita_detalles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cita_id UUID NOT NULL REFERENCES public.citas (id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES public.servicios (id) ON DELETE RESTRICT,
  precio_cobrado NUMERIC(10, 2) NOT NULL CHECK (precio_cobrado >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.auditoria_citas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cita_id UUID NOT NULL REFERENCES public.citas (id) ON DELETE CASCADE,
  usuario_id UUID,
  accion VARCHAR(255) NOT NULL,
  estado_anterior public.estado_cita_enum,
  estado_nuevo public.estado_cita_enum,
  monto_anterior NUMERIC(10, 2),
  monto_nuevo NUMERIC(10, 2),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.inventario_salon (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ventas_salon (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES public.inventario_salon (id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.inventario_barbero (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbero_id UUID NOT NULL REFERENCES public.barberos (id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concepto VARCHAR(255) NOT NULL,
  monto NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
  categoria VARCHAR(100) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.liquidaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbero_id UUID NOT NULL REFERENCES public.barberos (id) ON DELETE RESTRICT,
  monto_pagado NUMERIC(10, 2) NOT NULL CHECK (monto_pagado >= 0),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_liq_periodo CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE public.horarios_trabajo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbero_id UUID NOT NULL REFERENCES public.barberos (id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (barbero_id, dia_semana)
);

CREATE TABLE public.bloqueos_agenda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbero_id UUID NOT NULL REFERENCES public.barberos (id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  motivo VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bloqueo CHECK (fecha_fin >= fecha_inicio)
);

-- =============================================================================
-- Índices
-- =============================================================================
CREATE INDEX idx_perf_cliente ON public.perfiles (cliente_id);
CREATE INDEX idx_perf_barbero ON public.perfiles (barbero_id);
CREATE INDEX idx_citas_barb ON public.citas (barbero_id);
CREATE INDEX idx_citas_cli ON public.citas (cliente_id);
CREATE INDEX idx_citas_rango ON public.citas USING gist (rango_tiempo);
CREATE INDEX idx_citas_estado ON public.citas (estado);
CREATE INDEX idx_cita_det_cita ON public.cita_detalles (cita_id);
CREATE INDEX idx_ventas_fecha ON public.ventas_salon (created_at);
CREATE INDEX idx_gastos_fecha ON public.gastos (fecha);

-- =============================================================================
-- Triggers updated_at
-- =============================================================================
CREATE TRIGGER trg_upd_clientes BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_barberos BEFORE UPDATE ON public.barberos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_servicios BEFORE UPDATE ON public.servicios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_perfiles BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_citas BEFORE UPDATE ON public.citas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_inv_salon BEFORE UPDATE ON public.inventario_salon FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_inv_barbero BEFORE UPDATE ON public.inventario_barbero FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- Lógica de negocio
-- =============================================================================
CREATE OR REPLACE FUNCTION public.procesar_cita_completada() RETURNS TRIGGER AS $$
DECLARE
  v_cortes INTEGER;
  v_nuevo_rango public.rango_cliente_enum;
BEGIN
  IF NEW.estado = 'COMPLETADA' AND (OLD.estado IS DISTINCT FROM 'COMPLETADA') AND NEW.cliente_id IS NOT NULL THEN
    UPDATE public.clientes SET cortes = cortes + 1 WHERE id = NEW.cliente_id RETURNING cortes INTO v_cortes;
    IF v_cortes >= 25 THEN v_nuevo_rango := 'ORO';
    ELSIF v_cortes >= 10 THEN v_nuevo_rango := 'PLATA';
    ELSE v_nuevo_rango := 'BRONCE';
    END IF;
    UPDATE public.clientes SET rango = v_nuevo_rango WHERE id = NEW.cliente_id;
  ELSIF OLD.estado = 'COMPLETADA' AND (NEW.estado IS DISTINCT FROM 'COMPLETADA') AND NEW.cliente_id IS NOT NULL THEN
    UPDATE public.clientes SET cortes = GREATEST(cortes - 1, 0) WHERE id = NEW.cliente_id RETURNING cortes INTO v_cortes;
    IF v_cortes >= 25 THEN v_nuevo_rango := 'ORO';
    ELSIF v_cortes >= 10 THEN v_nuevo_rango := 'PLATA';
    ELSE v_nuevo_rango := 'BRONCE';
    END IF;
    UPDATE public.clientes SET rango = v_nuevo_rango WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rango_cliente
AFTER UPDATE OF estado ON public.citas FOR EACH ROW EXECUTE FUNCTION public.procesar_cita_completada();

CREATE OR REPLACE FUNCTION public.descontar_inventario_salon() RETURNS TRIGGER AS $$
DECLARE v_stock INTEGER;
BEGIN
  SELECT stock INTO v_stock FROM public.inventario_salon WHERE id = NEW.producto_id FOR UPDATE;
  IF v_stock IS NULL OR v_stock < NEW.cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para producto %', NEW.producto_id;
  END IF;
  UPDATE public.inventario_salon SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venta_inv AFTER INSERT ON public.ventas_salon FOR EACH ROW EXECUTE FUNCTION public.descontar_inventario_salon();

CREATE OR REPLACE FUNCTION public.procesar_ausencia_cliente() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'NO_ASISTIO' AND (OLD.estado IS DISTINCT FROM 'NO_ASISTIO') AND NEW.cliente_id IS NOT NULL THEN
    UPDATE public.clientes SET ausencias = ausencias + 1 WHERE id = NEW.cliente_id;
  ELSIF OLD.estado = 'NO_ASISTIO' AND (NEW.estado IS DISTINCT FROM 'NO_ASISTIO') AND NEW.cliente_id IS NOT NULL THEN
    UPDATE public.clientes SET ausencias = GREATEST(ausencias - 1, 0) WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ausencias_cliente
AFTER UPDATE OF estado ON public.citas FOR EACH ROW EXECUTE FUNCTION public.procesar_ausencia_cliente();

CREATE OR REPLACE FUNCTION public.cancelar_citas_por_bloqueo() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.citas
  SET estado = 'CANCELADA',
      notas = CONCAT(COALESCE(notas, ''), ' [Auto-cancelada por día libre del barbero]')
  WHERE barbero_id = NEW.barbero_id
    AND estado = 'PENDIENTE'
    AND rango_tiempo && tstzrange(
      NEW.fecha_inicio::timestamptz,
      (NEW.fecha_fin + 1)::timestamptz,
      '[)'
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cancelar_citas_bloqueo
AFTER INSERT ON public.bloqueos_agenda FOR EACH ROW EXECUTE FUNCTION public.cancelar_citas_por_bloqueo();

CREATE OR REPLACE FUNCTION public.registrar_auditoria_antifraude() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado = 'COMPLETADA' AND NEW.estado IS DISTINCT FROM 'COMPLETADA' THEN
    INSERT INTO public.auditoria_citas (cita_id, usuario_id, accion, estado_anterior, estado_nuevo, monto_anterior, monto_nuevo)
    VALUES (NEW.id, auth.uid(), 'ALERTA: REVERSIÓN DE CITA COMPLETADA', OLD.estado, NEW.estado, OLD.monto, NEW.monto);
  END IF;
  IF OLD.estado = 'COMPLETADA' AND NEW.estado = 'COMPLETADA' AND OLD.monto > NEW.monto THEN
    INSERT INTO public.auditoria_citas (cita_id, usuario_id, accion, estado_anterior, estado_nuevo, monto_anterior, monto_nuevo)
    VALUES (NEW.id, auth.uid(), 'ALERTA: REDUCCIÓN DE MONTO POST-COBRO', OLD.estado, NEW.estado, OLD.monto, NEW.monto);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auditoria_citas
AFTER UPDATE ON public.citas FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_antifraude();

CREATE OR REPLACE FUNCTION public.marcar_ausencias_automaticas() RETURNS void AS $$
BEGIN
  UPDATE public.citas
  SET estado = 'NO_ASISTIO',
      notas = CONCAT(COALESCE(notas, ''), ' [Cancelada: excedió tolerancia de inicio]')
  WHERE estado = 'PENDIENTE'
    AND NOW() > lower(rango_tiempo) + INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Cron (habilitar extensión y descomentar):
-- SELECT cron.schedule('revisar_tolerancia_10_min', '* * * * *', 'SELECT public.marcar_ausencias_automaticas()');

-- =============================================================================
-- Vista resumen financiero
-- =============================================================================
CREATE OR REPLACE VIEW public.resumen_financiero_mensual AS
WITH ingresos_citas AS (
  SELECT
    date_trunc('month', lower(rango_tiempo) AT TIME ZONE 'UTC') AS mes,
    SUM(monto) AS ingresos_cortes,
    SUM(comision_monto) AS pago_barberos,
    COUNT(*)::INTEGER AS cantidad_cortes
  FROM public.citas
  WHERE estado = 'COMPLETADA'
  GROUP BY 1
),
ingresos_ventas AS (
  SELECT date_trunc('month', created_at AT TIME ZONE 'UTC') AS mes, SUM(total) AS ingresos_productos
  FROM public.ventas_salon
  GROUP BY 1
),
egresos_gastos AS (
  SELECT date_trunc('month', fecha::timestamp) AS mes, SUM(monto) AS total_gastos
  FROM public.gastos
  GROUP BY 1
),
meses AS (
  SELECT mes FROM ingresos_citas
  UNION SELECT mes FROM ingresos_ventas
  UNION SELECT mes FROM egresos_gastos
)
SELECT
  m.mes::DATE AS mes_facturacion,
  COALESCE(ic.cantidad_cortes, 0) AS total_cortes,
  (COALESCE(ic.ingresos_cortes, 0) + COALESCE(iv.ingresos_productos, 0)) AS ingresos_brutos,
  COALESCE(ic.pago_barberos, 0) AS total_comisiones_barberos,
  COALESCE(eg.total_gastos, 0) AS total_gastos_operativos,
  ((COALESCE(ic.ingresos_cortes, 0) + COALESCE(iv.ingresos_productos, 0))
    - (COALESCE(ic.pago_barberos, 0) + COALESCE(eg.total_gastos, 0))) AS utilidad_neta
FROM meses m
LEFT JOIN ingresos_citas ic ON m.mes = ic.mes
LEFT JOIN ingresos_ventas iv ON m.mes = iv.mes
LEFT JOIN egresos_gastos eg ON m.mes = eg.mes;

-- =============================================================================
-- RLS — sin políticas USING(true). Spring con service_role suele saltar RLS.
-- =============================================================================
-- Comprueba si el JWT es admin leyendo perfiles SIN pasar de nuevo por RLS
-- (evita "infinite recursion detected in policy for relation perfiles").
CREATE OR REPLACE FUNCTION public.jec_auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.rol = 'ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.jec_auth_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jec_auth_is_admin() TO authenticated;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_citas ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfiles_select_self ON public.perfiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY perfiles_select_admin ON public.perfiles FOR SELECT USING (public.jec_auth_is_admin());

CREATE POLICY citas_admin_all ON public.citas FOR ALL USING (public.jec_auth_is_admin()) WITH CHECK (
  public.jec_auth_is_admin()
);

CREATE POLICY citas_barbero_select ON public.citas FOR SELECT USING (
  barbero_id = (SELECT barbero_id FROM public.perfiles WHERE id = auth.uid() AND rol = 'BARBERO')
);

CREATE POLICY citas_barbero_update ON public.citas FOR UPDATE USING (
  barbero_id = (SELECT barbero_id FROM public.perfiles WHERE id = auth.uid() AND rol = 'BARBERO')
) WITH CHECK (
  barbero_id = (SELECT barbero_id FROM public.perfiles WHERE id = auth.uid() AND rol = 'BARBERO')
);

CREATE POLICY citas_cliente_select ON public.citas FOR SELECT USING (
  cliente_id IS NOT NULL
  AND cliente_id = (SELECT cliente_id FROM public.perfiles WHERE id = auth.uid() AND rol = 'CLIENTE')
);

CREATE POLICY citas_cliente_insert ON public.citas FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND cliente_id = (SELECT cliente_id FROM public.perfiles WHERE id = auth.uid() AND rol = 'CLIENTE')
);

CREATE POLICY auditoria_admin_only ON public.auditoria_citas FOR SELECT USING (public.jec_auth_is_admin());

-- Barberos: lectura pública (landing / listados); escritura solo ADMIN
ALTER TABLE public.barberos ENABLE ROW LEVEL SECURITY;

CREATE POLICY barberos_select_public ON public.barberos FOR SELECT USING (true);

CREATE POLICY barberos_admin_insert ON public.barberos FOR INSERT TO authenticated
  WITH CHECK (public.jec_auth_is_admin());

CREATE POLICY barberos_admin_update ON public.barberos FOR UPDATE TO authenticated
  USING (public.jec_auth_is_admin()) WITH CHECK (public.jec_auth_is_admin());

CREATE POLICY barberos_admin_delete ON public.barberos FOR DELETE TO authenticated
  USING (public.jec_auth_is_admin());

-- Servicios: lectura pública; escritura solo ADMIN
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY servicios_select_public ON public.servicios FOR SELECT USING (true);

CREATE POLICY servicios_admin_insert ON public.servicios FOR INSERT TO authenticated
  WITH CHECK (public.jec_auth_is_admin());

CREATE POLICY servicios_admin_update ON public.servicios FOR UPDATE TO authenticated
  USING (public.jec_auth_is_admin()) WITH CHECK (public.jec_auth_is_admin());

CREATE POLICY servicios_admin_delete ON public.servicios FOR DELETE TO authenticated
  USING (public.jec_auth_is_admin());

COMMENT ON VIEW public.resumen_financiero_mensual IS 'KPI mensual; consumir desde admin con rol adecuado o vía Spring.';
