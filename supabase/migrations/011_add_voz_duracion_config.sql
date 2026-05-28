-- Agrega configuración de duración máxima de nota de voz
INSERT INTO public.configuracion (clave, valor, descripcion)
VALUES ('voz_duracion_max_segundos', '300', 'Duración máxima permitida para notas de voz (en segundos)')
ON CONFLICT (clave) DO NOTHING;
