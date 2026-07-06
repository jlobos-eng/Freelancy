-- Migration: Push notifications PWA — suscripciones + trigger send-push
--
-- Cómo funciona:
--   1. El usuario activa push desde la UI → el navegador entrega un PushSubscription
--      (endpoint, p256dh, auth keys).
--   2. El frontend llama upsert_push_subscription(...) para guardarlo.
--   3. Cuando una row se inserta en notifications, un trigger invoca la Edge Function
--      send-push vía pg_net (extension de Supabase para HTTP requests desde Postgres).
--   4. send-push lee las suscripciones del user_id y envía push web a cada endpoint.

-- =====================================================================
-- 1) Habilitar pg_net (Supabase lo trae preinstalado, sólo hay que activarlo)
-- =====================================================================
create extension if not exists pg_net with schema extensions;

-- =====================================================================
-- 2) Tabla principal
-- =====================================================================
create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,

    -- Datos del PushSubscription del browser
    endpoint text not null,           -- URL única por device/browser
    p256dh text not null,             -- pública del par ECDH
    auth text not null,               -- secreto del subscription (no es nuestro VAPID)

    -- Metadata útil
    user_agent text,
    last_used_at timestamptz default now(),
    created_at timestamptz not null default now(),

    -- Un endpoint es único globalmente (es la URL del push service del browser)
    constraint push_subscriptions_endpoint_unique unique (endpoint)
);

-- 3) Índices
create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

-- =====================================================================
-- 4) RLS — cada usuario sólo ve/modifica las suyas
-- =====================================================================
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_select_own" on public.push_subscriptions;
create policy "push_subs_select_own"
    on public.push_subscriptions for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
create policy "push_subs_insert_own"
    on public.push_subscriptions for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists "push_subs_delete_own" on public.push_subscriptions;
create policy "push_subs_delete_own"
    on public.push_subscriptions for delete
    to authenticated
    using (user_id = auth.uid());

-- =====================================================================
-- 5) RPC: upsert por endpoint (para el caso en que el browser regenera)
-- =====================================================================
create or replace function public.upsert_push_subscription(
    p_endpoint text,
    p_p256dh text,
    p_auth text,
    p_user_agent text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Must be authenticated';
    end if;

    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
    on conflict (endpoint) do update set
        user_id = auth.uid(),
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = coalesce(excluded.user_agent, public.push_subscriptions.user_agent),
        last_used_at = now()
    returning id into v_id;

    return v_id;
end;
$$;

grant execute on function public.upsert_push_subscription(text, text, text, text) to authenticated;

-- =====================================================================
-- 6) RPC: borrar mi suscripción por endpoint (cuando el usuario apaga push)
-- =====================================================================
create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
as $$
begin
    delete from public.push_subscriptions
    where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

grant execute on function public.delete_push_subscription(text) to authenticated;

-- =====================================================================
-- 7) Trigger: cuando se inserta una notification → llamar Edge Function send-push
--    Usamos pg_net.http_post (asíncrono, no bloquea el insert).
--    El secret SUPABASE_SERVICE_ROLE_KEY se inyecta como variable de Postgres.
--
-- IMPORTANTE: este trigger sólo va a funcionar si seteas el secret apropiado.
-- Si no, falla silenciosamente y la notification igual se persiste.
-- =====================================================================
create or replace function public.notify_send_push()
returns trigger
language plpgsql
security definer
as $$
declare
    v_url text;
    v_service_key text;
    v_payload jsonb;
begin
    -- Estos valores los debes setear en Supabase con:
    --   alter database postgres set app.settings.supabase_url = 'https://<ref>.supabase.co';
    --   alter database postgres set app.settings.service_role_key = 'eyJ...';
    -- O directamente como settings de pg_net.
    v_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);

    if v_url is null or v_service_key is null then
        -- Sin config, salimos en silencio (no bloqueamos la inserción)
        return new;
    end if;

    v_payload := jsonb_build_object('notification_id', new.id);

    perform net.http_post(
        url := v_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
        ),
        body := v_payload
    );

    return new;
exception when others then
    -- Nunca falla el insert por un problema con push
    raise warning '[notify_send_push] error: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_notify_send_push on public.notifications;
create trigger trg_notify_send_push
    after insert on public.notifications
    for each row execute function public.notify_send_push();

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Correr este SQL.
-- 2. Setear los settings de Postgres (una sola vez):
--      alter database postgres set app.settings.supabase_url = 'https://<TU-PROJECT>.supabase.co';
--      alter database postgres set app.settings.service_role_key = '<TU-SERVICE-ROLE-KEY>';
--    (Reemplaza los valores. Estos se persisten entre reinicios.)
-- 3. Generar VAPID keys (M4.3):
--      npx web-push generate-vapid-keys
--    Te da publicKey + privateKey. La pública va al frontend (.env), la privada
--    va a Supabase Edge Functions secrets.
-- 4. Setear secrets en Supabase Edge Functions:
--      VAPID_PUBLIC_KEY  = <publicKey>
--      VAPID_PRIVATE_KEY = <privateKey>
--      VAPID_SUBJECT     = mailto:<tu-email>
-- 5. Deployar la función send-push (M4.3).
-- 6. Activar push desde la UI.
-- =====================================================================
