-- Turnos recurrentes: asegurar columnas faltantes (idempotente)

-- ============================================================
-- TABLA: turnos_recurrentes — crear si no existe, sino agregar columnas
-- ============================================================
create table if not exists public.turnos_recurrentes (
  id            uuid default uuid_generate_v4() primary key,
  terapeuta_id  uuid references public.profiles(id) on delete cascade not null,
  dia_semana    integer not null,
  hora          text not null,
  duracion_min  integer default 50 not null,
  fecha_inicio  date not null,
  fecha_fin     date not null,
  activo        boolean default true not null,
  created_at    timestamptz default now() not null
);

-- Columnas que pueden faltar en la tabla existente
alter table public.turnos_recurrentes
  add column if not exists paciente_id   uuid references public.pacientes(id) on delete cascade,
  add column if not exists modalidad     text not null default 'presencial',
  add column if not exists monto         numeric(10, 2);

-- RLS
alter table public.turnos_recurrentes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'turnos_recurrentes' and policyname = 'Terapeutas ven sus series'
  ) then
    create policy "Terapeutas ven sus series"
      on public.turnos_recurrentes for select
      using (auth.uid() = terapeuta_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'turnos_recurrentes' and policyname = 'Terapeutas crean sus series'
  ) then
    create policy "Terapeutas crean sus series"
      on public.turnos_recurrentes for insert
      with check (auth.uid() = terapeuta_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'turnos_recurrentes' and policyname = 'Terapeutas editan sus series'
  ) then
    create policy "Terapeutas editan sus series"
      on public.turnos_recurrentes for update
      using (auth.uid() = terapeuta_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'turnos_recurrentes' and policyname = 'Terapeutas eliminan sus series'
  ) then
    create policy "Terapeutas eliminan sus series"
      on public.turnos_recurrentes for delete
      using (auth.uid() = terapeuta_id);
  end if;
end $$;

create index if not exists turnos_recurrentes_terapeuta_id_idx on public.turnos_recurrentes(terapeuta_id);
create index if not exists turnos_recurrentes_paciente_id_idx  on public.turnos_recurrentes(paciente_id);

-- ============================================================
-- ALTERACIONES A: turnos
-- ============================================================
alter table public.turnos
  add column if not exists serie_recurrente_id  uuid references public.turnos_recurrentes(id) on delete set null,
  add column if not exists pagado               boolean default false not null,
  add column if not exists recordatorio_enviado boolean default false not null;

create index if not exists turnos_serie_recurrente_id_idx on public.turnos(serie_recurrente_id);
