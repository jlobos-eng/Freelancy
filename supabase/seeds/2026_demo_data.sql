-- ============================================================================
-- Demo data — Lancys de muestra para presentación a inversionistas.
-- ============================================================================
-- Crea 6 perfiles falsos de Lancys distribuidos en Santiago, con skills,
-- direcciones, ratings y una certificación verificada (Mariana, electricista SEC).
--
-- IMPORTANTE: este script REQUIERE que las migraciones anteriores ya estén
-- aplicadas en orden:
--   1. PostGIS + profiles.lat/lng/geo
--   2. addresses
--   3. skills + worker_skills + seed catálogo (42 skills)
--   4. certifications (opcional pero recomendado)
--
-- Para correr este seed:
--   1. Crea los usuarios desde Supabase Auth → Users → "Add user". Necesitas
--      6 usuarios con los emails siguientes (cualquier password):
--          mariana.electricista@demo.cl
--          jorge.lobos@demo.cl
--          carla.gasfiter@demo.cl
--          daniel.pintor@demo.cl
--          paola.limpieza@demo.cl
--          luis.paseador@demo.cl
--   2. Después corre este SQL en el SQL Editor.
--      El script busca los usuarios por email y crea sus perfiles.
--
-- LIMPIAR los datos demo más tarde:
--   delete from profiles where id in (
--     select id from auth.users where email like '%@demo.cl'
--   );
--   (cascade borra todo lo asociado)
-- ============================================================================

-- =====================================================================
-- 1) Crear/actualizar perfiles para los usuarios demo
-- =====================================================================
do $$
declare
    v_user record;
    v_skill_id uuid;
    v_addr_id uuid;
    v_cert_id uuid;
    v_jorge_id uuid;
    v_mariana_id uuid;
begin
    -- ===== MARIANA — Electricista SEC verificada (Las Condes) =====
    select id into v_mariana_id from auth.users where email = 'mariana.electricista@demo.cl';
    if v_mariana_id is not null then
        insert into public.profiles (id, full_name, role, avatar_url, skill, location, rating, lat, lng, mp_user_id)
        values (
            v_mariana_id,
            'Mariana Soto',
            'worker',
            'https://i.pravatar.cc/200?img=47',
            'Electricista',
            'Las Condes, Santiago',
            4.9,
            -33.4172,
            -70.5476,
            'demo_mp_mariana'
        )
        on conflict (id) do update set
            full_name = excluded.full_name,
            role = excluded.role,
            avatar_url = excluded.avatar_url,
            location = excluded.location,
            rating = excluded.rating,
            lat = excluded.lat,
            lng = excluded.lng,
            mp_user_id = excluded.mp_user_id;

        -- Dirección
        insert into public.addresses (user_id, street, number, comuna, city, region, lat, lng, is_primary, label)
        values (v_mariana_id, 'Av. Apoquindo', '4500', 'Las Condes', 'Santiago', 'Región Metropolitana', -33.4172, -70.5476, true, 'Casa')
        on conflict do nothing;

        -- Skill: Electricista (con cert SEC)
        select id into v_skill_id from public.skills where slug = 'electricista';
        if v_skill_id is not null then
            insert into public.worker_skills (worker_id, skill_id, headline, hourly_rate, years_experience, is_primary)
            values (v_mariana_id, v_skill_id, 'Instalaciones residenciales y comerciales certificadas SEC', 18000, 12, true)
            on conflict (worker_id, skill_id) do nothing;

            -- Cert verificada
            insert into public.certifications (
                worker_id, skill_id, authority, credential_number,
                document_url, issued_at, expires_at, status, verified_at
            ) values (
                v_mariana_id, v_skill_id, 'SEC', 'SEC-A-2019-87432',
                'https://demo.local/cert-mariana.pdf',
                '2019-04-15', '2026-04-15', 'verified', now()
            ) on conflict do nothing;
        end if;
    end if;

    -- ===== JORGE — Diseñador gráfico Y paseador de perros (Providencia) =====
    select id into v_jorge_id from auth.users where email = 'jorge.lobos@demo.cl';
    if v_jorge_id is not null then
        insert into public.profiles (id, full_name, role, avatar_url, skill, location, rating, lat, lng, mp_user_id)
        values (
            v_jorge_id,
            'Jorge Lobos',
            'worker',
            'https://i.pravatar.cc/200?img=12',
            'Diseñador gráfico',
            'Providencia, Santiago',
            4.7,
            -33.4263,
            -70.6133,
            'demo_mp_jorge'
        )
        on conflict (id) do update set
            full_name = excluded.full_name, role = excluded.role,
            avatar_url = excluded.avatar_url, location = excluded.location,
            rating = excluded.rating, lat = excluded.lat, lng = excluded.lng,
            mp_user_id = excluded.mp_user_id;

        insert into public.addresses (user_id, street, number, comuna, city, region, lat, lng, is_primary, label)
        values (v_jorge_id, 'Av. Providencia', '1208', 'Providencia', 'Santiago', 'Región Metropolitana', -33.4263, -70.6133, true, 'Oficina')
        on conflict do nothing;

        -- Multi-skill: diseño gráfico + paseador
        select id into v_skill_id from public.skills where slug = 'diseno-grafico';
        if v_skill_id is not null then
            insert into public.worker_skills (worker_id, skill_id, headline, hourly_rate, years_experience, is_primary)
            values (v_jorge_id, v_skill_id, 'Diseño de logos, branding y material para emprendimientos', 22000, 8, true)
            on conflict (worker_id, skill_id) do nothing;
        end if;

        select id into v_skill_id from public.skills where slug = 'paseador-perros';
        if v_skill_id is not null then
            insert into public.worker_skills (worker_id, skill_id, headline, hourly_rate, years_experience, is_primary)
            values (v_jorge_id, v_skill_id, 'Paseos en parques cercanos · grupos pequeños · seguro contra accidentes', 8000, 3, false)
            on conflict (worker_id, skill_id) do nothing;
        end if;
    end if;

    -- ===== CARLA — Gásfiter (Ñuñoa) =====
    select id into v_user from auth.users where email = 'carla.gasfiter@demo.cl';
    if v_user.id is not null then
        insert into public.profiles (id, full_name, role, avatar_url, skill, location, rating, lat, lng, mp_user_id)
        values (
            v_user.id, 'Carla Mendoza', 'worker',
            'https://i.pravatar.cc/200?img=44',
            'Gásfiter', 'Ñuñoa, Santiago', 4.8, -33.4569, -70.5969,
            'demo_mp_carla'
        )
        on conflict (id) do update set
            full_name = excluded.full_name, role = excluded.role,
            avatar_url = excluded.avatar_url, location = excluded.location,
            rating = excluded.rating, lat = excluded.lat, lng = excluded.lng,
            mp_user_id = excluded.mp_user_id;

        insert into public.addresses (user_id, street, number, comuna, city, region, lat, lng, is_primary)
        values (v_user.id, 'Irarrázaval', '3450', 'Ñuñoa', 'Santiago', 'Región Metropolitana', -33.4569, -70.5969, true)
        on conflict do nothing;

        select id into v_skill_id from public.skills where slug = 'gasfiter';
        if v_skill_id is not null then
            insert into public.worker_skills (worker_id, skill_id, headline, hourly_rate, years_experience, is_primary)
            values (v_user.id, v_skill_id, 'Reparación de cañerías, calefont y filtraciones · disponible fines de semana', 16000, 7, true)
            on conflict (worker_id, skill_id) do nothing;
        end if;
    end if;

    -- ===== DANIEL — Pintor (Maipú) =====
    select id into v_user from auth.users where email = 'daniel.pintor@demo.cl';
    if v_user.id is not null then
        insert into public.profiles (id, full_name, role, avatar_url, skill, location, rating, lat, lng, mp_user_id)
        values (
            v_user.id, 'Daniel Rojas', 'worker',
            'https://i.pravatar.cc/200?img=33',
            'Pintor', 'Maipú, Santiago', 4.5, -33.5111, -70.7581,
            'demo_mp_daniel'
        )
        on conflict (id) do update set
            full_name = excluded.full_name, role = excluded.role,
            avatar_url = excluded.avatar_url, location = excluded.location,
            rating = excluded.rating, lat = excluded.lat, lng = excluded.lng,
            mp_user_id = excluded.mp_user_id;

        insert into public.addresses (user_id, street, number, comuna, city, region, lat, lng, is_primary)
        values (v_user.id, 'Av. Pajaritos', '3010', 'Maipú', 'Santiago', 'Región Metropolitana', -33.5111, -70.7581, true)
        on conflict do nothing;

        select id into v_skill_id from public.skills where slug = 'pintor';
        if v_skill_id is not null then
            insert into public.worker_skills (worker_id, skill_id, headline, hourly_rate, years_experience, is_primary)
            values (v_user.id, v_skill_id, 'Pintura interior y exterior · presupuesto sin costo', 14000, 5, true)
            on conflict (worker_id, skill_id) do nothing;
        end if;
    end if;

    -- ===== PAOLA — Limpieza doméstica (Macul) =====
    select id into v_user from auth.users where email = 'paola.limpieza@demo.cl';
    if v_user.id is not null then
        insert into public.profiles (id, full_name, role, avatar_url, skill, location, rating, lat, lng, mp_user_id)
        values (
            v_user.id, 'Paola Núñez', 'worker',
            'https://i.pravatar.cc/200?img=23',
            'Limpieza doméstica', 'Macul, Santiago', 4.9, -33.4894, -70.5994,
            'demo_mp_paola'
        )
        on conflict (id) do update set
            full_name = excluded.full_name, role = excluded.role,
            avatar_url = excluded.avatar_url, location = excluded.location,
            rating = excluded.rating, lat = excluded.lat, lng = excluded.lng,
            mp_user_id = excluded.mp_user_id;

        insert into public.addresses (user_id, street, number, comuna, city, region, lat, lng, is_primary)
        values (v_user.id, 'Av. Macul', '2890', 'Macul', 'Santiago', 'Región Metropolitana', -33.4894, -70.5994, true)
        on conflict do nothing;

        select id into v_skill_id from public.skills where slug = 'limpieza-domestica';
        if v_skill_id is not null then
            insert into public.worker_skills (worker_id, skill_id, headline, hourly_rate, years_experience, is_primary)
            values (v_user.id, v_skill_id, 'Limpieza profunda · materiales incluidos · 5+ años de experiencia', 9000, 6, true)
            on conflict (worker_id, skill_id) do nothing;
        end if;
    end if;

    -- ===== LUIS — Paseador de perros (La Reina) =====
    select id into v_user from auth.users where email = 'luis.paseador@demo.cl';
    if v_user.id is not null then
        insert into public.profiles (id, full_name, role, avatar_url, skill, location, rating, lat, lng, mp_user_id)
        values (
            v_user.id, 'Luis Espinoza', 'worker',
            'https://i.pravatar.cc/200?img=68',
            'Paseador de perros', 'La Reina, Santiago', 4.6, -33.4451, -70.5429,
            'demo_mp_luis'
        )
        on conflict (id) do update set
            full_name = excluded.full_name, role = excluded.role,
            avatar_url = excluded.avatar_url, location = excluded.location,
            rating = excluded.rating, lat = excluded.lat, lng = excluded.lng,
            mp_user_id = excluded.mp_user_id;

        insert into public.addresses (user_id, street, number, comuna, city, region, lat, lng, is_primary)
        values (v_user.id, 'Av. Príncipe de Gales', '7200', 'La Reina', 'Santiago', 'Región Metropolitana', -33.4451, -70.5429, true)
        on conflict do nothing;

        select id into v_skill_id from public.skills where slug = 'paseador-perros';
        if v_skill_id is not null then
            insert into public.worker_skills (worker_id, skill_id, headline, hourly_rate, years_experience, is_primary)
            values (v_user.id, v_skill_id, 'Paseos por Parque Aguas de Ramón · grupos de hasta 4 perros', 7000, 2, true)
            on conflict (worker_id, skill_id) do nothing;
        end if;
    end if;

    -- ===== Suprimir warnings de unused vars =====
    perform v_addr_id, v_cert_id;

    raise notice 'Demo data seeded. Workers visibles: hasta 6 (depende de cuántos usuarios demo creaste en Auth).';
end $$;

-- =====================================================================
-- 2) Verificación rápida
-- =====================================================================
-- Cuántos workers demo hay:
-- select count(*) from profiles p join auth.users u on u.id = p.id where u.email like '%@demo.cl';

-- Cuántas skills tienen asignadas:
-- select p.full_name, count(ws.id) as skills_count
-- from profiles p
-- join auth.users u on u.id = p.id
-- left join worker_skills ws on ws.worker_id = p.id
-- where u.email like '%@demo.cl'
-- group by p.full_name;

-- FIN
