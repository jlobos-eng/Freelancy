-- Migration: Catálogo cerrado de skills + multi-skill por worker
--
-- Cambia el modelo de "1 worker = 1 skill texto libre" a
-- "1 worker = N skills, cada una con headline propio + tarifa + cert opcional".
--
-- Catálogo cerrado: lo administra service_role. Las skills tienen `requires_certification`
-- y `cert_authority` para preparar M5.3.
--
-- DEPENDE: 2026_04_25_postgis_geolocation.sql (para nearby_workers_by_skill).

-- =====================================================================
-- 1) Tabla catálogo de skills
-- =====================================================================
create table if not exists public.skills (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,           -- 'electricista' | 'pintor' | etc.
    name text not null,                  -- 'Electricista' (display)
    category text not null,              -- 'Construcción y mejoras', 'Hogar y mascotas', etc.
    icon text,                           -- nombre de icono lucide opcional
    description text,
    requires_certification boolean not null default false,
    cert_authority text,                 -- 'SEC' | 'MINSAL' | 'CMR' | etc. (cuando aplica)
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists idx_skills_category on public.skills(category) where is_active = true;
create index if not exists idx_skills_slug on public.skills(slug);

-- Lectura pública (catálogo)
alter table public.skills enable row level security;

drop policy if exists "skills_select_public" on public.skills;
create policy "skills_select_public"
    on public.skills for select
    to authenticated, anon
    using (is_active = true);

-- Escritura: sólo service_role (sin policy → bloqueado para authenticated)

-- =====================================================================
-- 2) Tabla join worker_skills
-- =====================================================================
create table if not exists public.worker_skills (
    id uuid primary key default gen_random_uuid(),
    worker_id uuid not null references public.profiles(id) on delete cascade,
    skill_id uuid not null references public.skills(id) on delete restrict,

    headline text,                       -- "Diseño de logos y branding" / "Paseo + visita al veterinario"
    hourly_rate bigint,                  -- CLP por hora, opcional
    years_experience int check (years_experience >= 0 and years_experience <= 80),

    -- Certificación (preparado para M5.3, hoy queda null)
    is_certified boolean not null default false,
    certification_url text,
    certification_number text,
    verification_status text not null default 'unverified' check (verification_status in (
        'unverified', 'pending', 'verified', 'rejected', 'expired'
    )),

    is_primary boolean not null default false,    -- skill destacada en el perfil
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Un worker no puede agregar la misma skill dos veces
    unique (worker_id, skill_id)
);

create index if not exists idx_worker_skills_worker on public.worker_skills(worker_id);
create index if not exists idx_worker_skills_skill on public.worker_skills(skill_id);

-- Sólo una primary por worker (parcial)
create unique index if not exists idx_worker_skills_one_primary
    on public.worker_skills(worker_id)
    where is_primary = true;

-- Trigger updated_at
drop trigger if exists trg_worker_skills_updated_at on public.worker_skills;
create trigger trg_worker_skills_updated_at
    before update on public.worker_skills
    for each row execute function public.set_updated_at();

-- Trigger: si insert/update marca primary, desmarcar las demás del worker
create or replace function public.unset_other_primary_skills()
returns trigger language plpgsql as $$
begin
    if new.is_primary = true then
        update public.worker_skills
        set is_primary = false
        where worker_id = new.worker_id and id <> new.id and is_primary = true;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_unset_other_primary_skills on public.worker_skills;
create trigger trg_unset_other_primary_skills
    before insert or update of is_primary on public.worker_skills
    for each row execute function public.unset_other_primary_skills();

-- =====================================================================
-- 3) RLS worker_skills
-- =====================================================================
alter table public.worker_skills enable row level security;

drop policy if exists "worker_skills_select_public" on public.worker_skills;
create policy "worker_skills_select_public"
    on public.worker_skills for select
    to authenticated
    using (true);  -- el catálogo de habilidades de cada lancy es público para clientes

drop policy if exists "worker_skills_insert_own" on public.worker_skills;
create policy "worker_skills_insert_own"
    on public.worker_skills for insert
    to authenticated
    with check (worker_id = auth.uid());

drop policy if exists "worker_skills_update_own" on public.worker_skills;
create policy "worker_skills_update_own"
    on public.worker_skills for update
    to authenticated
    using (worker_id = auth.uid())
    with check (worker_id = auth.uid());

drop policy if exists "worker_skills_delete_own" on public.worker_skills;
create policy "worker_skills_delete_own"
    on public.worker_skills for delete
    to authenticated
    using (worker_id = auth.uid());

-- =====================================================================
-- 4) Seed catálogo (catálogo CERRADO — ~40 skills agrupadas por categoría)
-- =====================================================================
insert into public.skills (slug, name, category, requires_certification, cert_authority) values
    -- Construcción y mejoras
    ('electricista', 'Electricista', 'Construcción y mejoras', true, 'SEC'),
    ('gasfiter', 'Gásfiter', 'Construcción y mejoras', true, 'SEC'),
    ('pintor', 'Pintor', 'Construcción y mejoras', false, null),
    ('carpintero', 'Carpintero', 'Construcción y mejoras', false, null),
    ('albanil', 'Albañil / Maestro', 'Construcción y mejoras', false, null),
    ('cerrajero', 'Cerrajero', 'Construcción y mejoras', false, null),
    ('jardinero', 'Jardinero', 'Construcción y mejoras', false, null),
    ('soldador', 'Soldador', 'Construcción y mejoras', false, null),

    -- Limpieza
    ('limpieza-domestica', 'Limpieza doméstica', 'Limpieza', false, null),
    ('limpieza-oficina', 'Limpieza de oficinas', 'Limpieza', false, null),
    ('limpieza-post-obra', 'Limpieza post-obra', 'Limpieza', false, null),
    ('lavado-vehiculos', 'Lavado de vehículos', 'Limpieza', false, null),

    -- Hogar y mascotas
    ('paseador-perros', 'Paseador de perros', 'Hogar y mascotas', false, null),
    ('cuidado-mascotas', 'Cuidado de mascotas', 'Hogar y mascotas', false, null),
    ('niñera', 'Niñera / Cuidado de niños', 'Hogar y mascotas', false, null),
    ('cuidado-adultos-mayores', 'Cuidado de adultos mayores', 'Hogar y mascotas', false, null),
    ('chef-domicilio', 'Chef a domicilio', 'Hogar y mascotas', false, null),

    -- Diseño y digital
    ('diseno-grafico', 'Diseñador gráfico', 'Diseño y digital', false, null),
    ('diseno-web', 'Diseño web / UI', 'Diseño y digital', false, null),
    ('fotografia', 'Fotógrafo', 'Diseño y digital', false, null),
    ('video-edicion', 'Editor de video', 'Diseño y digital', false, null),
    ('community-manager', 'Community manager', 'Diseño y digital', false, null),
    ('redaccion', 'Redactor / Copywriter', 'Diseño y digital', false, null),

    -- Tech
    ('desarrollo-web', 'Desarrollador web', 'Tech', false, null),
    ('desarrollo-mobile', 'Desarrollador mobile', 'Tech', false, null),
    ('soporte-tecnico', 'Soporte técnico PC', 'Tech', false, null),
    ('redes', 'Instalación de redes / wifi', 'Tech', false, null),

    -- Mudanzas y transporte
    ('mudanza', 'Mudanzas', 'Mudanzas y transporte', false, null),
    ('flete', 'Flete y carga', 'Mudanzas y transporte', false, null),
    ('chofer-particular', 'Chofer particular', 'Mudanzas y transporte', false, null),

    -- Eventos y belleza
    ('peluqueria', 'Peluquería a domicilio', 'Eventos y belleza', false, null),
    ('manicure', 'Manicure / Pedicure', 'Eventos y belleza', false, null),
    ('maquillaje', 'Maquillaje', 'Eventos y belleza', false, null),
    ('garzon', 'Garzón / Atención eventos', 'Eventos y belleza', false, null),
    ('barman', 'Barman / Coctelería', 'Eventos y belleza', false, null),

    -- Salud y bienestar
    ('masajes', 'Masajista', 'Salud y bienestar', true, 'MINSAL'),
    ('kinesiologia', 'Kinesiólogo', 'Salud y bienestar', true, 'Superintendencia de Salud'),
    ('entrenador-personal', 'Entrenador personal', 'Salud y bienestar', false, null),
    ('yoga-instructor', 'Instructor de yoga', 'Salud y bienestar', false, null),

    -- Educación
    ('clases-particulares', 'Clases particulares', 'Educación', false, null),
    ('idiomas', 'Profesor de idiomas', 'Educación', false, null),
    ('musica-clases', 'Clases de música', 'Educación', false, null)
on conflict (slug) do nothing;

-- =====================================================================
-- 5) Migración legacy: copiar profiles.skill (texto libre) a worker_skills
--    cuando matcheé con un slug del catálogo. Si no matchea, queda sin migrar.
-- =====================================================================
do $$
declare
    v_profile record;
    v_skill_id uuid;
begin
    for v_profile in
        select id, skill from public.profiles
        where role = 'worker' and coalesce(trim(skill), '') <> ''
    loop
        -- Buscar skill por nombre normalizado (case insensitive, sin tildes)
        select id into v_skill_id
        from public.skills
        where lower(name) = lower(v_profile.skill)
           or slug = lower(regexp_replace(v_profile.skill, '\s+', '-', 'g'))
        limit 1;

        if v_skill_id is not null then
            insert into public.worker_skills (worker_id, skill_id, is_primary)
            values (v_profile.id, v_skill_id, true)
            on conflict (worker_id, skill_id) do nothing;
        end if;
    end loop;
end $$;

-- =====================================================================
-- 6) Vista enriquecida: worker_skills_with_skill
--    Junta worker_skills con datos del catálogo para queries del frontend.
-- =====================================================================
create or replace view public.worker_skills_with_skill as
select
    ws.id,
    ws.worker_id,
    ws.skill_id,
    ws.headline,
    ws.hourly_rate,
    ws.years_experience,
    ws.is_certified,
    ws.verification_status,
    ws.is_primary,
    ws.created_at,
    s.slug as skill_slug,
    s.name as skill_name,
    s.category as skill_category,
    s.requires_certification,
    s.cert_authority
from public.worker_skills ws
join public.skills s on s.id = ws.skill_id
where s.is_active = true;

alter view public.worker_skills_with_skill set (security_invoker = true);
grant select on public.worker_skills_with_skill to authenticated;

-- =====================================================================
-- 7) RPC nearby_workers_by_skill — búsqueda espacial filtrada por skill_slug
--    Devuelve workers que tienen esa skill, ordenados por distancia.
-- =====================================================================
create or replace function public.nearby_workers_by_skill(
    p_lat double precision,
    p_lng double precision,
    p_radius_km double precision default 5,
    p_skill_slug text default null,
    p_limit int default 50
)
returns table (
    id uuid,
    full_name text,
    avatar_url text,
    rating numeric,
    location text,
    lat double precision,
    lng double precision,
    distance_m double precision,
    -- Datos de la skill matcheada
    worker_skill_id uuid,
    skill_slug text,
    skill_name text,
    headline text,
    hourly_rate bigint,
    is_certified boolean,
    verification_status text
)
language sql stable security definer as $$
    select
        p.id,
        p.full_name,
        p.avatar_url,
        p.rating,
        p.location,
        round(p.lat::numeric, 3)::double precision as lat,
        round(p.lng::numeric, 3)::double precision as lng,
        st_distance(
            p.geo,
            st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
        ) as distance_m,
        ws.id as worker_skill_id,
        s.slug as skill_slug,
        s.name as skill_name,
        ws.headline,
        ws.hourly_rate,
        ws.is_certified,
        ws.verification_status
    from public.profiles p
    join public.worker_skills ws on ws.worker_id = p.id
    join public.skills s on s.id = ws.skill_id
    where p.role = 'worker'
      and p.geo is not null
      and s.is_active = true
      and (p_skill_slug is null or s.slug = p_skill_slug)
      and st_dwithin(
            p.geo,
            st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
            p_radius_km * 1000
          )
    order by distance_m asc, ws.is_primary desc
    limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.nearby_workers_by_skill(double precision, double precision, double precision, text, int) to authenticated;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Correr DESPUÉS de PostGIS y addresses.
-- 2. Validar el catálogo:
--      select category, count(*) from skills group by category;
-- 3. Si tienes datos legacy: revisar cuántos worker_skills se crearon vs
--    cuántos workers tenían skill no nulo:
--      select count(*) from worker_skills;
--      select count(*) from profiles where role='worker' and coalesce(trim(skill),'') <> '';
-- =====================================================================
