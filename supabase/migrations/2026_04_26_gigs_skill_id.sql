-- Migration: gigs.skill_id — vincular cada gig al catálogo de oficios.
--
-- M5.4 — el cliente elige primero "¿a quién necesitas?" en el formulario
-- "Pedir un Lancy". Esto:
--   - Mejora el matching cliente↔lancy (antes era texto libre vs skill).
--   - Habilita filtro real por categoría en DashboardWorker.
--   - Permite forzar verificación cuando skill.requires_certification=true
--     (lógica futura del lado del frontend / RPC de matching).
--
-- skill_id es nullable para no romper gigs legacy. on delete restrict
-- para no permitir borrar una skill del catálogo si hay gigs vinculados.

alter table public.gigs
    add column if not exists skill_id uuid
    references public.skills(id) on delete restrict;

create index if not exists idx_gigs_skill_id on public.gigs(skill_id)
    where skill_id is not null;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Esta migración ya fue aplicada al proyecto Supabase remoto.
-- 2. Para ver gigs por skill:
--      select g.title, s.name as oficio
--      from gigs g
--      left join skills s on s.id = g.skill_id;
-- =====================================================================
