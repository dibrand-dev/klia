-- ConsultorioApp - Schema inicial
-- Ejecutar en el SQL Editor de Supabase

-- ============================================================
-- EXTENSIONES
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: profiles (perfil del terapeuta, vinculado a auth.users)
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  nombre      text not null,
  apellido    text not null,
  matricula   text,                    -- Número de matrícula profesional
  especialidad text default 'Psicología',
  telefono    text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Los terapeutas solo ven su propio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Los terapeutas editan su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- TABLA: pacientes
-- ============================================================
create table public.pacientes (
  id              uuid default uuid_generate_v4() primary key,
  terapeuta_id    uuid references public.profiles(id) on delete cascade not null,
  nombre          text not null,
  apellido        text not null,
  dni             text,
  fecha_nacimiento date,
  telefono        text,
  email           text,
  obra_social     text,
  numero_afiliado text,
  notas           text,
  activo          boolean default true not null,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

alter table public.pacientes enable row level security;

create policy "Terapeutas solo ven sus pacientes"
  on public.pacientes for select
  using (auth.uid() = terapeuta_id);

create policy "Terapeutas crean sus pacientes"
  on public.pacientes for insert
  with check (auth.uid() = terapeuta_id);

create policy "Terapeutas editan sus pacientes"
  on public.pacientes for update
  using (auth.uid() = terapeuta_id);

create policy "Terapeutas eliminan sus pacientes"
  on public.pacientes for delete
  using (auth.uid() = terapeuta_id);

create index pacientes_terapeuta_id_idx on public.pacientes(terapeuta_id);

-- ============================================================
-- TABLA: turnos
-- ============================================================
create type public.estado_turno as enum (
  'pendiente',
  'confirmado',
  'cancelado',
  'realizado',
  'no_asistio'
);

create type public.modalidad_turno as enum (
  'presencial',
  'videollamada',
  'telefonica'
);

create table public.turnos (
  id              uuid default uuid_generate_v4() primary key,
  terapeuta_id    uuid references public.profiles(id) on delete cascade not null,
  paciente_id     uuid references public.pacientes(id) on delete cascade not null,
  fecha_hora      timestamptz not null,
  duracion_min    integer default 50 not null,   -- duración en minutos (sesión estándar 50 min)
  modalidad       public.modalidad_turno default 'presencial' not null,
  estado          public.estado_turno default 'pendiente' not null,
  monto           numeric(10, 2),                 -- honorarios en ARS
  notas           text,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

alter table public.turnos enable row level security;

create policy "Terapeutas solo ven sus turnos"
  on public.turnos for select
  using (auth.uid() = terapeuta_id);

create policy "Terapeutas crean sus turnos"
  on public.turnos for insert
  with check (auth.uid() = terapeuta_id);

create policy "Terapeutas editan sus turnos"
  on public.turnos for update
  using (auth.uid() = terapeuta_id);

create policy "Terapeutas eliminan sus turnos"
  on public.turnos for delete
  using (auth.uid() = terapeuta_id);

create index turnos_terapeuta_id_idx on public.turnos(terapeuta_id);
create index turnos_paciente_id_idx on public.turnos(paciente_id);
create index turnos_fecha_hora_idx on public.turnos(fecha_hora);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_pacientes_updated_at
  before update on public.pacientes
  for each row execute function public.handle_updated_at();

create trigger set_turnos_updated_at
  before update on public.turnos
  for each row execute function public.handle_updated_at();

-- ============================================================
-- FUNCIÓN: crear perfil automáticamente al registrarse
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nombre, apellido)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
