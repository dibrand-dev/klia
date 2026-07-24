-- Trackea el paso máximo real alcanzado en el wizard de onboarding (no solo completed/skipped),
-- para poder mostrar el % de avance en OPS.

alter table public.profiles
  add column if not exists onboarding_max_step_reached integer not null default 1;

-- admin_get_profiles no traía ningún campo de onboarding — se agrega onboarding_skipped
-- y onboarding_max_step_reached para el badge de progreso en la tabla de Prestadores.
drop function if exists public.admin_get_profiles(text);

create function public.admin_get_profiles(p_search text default null)
returns table (
  id                            uuid,
  nombre                        text,
  apellido                      text,
  email                         text,
  especialidad                  text,
  created_at                    timestamptz,
  last_sign_in_at               timestamptz,
  email_confirmed_at            timestamptz,
  plan                          text,
  estado_cuenta                 text,
  trial_fin                     timestamptz,
  suscripcion_fin                timestamptz,
  onboarding_skipped            boolean,
  onboarding_max_step_reached   integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.nombre,
    p.apellido,
    p.email,
    p.especialidad,
    p.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    p.plan,
    p.estado_cuenta,
    p.trial_fin,
    p.suscripcion_fin,
    p.onboarding_skipped,
    p.onboarding_max_step_reached
  from public.profiles p
  join auth.users u on u.id = p.id
  where (
    p_search is null
    or p.nombre  ilike '%' || p_search || '%'
    or p.apellido ilike '%' || p_search || '%'
    or p.email   ilike '%' || p_search || '%'
  )
  order by p.created_at desc;
end;
$$;
