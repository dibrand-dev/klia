-- Fix: qualify generar_booking_slug with public. schema prefix
-- GoTrue connects with a restricted search_path that excludes public,
-- so unqualified function calls inside triggers fail with "function does not exist".

CREATE OR REPLACE FUNCTION public.trigger_generar_booking_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.booking_slug IS NULL AND NEW.nombre IS NOT NULL AND NEW.apellido IS NOT NULL THEN
    NEW.booking_slug := public.generar_booking_slug(NEW.nombre, NEW.apellido, NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;
