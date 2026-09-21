-- Tabla de control para el sync mensual de Open Food Facts (Vademécum).
-- Fila única (singleton) que guarda el timestamp de la última corrida exitosa,
-- para que el cron mensual solo traiga productos modificados desde entonces.
-- Sin policies de RLS para `authenticated` a propósito: es una tabla interna
-- de control, nunca debe ser legible/escribible por profesionales logueados.
-- service_role (usado por el endpoint del cron) bypassea RLS igual.

create table public.vademecum_off_sync_control (
  id text primary key default 'off_argentina',
  ultima_sync_exitosa timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.vademecum_off_sync_control (id) values ('off_argentina')
on conflict (id) do nothing;

grant select, insert, update, delete on public.vademecum_off_sync_control to authenticated;
grant select, insert, update, delete on public.vademecum_off_sync_control to service_role;
alter table public.vademecum_off_sync_control enable row level security;
