-- ============================================================================
-- Migration: 2026_05_05 — Eliminar el modelo de saldo legacy (dual-write)
-- ============================================================================
-- CONTEXTO
--   El trigger `trigger_pago_gig` (función procesar_pago_gig) sumaba NEW.budget
--   a `profiles.balance` cuando un gig pasaba review→completed. Ese es el modelo
--   de saldo VIEJO. El modelo vigente es `transactions` + la vista
--   `wallet_balance` (que el frontend usa exclusivamente; ver comentario en
--   DashboardWorker.jsx: "NO usar profiles.balance — es un campo legacy").
--
--   Mantener ambos = doble contabilidad latente del dinero. Como la app no lee
--   profiles.balance, el dual-write es código muerto y riesgoso.
--
-- FIX
--   Quitar el trigger y la función legacy → una sola fuente de verdad del dinero.
--   Se CONSERVA la columna profiles.balance (inofensiva, la referencia el seed)
--   para no romper datos existentes; simplemente deja de escribirse por trigger.
--
-- Verificado: el frontend lee wallet_balance/transactions, nunca profiles.balance.
-- ============================================================================

drop trigger if exists trigger_pago_gig on public.gigs;
drop function if exists public.procesar_pago_gig();

comment on column public.profiles.balance is
    'LEGACY (no usar). El saldo real vive en transactions + vista wallet_balance. Conservada por compatibilidad con datos/seed antiguos.';

-- ============================================================================
-- VALIDACIÓN:
--   select tgname from pg_trigger where tgrelid='public.gigs'::regclass and tgname='trigger_pago_gig';
--   -- No debe devolver filas.
-- ============================================================================
-- FIN
