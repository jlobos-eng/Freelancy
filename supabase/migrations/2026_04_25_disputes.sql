-- Migration: Sistema de disputas y reportes
-- Permite a cualquiera de las dos partes (cliente o lancy) abrir una disputa.
-- Mientras una disputa esté 'open', el gig NO puede pasar a 'completed'.
-- Esto bloquea el pago automático del próximo bloque (Mercado Pago).

-- =====================================================================
-- 1) Tabla principal
-- =====================================================================
create table if not exists public.disputes (
    id uuid primary key default gen_random_uuid(),
    gig_id uuid not null references public.gigs(id) on delete cascade,
    -- Quién abre la disputa: cliente o lancy del gig
    opener_id uuid not null references public.profiles(id) on delete cascade,
    -- Contraparte cacheada para queries rápidas (no aplica triggers de update)
    respondent_id uuid references public.profiles(id) on delete set null,

    reason text not null check (reason in (
        'work_incomplete',     -- el lancy no terminó / quedó a medias
        'no_show',             -- el lancy no se presentó
        'misconduct',          -- mala conducta / acoso
        'damage',              -- daño a propiedad
        'overcharge',          -- cobró más de lo acordado
        'fraud',               -- estafa / engaño
        'other'                -- otro (descripción libre)
    )),
    description text,
    -- evidencia opcional: array de URLs (usar Storage de Supabase)
    evidence_urls text[] default array[]::text[],

    status text not null default 'open' check (status in (
        'open',                -- abierta, esperando intervención
        'under_review',        -- el equipo está revisando
        'resolved_for_opener', -- resuelta a favor del que abrió
        'resolved_for_respondent', -- resuelta en contra del que abrió
        'resolved_split',      -- pago dividido / acuerdo intermedio
        'withdrawn'            -- el opener retira la disputa
    )),
    resolution text,           -- texto explicativo del resolutor
    resolved_by uuid references public.profiles(id) on delete set null, -- admin que resolvió

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz,

    -- No permitimos múltiples disputas abiertas simultáneamente sobre el mismo gig
    -- (el constraint parcial se crea como índice único más abajo)
    constraint disputes_opener_in_gig check (true)
);

-- 2) Índices
create index if not exists idx_disputes_gig on public.disputes(gig_id);
create index if not exists idx_disputes_opener on public.disputes(opener_id);
create index if not exists idx_disputes_status on public.disputes(status);
-- Sólo una disputa abierta por gig
create unique index if not exists idx_disputes_one_open_per_gig
    on public.disputes(gig_id)
    where status in ('open', 'under_review');

-- 3) Trigger updated_at (reutiliza set_updated_at si ya existe)
do $$ begin
    if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
        create function public.set_updated_at() returns trigger as $f$
        begin new.updated_at := now(); return new; end;
        $f$ language plpgsql;
    end if;
end $$;

drop trigger if exists trg_disputes_updated_at on public.disputes;
create trigger trg_disputes_updated_at
    before update on public.disputes
    for each row execute function public.set_updated_at();

-- =====================================================================
-- 4) RLS — sólo los participantes del gig (cliente, lancy) ven sus disputas
-- =====================================================================
alter table public.disputes enable row level security;

drop policy if exists "disputes_select_participants" on public.disputes;
create policy "disputes_select_participants"
    on public.disputes for select
    to authenticated
    using (
        opener_id = auth.uid()
        or respondent_id = auth.uid()
        or exists (
            select 1 from public.gigs g
            where g.id = disputes.gig_id
              and (g.client_id = auth.uid() or g.worker_id = auth.uid())
        )
    );

-- Insert: sólo cliente o lancy del gig pueden abrir
drop policy if exists "disputes_insert_participants" on public.disputes;
create policy "disputes_insert_participants"
    on public.disputes for insert
    to authenticated
    with check (
        opener_id = auth.uid()
        and exists (
            select 1 from public.gigs g
            where g.id = disputes.gig_id
              and (g.client_id = auth.uid() or g.worker_id = auth.uid())
        )
    );

-- Update: el opener puede retirar (withdrawn). La resolución la hace un admin
-- (por ahora dejamos que el opener cambie a 'withdrawn'; admins se manejan
-- vía service role o vía la flag VITE_ADMIN_EMAIL en el frontend).
drop policy if exists "disputes_update_opener_withdraw" on public.disputes;
create policy "disputes_update_opener_withdraw"
    on public.disputes for update
    to authenticated
    using (opener_id = auth.uid())
    with check (opener_id = auth.uid());

-- =====================================================================
-- 5) Trigger CRÍTICO: bloquear cambio a 'completed' si hay disputa abierta
--    Esto es lo que protege el pago — incluso si el frontend lo intenta,
--    Postgres rechaza la transición.
-- =====================================================================
create or replace function public.block_completion_if_disputed()
returns trigger as $$
begin
    if new.status = 'completed' and old.status is distinct from 'completed' then
        if exists (
            select 1 from public.disputes
            where gig_id = new.id
              and status in ('open', 'under_review')
        ) then
            raise exception 'Cannot complete gig: there is an open dispute. Resolve it first.'
                using errcode = 'check_violation', hint = 'Resolve the dispute before approving payment.';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_block_completion_if_disputed on public.gigs;
create trigger trg_block_completion_if_disputed
    before update of status on public.gigs
    for each row execute function public.block_completion_if_disputed();

-- =====================================================================
-- 6) Trigger: cuando se abre una disputa → poblar respondent_id automáticamente
--    + crear notificaciones para la contraparte y para "admins"
-- =====================================================================
create or replace function public.on_dispute_open()
returns trigger as $$
declare
    v_client_id uuid;
    v_worker_id uuid;
    v_gig_title text;
    v_respondent_id uuid;
    v_opener_name text;
begin
    select g.client_id, g.worker_id, g.title
        into v_client_id, v_worker_id, v_gig_title
    from public.gigs g where g.id = new.gig_id;

    -- La contraparte es el otro participante del gig
    v_respondent_id := case
        when new.opener_id = v_client_id then v_worker_id
        when new.opener_id = v_worker_id then v_client_id
        else null
    end;

    new.respondent_id := v_respondent_id;

    -- Si la tabla notifications existe, crear notificación para la contraparte
    if v_respondent_id is not null and exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'notifications'
    ) then
        select full_name into v_opener_name
        from public.profiles where id = new.opener_id;

        insert into public.notifications (user_id, type, title, body, gig_id, actor_id)
        values (
            v_respondent_id,
            'gig_in_review',  -- reusamos un tipo existente; si quieres uno nuevo, agrégalo al check
            'Disputa abierta',
            coalesce(v_opener_name, 'La otra parte') || ' abrió una disputa en "' || coalesce(v_gig_title, 'tu gig') || '". El pago queda en pausa.',
            new.gig_id,
            new.opener_id
        );
    end if;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_on_dispute_open on public.disputes;
create trigger trg_on_dispute_open
    before insert on public.disputes
    for each row execute function public.on_dispute_open();

-- =====================================================================
-- 7) RPC open_dispute — alias amigable para abrir desde el frontend
-- =====================================================================
create or replace function public.open_dispute(
    p_gig_id uuid,
    p_reason text,
    p_description text default null,
    p_evidence_urls text[] default null
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_dispute_id uuid;
begin
    -- Validar que el caller sea participante
    if not exists (
        select 1 from public.gigs g
        where g.id = p_gig_id
          and (g.client_id = auth.uid() or g.worker_id = auth.uid())
    ) then
        raise exception 'Not a participant of this gig';
    end if;

    insert into public.disputes (gig_id, opener_id, reason, description, evidence_urls)
    values (p_gig_id, auth.uid(), p_reason, p_description, coalesce(p_evidence_urls, array[]::text[]))
    returning id into v_dispute_id;

    return v_dispute_id;
end;
$$;

grant execute on function public.open_dispute(uuid, text, text, text[]) to authenticated;

-- =====================================================================
-- 8) RPC withdraw_dispute — el opener retira su propia disputa
-- =====================================================================
create or replace function public.withdraw_dispute(p_dispute_id uuid)
returns void
language plpgsql
security definer
as $$
begin
    update public.disputes
    set status = 'withdrawn', resolved_at = now(), resolution = 'Withdrawn by opener'
    where id = p_dispute_id
      and opener_id = auth.uid()
      and status in ('open', 'under_review');

    if not found then
        raise exception 'Dispute not found, not owned, or already resolved';
    end if;
end;
$$;

grant execute on function public.withdraw_dispute(uuid) to authenticated;

-- =====================================================================
-- 9) View pública para badges en el dashboard: gig_id → tiene_disputa_abierta
--    El frontend puede unirse a esta view sin hacer N+1.
-- =====================================================================
create or replace view public.gigs_with_open_disputes as
select gig_id, count(*) as open_count, max(created_at) as latest_open_at
from public.disputes
where status in ('open', 'under_review')
group by gig_id;

grant select on public.gigs_with_open_disputes to authenticated;

-- =====================================================================
-- 10) Habilitar realtime para que los badges se actualicen sin refrescar
-- =====================================================================
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            execute 'alter publication supabase_realtime add table public.disputes';
        exception when duplicate_object then null;
        end;
    end if;
end $$;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Correr en Supabase SQL Editor.
-- 2. Probar abrir una disputa:
--      select open_dispute('<gig-uuid>', 'work_incomplete', 'No terminó');
-- 3. Probar el bloqueo:
--      update gigs set status = 'completed' where id = '<gig-uuid>';
--      → debe fallar con "Cannot complete gig: there is an open dispute"
-- 4. Retirar:
--      select withdraw_dispute('<dispute-uuid>');
-- =====================================================================
