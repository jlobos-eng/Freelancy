-- ============================================================================
-- Migration: 2026_04_30 — Aislar tokens Mercado Pago (cierre total de C6)
-- ============================================================================
-- PROBLEMA
--   mp_access_token / mp_refresh_token vivían en `profiles`. Como la política
--   de lectura de profiles es `using true` para authenticated y el rol tiene
--   grant sobre esas columnas, cualquier usuario logueado podía leer los
--   tokens de otros. No se puede cerrar por columna sin romper `select('*')`.
--
-- SOLUCIÓN
--   Mover los tokens a una tabla dedicada `mp_credentials` con RLS y SIN
--   políticas para authenticated/anon → solo `service_role` (edge functions)
--   accede. Luego ELIMINAR las columnas de `profiles`, con lo que `select('*')`
--   deja de exponerlas y no se rompe.
--
--   Verificado antes de aplicar: 0 perfiles con token (nada que migrar),
--   ninguna función ni vista referencia esas columnas.
--
-- REQUIERE: redeploy de la edge function `mp-oauth-callback` (ya adaptada en el
--   código) ANTES de activar Mercado Pago. Hoy MP está OFF, así que no hay
--   flujo en curso.
-- ============================================================================

-- 1) Tabla dedicada para credenciales sensibles (una por Lancy)
create table if not exists public.mp_credentials (
    user_id             uuid primary key references public.profiles(id) on delete cascade,
    mp_access_token     text not null,
    mp_refresh_token    text,
    mp_token_expires_at timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

drop trigger if exists trg_mp_credentials_updated_at on public.mp_credentials;
create trigger trg_mp_credentials_updated_at
    before update on public.mp_credentials
    for each row execute function public.set_updated_at();

-- 2) RLS ON, sin políticas: nadie con rol authenticated/anon puede tocarla.
--    `service_role` (edge functions vía getSupabaseAdmin) bypassa RLS.
alter table public.mp_credentials enable row level security;

-- Defensa en profundidad: revocar cualquier grant directo.
revoke all on public.mp_credentials from anon, authenticated;

-- 3) Migrar tokens existentes (si hubiera). Hoy: 0 filas.
insert into public.mp_credentials (user_id, mp_access_token, mp_refresh_token, mp_token_expires_at)
select id, mp_access_token, mp_refresh_token, mp_token_expires_at
from public.profiles
where mp_access_token is not null
on conflict (user_id) do nothing;

-- 4) Eliminar las columnas sensibles de profiles.
--    Se conservan mp_user_id (collector_id, no secreto, lo usa el frontend) y
--    mp_onboarded_at (timestamp).
alter table public.profiles drop column if exists mp_access_token;
alter table public.profiles drop column if exists mp_refresh_token;
alter table public.profiles drop column if exists mp_token_expires_at;

-- ============================================================================
-- VALIDACIÓN:
--   -- Los tokens ya no existen en profiles:
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='profiles'
--       and column_name like 'mp_%token%';   -- debe devolver 0 filas
--
--   -- authenticated no puede leer mp_credentials:
--   select has_table_privilege('authenticated','public.mp_credentials','select'); -- false
-- ============================================================================
-- FIN
