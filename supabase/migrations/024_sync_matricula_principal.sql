-- 024_sync_matricula_principal.sql — NO ejecutar automáticamente: correr
-- manualmente en el dashboard de Supabase (klia-staging primero, validar,
-- recién después en Klin).
--
-- Fase 3 de Ajustes v3 (dos matrículas, provincial y nacional). Mantiene
-- profiles.matricula / matricula_tipo / matricula_provincia sincronizados
-- con la fila "principal" de profesional_matriculas, para que los ~20
-- lugares que todavía leen el campo viejo (planillas PAMI/IOMA/Swiss
-- Medical, aviso de deuda, certificados, informes, historial exportado,
-- antropometría compartida, plan alimentario, link público, OPS) sigan
-- funcionando sin tocarlos.
--
-- Verificado contra datos reales antes de escribir esto (solo lectura,
-- SELECT DISTINCT en Klin y klia-staging): profiles.matricula_tipo hoy solo
-- toma los valores 'nacional', 'provincial' o NULL — exactamente los mismos
-- que el CHECK de profesional_matriculas.tipo. No hace falta mapeo de
-- formato: numero/tipo/provincia se copian 1:1, sin agregar el prefijo
-- "MP"/"MN" (eso lo arma cada lugar de lectura en el momento de mostrarlo,
-- igual que hoy).

-- ── 1. Función + trigger de sincronización ──────────────────────────────
-- AFTER INSERT/UPDATE/DELETE en profesional_matriculas. SECURITY DEFINER
-- (dueño de la función, no el rol que dispara el trigger) para poder:
--   a) promover a principal una fila origen='refeps' tras un DELETE, algo
--      que la policy "dueño edita matriculas manuales" no permitiría si el
--      trigger corriera con los privilegios de `authenticated` (esa policy
--      exige origen='manual').
--   b) actualizar profiles.matricula* aunque la policy de profiles no
--      cubriera ese caso puntual.
create or replace function public.sync_matricula_principal_a_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profesional_id uuid;
  v_nueva_principal record;
  v_ya_tiene_principal boolean;
begin
  v_profesional_id := coalesce(new.profesional_id, old.profesional_id);

  if tg_op = 'DELETE' then
    if not old.es_principal then
      return old;
    end if;

    -- Se borró la principal: promover otra. Primero una verificada; si no
    -- hay ninguna verificada, la más reciente. El UPDATE de abajo vuelve a
    -- disparar este mismo trigger (AFTER UPDATE), que ya sincroniza
    -- profiles.matricula* con la fila promovida — no se repite acá.
    select * into v_nueva_principal
    from profesional_matriculas
    where profesional_id = v_profesional_id
    order by verificada desc, created_at desc
    limit 1;

    if v_nueva_principal is null then
      -- No queda ninguna matrícula. A pedido explícito: NO se borra
      -- profiles.matricula/matricula_tipo/matricula_provincia, queda el
      -- último valor. Esto es lo más cerca que un trigger de SQL puede
      -- llegar a "avisar" — queda en los logs de Postgres de Supabase, no
      -- llega como notificación real a nadie. Si se necesita un aviso de
      -- verdad (email, Pushover, etc.) hay que agregarlo aparte, a nivel
      -- de aplicación — lo marco como pendiente, no está resuelto acá.
      raise warning 'sync_matricula_principal_a_profile: profesional % quedó sin matrículas al borrar la principal — profiles.matricula* conserva el último valor.', v_profesional_id;
      return old;
    end if;

    update profesional_matriculas set es_principal = true where id = v_nueva_principal.id;
    return old;
  end if;

  -- INSERT: si es la primera matrícula del profesional (no hay ninguna
  -- principal todavía) y esta fila no llegó ya marcada como principal,
  -- se vuelve principal automáticamente.
  if tg_op = 'INSERT' and not new.es_principal then
    v_ya_tiene_principal := exists (
      select 1 from profesional_matriculas
      where profesional_id = new.profesional_id and es_principal and id <> new.id
    );
    if not v_ya_tiene_principal then
      update profesional_matriculas set es_principal = true where id = new.id;
      return new; -- el UPDATE de arriba dispara este trigger de nuevo y sincroniza
    end if;
  end if;

  -- Si esta fila es (o pasó a ser) la principal, sincronizar profiles.
  -- Cubre: INSERT ya marcado como principal, UPDATE que marca/edita la
  -- principal (incluye marcar_matricula_principal y la edición manual del
  -- número de la propia principal). Si new.es_principal es false (p.ej. al
  -- desmarcar la vieja principal desde marcar_matricula_principal) no se
  -- toca profiles — nunca se sincroniza con una fila que deja de ser
  -- principal.
  if new.es_principal then
    update profiles set
      matricula = new.numero,
      matricula_tipo = new.tipo,
      matricula_provincia = new.provincia
    where id = v_profesional_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_matricula_principal on public.profesional_matriculas;
create trigger trg_sync_matricula_principal
  after insert or update or delete on public.profesional_matriculas
  for each row execute function public.sync_matricula_principal_a_profile();

-- ── 2. marcar_matricula_principal — simplificada, el trigger sincroniza ──
-- Necesita SECURITY DEFINER porque la policy "dueño edita matriculas
-- manuales" exige origen='manual' — esta función tiene que poder marcar
-- como principal una fila origen='refeps' también.
create or replace function public.marcar_matricula_principal(p_matricula_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profesional_id uuid;
begin
  select profesional_id into v_profesional_id
  from profesional_matriculas
  where id = p_matricula_id and profesional_id = auth.uid();

  if v_profesional_id is null then
    raise exception 'Matrícula no encontrada o no pertenece al usuario';
  end if;

  update profesional_matriculas set es_principal = false
    where profesional_id = v_profesional_id and es_principal = true and id <> p_matricula_id;

  update profesional_matriculas set es_principal = true
    where id = p_matricula_id;
end;
$$;

revoke execute on function public.marcar_matricula_principal(uuid) from public, anon;
grant execute on function public.marcar_matricula_principal(uuid) to authenticated;

-- ── 3. Backfill (idempotente) ─────────────────────────────────────────
-- A fecha de esta migración, verificado por SELECT en ambos proyectos:
-- este backfill ya corrió antes (klia-staging: 2/2 profiles con matricula
-- ya tienen fila; Klin: 39/39). El WHERE NOT EXISTS hace que, si ya están
-- todas, esto no inserte nada — seguro de re-correr.
-- Respeta el CHECK de tipo (nacional|provincial|NULL): los perfiles con
-- matricula_tipo NULL (confirmado que existen: 15 en Klin con matricula
-- cargada y tipo NULL) se insertan con tipo NULL — el CHECK lo permite
-- (NULL nunca viola un CHECK). No se fuerza ningún valor.
insert into public.profesional_matriculas (profesional_id, tipo, provincia, numero, origen, verificada, es_principal)
select p.id, p.matricula_tipo, p.matricula_provincia, p.matricula, 'manual', false, true
from public.profiles p
where p.matricula is not null and trim(p.matricula) <> ''
  and not exists (
    select 1 from public.profesional_matriculas m where m.profesional_id = p.id
  );

-- ── Rollback ───────────────────────────────────────────────────────────
-- Revierte el trigger y las funciones. El backfill es un INSERT de datos,
-- no un objeto de schema — no se revierte acá (si hace falta deshacerlo,
-- identificar las filas por profesional_id + verificada=false + origen=
-- 'manual' + created_at de esta corrida puntual, y borrarlas a mano).
--
-- drop trigger if exists trg_sync_matricula_principal on public.profesional_matriculas;
-- drop function if exists public.sync_matricula_principal_a_profile();
-- revoke execute on function public.marcar_matricula_principal(uuid) from authenticated;
-- drop function if exists public.marcar_matricula_principal(uuid);
