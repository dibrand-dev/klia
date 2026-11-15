-- 022_antropometria_isak
-- YA APLICADA en klia-staging y en Klin (producción) el 15/11/2026. Este archivo es solo para versionar. Idempotente.

-- 1) Registros: columnas ISAK (perfil restringido) y metadatos del método
alter table public.registros_antropometricos
  add column if not exists metodo_medicion text not null default 'basico',
  add column if not exists perfil_medicion text not null default 'restringido',
  add column if not exists talla_sentado numeric,
  add column if not exists envergadura numeric,
  add column if not exists pliegue_biceps numeric,
  add column if not exists pliegue_cresta_iliaca numeric,
  add column if not exists pliegue_supraespinal numeric,
  add column if not exists pliegue_muslo numeric,
  add column if not exists pliegue_pantorrilla numeric,
  add column if not exists perimetro_brazo_contraido numeric,
  add column if not exists perimetro_muslo_medio numeric,
  add column if not exists diametro_humero numeric,
  add column if not exists diametro_biestiloideo numeric,
  add column if not exists diametro_femur numeric;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'registros_antrop_metodo_chk') then
    alter table public.registros_antropometricos add constraint registros_antrop_metodo_chk check (metodo_medicion in ('basico','isak','otro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'registros_antrop_perfil_chk') then
    alter table public.registros_antropometricos add constraint registros_antrop_perfil_chk check (perfil_medicion in ('restringido','completo'));
  end if;
end $$;

-- 2) Perfil del profesional
alter table public.profiles
  add column if not exists antropometria_certificacion text,
  add column if not exists antropometria_activa boolean;
comment on column public.profiles.antropometria_activa is 'null = por defecto según especialidad (Nutrición activa); true/false = elección del profesional';

-- 3) Links compartidos (espejo de plan_compartidos)
create table if not exists public.antropometria_compartidos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  terapeuta_id uuid not null references auth.users(id),
  token text not null unique,
  creado_en timestamptz not null default now(),
  vence_en timestamptz,
  revocado_en timestamptz,
  enviado_a text,
  enviado_en timestamptz
);
create unique index if not exists antropometria_compartidos_un_activo_por_paciente on public.antropometria_compartidos (paciente_id) where revocado_en is null;
create index if not exists antropometria_compartidos_terapeuta_idx on public.antropometria_compartidos (terapeuta_id);

alter table public.antropometria_compartidos enable row level security;
drop policy if exists terapeuta_select_own_antropometria_compartidos on public.antropometria_compartidos;
drop policy if exists terapeuta_insert_own_antropometria_compartidos on public.antropometria_compartidos;
drop policy if exists terapeuta_update_own_antropometria_compartidos on public.antropometria_compartidos;
drop policy if exists terapeuta_delete_own_antropometria_compartidos on public.antropometria_compartidos;
create policy terapeuta_select_own_antropometria_compartidos on public.antropometria_compartidos for select to authenticated using (terapeuta_id = auth.uid());
create policy terapeuta_insert_own_antropometria_compartidos on public.antropometria_compartidos for insert to authenticated with check (terapeuta_id = auth.uid());
create policy terapeuta_update_own_antropometria_compartidos on public.antropometria_compartidos for update to authenticated using (terapeuta_id = auth.uid()) with check (terapeuta_id = auth.uid());
create policy terapeuta_delete_own_antropometria_compartidos on public.antropometria_compartidos for delete to authenticated using (terapeuta_id = auth.uid());

revoke all on public.antropometria_compartidos from public, anon;
grant select, insert, update, delete on public.antropometria_compartidos to authenticated;
grant all on public.antropometria_compartidos to service_role;

-- 4) Rangos configurables (lectura para autenticados; escritura solo service_role / OPS)
create table if not exists public.antropometria_rangos (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  sexo text check (sexo in ('M','F')),
  desde numeric,
  hasta numeric,
  etiqueta text not null,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);
create index if not exists antropometria_rangos_clave_idx on public.antropometria_rangos (clave, sexo, orden);

alter table public.antropometria_rangos enable row level security;
drop policy if exists authenticated_select_antropometria_rangos on public.antropometria_rangos;
create policy authenticated_select_antropometria_rangos on public.antropometria_rangos for select to authenticated using (true);

revoke all on public.antropometria_rangos from public, anon, authenticated;
grant select on public.antropometria_rangos to authenticated;
grant all on public.antropometria_rangos to service_role;

insert into public.antropometria_rangos (clave, sexo, desde, hasta, etiqueta, orden)
select * from (values
  ('musculo_oseo','F',null::numeric,2.01::numeric,'Muy bajo',1),
  ('musculo_oseo','F',2.01,2.11,'Bajo',2),
  ('musculo_oseo','F',2.11,2.78,'Medio',3),
  ('musculo_oseo','F',2.78,2.96,'Alto',4),
  ('musculo_oseo','F',2.96,null,'Muy alto',5),
  ('musculo_oseo','M',null,2.34,'Muy bajo',1),
  ('musculo_oseo','M',2.34,2.44,'Bajo',2),
  ('musculo_oseo','M',2.44,3.11,'Medio',3),
  ('musculo_oseo','M',3.11,3.29,'Alto',4),
  ('musculo_oseo','M',3.29,null,'Muy alto',5)
) v(clave,sexo,desde,hasta,etiqueta,orden)
where not exists (select 1 from public.antropometria_rangos where clave='musculo_oseo');
