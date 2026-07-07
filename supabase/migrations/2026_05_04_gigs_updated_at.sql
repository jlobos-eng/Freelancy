-- ============================================================================
-- Migration: 2026_05_04 — Reparar trigger updated_at de gigs (bug regresión)
-- ============================================================================
-- La migración base (0000) creó el trigger `trg_gigs_updated_at` sobre `gigs`,
-- que llama a set_updated_at() → `new.updated_at := now()`. Pero la tabla `gigs`
-- viva NO tenía la columna `updated_at` (existía desde antes sin ella), por lo
-- que TODO UPDATE sobre gigs fallaba con:
--     record "new" has no field "updated_at"
-- Esto rompía el flujo central: aceptar postulación (accept_application_v2),
-- marcar en revisión y completar un gig.
--
-- Detectado por el test de integración del flujo de dinero.
--
-- Fix: agregar la columna que el trigger espera (idempotente).
-- ============================================================================
alter table public.gigs
    add column if not exists updated_at timestamptz not null default now();

-- ============================================================================
-- VALIDACIÓN:
--   update public.gigs set status = status where id = (select id from public.gigs limit 1);
--   -- Debe ejecutar sin error.
-- ============================================================================
-- FIN
