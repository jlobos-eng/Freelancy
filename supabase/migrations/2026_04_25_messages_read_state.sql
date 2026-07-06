-- Migration: read state para mensajes del chat por gig.
-- Agrega messages.read_at + view unread_messages_per_gig + RPC mark_messages_read.
--
-- IMPORTANTE: asume que ya existe la tabla `messages` con columnas
-- (id, gig_id, sender_id, content, created_at). Si tu schema difiere,
-- ajustar nombres de columnas en la view y RPC.

-- =====================================================================
-- 1) Agregar columna read_at + índice
-- =====================================================================
alter table public.messages
    add column if not exists read_at timestamptz;

-- Índice parcial: el caso común es "mensajes NO leídos para mí en este gig".
-- Sólo indexa rows con read_at IS NULL (tabla pequeña, mucho más eficiente).
create index if not exists idx_messages_unread_per_gig
    on public.messages (gig_id, sender_id)
    where read_at is null;

-- =====================================================================
-- 2) View: cuántos mensajes no leídos hay por gig PARA EL CALLER.
--    "No leídos" = mensajes en gigs donde participo, enviados por OTRO,
--    con read_at IS NULL.
--    security_invoker=true → cada usuario ve sólo sus propios contadores.
-- =====================================================================
create or replace view public.unread_messages_per_gig as
select
    m.gig_id,
    g.client_id,
    g.worker_id,
    -- Para el cliente del gig: cuenta mensajes del worker no leídos
    count(*) filter (where m.sender_id = g.worker_id and m.read_at is null) as unread_for_client,
    -- Para el worker del gig: cuenta mensajes del cliente no leídos
    count(*) filter (where m.sender_id = g.client_id and m.read_at is null) as unread_for_worker,
    max(m.created_at) as last_message_at
from public.messages m
join public.gigs g on g.id = m.gig_id
group by m.gig_id, g.client_id, g.worker_id;

alter view public.unread_messages_per_gig set (security_invoker = true);
grant select on public.unread_messages_per_gig to authenticated;

-- =====================================================================
-- 3) RPC: marcar como leídos todos los mensajes de un gig dirigidos al caller.
--    Llamada desde el frontend cuando el usuario abre el chat.
-- =====================================================================
create or replace function public.mark_messages_read(p_gig_id uuid)
returns int  -- cantidad de mensajes marcados
language plpgsql
security definer
as $$
declare
    v_caller uuid := auth.uid();
    v_is_participant boolean;
    v_count int;
begin
    if v_caller is null then
        raise exception 'Must be authenticated';
    end if;

    -- Validar que el caller participa en el gig
    select exists (
        select 1 from public.gigs g
        where g.id = p_gig_id
          and (g.client_id = v_caller or g.worker_id = v_caller)
    ) into v_is_participant;

    if not v_is_participant then
        raise exception 'Not a participant of this gig';
    end if;

    -- Marcar como leídos los mensajes que NO envié yo
    update public.messages
    set read_at = now()
    where gig_id = p_gig_id
      and sender_id <> v_caller
      and read_at is null;

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

grant execute on function public.mark_messages_read(uuid) to authenticated;

-- =====================================================================
-- 4) Habilitar realtime para messages (si no estaba)
-- =====================================================================
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            execute 'alter publication supabase_realtime add table public.messages';
        exception when duplicate_object then null;
        end;
    end if;
end $$;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Correr este SQL.
-- 2. Verificar la view:
--      select * from unread_messages_per_gig;
-- 3. Probar la RPC:
--      select mark_messages_read('<gig-uuid>');
-- =====================================================================
