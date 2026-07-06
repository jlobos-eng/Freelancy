-- Migration: notifications + triggers de creación automática
-- Tabla de notificaciones in-app para cada usuario.
-- Triggers automáticos: nueva postulación, postulación aceptada, gig terminado.

-- 1) Tabla principal
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    type text not null check (type in (
        'new_application',     -- al cliente: te postularon
        'application_accepted', -- al lancy: te aceptaron
        'application_rejected', -- al lancy: te rechazaron
        'gig_in_review',       -- al cliente: el lancy terminó, requiere aprobación
        'gig_completed',       -- al lancy: el cliente aprobó y pagó
        'new_message'          -- a ambos: nuevo mensaje en el chat
    )),
    title text not null,
    body text,
    gig_id uuid references public.gigs(id) on delete cascade,
    application_id uuid references public.gig_applications(id) on delete cascade,
    actor_id uuid references public.profiles(id) on delete set null, -- quién provocó la notificación
    read_at timestamptz,
    created_at timestamptz not null default now()
);

-- 2) Índices
create index if not exists idx_notifications_user_unread
    on public.notifications(user_id, read_at, created_at desc);
create index if not exists idx_notifications_user_created
    on public.notifications(user_id, created_at desc);

-- 3) RLS
alter table public.notifications enable row level security;

-- a) Cada usuario sólo puede leer sus propias notificaciones
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
    on public.notifications for select
    to authenticated
    using (user_id = auth.uid());

-- b) El sistema (trigger) inserta a nombre de cualquier user — usamos security definer en triggers
drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated"
    on public.notifications for insert
    to authenticated
    with check (true);

-- c) Cada usuario puede marcar sus notificaciones como leídas
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
    on public.notifications for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- d) Cada usuario puede borrar sus notificaciones
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
    on public.notifications for delete
    to authenticated
    using (user_id = auth.uid());

-- 4) Habilitar realtime para esta tabla
alter publication supabase_realtime add table public.notifications;

-- 5) Trigger: cuando se crea una postulación → notificar al cliente dueño del gig
create or replace function public.notify_new_application()
returns trigger as $$
declare
    v_client_id uuid;
    v_gig_title text;
    v_worker_name text;
begin
    select g.client_id, g.title into v_client_id, v_gig_title
    from public.gigs g where g.id = new.gig_id;

    select p.full_name into v_worker_name
    from public.profiles p where p.id = new.worker_id;

    if v_client_id is not null then
        insert into public.notifications (user_id, type, title, body, gig_id, application_id, actor_id)
        values (
            v_client_id,
            'new_application',
            'Nueva postulación',
            coalesce(v_worker_name, 'Un Lancy') || ' postuló a "' || coalesce(v_gig_title, 'tu gig') || '" por $' || to_char(new.bid_amount, 'FM999G999G999'),
            new.gig_id,
            new.id,
            new.worker_id
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_new_application on public.gig_applications;
create trigger trg_notify_new_application
    after insert on public.gig_applications
    for each row execute function public.notify_new_application();

-- 6) Trigger: cuando una postulación cambia a 'accepted' o 'rejected' → notificar al lancy
create or replace function public.notify_application_status_change()
returns trigger as $$
declare
    v_gig_title text;
begin
    if new.status = old.status then
        return new;
    end if;

    select g.title into v_gig_title from public.gigs g where g.id = new.gig_id;

    if new.status = 'accepted' then
        insert into public.notifications (user_id, type, title, body, gig_id, application_id)
        values (
            new.worker_id,
            'application_accepted',
            '¡Te aceptaron!',
            'Fuiste seleccionado para "' || coalesce(v_gig_title, 'el gig') || '". Coordina con el cliente por chat.',
            new.gig_id,
            new.id
        );
    elsif new.status = 'rejected' then
        insert into public.notifications (user_id, type, title, body, gig_id, application_id)
        values (
            new.worker_id,
            'application_rejected',
            'Postulación no seleccionada',
            'El cliente eligió otro Lancy para "' || coalesce(v_gig_title, 'el gig') || '". ¡Sigue postulando!',
            new.gig_id,
            new.id
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_application_status on public.gig_applications;
create trigger trg_notify_application_status
    after update of status on public.gig_applications
    for each row execute function public.notify_application_status_change();

-- 7) Trigger: cuando un gig pasa a 'review' → notificar al cliente
-- y cuando pasa a 'completed' → notificar al lancy
create or replace function public.notify_gig_status_change()
returns trigger as $$
begin
    if new.status = old.status then
        return new;
    end if;

    if new.status = 'review' and new.client_id is not null then
        insert into public.notifications (user_id, type, title, body, gig_id, actor_id)
        values (
            new.client_id,
            'gig_in_review',
            'Trabajo terminado',
            'El Lancy terminó "' || coalesce(new.title, 'tu gig') || '". Revisa y aprueba el pago.',
            new.id,
            new.worker_id
        );
    elsif new.status = 'completed' and new.worker_id is not null then
        insert into public.notifications (user_id, type, title, body, gig_id, actor_id)
        values (
            new.worker_id,
            'gig_completed',
            '¡Pago liberado!',
            'El cliente aprobó "' || coalesce(new.title, 'el gig') || '". El pago se acreditó a tu billetera.',
            new.id,
            new.client_id
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_gig_status on public.gigs;
create trigger trg_notify_gig_status
    after update of status on public.gigs
    for each row execute function public.notify_gig_status_change();

-- 8) Helper RPC: marcar todas como leídas
create or replace function public.mark_all_notifications_read()
returns void as $$
begin
    update public.notifications
    set read_at = now()
    where user_id = auth.uid() and read_at is null;
end;
$$ language plpgsql security definer;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- FIN
