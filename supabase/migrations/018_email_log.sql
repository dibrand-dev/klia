-- Trazabilidad de emails transaccionales enviados por los crons de trial/inactividad.
-- Hasta ahora enviarEmail() no persistía nada — sin esta tabla, OPS no tenía forma de
-- saber qué avisos recibió cada profesional ni si los llegó a abrir.
create table if not exists public.email_log (
  id                uuid primary key default gen_random_uuid(),
  terapeuta_id      uuid not null references public.profiles(id) on delete cascade,
  tipo              text not null check (tipo in ('trial_d7', 'trial_d14', 'trial_d3', 'trial_d1', 'bloqueada', 'inactividad')),
  asunto            text not null,
  brevo_message_id  text,
  enviado_at        timestamptz not null default now(),
  opened_at         timestamptz
);

create index if not exists email_log_terapeuta_id_idx on public.email_log(terapeuta_id);
create index if not exists email_log_brevo_message_id_idx on public.email_log(brevo_message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Solo Super Admins de OPS pueden leer este log (nunca el propio profesional desde la app).
-- Los inserts/updates reales los hacen los crons y el webhook de Brevo con service_role,
-- que ya bypassea RLS — no hace falta policy de INSERT/UPDATE para authenticated.
create policy "Admins de OPS leen el log de emails"
  on public.email_log for select
  using (
    exists (select 1 from public.admin_users a where a.email = auth.email() and a.activo = true)
  );
