-- Dedup para el cron de email de inactividad de profesionales en trial (5+ días sin login).
-- Timestamp en vez de boolean: a diferencia de email_bloqueada_enviado (evento único), la
-- inactividad puede repetirse en ciclos — se resetea a NULL en cada login exitoso
-- (src/app/auth/callback/route.ts) para permitir un nuevo aviso si vuelve a caer inactivo.

alter table public.profiles
  add column if not exists email_inactividad_enviado_at timestamptz;

-- last_sign_in_at vive en auth.users, no en profiles (mismo patrón que admin_get_profiles /
-- admin_get_last_sign_in) — el cron no puede filtrar por ese campo con un .lt() directo sobre
-- profiles, necesita este RPC para hacer el JOIN server-side.
create or replace function public.get_inactive_trial_profiles()
returns table (
  id     uuid,
  nombre text,
  email  text
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
    p.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.estado_cuenta = 'trial'
    and u.last_sign_in_at < now() - interval '5 days'
    and p.email_inactividad_enviado_at is null;
end;
$$;

-- SECURITY DEFINER + EXECUTE default a PUBLIC expondría nombre+email de profesionales en trial
-- inactivos a cualquier usuario autenticado (o anon, vía PostgREST) — mismo riesgo ya cazado con
-- testimonios. Grants explícitos: solo service_role (el cron ya usa ese cliente).
revoke all on function public.get_inactive_trial_profiles() from public;
revoke all on function public.get_inactive_trial_profiles() from anon;
revoke all on function public.get_inactive_trial_profiles() from authenticated;
grant execute on function public.get_inactive_trial_profiles() to service_role;
