-- Permisos explícitos por si el rol authenticated no tenía acceso a public.clientes
-- (evita errores al listar / insertar desde el panel admin con anon key + JWT).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clientes TO authenticated;
