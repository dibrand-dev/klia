-- Función: get_interconsultas
-- Devuelve el perfil de otros profesionales que también atienden al mismo paciente (cruzado por DNI)
-- SECURITY DEFINER: accede a pacientes de otros terapeutas sin exponer su historial clínico
CREATE OR REPLACE FUNCTION public.get_interconsultas(p_paciente_id uuid)
RETURNS TABLE (
  nombre       text,
  apellido     text,
  especialidad text,
  telefono     text,
  email        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terapeuta_id uuid := auth.uid();
  v_dni          text;
BEGIN
  -- Verificar que el paciente pertenece al terapeuta que llama y obtener su DNI
  SELECT p.dni INTO v_dni
  FROM public.pacientes p
  WHERE p.id = p_paciente_id AND p.terapeuta_id = v_terapeuta_id;

  -- Si el paciente no existe, no pertenece al llamante, o no tiene DNI: retornar vacío
  IF NOT FOUND OR v_dni IS NULL OR trim(v_dni) = '' THEN
    RETURN;
  END IF;

  -- Buscar otros terapeutas que tengan pacientes con el mismo DNI
  RETURN QUERY
  SELECT
    prof.nombre,
    prof.apellido,
    prof.especialidad,
    prof.telefono,
    prof.email
  FROM public.pacientes p2
  JOIN public.profiles prof ON p2.terapeuta_id = prof.id
  WHERE trim(p2.dni) = trim(v_dni)
    AND p2.terapeuta_id != v_terapeuta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_interconsultas(uuid) TO authenticated;

-- ============================================================
-- Verificación de políticas RLS existentes
-- ============================================================
-- Las siguientes políticas YA EXISTEN y garantizan que cada profesional
-- solo puede acceder a sus propios datos:
--
-- pacientes:   SELECT/INSERT/UPDATE/DELETE filtra por terapeuta_id = auth.uid()
-- turnos:      SELECT/INSERT/UPDATE/DELETE filtra por terapeuta_id = auth.uid()
-- notas_clinicas: ALL filtra por terapeuta_id = auth.uid()
-- profiles:    SELECT/UPDATE filtra por id = auth.uid()
--
-- La función get_interconsultas usa SECURITY DEFINER para cruzar pacientes por DNI,
-- pero solo expone datos del perfil profesional (nombre, especialidad, teléfono, email),
-- nunca datos clínicos del paciente de otro terapeuta.
