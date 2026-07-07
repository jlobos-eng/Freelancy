-- ============================================================================
-- Migration: 2026_05_08 — Cierres de la feature de retiros
-- ============================================================================
-- Dos detalles detectados por el chequeo de salud tras aplicar retiros:
--   1. cl_banks (catálogo de bancos) estaba sin RLS → el advisor lo marca como
--      rls_disabled_in_public. Es un catálogo de solo lectura: habilitamos RLS
--      con una política de lectura para authenticated (mismo acceso, sin warning).
--   2. bank_accounts.bank_code (FK a cl_banks) sin índice → lo agregamos
--      (la migración de índices FK corrió antes de que bank_accounts existiera).
-- ============================================================================

-- 1) RLS en el catálogo de bancos (lectura pública para usuarios autenticados)
alter table public.cl_banks enable row level security;
drop policy if exists "cl_banks_select_authenticated" on public.cl_banks;
create policy "cl_banks_select_authenticated" on public.cl_banks
    for select to authenticated using (true);

-- 2) Índice para la FK bank_accounts.bank_code
create index if not exists idx_bank_accounts_bank_code on public.bank_accounts(bank_code);

-- ============================================================================
-- VALIDACIÓN:
--   select relrowsecurity from pg_class where relname='cl_banks';  -- true
-- ============================================================================
-- FIN
