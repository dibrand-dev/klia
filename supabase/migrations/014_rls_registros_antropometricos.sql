-- registros_antropometricos tenía RLS habilitado sin ninguna policy (fail-closed silencioso:
-- el SELECT del profesional volvía [] sin error, aunque el INSERT funcionaba por tener GRANT).
-- Mismo patrón que el resto de tablas propias del profesional: filtro por terapeuta_id = auth.uid().

create policy "terapeuta_select_own_registros_antropometricos"
  on public.registros_antropometricos
  for select
  to authenticated
  using (terapeuta_id = auth.uid());

create policy "terapeuta_insert_own_registros_antropometricos"
  on public.registros_antropometricos
  for insert
  to authenticated
  with check (terapeuta_id = auth.uid());

create policy "terapeuta_update_own_registros_antropometricos"
  on public.registros_antropometricos
  for update
  to authenticated
  using (terapeuta_id = auth.uid())
  with check (terapeuta_id = auth.uid());

create policy "terapeuta_delete_own_registros_antropometricos"
  on public.registros_antropometricos
  for delete
  to authenticated
  using (terapeuta_id = auth.uid());
