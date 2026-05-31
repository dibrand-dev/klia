-- Add feriados configuration columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feriados_nacionales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feriados_provinciales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feriados_trabajar_si_confirmado boolean NOT NULL DEFAULT false;
