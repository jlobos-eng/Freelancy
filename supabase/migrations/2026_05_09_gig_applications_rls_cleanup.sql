-- ============================================================================
-- Migration: 2026_05_09 — Limpieza RLS de gig_applications (privacidad + perf)
-- ============================================================================
-- DOS PROBLEMAS (detectados por el advisor de Supabase, lint
-- multiple_permissive_policies):
--   1. PRIVACIDAD: la política `applications_select` usaba `using (true)` →
--      CUALQUIER usuario autenticado podía leer TODAS las postulaciones de
--      TODOS los gigs (un worker veía las ofertas/montos de su competencia).
--   2. PERFORMANCE: convivían políticas legacy del MVP (rol `public`, nombres
--      en español) con las nuevas → múltiples políticas permisivas evaluadas
--      por cada query.
--
-- FIX:
--   - Eliminar las 4 políticas legacy `public` (su intención ya está cubierta).
--   - Reemplazar `applications_select` (true) por una versión ACOTADA: solo el
--     worker dueño de la postulación o el cliente dueño del gig pueden verla.
--
-- Verificado contra el frontend: solo lee (a) postulaciones propias del worker
-- (worker_id = uid) y (b) postulaciones de los gigs del cliente (in gig_ids).
-- Nunca necesita ver postulaciones ajenas. El cambio es seguro.
-- ============================================================================

-- 1) Eliminar políticas legacy del MVP (rol public, redundantes)
drop policy if exists "Trabajadores insertan sus postulaciones"     on public.gig_applications;
drop policy if exists "Clientes ven postulaciones de sus gigs"        on public.gig_applications;
drop policy if exists "Trabajadores ven sus propias postulaciones"    on public.gig_applications;
drop policy if exists "Clientes actualizan estado de postulaciones"   on public.gig_applications;

-- 2) Reemplazar el SELECT abierto (true) por uno acotado
drop policy if exists "applications_select" on public.gig_applications;
create policy "applications_select" on public.gig_applications
    for select to authenticated
    using (
        worker_id = (select auth.uid())
        or exists (
            select 1 from public.gigs g
            where g.id = gig_applications.gig_id
              and g.client_id = (select auth.uid())
        )
    );

-- Quedan vigentes (scoped a authenticated):
--   applications_insert_own, applications_update, applications_delete_own

-- ============================================================================
-- VALIDACIÓN: no debe quedar ninguna política de rol public en gig_applications,
-- y applications_select ya no debe ser `true`.
-- ============================================================================
-- FIN
