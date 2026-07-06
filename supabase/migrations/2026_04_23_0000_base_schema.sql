-- ============================================================================
-- Migration: 0000 — Esquema base (profiles, gigs, messages, ratings)
-- ============================================================================
-- PROPÓSITO
--   Reconstruir desde cero las tablas fundacionales que TODAS las demás
--   migraciones (2026_04_24 en adelante) asumen como preexistentes. Sin este
--   archivo, `supabase db reset` falla porque profiles/gigs/messages no existen.
--
-- DEBE CORRER PRIMERO (nombre elegido para ordenar antes de 2026_04_24_*).
--
-- COLUMNAS QUE **NO** VAN AQUÍ (las agregan migraciones posteriores vía ALTER):
--   profiles: lat, lng, geo, last_seen_at, location_updated_at, is_admin,
--             kyc_status, mp_user_id, mp_access_token, mp_refresh_token,
--             mp_token_expires_at, mp_onboarded_at, balance_pending, balance_available
--   gigs:     address_id, skill_id, payment_status
--   messages: read_at
--   Mantener esas columnas fuera de aquí evita choques con las migraciones que
--   las introducen. Este archivo define solo el "núcleo original".
--
-- SEGURIDAD / IDEMPOTENCIA
--   - `create table if not exists` → no toca tablas ya existentes en una BD viva.
--   - Políticas con `drop policy if exists` antes de `create` → re-ejecutable.
--   - RLS habilitado en todas las tablas.
-- ============================================================================

-- Extensiones necesarias para el resto del proyecto (idempotente).
-- IMPORTANTE: postgis se declara aquí a propósito. La migración de `addresses`
-- usa el tipo `geography` pero, por orden alfabético, corre ANTES que
-- `2026_04_25_postgis_geolocation.sql`. Habilitar la extensión en la base
-- garantiza que `supabase db reset` (que aplica en orden de nombre) no falle.
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists postgis;      -- tipo geography usado por addresses/profiles

-- ---------------------------------------------------------------------------
-- Helper compartido: trigger updated_at (varias migraciones lo usan / redefinen)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

-- ===========================================================================
-- 1) PROFILES — perfil de cada usuario (cliente o "Lancy"/worker)
--    1:1 con auth.users. Otras migraciones extienden esta tabla con ALTER.
-- ===========================================================================
create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    full_name   text,
    role        text not null default 'client'
                    check (role in ('client', 'worker')),
    avatar_url  text,
    -- Campos legacy de "una sola skill" (el catálogo skills/worker_skills los
    -- reemplaza, pero el código y el seed aún los leen/escriben).
    skill       text,
    location    text,               -- dirección en texto libre (legacy)
    -- Datos de contacto / presentación
    email       text,
    phone       text,
    bio         text,
    headline    text,
    -- Reputación denormalizada (promedio). La tabla ratings es la fuente.
    rating      numeric(3, 2) not null default 0
                    check (rating >= 0 and rating <= 5),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Lectura: marketplace público → cualquier autenticado ve perfiles.
-- (Las columnas sensibles mp_access_token/refresh se blindan en la migración
--  de pagos con una vista profiles_safe; aquí el núcleo no tiene secretos.)
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
    on public.profiles for select
    to authenticated
    using (true);

-- Cada usuario crea SOLO su propio perfil.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
    on public.profiles for insert
    to authenticated
    with check (id = auth.uid());

-- Cada usuario edita SOLO su propio perfil.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

-- ===========================================================================
-- 2) GIGS — trabajos publicados por un cliente
--    Migraciones posteriores añaden address_id, skill_id, payment_status.
-- ===========================================================================
create table if not exists public.gigs (
    id          uuid primary key default gen_random_uuid(),
    client_id   uuid not null references public.profiles(id) on delete cascade,
    worker_id   uuid references public.profiles(id) on delete set null,
    title       text not null,
    description text,
    budget      bigint check (budget is null or budget >= 0),  -- CLP, sin decimales
    category    text,
    image_url   text,
    status      text not null default 'open'
                    check (status in ('open', 'bidding', 'assigned', 'review', 'completed', 'cancelled')),
    -- Estrellas que el cliente asigna al worker al cerrar (1..5). La tabla
    -- ratings guarda la reseña completa; esto es un atajo denormalizado.
    rating      int check (rating is null or (rating >= 1 and rating <= 5)),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_gigs_client on public.gigs(client_id);
create index if not exists idx_gigs_worker on public.gigs(worker_id);
create index if not exists idx_gigs_status on public.gigs(status);

drop trigger if exists trg_gigs_updated_at on public.gigs;
create trigger trg_gigs_updated_at
    before update on public.gigs
    for each row execute function public.set_updated_at();

alter table public.gigs enable row level security;

-- Lectura: gigs abiertos son visibles para todos (feed del marketplace);
-- además cliente y worker asignado siempre ven sus propios gigs.
drop policy if exists "gigs_select_visible" on public.gigs;
create policy "gigs_select_visible"
    on public.gigs for select
    to authenticated
    using (
        status = 'open'
        or client_id = auth.uid()
        or worker_id = auth.uid()
    );

-- El cliente publica sus propios gigs.
drop policy if exists "gigs_insert_own_client" on public.gigs;
create policy "gigs_insert_own_client"
    on public.gigs for insert
    to authenticated
    with check (client_id = auth.uid());

-- Update: el cliente dueño gestiona su gig; el worker asignado puede
-- avanzar el estado del trabajo (p. ej. marcar 'review').
drop policy if exists "gigs_update_participants" on public.gigs;
create policy "gigs_update_participants"
    on public.gigs for update
    to authenticated
    using (client_id = auth.uid() or worker_id = auth.uid())
    with check (client_id = auth.uid() or worker_id = auth.uid());

-- Delete: solo el cliente dueño.
drop policy if exists "gigs_delete_own_client" on public.gigs;
create policy "gigs_delete_own_client"
    on public.gigs for delete
    to authenticated
    using (client_id = auth.uid());

-- ===========================================================================
-- 3) MESSAGES — chat 1:1 dentro de un gig (cliente <-> worker)
--    La migración messages_read_state añade read_at + view + RPC.
-- ===========================================================================
create table if not exists public.messages (
    id          uuid primary key default gen_random_uuid(),
    gig_id      uuid not null references public.gigs(id) on delete cascade,
    sender_id   uuid not null references public.profiles(id) on delete cascade,
    content     text not null check (length(trim(content)) > 0),
    created_at  timestamptz not null default now()
);

create index if not exists idx_messages_gig on public.messages(gig_id, created_at);
create index if not exists idx_messages_sender on public.messages(sender_id);

alter table public.messages enable row level security;

-- Solo los participantes del gig (cliente o worker) ven los mensajes.
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
    on public.messages for select
    to authenticated
    using (
        exists (
            select 1 from public.gigs g
            where g.id = messages.gig_id
              and (g.client_id = auth.uid() or g.worker_id = auth.uid())
        )
    );

-- Solo puedo enviar mensajes como yo mismo, y solo en gigs donde participo.
drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant"
    on public.messages for insert
    to authenticated
    with check (
        sender_id = auth.uid()
        and exists (
            select 1 from public.gigs g
            where g.id = messages.gig_id
              and (g.client_id = auth.uid() or g.worker_id = auth.uid())
        )
    );

-- Update acotado (usado por mark_messages_read para setear read_at): solo
-- participantes del gig.
drop policy if exists "messages_update_participants" on public.messages;
create policy "messages_update_participants"
    on public.messages for update
    to authenticated
    using (
        exists (
            select 1 from public.gigs g
            where g.id = messages.gig_id
              and (g.client_id = auth.uid() or g.worker_id = auth.uid())
        )
    );

-- ===========================================================================
-- 4) RATINGS — reseña de una parte hacia la otra al cerrar un gig
--    Fuente de verdad de la reputación; profiles.rating y gigs.rating son
--    atajos denormalizados que el frontend mantiene hoy. Tabla ADITIVA:
--    el código actual aún no la consulta, pero el roadmap (reputación
--    verificada por transacción) se apoya en ella. Segura de crear.
-- ===========================================================================
create table if not exists public.ratings (
    id           uuid primary key default gen_random_uuid(),
    gig_id       uuid not null references public.gigs(id) on delete cascade,
    rater_id     uuid not null references public.profiles(id) on delete cascade,   -- quién califica
    ratee_id     uuid not null references public.profiles(id) on delete cascade,   -- a quién califican
    stars        int not null check (stars >= 1 and stars <= 5),
    comment      text,
    created_at   timestamptz not null default now(),
    -- Una reseña por (gig, evaluador): evita spam y auto-reseñas repetidas.
    unique (gig_id, rater_id)
);

create index if not exists idx_ratings_ratee on public.ratings(ratee_id);
create index if not exists idx_ratings_gig on public.ratings(gig_id);

alter table public.ratings enable row level security;

-- Reputación pública: las reseñas se leen por cualquier autenticado.
drop policy if exists "ratings_select_public" on public.ratings;
create policy "ratings_select_public"
    on public.ratings for select
    to authenticated
    using (true);

-- Solo puedo dejar una reseña como yo mismo, sobre un gig completado en el
-- que participé, y no puedo auto-evaluarme.
drop policy if exists "ratings_insert_participant" on public.ratings;
create policy "ratings_insert_participant"
    on public.ratings for insert
    to authenticated
    with check (
        rater_id = auth.uid()
        and rater_id <> ratee_id
        and exists (
            select 1 from public.gigs g
            where g.id = ratings.gig_id
              and g.status = 'completed'
              and (g.client_id = auth.uid() or g.worker_id = auth.uid())
        )
    );

-- ===========================================================================
-- 5) VALIDACIONES POST-MIGRACIÓN (correr manualmente en el SQL Editor)
-- ===========================================================================
--   select table_name from information_schema.tables
--     where table_schema='public'
--       and table_name in ('profiles','gigs','messages','ratings');
--   -- Debe devolver las 4.
--
--   select relrowsecurity from pg_class
--     where relname in ('profiles','gigs','messages','ratings');
--   -- Todas deben ser true (RLS habilitado).
-- ============================================================================
-- FIN
