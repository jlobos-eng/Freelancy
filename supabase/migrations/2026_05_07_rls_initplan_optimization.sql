-- ============================================================================
-- Migration: 2026_05_07 — Optimizar RLS: auth.uid() → (select auth.uid())
-- ============================================================================
-- Las políticas que llaman auth.uid()/auth.role()/auth.jwt() SIN envolver en un
-- subquery hacen que Postgres re-evalúe esas funciones UNA VEZ POR FILA. Al
-- envolverlas en (select auth.uid()) el planner las evalúa una sola vez por
-- consulta (initplan). Es el lint `auth_rls_initplan` de Supabase.
--
-- Cambio 100% semántico-neutro: (select auth.uid()) devuelve el mismo valor.
-- No cambia NINGÚN permiso (validado con la suite supabase/tests/rls_security_checks.sql).
--
-- Este script es SELF-TRANSFORMING e IDEMPOTENTE: recorre las políticas del
-- esquema public, y solo reescribe (ALTER POLICY, no DROP) las que aún tienen
-- auth.*() sin envolver. Protege las ya envueltas para no doble-envolver.
-- Corre bien en cualquier estado de la BD (incluido un fresh install tras las
-- migraciones base).
-- ============================================================================
do $$
declare
  r record; nq text; nc text; stmt text; n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual ~* 'auth\.(uid|role|jwt)\(\)' and qual !~* 'select\s+auth\.')
        or (with_check ~* 'auth\.(uid|role|jwt)\(\)' and with_check !~* 'select\s+auth\.')
      )
  loop
    nq := case when r.qual is not null then
      regexp_replace(
        regexp_replace(
          regexp_replace(r.qual, '\(\s*select auth\.(uid|role|jwt)\(\)[^)]*\)', 'ZZZ\1', 'gi'),
          'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g'),
        'ZZZ(uid|role|jwt)', '(select auth.\1())', 'g')
    end;
    nc := case when r.with_check is not null then
      regexp_replace(
        regexp_replace(
          regexp_replace(r.with_check, '\(\s*select auth\.(uid|role|jwt)\(\)[^)]*\)', 'ZZZ\1', 'gi'),
          'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g'),
        'ZZZ(uid|role|jwt)', '(select auth.\1())', 'g')
    end;
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if nq is not null then stmt := stmt || format(' using (%s)', nq); end if;
    if nc is not null then stmt := stmt || format(' with check (%s)', nc); end if;
    execute stmt;
    n := n + 1;
  end loop;
  raise notice 'RLS initplan: % políticas optimizadas', n;
end $$;

-- ============================================================================
-- VALIDACIÓN (debe dar 0):
--   select count(*) from pg_policies where schemaname='public'
--     and ((qual ~* 'auth\.(uid|role|jwt)\(\)' and qual !~* 'select\s+auth\.')
--       or (with_check ~* 'auth\.(uid|role|jwt)\(\)' and with_check !~* 'select\s+auth\.'));
-- Y correr supabase/tests/rls_security_checks.sql → ALL PASS.
-- ============================================================================
-- FIN
