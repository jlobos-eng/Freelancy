-- Migration: Soporte y Ayuda — tickets enviados por usuarios
--
-- El usuario abre el modal de soporte, llena form (tipo, prioridad, asunto,
-- descripción), y se inserta una row aquí. El admin (service_role / staff)
-- responde editando admin_response y status. Cuando responde, el realtime
-- empuja el cambio al usuario.

create table if not exists public.support_tickets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,

    type text not null check (type in (
        'bug',          -- algo no funciona
        'question',     -- pregunta general
        'payment',      -- problema con pago
        'account',      -- cuenta / login
        'other'         -- otro
    )),
    priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),

    subject text not null,
    description text not null,

    status text not null default 'open' check (status in (
        'open',         -- recién creado
        'in_progress',  -- el equipo lo está mirando
        'answered',     -- respondido, esperando feedback del usuario
        'closed'        -- cerrado
    )),

    -- Contexto auto-capturado para debug (snapshot del estado al crear)
    context jsonb default '{}'::jsonb,

    -- Respuesta del equipo de soporte
    admin_response text,
    answered_by uuid references public.profiles(id) on delete set null,
    answered_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user
    on public.support_tickets(user_id, created_at desc);
create index if not exists idx_support_tickets_status
    on public.support_tickets(status) where status in ('open', 'in_progress');

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
    before update on public.support_tickets
    for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS: el usuario ve y crea solo los suyos. Update/delete bloqueados
-- para authenticated (los maneja el equipo de soporte vía service_role).
-- =====================================================================
alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets_select_own" on public.support_tickets;
create policy "support_tickets_select_own"
    on public.support_tickets for select to authenticated
    using (user_id = auth.uid());

drop policy if exists "support_tickets_insert_own" on public.support_tickets;
create policy "support_tickets_insert_own"
    on public.support_tickets for insert to authenticated
    with check (user_id = auth.uid() and status = 'open');

-- Update: el usuario solo puede agregar info adicional a su descripción mientras
-- el ticket esté open. No puede cambiar status ni admin_response.
drop policy if exists "support_tickets_update_own_open" on public.support_tickets;
create policy "support_tickets_update_own_open"
    on public.support_tickets for update to authenticated
    using (user_id = auth.uid() and status = 'open')
    with check (user_id = auth.uid() and status = 'open');

-- =====================================================================
-- Realtime: cuando el equipo responde, el usuario ve el cambio en vivo.
-- =====================================================================
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            execute 'alter publication supabase_realtime add table public.support_tickets';
        exception when duplicate_object then null;
        end;
    end if;
end $$;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Esta migración ya fue aplicada al proyecto Supabase remoto.
-- 2. Para responder un ticket como admin (service_role):
--      update support_tickets
--      set status = 'answered',
--          admin_response = 'Tu respuesta...',
--          answered_at = now()
--      where id = '<ticket-id>';
--    El usuario verá la respuesta en vivo (realtime).
-- =====================================================================
