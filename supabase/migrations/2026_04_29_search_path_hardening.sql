-- ============================================================================
-- Migration: 2026_04_29 — Fijar search_path en funciones security definer (C2)
-- ============================================================================
-- Las funciones SECURITY DEFINER sin `search_path` fijo son un vector de
-- escalación de privilegios: un usuario podría crear un objeto en un esquema
-- anterior en el search_path y hacer que la función ejecute su código con los
-- privilegios del definidor. Es el hallazgo `function_search_path_mutable` del
-- linter de Supabase.
--
-- Arreglo NO destructivo: `ALTER FUNCTION ... SET search_path` no reescribe el
-- cuerpo. Se usa `public, extensions` para que sigan resolviendo PostGIS y
-- pgcrypto (gen_random_uuid). Idempotente.
--
-- NO se tocan las 3 sobrecargas de st_estimatedextent (pertenecen a PostGIS).
-- ============================================================================

alter function public.accept_application(uuid) set search_path = public, extensions;
alter function public.accept_application_v2(uuid) set search_path = public, extensions;
alter function public.create_address(text, text, text, text, text, text, double precision, double precision, text, text, text, boolean) set search_path = public, extensions;
alter function public.delete_push_subscription(text) set search_path = public, extensions;
alter function public.handle_new_user() set search_path = public, extensions;
alter function public.mark_all_notifications_read() set search_path = public, extensions;
alter function public.mark_messages_read(uuid) set search_path = public, extensions;
alter function public.mark_skill_cert_pending() set search_path = public, extensions;
alter function public.nearby_workers(double precision, double precision, double precision, text, integer) set search_path = public, extensions;
alter function public.nearby_workers_by_skill(double precision, double precision, double precision, text, integer) set search_path = public, extensions;
alter function public.notify_application_status_change() set search_path = public, extensions;
alter function public.notify_gig_status_change() set search_path = public, extensions;
alter function public.notify_new_application() set search_path = public, extensions;
alter function public.notify_send_push() set search_path = public, extensions;
alter function public.on_dispute_open() set search_path = public, extensions;
alter function public.open_dispute(uuid, text, text, text[]) set search_path = public, extensions;
alter function public.procesar_pago_gig() set search_path = public, extensions;
alter function public.submit_certification(uuid, text, text, text, text, integer, date, date) set search_path = public, extensions;
alter function public.sync_cert_to_worker_skill() set search_path = public, extensions;
alter function public.sync_dispute_to_transaction() set search_path = public, extensions;
alter function public.sync_primary_address_to_profile() set search_path = public, extensions;
alter function public.update_my_location(double precision, double precision, text) set search_path = public, extensions;
alter function public.upsert_push_subscription(text, text, text, text) set search_path = public, extensions;
alter function public.withdraw_dispute(uuid) set search_path = public, extensions;

-- ============================================================================
-- VALIDACIÓN:
--   select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.prosecdef and p.proname<>'st_estimatedextent'
--     and (p.proconfig is null or not exists (
--        select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
--   -- Debe devolver 0.
-- ============================================================================
-- FIN
