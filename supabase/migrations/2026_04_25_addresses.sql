-- Migration: Direcciones estructuradas
--
-- Reemplaza el campo libre `profiles.location` por una tabla relacional con
-- street/número/comuna/región/lat/lng. Una persona puede tener múltiples
-- direcciones (cliente: casa+oficina, gigs distintos). Se mantiene
-- profiles.location como string formateado por compat (legacy).
--
-- DEPENDE: PostGIS (2026_04_25_postgis_geolocation.sql) para columna geo.

-- =====================================================================
-- 1) Tabla addresses
-- =====================================================================
create table if not exists public.addresses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,

    -- Componentes desglosados
    label text,                    -- "Casa", "Oficina", "Otro" (libre, default null)
    street text not null,          -- "Av. Apoquindo"
    number text,                   -- "3000" (text por casos como "3000-A")
    apartment text,                -- "Depto 502" / "Casa B"
    comuna text not null,          -- "Las Condes"
    city text not null,            -- "Santiago"
    region text not null,          -- "Región Metropolitana"
    country text not null default 'CL',
    postal_code text,
    instructions text,             -- "Edificio rojo, portón al lado del banco"

    -- Coords geocodificadas
    lat double precision,
    lng double precision,
    geo geography(Point, 4326)
        generated always as (
            case
                when lat is not null and lng is not null
                then st_setsrid(st_makepoint(lng, lat), 4326)::geography
                else null
            end
        ) stored,

    -- Sólo una dirección puede estar marcada como primary por usuario
    is_primary boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2) Índices
create index if not exists idx_addresses_user on public.addresses(user_id);
create index if not exists idx_addresses_geo on public.addresses using gist (geo);
-- Sólo una primary por usuario (constraint parcial)
create unique index if not exists idx_addresses_one_primary_per_user
    on public.addresses(user_id)
    where is_primary = true;

-- 3) Trigger updated_at
drop trigger if exists trg_addresses_updated_at on public.addresses;
create trigger trg_addresses_updated_at
    before update on public.addresses
    for each row execute function public.set_updated_at();

-- =====================================================================
-- 4) RLS — cada usuario sólo ve/edita las suyas. EXCEPCIÓN: si la dirección
--    está vinculada a un gig activo, la contraparte (cliente↔lancy) puede
--    leerla mientras dura el gig (para llegar al lugar del trabajo).
-- =====================================================================
alter table public.addresses enable row level security;

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own"
    on public.addresses for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own"
    on public.addresses for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists "addresses_update_own" on public.addresses;
create policy "addresses_update_own"
    on public.addresses for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "addresses_delete_own" on public.addresses;
create policy "addresses_delete_own"
    on public.addresses for delete
    to authenticated
    using (user_id = auth.uid());

-- =====================================================================
-- 5) Helper: formatear dirección a string humano
-- =====================================================================
create or replace function public.format_address(
    p_street text,
    p_number text,
    p_apartment text,
    p_comuna text,
    p_city text
) returns text
language sql immutable as $$
    select trim(both ', ' from concat_ws(', ',
        nullif(trim(concat_ws(' ',
            nullif(p_street, ''),
            nullif(p_number, ''),
            case when nullif(p_apartment, '') is not null then '— ' || p_apartment else null end
        )), ''),
        nullif(p_comuna, ''),
        nullif(p_city, '')
    ));
$$;

-- =====================================================================
-- 6) Trigger: cuando una dirección es PRIMARY, actualizar profiles.location
--    con el string formateado + lat/lng. Mantiene retrocompat.
-- =====================================================================
create or replace function public.sync_primary_address_to_profile()
returns trigger
language plpgsql
security definer
as $$
declare
    v_target_user uuid;
    v_address record;
begin
    -- Determinar usuario afectado (insert/update vs delete)
    v_target_user := coalesce(new.user_id, old.user_id);

    -- Si la operación marca o desmarca primary, sincronizar
    select * into v_address
    from public.addresses
    where user_id = v_target_user and is_primary = true
    limit 1;

    if v_address.id is not null then
        update public.profiles
        set
            location = public.format_address(
                v_address.street, v_address.number, v_address.apartment,
                v_address.comuna, v_address.city
            ),
            lat = v_address.lat,
            lng = v_address.lng
        where id = v_target_user;
    end if;

    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_primary_address on public.addresses;
create trigger trg_sync_primary_address
    after insert or update or delete on public.addresses
    for each row execute function public.sync_primary_address_to_profile();

-- =====================================================================
-- 7) Trigger: si insert/update marca is_primary=true, desmarcar las demás
--    del mismo usuario antes (evita race con el unique index parcial).
-- =====================================================================
create or replace function public.unset_other_primary_addresses()
returns trigger
language plpgsql
as $$
begin
    if new.is_primary = true then
        update public.addresses
        set is_primary = false
        where user_id = new.user_id and id <> new.id and is_primary = true;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_unset_other_primary on public.addresses;
create trigger trg_unset_other_primary
    before insert or update of is_primary on public.addresses
    for each row execute function public.unset_other_primary_addresses();

-- =====================================================================
-- 8) Extender gigs con address_id opcional (la dirección DEL TRABAJO)
--    Esto desacopla la dirección del gig de la dirección de los perfiles.
-- =====================================================================
alter table public.gigs
    add column if not exists address_id uuid references public.addresses(id) on delete set null;

create index if not exists idx_gigs_address on public.gigs(address_id);

-- =====================================================================
-- 9) RLS extra: la contraparte del gig puede leer la dirección DEL gig
--    (no las otras direcciones del usuario). Política aditiva.
-- =====================================================================
drop policy if exists "addresses_select_gig_counterpart" on public.addresses;
create policy "addresses_select_gig_counterpart"
    on public.addresses for select
    to authenticated
    using (
        user_id = auth.uid()
        or exists (
            select 1 from public.gigs g
            where g.address_id = addresses.id
              and (g.client_id = auth.uid() or g.worker_id = auth.uid())
              and g.status in ('assigned', 'review', 'completed')
        )
    );

-- Eliminamos la policy básica para que sólo quede la nueva (que ya cubre el caso own)
drop policy if exists "addresses_select_own" on public.addresses;

-- =====================================================================
-- 10) RPC create_address — wrapper amigable que valida y devuelve la fila
-- =====================================================================
create or replace function public.create_address(
    p_street text,
    p_number text,
    p_apartment text,
    p_comuna text,
    p_city text,
    p_region text,
    p_lat double precision default null,
    p_lng double precision default null,
    p_label text default null,
    p_postal_code text default null,
    p_instructions text default null,
    p_is_primary boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_id uuid;
    v_first boolean;
begin
    if auth.uid() is null then
        raise exception 'Must be authenticated';
    end if;

    -- Si es la primera dirección del usuario, marcarla como primary aunque no se pida
    select count(*) = 0 into v_first
    from public.addresses where user_id = auth.uid();

    insert into public.addresses (
        user_id, street, number, apartment, comuna, city, region,
        lat, lng, label, postal_code, instructions, is_primary
    )
    values (
        auth.uid(), p_street, p_number, p_apartment, p_comuna, p_city, p_region,
        p_lat, p_lng, p_label, p_postal_code, p_instructions, (p_is_primary or v_first)
    )
    returning id into v_id;

    return v_id;
end;
$$;

grant execute on function public.create_address(text, text, text, text, text, text, double precision, double precision, text, text, text, boolean) to authenticated;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Correr este SQL DESPUÉS de la migración PostGIS.
-- 2. Para usuarios existentes con profiles.location en texto libre: opcional
--    correr un script que parsea esos strings y crea direcciones placeholder.
-- =====================================================================
