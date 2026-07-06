-- =====================================================================
-- 2026_04_27_auth_profile_trigger.sql
-- Auto-crea row en public.profiles cuando se inserta en auth.users.
--
-- Aplica a:
--   - Sign up con email/password.
--   - Sign in con Google OAuth (primer login crea auth.users).
--   - Sign in con Microsoft/Azure OAuth (mismo caso).
--   - Magic link (también crea auth.users la primera vez).
--
-- Lee metadatos del provider:
--   - raw_user_meta_data->>'full_name' (Google manda 'name', Microsoft 'name')
--   - raw_user_meta_data->>'avatar_url' (Google manda 'picture', Microsoft tiene Graph)
--   - email
--
-- Idempotente: si ya existe profile con ese id, no hace nada (el trigger
-- usa ON CONFLICT). Eso permite re-correr la migration y permite que un
-- script de backfill llene perfiles antiguos sin chocar.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_full_name text;
    v_avatar_url text;
    v_email text;
begin
    v_email := new.email;

    -- Resolver full_name: probamos varios nombres de campo por provider
    v_full_name := coalesce(
        new.raw_user_meta_data->>'full_name',         -- usado por Supabase signUp con metadata
        new.raw_user_meta_data->>'name',              -- Google, Microsoft
        new.raw_user_meta_data->>'preferred_username',-- Microsoft fallback
        new.raw_user_meta_data->>'user_name',         -- algunos providers
        split_part(v_email, '@', 1)                   -- último fallback: parte antes del @
    );

    -- Resolver avatar_url
    v_avatar_url := coalesce(
        new.raw_user_meta_data->>'avatar_url',  -- Supabase normaliza algunos providers a esto
        new.raw_user_meta_data->>'picture',     -- Google
        new.raw_user_meta_data->>'photo'        -- algunos
    );

    insert into public.profiles (id, full_name, avatar_url, role)
    values (
        new.id,
        v_full_name,
        v_avatar_url,
        'client'  -- todos arrancan como client; pueden cambiar a 'worker' al editar perfil
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

-- Reemplazar trigger anterior si existía
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- =====================================================================
-- Permisos: la función SECURITY DEFINER ya bypassa RLS al insertar.
-- Pero el role anon necesita permiso explícito para que el trigger se
-- ejecute durante el flow de signUp anónimo (antes de tener JWT).
-- =====================================================================
grant usage on schema public to anon, authenticated;

-- =====================================================================
-- Backfill: por si hay rows en auth.users sin profile correspondiente
-- (ej. usuarios creados antes de esta migration). Idempotente.
-- =====================================================================
insert into public.profiles (id, full_name, avatar_url, role)
select
    u.id,
    coalesce(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        u.raw_user_meta_data->>'preferred_username',
        split_part(u.email, '@', 1)
    ) as full_name,
    coalesce(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
    ) as avatar_url,
    'client' as role
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- =====================================================================
-- INSTRUCCIONES:
-- 1. Correr este script en Supabase SQL Editor.
-- 2. Verificar que el trigger quedó:
--      select trigger_name, event_object_schema, event_object_table
--      from information_schema.triggers
--      where trigger_name = 'on_auth_user_created';
-- 3. Probar creando un usuario en Authentication > Users → debería
--    aparecer la fila correspondiente en public.profiles.
-- =====================================================================
