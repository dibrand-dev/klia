-- 023_registros_antropometricos_metodo_otro.sql — NO ejecutar automáticamente: correr manualmente en el dashboard de Supabase (klia-staging primero, luego Klin).
-- Persiste el nombre del método cuando metodo_medicion = 'otro' (SlideOver Nuevo registro antropométrico).
alter table public.registros_antropometricos
  add column if not exists metodo_otro text;
