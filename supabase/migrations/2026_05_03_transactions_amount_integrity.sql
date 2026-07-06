-- ============================================================================
-- Migration: 2026_05_03 — Integridad de montos en transactions (cierra C4)
-- ============================================================================
-- Garantiza a nivel de BD que el desglose de dinero SIEMPRE cuadra:
--   amount_gross (lo que paga el cliente) = amount_fee (comisión app) + amount_net (worker)
--
-- Hoy el split lo calcula accept_application_v2:
--   amount_fee = round(bid * 0.10);  amount_net = bid - fee;  amount_gross = bid
-- => la invariante gross = fee + net se cumple por construcción. Este CHECK es
--    defensa en profundidad: si algún código futuro (o una comisión variable)
--    rompe el cuadre, la BD lo rechaza en vez de dejar dinero "descuadrado".
--
-- amount_provider_fee (comisión de Mercado Pago) es contabilidad aparte y NO
-- entra en esta invariante.
--
-- Verificado antes de aplicar: 0 transacciones, 0 filas inconsistentes.
-- ============================================================================
alter table public.transactions
    drop constraint if exists transactions_amounts_balance;

alter table public.transactions
    add constraint transactions_amounts_balance
    check (amount_gross = amount_fee + amount_net);

-- ============================================================================
-- VALIDACIÓN:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.transactions'::regclass and conname = 'transactions_amounts_balance';
-- ============================================================================
-- FIN
