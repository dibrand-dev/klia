-- Actualiza admin_get_profiles para incluir email_confirmed_at desde auth.users
-- Permite distinguir cuentas pendientes de validación de email de cuentas activas

CREATE OR REPLACE FUNCTION public.admin_get_profiles(p_search text DEFAULT NULL)
RETURNS TABLE (
  id               uuid,
  nombre           text,
  apellido         text,
  email            text,
  especialidad     text,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  email_confirmed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nombre,
    p.apellido,
    p.email,
    p.especialidad,
    p.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE (
    p_search IS NULL
    OR p.nombre  ILIKE '%' || p_search || '%'
    OR p.apellido ILIKE '%' || p_search || '%'
    OR p.email   ILIKE '%' || p_search || '%'
  )
  ORDER BY p.created_at DESC;
END;
$$;
