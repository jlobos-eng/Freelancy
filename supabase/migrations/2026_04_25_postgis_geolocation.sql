-- Migration: Geolocalización real con PostGIS
-- Sustituye el campo de texto `location` por coordenadas reales + búsqueda espacial.
-- Mantiene `location` como texto para mostrar la comuna humana (reverse geocoded).

-- =====================================================================
-- 1) Habilitar PostGIS (idempotente, Supabase ya lo trae instalable)
-- =====================================================================
create extension if not exists postgis;

-- =====================================================================
-- 2) Agregar columnas a profiles
--    - lat / lng: la coord cruda que el usuario nos confió (privada)
--    - geo: columna generada espacial, indexable con GIST
--    - location: ya existía como text, lo dejamos para "Las Condes", etc.
--    - last_seen_at: timestamp de la última vez que el worker confirmó
--      ubicación. El frontend lo lee para mostrar "actualizado hace X" y
--      para throttle del auto-update. NOTA: mantenemos también
--      location_updated_at para retrocompat con cualquier consumer
--      legacy. Ambos se sincronizan en el trigger de §4.
-- =====================================================================
alter table public.profiles
    add column if not exists lat double precision,
    add column if not exists lng double precision,
    add column if not exists last_seen_at timestamptz,
    add column if not exists location_updated_at timestamptz;

-- Columna generada — siempre derivada de lat/lng. Si lat/lng son null, geo es null.
-- Nota: si tu Postgres no soporta GENERATED, usa el trigger de la sección 4 en su lugar.
alter table public.profiles
    add column if not exists geo geography(Point, 4326)
    generated always as (
        case
            when lat is not null and lng is not null
            then st_setsrid(st_makepoint(lng, lat), 4326)::geography
            else null
        end
    ) stored;

-- =====================================================================
-- 3) Índice GIST sobre geo — clave para que ST_DWithin sea O(log n)
-- =====================================================================
create index if not exists idx_profiles_geo on public.profiles using gist (geo);

-- Índice compuesto para búsquedas comunes filtradas por rol
create index if not exists idx_profiles_role_geo on public.profiles (role) where role = 'worker';

-- =====================================================================
-- 4) Trigger: cuando cambian lat/lng, sincroniza last_seen_at + location_updated_at
-- =====================================================================
create or replace function public.set_location_updated_at()
returns trigger as $$
begin
    if (new.lat is distinct from old.lat) or (new.lng is distinct from old.lng) then
        new.last_seen_at := now();
        new.location_updated_at := now();
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_location_updated_at on public.profiles;
create trigger trg_profiles_location_updated_at
    before update on public.profiles
    for each row execute function public.set_location_updated_at();

-- =====================================================================
-- 5) RPC nearby_workers — búsqueda espacial general (sin filtro de skill)
--
-- IMPORTANTE: el filtro por skill vive en `nearby_workers_by_skill`
-- (definida en 2026_04_25_skills_catalog.sql). Mantenemos esto simple
-- a 4 parámetros para que coincida con la firma que el frontend usa.
-- Si en el futuro queremos un filtro extra acá, agregar OTRA función
-- con nombre distinto en lugar de overload (los overloads via params
-- por nombre desde supabase-js son ambiguos).
--
-- Privacidad:
--   - lat/lng se redondean a 3 decimales (~110 m) antes de devolverlos.
--   - El cliente aplica jitter visual adicional con utils/geo.js → jitterCoord.
--     Combinado, el pin nunca coincide exactamente con la dirección real.
-- =====================================================================
-- Limpieza de cualquier firma legacy antes de redefinir
drop function if exists public.nearby_workers(double precision, double precision, double precision, integer);
drop function if exists public.nearby_workers(double precision, double precision, double precision, text, integer);

create or replace function public.nearby_workers(
    p_lat double precision,
    p_lng double precision,
    p_radius_km double precision default 5,
    p_limit int default 50
)
returns table (
    id uuid,
    full_name text,
    avatar_url text,
    rating numeric,
    skill text,
    location text,
    lat double precision,
    lng double precision,
    distance_m double precision,
    last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select
        p.id,
        p.full_name,
        p.avatar_url,
        p.rating,
        p.skill,
        p.location,
        round(p.lat::numeric, 3)::double precision as lat,
        round(p.lng::numeric, 3)::double precision as lng,
        st_distance(
            p.geo,
            st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
        ) as distance_m,
        p.last_seen_at
    from public.profiles p
    where p.role = 'worker'
      and p.geo is not null
      and st_dwithin(
            p.geo,
            st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
            p_radius_km * 1000  -- ST_DWithin en geography usa metros
          )
    order by distance_m asc
    limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.nearby_workers(double precision, double precision, double precision, int) to authenticated;

-- =====================================================================
-- 6) RPC update_my_location — el worker comparte su ubicación
--    Centralizar acá evita que cada cliente haga UPDATE directo y
--    permite validar bounds (Chile aprox: lat -56..-17, lng -110..-66).
--    Setea last_seen_at explícitamente (además del trigger) por si
--    el cliente actualiza con coords idénticas a las anteriores.
-- =====================================================================
drop function if exists public.update_my_location(double precision, double precision);
drop function if exists public.update_my_location(double precision, double precision, text);

create or replace function public.update_my_location(
    p_lat double precision,
    p_lng double precision,
    p_location text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_lat is null or p_lng is null then
        raise exception 'lat and lng required';
    end if;
    if p_lat < -56 or p_lat > -17 or p_lng < -110 or p_lng > -66 then
        raise exception 'coordinates outside Chile bounds';
    end if;

    update public.profiles
    set
        lat = p_lat,
        lng = p_lng,
        location = coalesce(p_location, location),
        last_seen_at = now(),
        location_updated_at = now()
    where id = auth.uid();
end;
$$;

grant execute on function public.update_my_location(double precision, double precision, text) to authenticated;

-- =====================================================================
-- 7) RLS / Vista pública sin coords crudas
--    Para clientes que necesitan listar workers sin pasar por nearby_workers
--    (ej. perfil público), exponemos esta vista que omite lat/lng.
-- =====================================================================
create or replace view public.profiles_public as
select
    id, full_name, avatar_url, rating, skill, location, role, created_at
from public.profiles;

grant select on public.profiles_public to authenticated, anon;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Correr este script en Supabase SQL Editor.
-- 2. Si ya tienes datos en profiles.location (texto), opcionalmente
--    podemos geocodear esos textos a lat/lng con un script aparte.
-- 3. Verificar que la extension PostGIS quedó habilitada:
--      select postgis_version();
-- 4. Probar la RPC con tu propia ubicación:
--      select * from nearby_workers(-33.4489, -70.6693, 5, 50);
-- =====================================================================
