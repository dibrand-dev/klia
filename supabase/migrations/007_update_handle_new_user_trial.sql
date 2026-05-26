-- Actualiza el trigger de creación de perfil para incluir campos de trial por defecto y matrícula

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    nombre,
    apellido,
    especialidad,
    matricula,
    plan,
    estado_cuenta,
    trial_inicio,
    trial_fin
  ) VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.raw_user_meta_data->>'especialidad',
    new.raw_user_meta_data->>'matricula',
    'premium',
    'trial',
    now(),
    now() + interval '21 days'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
