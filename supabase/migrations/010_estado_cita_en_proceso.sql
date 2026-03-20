-- Estado intermedio: barbero "Iniciar" servicio antes de marcar COMPLETADA.
-- FINALIZADA en UI = COMPLETADA en BD (triggers existentes siguen igual).

ALTER TYPE public.estado_cita_enum ADD VALUE IF NOT EXISTS 'EN_PROCESO';
