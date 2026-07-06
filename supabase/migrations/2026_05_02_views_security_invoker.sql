-- ============================================================================
-- Migration: 2026_05_02 — Vistas con security_invoker (lint security_definer_view)
-- ============================================================================
-- Las vistas sin `security_invoker` corren con los privilegios del DUEÑO de la
-- vista y NO respetan el RLS del usuario que consulta → pueden filtrar filas
-- que ese usuario no debería ver. Es el lint `security_definer_view` de Supabase.
--
-- Fix recomendado: security_invoker = true → la vista respeta el RLS del caller.
-- `service_role` (edge functions) sigue bypasseando RLS igual. Ninguna de estas
-- vistas se usa desde el frontend, así que el cambio es seguro.
-- IDEMPOTENTE.
-- ============================================================================

alter view if exists public.profiles_public          set (security_invoker = true);
alter view if exists public.profiles_safe            set (security_invoker = true);
alter view if exists public.gigs_with_open_disputes  set (security_invoker = true);

-- ============================================================================
-- VALIDACIÓN:
--   select c.relname,
--     (select option_value from pg_options_to_table(c.reloptions)
--        where option_name='security_invoker') as invoker
--   from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and c.relkind='v'
--     and c.relname in ('profiles_public','profiles_safe','gigs_with_open_disputes');
--   -- invoker debe ser 'true' en las tres.
-- ============================================================================
-- FIN
