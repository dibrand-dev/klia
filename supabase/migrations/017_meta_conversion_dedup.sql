-- Guard server-side para evitar disparar el evento Meta CompleteRegistration más de una vez
-- por profesional (ej. si vuelve a navegar manualmente a /bienvenida). Update atómico
-- (WHERE meta_conversion_enviada = false) para que sea race-safe ante llamadas simultáneas.
alter table public.profiles
  add column if not exists meta_conversion_enviada boolean not null default false;

create or replace function public.marcar_meta_conversion_enviada()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marcada boolean;
begin
  update public.profiles
  set meta_conversion_enviada = true
  where id = auth.uid()
    and meta_conversion_enviada = false
  returning true into v_marcada;

  return coalesce(v_marcada, false);
end;
$$;

-- SECURITY DEFINER usa auth.uid() internamente (nunca recibe un id como parámetro) — un
-- usuario autenticado solo puede marcar su propia fila, nunca la de otro profesional.
revoke all on function public.marcar_meta_conversion_enviada() from public;
revoke all on function public.marcar_meta_conversion_enviada() from anon;
grant execute on function public.marcar_meta_conversion_enviada() to authenticated;
