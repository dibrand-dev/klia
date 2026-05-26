-- Add meet_link column to turnos for Google Meet auto-generated links on videollamada sessions

ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS meet_link text;
