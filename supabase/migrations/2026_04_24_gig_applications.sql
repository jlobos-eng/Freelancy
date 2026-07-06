-- Migration: gig_applications (postulación competitiva multi-bid)
-- Crea la tabla donde los Lancys envían ofertas a un gig.
-- Un cliente publica un gig → varios Lancys postulan con su precio/ETA/mensaje → cliente elige uno → ese pasa a 'accepted' y el resto a 'rejected'.

-- 1) Tabla principal
create table if not exists public.gig_applications (
    id uuid primary key default gen_random_uuid(),
    gig_id uuid not null references public.gigs(id) on delete cascade,
    worker_id uuid not null references public.profiles(id) on delete cascade,
    bid_amount numeric(12, 0) not null check (bid_amount > 0),
    eta_days int not null check (eta_days >= 0 and eta_days <= 365),
    message text,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- un Lancy sólo puede postular una vez al mismo gig
    unique (gig_id, worker_id)
);

-- 2) Índices para consultas comunes
create index if not exists idx_gig_applications_gig on public.gig_applications(gig_id);
create index if not exists idx_gig_applications_worker on public.gig_applications(worker_id);
create index if not exists idx_gig_applications_status on public.gig_applications(status);

-- 3) Trigger updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at := now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gig_applications_updated_at on public.gig_applications;
create trigger trg_gig_applications_updated_at
    before update on public.gig_applications
    for each row execute function public.set_updated_at();

-- 4) Agregar status 'bidding' al check existente de gigs (si tu tabla gigs tiene check constraint).
-- Si tu tabla gigs.status es free-text, este paso no es necesario.
-- Ejemplo (descomenta y ajusta nombre del constraint):
-- alter table public.gigs drop constraint if exists gigs_status_check;
-- alter table public.gigs add constraint gigs_status_check
--   check (status in ('open', 'bidding', 'assigned', 'review', 'completed', 'cancelled'));

-- 5) RLS — habilitar y políticas
alter table public.gig_applications enable row level security;

-- a) Cualquier autenticado puede leer postulaciones de un gig (para que el dueño del gig las vea y el postulante las vea)
drop policy if exists "applications_select" on public.gig_applications;
create policy "applications_select"
    on public.gig_applications for select
    to authenticated
    using (true);

-- b) Sólo el worker dueño puede crear su postulación
drop policy if exists "applications_insert_own" on public.gig_applications;
create policy "applications_insert_own"
    on public.gig_applications for insert
    to authenticated
    with check (worker_id = auth.uid());

-- c) Update: el worker puede retirar su postulación; el dueño del gig puede aceptar/rechazar
drop policy if exists "applications_update" on public.gig_applications;
create policy "applications_update"
    on public.gig_applications for update
    to authenticated
    using (
        worker_id = auth.uid()
        or exists (
            select 1 from public.gigs g
            where g.id = gig_applications.gig_id and g.client_id = auth.uid()
        )
    )
    with check (
        worker_id = auth.uid()
        or exists (
            select 1 from public.gigs g
            where g.id = gig_applications.gig_id and g.client_id = auth.uid()
        )
    );

-- d) Delete: sólo el dueño del worker puede borrar (retirar postulación pasada)
drop policy if exists "applications_delete_own" on public.gig_applications;
create policy "applications_delete_own"
    on public.gig_applications for delete
    to authenticated
    using (worker_id = auth.uid());

-- 6) Función helper opcional: aceptar una postulación (atómica)
-- Marca la postulación seleccionada como 'accepted', el resto como 'rejected', y el gig pasa a 'assigned' con worker_id correspondiente.
create or replace function public.accept_application(application_id uuid)
returns void as $$
declare
    v_gig_id uuid;
    v_worker_id uuid;
    v_client_id uuid;
begin
    select ga.gig_id, ga.worker_id into v_gig_id, v_worker_id
    from public.gig_applications ga
    where ga.id = application_id;

    if v_gig_id is null then
        raise exception 'Application not found';
    end if;

    select g.client_id into v_client_id
    from public.gigs g
    where g.id = v_gig_id;

    if v_client_id is distinct from auth.uid() then
        raise exception 'Only the gig owner can accept applications';
    end if;

    -- marcar la postulación como aceptada
    update public.gig_applications
    set status = 'accepted'
    where id = application_id;

    -- marcar el resto como rechazadas
    update public.gig_applications
    set status = 'rejected'
    where gig_id = v_gig_id and id <> application_id and status = 'pending';

    -- asignar el gig al worker ganador
    update public.gigs
    set status = 'assigned', worker_id = v_worker_id
    where id = v_gig_id;
end;
$$ language plpgsql security definer;

grant execute on function public.accept_application(uuid) to authenticated;

-- FIN
