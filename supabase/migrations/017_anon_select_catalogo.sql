-- Catálogo público (invitado sin sesión): asegurar que el rol anon puede leer barberos y servicios.
-- Sin esto, PostgREST puede devolver error de permiso según cómo se creó el proyecto.

GRANT SELECT ON TABLE public.barberos TO anon;
GRANT SELECT ON TABLE public.servicios TO anon;
