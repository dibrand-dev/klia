-- Turnos recurrentes: tabla de series y columnas adicionales en turnos

-- ============================================================
-- TABLA: turnos_recurrentes
-- ============================================================
create table public.turnos_recurrentes (
  id            uuid default uuid_generate_v4() primary key,
  terapeuta_id  uuid references public.profiles(id) on delete cascade not null,
  paciente_id   uuid references public.pacientes(id) on delete cascade not null,
  dia_semana    integer not null check (dia_semana >= 0 and dia_semana <= 6),
  hora          text not null,
  duracion_min  integer default 50 not null,
  modalidad     public.modalidad_turno default 'presencial' not null,
  monto         numeric(10, 2),
  fecha_inicio  date not null,
  fecha_fin     date not null,
  activo        boolean default true not null,
  created_at    timestamptz default now() not null
);

alter table public.turnos_recurrentes enable row level security;

create policy "Terapeutas ven sus series"
  on public.turnos_recurrentes for select
  using (auth.uid() = terapeuta_id);

create policy "Terapeutas crean sus series"
  on public.turnos_recurrentes for insert
  with check (auth.uid() = terapeuta_id);

create policy "Terapeutas editan sus series"
  on public.turnos_recurrentes for update
  using (auth.uid() = terapeuta_id);

create policy "Terapeutas eliminan sus series"
  on public.turnos_recurrentes for delete
  using (auth.uid() = terapeuta_id);

create index turnos_recurrentes_terapeuta_id_idx on public.turnos_recurrentes(terapeuta_id);
create index turnos_recurrentes_paciente_id_idx on public.turnos_recurrentes(paciente_id);

-- ============================================================
-- ALTERACIONES A: turnos
-- ============================================================
alter table public.turnos
  add column if not exists serie_recurrente_id uuid references public.turnos_recurrentes(id) on delete set null,
  add column if not exists pagado              boolean default false not null,
  add column if not exists recordatorio_enviado boolean default false not null;

create index if not exists turnos_serie_recurrente_id_idx on public.turnos(serie_recurrente_id);
