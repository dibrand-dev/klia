-- 021_webinars.sql — REGISTRO. Ya aplicado en klia-staging y Klin (2026-11-06) vía conector de Supabase.
-- Webinars: eventos gratuitos publicados en la landing + inscripciones
create table public.webinars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  titulo text not null check (char_length(titulo) between 3 and 140),
  bajada text not null check (char_length(bajada) between 3 and 1200),
  institucion text,
  imagen_url text,
  fecha_inicio timestamptz not null,
  duracion_min integer not null default 60 check (duracion_min between 5 and 600),
  cierre_inscripcion timestamptz not null,
  url_videoconferencia text not null check (url_videoconferencia ~* '^https://'),
  estado text not null default 'borrador' check (estado in ('borrador','publicado','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint webinars_cierre_antes_de_inicio check (cierre_inscripcion <= fecha_inicio)
);
create index webinars_publicados_fecha_idx on public.webinars (fecha_inicio) where estado = 'publicado';

create table public.inscripciones_webinar (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  nombre_apellido text not null,
  institucion text,
  email text not null,
  telefono text not null,
  especialidad text not null,
  respuestas jsonb not null default '{}'::jsonb,
  consentimiento_at timestamptz not null default now(),
  utm jsonb,
  confirmacion_enviada_at timestamptz,
  recordatorio_1d_enviado_at timestamptz,
  recordatorio_30m_enviado_at timestamptz,
  postevento_enviado_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index inscripciones_webinar_email_uk on public.inscripciones_webinar (webinar_id, lower(email));

alter table public.webinars enable row level security;
alter table public.inscripciones_webinar enable row level security;

create policy webinars_publicados_select on public.webinars for select to anon, authenticated using (estado = 'publicado');
create policy webinars_service_role_all on public.webinars for all to service_role using (true) with check (true);

revoke all on public.webinars from public, anon, authenticated;
grant select (id, slug, titulo, bajada, institucion, imagen_url, fecha_inicio, duracion_min, cierre_inscripcion, estado) on public.webinars to anon, authenticated;
grant all on public.webinars to service_role;

create policy inscripciones_webinar_service_role_all on public.inscripciones_webinar for all to service_role using (true) with check (true);
revoke all on public.inscripciones_webinar from public, anon, authenticated;
grant all on public.inscripciones_webinar to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('webinar-heroes', 'webinar-heroes', true, 3145728, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy webinar_heroes_select_publico on storage.objects for select to anon, authenticated using (bucket_id = 'webinar-heroes');
create policy webinar_heroes_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'webinar-heroes' and exists (select 1 from public.admin_users a where a.email = auth.email() and a.activo = true))
  with check (bucket_id = 'webinar-heroes' and exists (select 1 from public.admin_users a where a.email = auth.email() and a.activo = true));
create policy webinar_heroes_service_role_all on storage.objects for all to service_role using (bucket_id = 'webinar-heroes') with check (bucket_id = 'webinar-heroes');
