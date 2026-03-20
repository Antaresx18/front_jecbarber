-- =============================================================================
-- Auto-registro de clientes: cuando un usuario hace signUp con metadata
-- { rol: 'CLIENTE', nombre: '...' }, este trigger crea automáticamente
-- la fila en public.clientes y public.perfiles.
--
-- Sin esta migración, el usuario queda en auth.users pero sin perfil y
-- la app muestra "ProfileMissingError".
-- =============================================================================

CREATE OR REPLACE FUNCTION public.jec_auto_crear_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol    TEXT;
  v_nombre TEXT;
  v_cli_id UUID;
BEGIN
  v_rol := NEW.raw_user_meta_data->>'rol';

  -- Solo actúa si el signup indicó rol CLIENTE
  IF upper(v_rol) != 'CLIENTE' THEN
    RETURN NEW;
  END IF;

  v_nombre := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nombre'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1),
    'Cliente'
  );

  -- Crear fila en clientes
  INSERT INTO public.clientes (nombre, rango, cortes, proximos)
  VALUES (v_nombre, 'BRONCE', 0, 5)
  RETURNING id INTO v_cli_id;

  -- Crear perfil vinculado
  INSERT INTO public.perfiles (id, rol, cliente_id, barbero_id)
  VALUES (NEW.id, 'CLIENTE', v_cli_id, NULL)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- El trigger dispara DESPUÉS del INSERT en auth.users
DROP TRIGGER IF EXISTS trg_auto_crear_cliente ON auth.users;
CREATE TRIGGER trg_auto_crear_cliente
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.jec_auto_crear_cliente();

COMMENT ON FUNCTION public.jec_auto_crear_cliente() IS
  'Crea automáticamente clientes + perfiles cuando un usuario se registra con rol=CLIENTE en raw_user_meta_data.';
