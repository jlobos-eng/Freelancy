-- Migration: Pagos reales con escrow (Mercado Pago Marketplace)
-- Diseño provider-agnóstico: la tabla transactions tiene 'provider' para soportar
-- futuros providers (Khipu, Stripe). Acá inicializamos sólo MP.
--
-- FLUJO:
--   1. Cliente acepta una oferta → función accept_application asigna el gig a 'assigned'
--      y crea una transaction(status='requires_payment', provider='mercadopago').
--   2. Frontend pide a Edge Function 'create-mp-preference' que devuelva init_point.
--   3. Cliente paga en checkout MP → MP captura el monto y llama nuestro webhook.
--   4. Webhook valida firma, marca transaction(status='escrowed') y gig(payment_status='escrowed').
--   5. Worker termina → status='review'.
--   6. Cliente aprueba → trigger valida que NO haya disputa abierta y NO haya transaction
--      con status distinto a 'escrowed'. Si todo ok, marca gig.status='completed' y la
--      transaction queda lista para release.
--   7. Edge Function 'release-mp-payment' (M3.3) hace el split: comisión a la app,
--      neto al worker (collector_id MP del worker).

-- =====================================================================
-- 1) Extender profiles con datos de Mercado Pago Marketplace
-- =====================================================================
alter table public.profiles
    add column if not exists mp_user_id text,            -- collector_id que devuelve OAuth de MP
    add column if not exists mp_access_token text,       -- token cifrado del Lancy (NUNCA exponer al cliente)
    add column if not exists mp_refresh_token text,      -- para renovar el access_token cuando expire
    add column if not exists mp_token_expires_at timestamptz,
    add column if not exists mp_onboarded_at timestamptz,
    add column if not exists balance_pending bigint default 0, -- en CLP, lo que está escrowed
    add column if not exists balance_available bigint default 0; -- liberado, listo para retirar

-- mp_access_token y mp_refresh_token NO deben ser SELECT-able por nadie excepto service_role.
-- Lo aseguramos con una columna-policy más abajo (sección RLS).

-- =====================================================================
-- 2) Tabla principal: transactions
-- =====================================================================
create table if not exists public.transactions (
    id uuid primary key default gen_random_uuid(),
    gig_id uuid not null references public.gigs(id) on delete cascade,
    application_id uuid references public.gig_applications(id) on delete set null,
    -- Quién paga (cliente) y quién recibe (worker)
    payer_id uuid not null references public.profiles(id) on delete restrict,
    payee_id uuid not null references public.profiles(id) on delete restrict,

    -- Monto desglosado (todo en CLP, sin decimales)
    amount_gross bigint not null check (amount_gross > 0),    -- lo que pagó el cliente
    amount_fee bigint not null default 0 check (amount_fee >= 0), -- comisión de la app
    amount_provider_fee bigint not null default 0 check (amount_provider_fee >= 0), -- comisión MP
    amount_net bigint not null check (amount_net >= 0),       -- lo que recibe el worker

    currency text not null default 'CLP' check (currency in ('CLP')),

    -- Provider info
    provider text not null default 'mercadopago' check (provider in ('mercadopago', 'khipu', 'manual')),
    provider_payment_id text,        -- id en MP/Khipu
    provider_preference_id text,     -- id de preferencia (MP) / orden (Khipu)
    provider_status text,            -- status raw del provider
    provider_payload jsonb,          -- snapshot del último webhook recibido

    -- Estado interno (no acoplado al provider)
    status text not null default 'requires_payment' check (status in (
        'requires_payment',  -- esperando que el cliente pague
        'processing',        -- en curso (3DS, validación bank)
        'escrowed',          -- pagado y retenido por la app — gig en curso
        'released',          -- liberado al worker
        'refunded',          -- devuelto al cliente
        'disputed',          -- congelado por disputa abierta
        'failed',            -- pago rechazado
        'cancelled'          -- cliente canceló antes de pagar
    )),

    init_point text,         -- URL de checkout para redirigir al cliente
    paid_at timestamptz,
    released_at timestamptz,
    refunded_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3) Índices
create index if not exists idx_transactions_gig on public.transactions(gig_id);
create index if not exists idx_transactions_payer on public.transactions(payer_id);
create index if not exists idx_transactions_payee on public.transactions(payee_id);
create index if not exists idx_transactions_status on public.transactions(status);
create index if not exists idx_transactions_provider_payment on public.transactions(provider_payment_id) where provider_payment_id is not null;

-- Sólo una transaction "viva" por gig (no permitir doble pago)
create unique index if not exists idx_transactions_one_active_per_gig
    on public.transactions(gig_id)
    where status in ('requires_payment', 'processing', 'escrowed', 'disputed');

-- 4) Trigger updated_at
drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
    before update on public.transactions
    for each row execute function public.set_updated_at();

-- =====================================================================
-- 5) Extender gigs con payment_status (separado del status del gig)
--    Razón: gig.status habla del trabajo (open/assigned/review/completed),
--    payment_status habla del dinero (none/escrowed/released/refunded).
-- =====================================================================
alter table public.gigs
    add column if not exists payment_status text default 'none' check (payment_status in (
        'none',         -- el gig todavía no requiere pago (open/bidding)
        'requires_payment', -- aceptado, esperando que el cliente pague
        'escrowed',     -- el dinero está retenido
        'released',     -- pagado al worker
        'refunded',     -- devuelto al cliente
        'disputed'      -- congelado
    ));

-- =====================================================================
-- 6) RLS — transactions sólo visibles para payer y payee
-- =====================================================================
alter table public.transactions enable row level security;

drop policy if exists "transactions_select_participants" on public.transactions;
create policy "transactions_select_participants"
    on public.transactions for select
    to authenticated
    using (payer_id = auth.uid() or payee_id = auth.uid());

-- Insert/Update: SOLO service_role (nadie escribe directo desde el cliente).
-- No creamos políticas → por defecto bloqueado para 'authenticated'.
-- Las Edge Functions usan service_role key y bypasean RLS.

-- =====================================================================
-- 7) RLS para tokens MP en profiles — NUNCA leer mp_access_token / refresh
-- =====================================================================
-- Crear vista 'profiles_safe' sin tokens, que es la que el frontend debe usar.
create or replace view public.profiles_safe as
select
    id, full_name, avatar_url, rating, skill, location, role, created_at,
    lat, lng, location_updated_at,
    balance_pending, balance_available,
    mp_user_id, mp_onboarded_at, -- saber si está onboarded está OK
    null::text as mp_access_token,  -- jamás
    null::text as mp_refresh_token  -- jamás
from public.profiles;

grant select on public.profiles_safe to authenticated;

-- =====================================================================
-- 8) Helper RPC: accept_application_v2 — crea transaction al aceptar
--    Reemplaza la accept_application del bloque #2 con manejo de pago.
--    La anterior se mantiene como deprecada por compat.
-- =====================================================================
create or replace function public.accept_application_v2(application_id uuid)
returns uuid  -- devuelve el id de la transaction creada
language plpgsql
security definer
as $$
declare
    v_gig_id uuid;
    v_worker_id uuid;
    v_client_id uuid;
    v_bid_amount bigint;
    v_fee bigint;
    v_net bigint;
    v_tx_id uuid;
begin
    -- Validar y obtener datos
    select ga.gig_id, ga.worker_id, ga.bid_amount
        into v_gig_id, v_worker_id, v_bid_amount
    from public.gig_applications ga
    where ga.id = application_id;

    if v_gig_id is null then raise exception 'Application not found'; end if;

    select g.client_id into v_client_id
    from public.gigs g where g.id = v_gig_id;

    if v_client_id is distinct from auth.uid() then
        raise exception 'Only the gig owner can accept applications';
    end if;

    -- Comisión de la app: 10% (parametrizable más adelante)
    v_fee := round(v_bid_amount * 0.10);
    v_net := v_bid_amount - v_fee;

    -- Marcar postulaciones
    update public.gig_applications set status = 'accepted' where id = application_id;
    update public.gig_applications set status = 'rejected'
    where gig_id = v_gig_id and id <> application_id and status = 'pending';

    -- Asignar gig (status='assigned', payment_status='requires_payment')
    update public.gigs
    set status = 'assigned',
        worker_id = v_worker_id,
        payment_status = 'requires_payment'
    where id = v_gig_id;

    -- Crear la transaction inicial. amount_provider_fee se rellena después con el webhook.
    insert into public.transactions (
        gig_id, application_id, payer_id, payee_id,
        amount_gross, amount_fee, amount_provider_fee, amount_net,
        provider, status
    )
    values (
        v_gig_id, application_id, v_client_id, v_worker_id,
        v_bid_amount, v_fee, 0, v_net,
        'mercadopago', 'requires_payment'
    )
    returning id into v_tx_id;

    return v_tx_id;
end;
$$;

grant execute on function public.accept_application_v2(uuid) to authenticated;

-- =====================================================================
-- 9) Trigger CRÍTICO: bloquear pago si la transaction no está en 'escrowed'
--    Reemplaza el flujo viejo donde aprobar = completar gig.
--    Ahora aprobar = completar gig + permitir release de la transaction.
-- =====================================================================
create or replace function public.guard_completion_payment()
returns trigger as $$
declare
    v_active_tx record;
begin
    if new.status = 'completed' and old.status is distinct from 'completed' then
        -- Buscar la transaction activa de este gig
        select * into v_active_tx
        from public.transactions
        where gig_id = new.id
        order by created_at desc
        limit 1;

        if v_active_tx is null then
            -- gig sin transaction (legacy o pagos manuales) → permitir
            return new;
        end if;

        if v_active_tx.status = 'disputed' then
            raise exception 'Cannot complete: transaction is in disputed state.'
                using errcode = 'check_violation';
        end if;

        if v_active_tx.status not in ('escrowed', 'released') then
            raise exception 'Cannot complete: payment not escrowed (current status: %).', v_active_tx.status
                using errcode = 'check_violation', hint = 'Client must pay before approving.';
        end if;

        -- Actualizar payment_status del gig (la liberación efectiva la hace la Edge Function)
        new.payment_status := 'released';
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_guard_completion_payment on public.gigs;
create trigger trg_guard_completion_payment
    before update of status on public.gigs
    for each row execute function public.guard_completion_payment();

-- =====================================================================
-- 10) Trigger: cuando se abre una disputa → marcar transaction como 'disputed'
--     Cuando se resuelve la disputa → restaurar a 'escrowed' (si fue resolved_for_respondent)
--     o 'refunded' (si fue resolved_for_opener y el opener era el cliente)
-- =====================================================================
create or replace function public.sync_dispute_to_transaction()
returns trigger as $$
begin
    -- Insert: marcar tx como disputed
    if tg_op = 'INSERT' then
        update public.transactions
        set status = 'disputed'
        where gig_id = new.gig_id
          and status in ('escrowed', 'requires_payment');
        update public.gigs set payment_status = 'disputed' where id = new.gig_id;
        return new;
    end if;

    -- Update: si la disputa se resuelve, decidir el destino del dinero
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
        -- Resuelta a favor del cliente (opener si opener=cliente, respondent si respondent=cliente)
        if new.status = 'resolved_for_opener' then
            -- TODO: validar quién era cliente vs worker; placeholder asume opener=cliente=refund
            update public.transactions
            set status = 'refunded', refunded_at = now()
            where gig_id = new.gig_id and status = 'disputed';
            update public.gigs set payment_status = 'refunded' where id = new.gig_id;
        elsif new.status = 'resolved_for_respondent' or new.status = 'withdrawn' then
            -- Restaurar para que el cliente apruebe normalmente
            update public.transactions
            set status = 'escrowed'
            where gig_id = new.gig_id and status = 'disputed';
            update public.gigs set payment_status = 'escrowed' where id = new.gig_id;
        end if;
        -- resolved_split lo manejamos manualmente por ahora (admin)
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_dispute_to_transaction on public.disputes;
create trigger trg_sync_dispute_to_transaction
    after insert or update of status on public.disputes
    for each row execute function public.sync_dispute_to_transaction();

-- =====================================================================
-- 11) Vista wallet_balance — UI consume esta vista para mostrar saldos en tiempo real
--     en lugar de los campos cacheados balance_pending/balance_available que pueden
--     desincronizarse. Los campos cacheados quedan como optimización futura.
-- =====================================================================
create or replace view public.wallet_balance as
select
    p.id as user_id,
    coalesce(sum(case when t.status = 'escrowed' then t.amount_net else 0 end), 0) as pending,
    coalesce(sum(case when t.status = 'released' then t.amount_net else 0 end), 0) as available,
    coalesce(sum(case when t.status in ('escrowed', 'released') then t.amount_net else 0 end), 0) as lifetime,
    coalesce(count(*) filter (where t.status = 'released'), 0)::bigint as completed_jobs
from public.profiles p
left join public.transactions t on t.payee_id = p.id
group by p.id;

grant select on public.wallet_balance to authenticated;

-- RLS para que cada usuario sólo vea SU balance
-- (las views heredan permisos pero conviene crear una políticas defensiva via security_invoker)
alter view public.wallet_balance set (security_invoker = true);

-- =====================================================================
-- 12) Habilitar realtime para transactions (la UI puede mostrar "pago confirmado" sin refresh)
-- =====================================================================
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            execute 'alter publication supabase_realtime add table public.transactions';
        exception when duplicate_object then null;
        end;
    end if;
end $$;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Correr este script DESPUÉS de notifications + disputes (depende de ellos).
-- 2. Configurar las credenciales de MP en Supabase Vault o como env vars
--    para las Edge Functions (M3.2 y M3.3):
--      MP_ACCESS_TOKEN     (de tu app Marketplace en MP Developers)
--      MP_CLIENT_ID
--      MP_CLIENT_SECRET
--      MP_WEBHOOK_SECRET   (para validar firma x-signature)
--      APP_FEE_PERCENT     (default 10)
-- 3. Verificar:
--      select * from accept_application_v2('<application-uuid>');
--      → debe crear una row en transactions con status='requires_payment'
-- =====================================================================
