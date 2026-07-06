-- Migration: Retiros a banco (modo simulado, listo para conectar a banco real)
--
-- DISEÑO:
--   - bank_accounts: cuentas bancarias chilenas que el usuario registra para retirar.
--     Validamos formato RUT, banco contra lista chilena, tipo de cuenta. Una cuenta
--     "primary" por usuario (la default al pedir un retiro).
--   - withdrawals: solicitudes de retiro. Status: requested → processing → paid | failed.
--     El RPC request_withdrawal valida atómicamente que haya saldo y descuenta.
--
-- FLUJO ACTUAL (simulado):
--   1. Worker registra una cuenta bancaria desde la UI.
--   2. Worker presiona "Transferir a mi banco", elige monto y cuenta.
--   3. UI llama RPC request_withdrawal(amount, bank_account_id) → crea row 'requested'
--      y reduce el available (porque la vista wallet_balance ahora descuenta retiros).
--   4. Job/admin/Edge Function llama simulate_process_withdrawal(withdrawal_id) que
--      pasa el status a 'paid' (o 'failed' si se quiere probar el rollback).
--   5. El día que conectemos MP Payouts / Banco real: en vez de simulate_process_withdrawal
--      hacemos un POST a la API real, y al recibir confirmación marcamos 'paid'.
--      El frontend NO cambia.
--
-- DEPENDE DE: 2026_04_25_payments_marketplace.sql (transactions, wallet_balance, set_updated_at)

-- =====================================================================
-- 1) Catálogo de bancos chilenos (estable, raramente cambia)
--    Lo dejamos en una tabla en vez de un check para poder agregar metadata
--    (logos, swift code) sin migrar.
-- =====================================================================
create table if not exists public.cl_banks (
    code text primary key,            -- codigo SBIF/CMF
    name text not null,
    short_name text,
    is_active boolean not null default true
);

insert into public.cl_banks (code, name, short_name) values
    ('001', 'Banco de Chile', 'BCH'),
    ('009', 'Banco Internacional', 'BINT'),
    ('012', 'Banco del Estado de Chile', 'BancoEstado'),
    ('014', 'Scotiabank Chile', 'Scotiabank'),
    ('016', 'Banco de Crédito e Inversiones', 'BCI'),
    ('027', 'Corpbanca / Itaú', 'Itaú'),
    ('028', 'Banco Bice', 'BICE'),
    ('031', 'HSBC Bank Chile', 'HSBC'),
    ('037', 'Banco Santander Chile', 'Santander'),
    ('039', 'Banco Itaú Chile', 'Itaú'),
    ('049', 'Banco Security', 'Security'),
    ('051', 'Banco Falabella', 'Falabella'),
    ('053', 'Banco Ripley', 'Ripley'),
    ('055', 'Banco Consorcio', 'Consorcio'),
    ('504', 'Banco Bilbao Vizcaya Argentaria, Chile (BBVA)', 'BBVA'),
    ('672', 'Coopeuch', 'Coopeuch'),
    ('999', 'Mercado Pago (cuenta digital)', 'MercadoPago'),
    ('730', 'Tenpo', 'Tenpo'),
    ('729', 'MACH', 'MACH')
on conflict (code) do nothing;

grant select on public.cl_banks to authenticated;

-- =====================================================================
-- 2) Validador de RUT chileno (módulo 11)
--    Acepta formato '12345678-9' o '12345678-K', devuelve true/false.
-- =====================================================================
create or replace function public.is_valid_rut(rut text)
returns boolean
language plpgsql
immutable
as $$
declare
    v_clean text;
    v_body text;
    v_dv text;
    v_calc_dv text;
    v_sum int := 0;
    v_factor int := 2;
    v_digit int;
    v_remainder int;
begin
    if rut is null then return false; end if;
    -- Sacar puntos, espacios, mayúsculas
    v_clean := upper(regexp_replace(rut, '[^0-9K]', '', 'g'));
    if length(v_clean) < 2 then return false; end if;
    v_body := substring(v_clean from 1 for length(v_clean) - 1);
    v_dv := substring(v_clean from length(v_clean));

    if v_body !~ '^[0-9]+$' then return false; end if;

    -- Algoritmo módulo 11
    for i in reverse length(v_body)..1 loop
        v_digit := (substring(v_body from i for 1))::int;
        v_sum := v_sum + v_digit * v_factor;
        v_factor := v_factor + 1;
        if v_factor > 7 then v_factor := 2; end if;
    end loop;

    v_remainder := 11 - (v_sum % 11);
    if v_remainder = 11 then v_calc_dv := '0';
    elsif v_remainder = 10 then v_calc_dv := 'K';
    else v_calc_dv := v_remainder::text;
    end if;

    return v_dv = v_calc_dv;
end;
$$;

grant execute on function public.is_valid_rut(text) to authenticated;

-- =====================================================================
-- 3) Tabla bank_accounts
-- =====================================================================
create table if not exists public.bank_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,

    -- Datos del titular (puede ser distinto del user, ej. cuenta de un familiar)
    holder_name text not null check (length(trim(holder_name)) >= 3),
    holder_rut text not null check (public.is_valid_rut(holder_rut)),

    -- Datos del banco
    bank_code text not null references public.cl_banks(code),
    account_type text not null check (account_type in (
        'corriente',     -- cuenta corriente
        'vista',         -- cuenta vista / chequera electrónica
        'ahorro',        -- cuenta de ahorro
        'rut',           -- CuentaRUT BancoEstado
        'digital'        -- billetera digital (MP, Tenpo, MACH)
    )),
    account_number text not null check (length(trim(account_number)) >= 4),

    -- Email para notificación de transferencia (Chile lo pide casi siempre)
    contact_email text,

    -- Una sola cuenta primary por user
    is_primary boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists idx_bank_accounts_one_primary
    on public.bank_accounts(user_id) where is_primary = true;

create index if not exists idx_bank_accounts_user on public.bank_accounts(user_id);

drop trigger if exists trg_bank_accounts_updated_at on public.bank_accounts;
create trigger trg_bank_accounts_updated_at
    before update on public.bank_accounts
    for each row execute function public.set_updated_at();

-- RLS: cada uno ve y modifica sólo lo suyo
alter table public.bank_accounts enable row level security;

drop policy if exists "bank_accounts_select_own" on public.bank_accounts;
create policy "bank_accounts_select_own" on public.bank_accounts for select
    to authenticated using (user_id = auth.uid());

drop policy if exists "bank_accounts_insert_own" on public.bank_accounts;
create policy "bank_accounts_insert_own" on public.bank_accounts for insert
    to authenticated with check (user_id = auth.uid());

drop policy if exists "bank_accounts_update_own" on public.bank_accounts;
create policy "bank_accounts_update_own" on public.bank_accounts for update
    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "bank_accounts_delete_own" on public.bank_accounts;
create policy "bank_accounts_delete_own" on public.bank_accounts for delete
    to authenticated using (user_id = auth.uid());

-- Trigger: si insertan/actualizan con is_primary=true, des-marcar las demás
create or replace function public.enforce_single_primary_bank_account()
returns trigger language plpgsql as $$
begin
    if new.is_primary = true then
        update public.bank_accounts
        set is_primary = false
        where user_id = new.user_id and id <> new.id and is_primary = true;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_enforce_single_primary on public.bank_accounts;
create trigger trg_enforce_single_primary
    after insert or update of is_primary on public.bank_accounts
    for each row when (new.is_primary = true)
    execute function public.enforce_single_primary_bank_account();

-- =====================================================================
-- 4) Tabla withdrawals
-- =====================================================================
create table if not exists public.withdrawals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete restrict,
    bank_account_id uuid not null references public.bank_accounts(id) on delete restrict,

    amount bigint not null check (amount > 0),     -- CLP solicitado por el user
    fee bigint not null default 0 check (fee >= 0), -- comisión de retiro (banco / MP). Por ahora 0.
    amount_net bigint not null check (amount_net > 0), -- amount - fee, lo que llega a la cuenta

    currency text not null default 'CLP' check (currency in ('CLP')),

    status text not null default 'requested' check (status in (
        'requested',   -- recién creado, pendiente de procesar
        'processing',  -- enviado al banco/MP, esperando confirmación
        'paid',        -- transferido exitosamente
        'failed',      -- rechazado, plata vuelve al available
        'cancelled'    -- usuario canceló antes de procesar
    )),

    -- Snapshot de los datos bancarios al momento del retiro (audit trail).
    -- Si el user borra después la cuenta, queremos saber a dónde se mandó.
    snapshot jsonb not null,

    -- Metadata del provider que ejecutó (si aplica)
    provider text check (provider in ('mercadopago', 'manual', 'simulated')),
    provider_payout_id text,
    provider_payload jsonb,

    failure_reason text,
    requested_at timestamptz not null default now(),
    processed_at timestamptz,
    paid_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_withdrawals_user on public.withdrawals(user_id);
create index if not exists idx_withdrawals_status on public.withdrawals(status);
create index if not exists idx_withdrawals_bank_account on public.withdrawals(bank_account_id);

drop trigger if exists trg_withdrawals_updated_at on public.withdrawals;
create trigger trg_withdrawals_updated_at
    before update on public.withdrawals
    for each row execute function public.set_updated_at();

-- RLS: el dueño puede ver sus retiros. Insert/update sólo via RPC (service_role).
alter table public.withdrawals enable row level security;

drop policy if exists "withdrawals_select_own" on public.withdrawals;
create policy "withdrawals_select_own" on public.withdrawals for select
    to authenticated using (user_id = auth.uid());

-- =====================================================================
-- 5) Vista wallet_balance v2 — ahora descuenta retiros del available
--    Reemplaza la versión de la migración anterior. Mismo nombre, mismas
--    columnas → el frontend no cambia.
--
--    available = liberado - (retirado o en proceso de retiro)
-- =====================================================================
create or replace view public.wallet_balance as
select
    p.id as user_id,
    -- pending: plata que está en escrow (todavía no liberada)
    coalesce(sum(case when t.status = 'escrowed' then t.amount_net else 0 end), 0) as pending,
    -- available: liberado al worker MENOS lo retirado (o en vuelo)
    coalesce(sum(case when t.status = 'released' then t.amount_net else 0 end), 0)
        - coalesce((
            select sum(w.amount)
            from public.withdrawals w
            where w.user_id = p.id
              and w.status in ('requested', 'processing', 'paid')
        ), 0) as available,
    -- lifetime: todo lo ganado histórico (escrow + released, sin restar retiros)
    coalesce(sum(case when t.status in ('escrowed', 'released') then t.amount_net else 0 end), 0) as lifetime,
    coalesce(count(*) filter (where t.status = 'released'), 0)::bigint as completed_jobs,
    -- nuevos campos: total retirado y retiros en curso (útil para UI)
    coalesce((
        select sum(w.amount) from public.withdrawals w
        where w.user_id = p.id and w.status = 'paid'
    ), 0) as total_withdrawn,
    coalesce((
        select sum(w.amount) from public.withdrawals w
        where w.user_id = p.id and w.status in ('requested', 'processing')
    ), 0) as withdrawals_in_flight
from public.profiles p
left join public.transactions t on t.payee_id = p.id
group by p.id;

grant select on public.wallet_balance to authenticated;
alter view public.wallet_balance set (security_invoker = true);

-- =====================================================================
-- 6) RPC request_withdrawal — el único punto de entrada del frontend
--    Valida atómicamente saldo + cuenta + monto mínimo y crea la row.
-- =====================================================================
create or replace function public.request_withdrawal(
    p_amount bigint,
    p_bank_account_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_user_id uuid := auth.uid();
    v_min_amount bigint := 1000;   -- $1.000 mínimo (parametrizable)
    v_max_amount bigint := 5000000; -- $5MM máximo por retiro
    v_fee bigint := 0;             -- por ahora gratis. Cuando conectemos banco real sube.
    v_available bigint;
    v_account record;
    v_bank record;
    v_withdrawal_id uuid;
    v_snapshot jsonb;
begin
    if v_user_id is null then
        raise exception 'Not authenticated' using errcode = '42501';
    end if;

    -- Validar monto
    if p_amount is null or p_amount < v_min_amount then
        raise exception 'El monto mínimo de retiro es $%.', v_min_amount
            using errcode = 'check_violation';
    end if;
    if p_amount > v_max_amount then
        raise exception 'El monto máximo por retiro es $%.', v_max_amount
            using errcode = 'check_violation';
    end if;

    -- Validar cuenta bancaria pertenece al user
    select * into v_account
    from public.bank_accounts
    where id = p_bank_account_id and user_id = v_user_id;

    if v_account is null then
        raise exception 'Cuenta bancaria no encontrada o no pertenece al usuario.'
            using errcode = '42501';
    end if;

    select * into v_bank from public.cl_banks where code = v_account.bank_code;

    -- Validar saldo disponible (lectura desde la vista para incluir retiros en vuelo)
    select available into v_available
    from public.wallet_balance where user_id = v_user_id;

    if v_available is null or v_available < p_amount then
        raise exception 'Saldo insuficiente. Disponible: $%, solicitado: $%.', coalesce(v_available, 0), p_amount
            using errcode = 'check_violation';
    end if;

    -- Snapshot de la cuenta para audit
    v_snapshot := jsonb_build_object(
        'holder_name', v_account.holder_name,
        'holder_rut', v_account.holder_rut,
        'bank_code', v_account.bank_code,
        'bank_name', v_bank.name,
        'account_type', v_account.account_type,
        'account_number', v_account.account_number,
        'contact_email', v_account.contact_email
    );

    insert into public.withdrawals (
        user_id, bank_account_id, amount, fee, amount_net,
        status, provider, snapshot
    ) values (
        v_user_id, p_bank_account_id, p_amount, v_fee, p_amount - v_fee,
        'requested', 'simulated', v_snapshot
    )
    returning id into v_withdrawal_id;

    return v_withdrawal_id;
end;
$$;

grant execute on function public.request_withdrawal(bigint, uuid) to authenticated;

-- =====================================================================
-- 7) RPC simulate_process_withdrawal — sólo para dev/demo
--    Mueve un retiro 'requested' a 'paid' (o 'failed' si force_fail=true).
--    El día que conectemos banco real, esta función se reemplaza por una
--    Edge Function que hace POST a la API correspondiente.
-- =====================================================================
create or replace function public.simulate_process_withdrawal(
    p_withdrawal_id uuid,
    p_force_fail boolean default false
)
returns text
language plpgsql
security definer
as $$
declare
    v_w record;
begin
    -- Sólo el dueño puede simular sobre sus propios retiros (en dev).
    select * into v_w from public.withdrawals
    where id = p_withdrawal_id and user_id = auth.uid();

    if v_w is null then
        raise exception 'Retiro no encontrado.';
    end if;

    if v_w.status not in ('requested', 'processing') then
        raise exception 'Sólo se pueden procesar retiros en estado requested/processing (actual: %).', v_w.status;
    end if;

    if p_force_fail then
        update public.withdrawals
        set status = 'failed',
            failure_reason = 'Simulación: rechazado por el banco',
            processed_at = coalesce(processed_at, now())
        where id = p_withdrawal_id;
        return 'failed';
    end if;

    update public.withdrawals
    set status = 'paid',
        processed_at = coalesce(processed_at, now()),
        paid_at = now(),
        provider_payout_id = 'sim_' || substr(md5(random()::text), 1, 12)
    where id = p_withdrawal_id;
    return 'paid';
end;
$$;

grant execute on function public.simulate_process_withdrawal(uuid, boolean) to authenticated;

-- =====================================================================
-- 8) RPC cancel_withdrawal — el user puede cancelar un retiro 'requested'
--    (no 'processing', porque ahí ya está enviado al banco).
-- =====================================================================
create or replace function public.cancel_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
as $$
declare v_w record;
begin
    select * into v_w from public.withdrawals
    where id = p_withdrawal_id and user_id = auth.uid();

    if v_w is null then raise exception 'Retiro no encontrado.'; end if;
    if v_w.status <> 'requested' then
        raise exception 'Sólo se pueden cancelar retiros en estado requested (actual: %).', v_w.status;
    end if;

    update public.withdrawals
    set status = 'cancelled', processed_at = now()
    where id = p_withdrawal_id;
end;
$$;

grant execute on function public.cancel_withdrawal(uuid) to authenticated;

-- =====================================================================
-- 9) Realtime para withdrawals
-- =====================================================================
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            execute 'alter publication supabase_realtime add table public.withdrawals';
        exception when duplicate_object then null;
        end;
    end if;
end $$;

-- FIN
