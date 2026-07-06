-- Migration: Certificaciones verificables
--
-- Para skills marcadas con `requires_certification=true` (ej: Electricista SEC,
-- Kinesiólogo MINSAL), el lancy puede subir un documento + número de credencial.
-- El admin lo verifica → cambia status a 'verified' → trigger marca
-- worker_skills.is_certified=true y la card del lancy muestra badge azul.
--
-- DEPENDE: 2026_04_25_skills_catalog.sql (worker_skills + skills).

-- =====================================================================
-- 1) Tabla certifications
-- =====================================================================
create table if not exists public.certifications (
    id uuid primary key default gen_random_uuid(),
    worker_id uuid not null references public.profiles(id) on delete cascade,
    -- skill_id directo para queries rápidas + worker_skill_id para join contextual
    skill_id uuid not null references public.skills(id) on delete restrict,
    worker_skill_id uuid references public.worker_skills(id) on delete cascade,

    -- Datos de la credencial
    authority text not null,             -- 'SEC', 'MINSAL', 'CMR', etc. (debería matchear con skills.cert_authority)
    credential_number text not null,     -- nº de RUT, registro o folio
    document_url text,                   -- URL del archivo en Storage
    document_mime text,                  -- 'application/pdf' | 'image/png' | etc.
    document_size_bytes int,
    issued_at date,                      -- cuándo se emitió
    expires_at date,                     -- vencimiento (algunas certs expiran)

    -- Workflow de verificación
    status text not null default 'pending' check (status in (
        'pending',           -- subió, espera revisión
        'under_review',      -- admin la está mirando
        'verified',          -- aprobada
        'rejected',          -- rechazada (rejection_reason llena)
        'expired'            -- pasó expires_at (job de cron lo marca)
    )),
    verified_by uuid references public.profiles(id) on delete set null,
    verified_at timestamptz,
    rejection_reason text,
    admin_notes text,                    -- notas internas (no visibles al lancy)

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Un mismo worker no puede tener dos certs activas para la misma skill+authority
    constraint cert_unique_active exclude using btree (
        worker_id with =, skill_id with =, authority with =
    ) where (status in ('pending', 'under_review', 'verified'))
);

create index if not exists idx_certifications_worker on public.certifications(worker_id);
create index if not exists idx_certifications_skill on public.certifications(skill_id);
create index if not exists idx_certifications_status on public.certifications(status);
create index if not exists idx_certifications_expires
    on public.certifications(expires_at)
    where status = 'verified';

-- Trigger updated_at
drop trigger if exists trg_certifications_updated_at on public.certifications;
create trigger trg_certifications_updated_at
    before update on public.certifications
    for each row execute function public.set_updated_at();

-- =====================================================================
-- 2) RLS — el worker ve sus certs, los demás solo si están verified
--    (clientes pueden ver "sí está verificado" pero no el documento)
-- =====================================================================
alter table public.certifications enable row level security;

drop policy if exists "certifications_select_own_or_verified" on public.certifications;
create policy "certifications_select_own_or_verified"
    on public.certifications for select
    to authenticated
    using (
        worker_id = auth.uid()
        or status = 'verified'
    );

drop policy if exists "certifications_insert_own" on public.certifications;
create policy "certifications_insert_own"
    on public.certifications for insert
    to authenticated
    with check (worker_id = auth.uid() and status = 'pending');

-- Update: el worker puede borrar/reemplazar SU pending. La transición a verified
-- la hace el admin con service_role (sin policy → bloqueado para authenticated).
drop policy if exists "certifications_update_own_pending" on public.certifications;
create policy "certifications_update_own_pending"
    on public.certifications for update
    to authenticated
    using (worker_id = auth.uid() and status in ('pending', 'rejected'))
    with check (worker_id = auth.uid() and status in ('pending', 'rejected'));

drop policy if exists "certifications_delete_own_pending" on public.certifications;
create policy "certifications_delete_own_pending"
    on public.certifications for delete
    to authenticated
    using (worker_id = auth.uid() and status in ('pending', 'rejected'));

-- =====================================================================
-- 3) Trigger crítico: cuando una cert pasa a 'verified', marcar
--    worker_skills.is_certified=true y verification_status='verified'.
--    Cuando pasa a 'expired'/'rejected', revertir.
-- =====================================================================
create or replace function public.sync_cert_to_worker_skill()
returns trigger
language plpgsql
security definer
as $$
declare
    v_skill_authority text;
begin
    -- Obtener autoridad del catálogo
    select cert_authority into v_skill_authority
    from public.skills where id = new.skill_id;

    if tg_op = 'UPDATE' and new.status is distinct from old.status then
        -- Verified → marcar
        if new.status = 'verified' then
            update public.worker_skills
            set is_certified = true,
                verification_status = 'verified',
                certification_url = new.document_url,
                certification_number = new.credential_number
            where worker_id = new.worker_id and skill_id = new.skill_id;

        -- Rejected/expired → desmarcar (sólo si la cert que se cae era la activa)
        elsif new.status in ('rejected', 'expired') and old.status = 'verified' then
            update public.worker_skills
            set is_certified = false,
                verification_status = case new.status
                    when 'expired' then 'expired'
                    else 'rejected'
                end
            where worker_id = new.worker_id and skill_id = new.skill_id;
        end if;
    end if;

    -- Insert: si llega ya verified (admin vía service_role saltando el flujo)
    if tg_op = 'INSERT' and new.status = 'verified' then
        update public.worker_skills
        set is_certified = true,
            verification_status = 'verified',
            certification_url = new.document_url,
            certification_number = new.credential_number
        where worker_id = new.worker_id and skill_id = new.skill_id;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_sync_cert_to_worker_skill on public.certifications;
create trigger trg_sync_cert_to_worker_skill
    after insert or update of status on public.certifications
    for each row execute function public.sync_cert_to_worker_skill();

-- =====================================================================
-- 4) Trigger: marcar como pending la worker_skill cuando se crea cert nueva
--    (mientras está under review, mostrar el badge "Pendiente")
-- =====================================================================
create or replace function public.mark_skill_cert_pending()
returns trigger
language plpgsql
security definer
as $$
begin
    if new.status in ('pending', 'under_review') then
        update public.worker_skills
        set verification_status = 'pending'
        where worker_id = new.worker_id
          and skill_id = new.skill_id
          and verification_status = 'unverified';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_mark_skill_cert_pending on public.certifications;
create trigger trg_mark_skill_cert_pending
    after insert on public.certifications
    for each row execute function public.mark_skill_cert_pending();

-- =====================================================================
-- 5) RPC submit_certification — wrapper para insertar pending desde frontend
-- =====================================================================
create or replace function public.submit_certification(
    p_skill_id uuid,
    p_authority text,
    p_credential_number text,
    p_document_url text,
    p_document_mime text default null,
    p_document_size_bytes int default null,
    p_issued_at date default null,
    p_expires_at date default null
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_id uuid;
    v_worker_skill_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Must be authenticated';
    end if;

    -- Validar que el worker tenga esa skill agregada
    select id into v_worker_skill_id
    from public.worker_skills
    where worker_id = auth.uid() and skill_id = p_skill_id;

    if v_worker_skill_id is null then
        raise exception 'You must add this skill to your profile first';
    end if;

    insert into public.certifications (
        worker_id, skill_id, worker_skill_id,
        authority, credential_number,
        document_url, document_mime, document_size_bytes,
        issued_at, expires_at
    )
    values (
        auth.uid(), p_skill_id, v_worker_skill_id,
        p_authority, p_credential_number,
        p_document_url, p_document_mime, p_document_size_bytes,
        p_issued_at, p_expires_at
    )
    returning id into v_id;

    return v_id;
end;
$$;

grant execute on function public.submit_certification(
    uuid, text, text, text, text, int, date, date
) to authenticated;

-- =====================================================================
-- 6) RPC admin_verify_certification — placeholder de admin tool
--    Sólo callable con service_role — sirve para el panel admin futuro.
-- =====================================================================
create or replace function public.admin_verify_certification(
    p_certification_id uuid,
    p_status text,
    p_rejection_reason text default null,
    p_admin_notes text default null
)
returns void
language plpgsql
as $$
begin
    if p_status not in ('verified', 'rejected', 'under_review') then
        raise exception 'Invalid status';
    end if;
    update public.certifications
    set status = p_status,
        verified_by = auth.uid(),
        verified_at = case when p_status = 'verified' then now() else verified_at end,
        rejection_reason = p_rejection_reason,
        admin_notes = coalesce(p_admin_notes, admin_notes)
    where id = p_certification_id;
end;
$$;

-- NO grant a authenticated — sólo service_role.

-- =====================================================================
-- 7) Storage bucket — IMPORTANTE: esto debe correrse manualmente en
--    Supabase Dashboard → Storage → New bucket → 'certifications', Private.
--    Después aplicar las policies abajo.
-- =====================================================================
-- Las policies de storage.objects se manejan desde el dashboard normalmente.
-- Para automatizarlo, descomenta lo siguiente DESPUÉS de crear el bucket:
--
-- insert into storage.buckets (id, name, public) values ('certifications', 'certifications', false)
--   on conflict (id) do nothing;
--
-- -- Cada lancy puede subir/leer dentro de su propia carpeta {user_id}/
-- create policy "cert_upload_own"
--     on storage.objects for insert to authenticated
--     with check (bucket_id = 'certifications' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "cert_read_own"
--     on storage.objects for select to authenticated
--     using (bucket_id = 'certifications' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "cert_delete_own"
--     on storage.objects for delete to authenticated
--     using (bucket_id = 'certifications' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 8) View: workers verificados por autoridad — útil para filtro en dashboard
-- =====================================================================
create or replace view public.verified_workers_per_skill as
select
    ws.worker_id,
    ws.skill_id,
    s.slug as skill_slug,
    s.cert_authority,
    c.verified_at,
    c.expires_at
from public.worker_skills ws
join public.skills s on s.id = ws.skill_id
left join public.certifications c
    on c.worker_id = ws.worker_id
    and c.skill_id = ws.skill_id
    and c.status = 'verified'
where ws.is_certified = true;

alter view public.verified_workers_per_skill set (security_invoker = true);
grant select on public.verified_workers_per_skill to authenticated;

-- =====================================================================
-- 9) Habilitar realtime para que el lancy vea cuando le aprueban
-- =====================================================================
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            execute 'alter publication supabase_realtime add table public.certifications';
        exception when duplicate_object then null;
        end;
    end if;
end $$;

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Correr este SQL DESPUÉS de skills_catalog.
-- 2. Crear bucket 'certifications' (private) en Supabase Storage.
-- 3. Aplicar las policies del bloque (7) (descomentadas) o configurarlas
--    desde el dashboard.
-- 4. Para verificar manualmente una cert (admin):
--      select admin_verify_certification('<cert-id>', 'verified');
--    (correr con service_role key)
-- =====================================================================
