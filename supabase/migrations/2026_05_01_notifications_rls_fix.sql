-- ============================================================================
-- Migration: 2026_05_01 — Cerrar spoofing de notificaciones (hallazgo C3)
-- ============================================================================
-- PROBLEMA
--   `notifications` tenía políticas de INSERT permisivas (with check `true`),
--   una incluso para el rol `public`. Efecto: cualquier usuario (o anónimo)
--   podía crear notificaciones a nombre de otro → phishing / spoofing in-app.
--
-- POR QUÉ ES SEGURO QUITARLAS
--   Las notificaciones legítimas las crean:
--     - triggers SECURITY DEFINER (notify_new_application, etc.) → bypass RLS.
--     - edge functions con service_role → bypass RLS.
--   El frontend NUNCA inserta notificaciones directamente (verificado).
--   Por lo tanto, sin política de INSERT para authenticated/anon, todo sigue
--   funcionando y se cierra el spoofing.
--
--   También se eliminan políticas duplicadas de rol `public` (SELECT/UPDATE)
--   que ya están cubiertas por sus equivalentes scoped a `authenticated`.
--   IDEMPOTENTE.
-- ============================================================================

-- 1) Eliminar TODAS las políticas de INSERT (dejar la tabla sin INSERT para
--    usuarios normales; triggers/service_role no las necesitan).
drop policy if exists "El sistema puede insertar notificaciones" on public.notifications;
drop policy if exists "notifications_insert_authenticated"       on public.notifications;

-- 2) Limpiar duplicados legados de rol public (equivalentes ya existen scoped).
drop policy if exists "Usuarios pueden ver sus propias notificaciones"        on public.notifications;
drop policy if exists "Usuarios pueden actualizar sus propias notificaciones"  on public.notifications;

-- Quedan vigentes (scoped a authenticated):
--   notifications_select_own, notifications_update_own, notifications_delete_own

-- ============================================================================
-- VALIDACIÓN:
--   select policyname, cmd, roles from pg_policies
--     where schemaname='public' and tablename='notifications' order by cmd;
--   -- No debe existir ninguna política INSERT; el resto solo con {authenticated}.
-- ============================================================================
-- FIN
