-- ============================================================================
-- Migration: 2026_05_10 — search_path en los guards de completar/pagar
-- ============================================================================
-- block_completion_if_disputed y guard_completion_payment son triggers que
-- referencian tablas de public pero no tenían search_path fijo (lint
-- function_search_path_mutable). No son SECURITY DEFINER (riesgo bajo), pero
-- lo fijamos por consistencia y para dejar el linter en verde. No destructivo.
-- ============================================================================
alter function public.block_completion_if_disputed() set search_path = public;
alter function public.guard_completion_payment()     set search_path = public;
-- FIN
