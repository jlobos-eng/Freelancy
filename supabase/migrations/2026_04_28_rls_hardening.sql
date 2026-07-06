-- ============================================================================
-- Migration: 2026_04_28 — Endurecimiento RLS (cierra hallazgo C6)
-- ============================================================================
-- CONTEXTO
--   Las tablas profiles/gigs/messages arrastraban políticas permisivas del MVP
--   (rol `public`, `using true`). En Postgres las políticas permisivas se
--   combinan con OR, por lo que ANULABAN las políticas restrictivas correctas.
--   Efectos detectados:
--     - messages: cualquiera (incluso anónimo) leía/escribía TODO chat privado.
--     - gigs: cualquiera veía todos los gigs y podía actualizar gigs abiertos.
--     - profiles: `anon` y `authenticated` podían leer filas de perfil.
--
--   Esta migración elimina las políticas legadas y deja SOLO las scoped.
--   Además reemplaza la política que permitía a un worker mover un gig
--   open→bidding (necesaria para el flujo de postulación) por una versión
--   acotada.
--
--   NOTA sobre tokens MP: cerrar la lectura de mp_access_token/refresh a
--   usuarios *authenticated* requiere sacar esas columnas de `profiles`
--   (rompe `select('*')`). Se aborda en una migración aparte de token-hardening.
--   Esta migración ya cierra el acceso ANÓNIMO (lo más grave).
--
--   IDEMPOTENTE: usa `drop policy if exists` y `create policy`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) MESSAGES — eliminar la política abierta del MVP
-- ---------------------------------------------------------------------------
drop policy if exists "Todos pueden leer y escribir mensajes del MVP" on public.messages;
-- Quedan vigentes (creadas en 0000_base_schema):
--   messages_select_participants, messages_insert_participant, messages_update_participants

-- ---------------------------------------------------------------------------
-- 2) GIGS — eliminar políticas permisivas legadas
-- ---------------------------------------------------------------------------
drop policy if exists "Cualquiera puede ver los gigs"      on public.gigs;  -- SELECT true (public)
drop policy if exists "Participantes pueden editar"        on public.gigs;  -- UPDATE public (dup de gigs_update_participants)
drop policy if exists "Lancys pueden aceptar trabajos"     on public.gigs;  -- UPDATE public status=open (se reemplaza abajo)
drop policy if exists "Clientes pueden crear gigs"         on public.gigs;  -- INSERT public (dup de gigs_insert_own_client)

-- Reemplazo acotado: un usuario autenticado (que NO sea el dueño) puede
-- señalizar interés moviendo un gig de 'open' a 'bidding'. Solo esa transición.
-- La asignación real del worker la hace la RPC accept_application (security definer).
drop policy if exists "gigs_bid_open_to_bidding" on public.gigs;
create policy "gigs_bid_open_to_bidding"
    on public.gigs for update
    to authenticated
    using (status = 'open' and client_id <> auth.uid())
    with check (status = 'bidding' and client_id <> auth.uid());
-- Quedan vigentes (de 0000_base_schema):
--   gigs_select_visible (open OR client OR worker),
--   gigs_insert_own_client, gigs_update_participants, gigs_delete_own_client

-- ---------------------------------------------------------------------------
-- 3) PROFILES — eliminar políticas permisivas legadas
--    Tras esto, `anon` pierde toda lectura de perfiles (login requerido),
--    lo que cierra el acceso anónimo a las columnas de token MP.
-- ---------------------------------------------------------------------------
drop policy if exists "Public profiles are viewable by everyone." on public.profiles; -- SELECT true (public)
drop policy if exists "Users can insert their own profile."       on public.profiles; -- dup de profiles_insert_own
drop policy if exists "Users can update own profile."             on public.profiles; -- dup de profiles_update_own
-- Quedan vigentes (de 0000_base_schema):
--   profiles_select_authenticated (SELECT true → solo authenticated),
--   profiles_insert_own, profiles_update_own

-- Defensa en profundidad: revocar cualquier privilegio directo de `anon`
-- sobre estas tablas (ya no tiene políticas permisivas, pero por si acaso).
revoke all on public.profiles from anon;
revoke all on public.messages from anon;

-- ============================================================================
-- VALIDACIÓN (correr en SQL Editor):
--   -- No deben quedar políticas con roles={public} en estas tablas:
--   select tablename, policyname, roles from pg_policies
--     where schemaname='public' and tablename in ('profiles','gigs','messages')
--       and roles::text like '%public%';
-- ============================================================================
-- FIN
