-- =====================================================================
-- 2026_04_27_kyc.sql
-- Verificación de identidad (KYC) — modo MVP propio (sin proveedor pago).
--
-- Flujo:
--   1. Usuario sube frente + reverso de cédula + selfie a Storage privado
--      (bucket 'kyc-documents'). El frontend hace OCR client-side con
--      Tesseract.js y extrae RUT + nombre.
--   2. Llama a la RPC submit_kyc con los paths y el OCR result.
--   3. Si OCR confidence >= 0.7 Y rut válido (módulo 11) Y nombre matchea
--      con profiles.full_name → status = 'auto_approved'.
--      Si no → status = 'pending_review' (revisión humana).
--   4. Mientras kyc_status != 'approved', el frontend bloquea el dashboard.
--
-- Diseño:
--   - kyc_submissions: histórico, una row por intento. La última row con
--     status='approved' es la que cuenta (latest_kyc per user_id).
--   - Storage privado: solo el dueño y service_role pueden acceder.
--     RLS lo aseguramos vía storage policies.
-- =====================================================================

-- Función auxiliar: validar RUT chileno (módulo 11). Espejo del JS utils/rut.js.
create or replace function public.is_valid_rut(p_rut text)
returns boolean
language plpgsql
immutable
as $$
declare
    clean text;
    cuerpo text;
    dv text;
    suma int := 0;
    factor int := 2;
    i int;
    resto int;
    expected text;
begin
    if p_rut is null then return false; end if;
    clean := upper(regexp_replace(p_rut, '[^0-9K]', '', 'g'));
    if length(clean) < 2 then return false; end if;
    cuerpo := left(clean, length(clean) - 1);
    dv := right(clean, 1);
    if cuerpo !~ '^\d+$' then return false; end if;
    for i in reverse length(cuerpo)..1 loop
        suma := suma + (substring(cuerpo from i for 1)::int) * factor;
        factor := case when factor = 7 then 2 else factor + 1 end;
    end loop;
    resto := 11 - (suma % 11);
    expected := case
        when resto = 11 then '0'
        when resto = 10 then 'K'
        else resto::text
    end;
    return expected = dv;
end;
$$;

-- =====================================================================
-- Columna kyc_status en profiles
-- =====================================================================
alter table public.profiles
    add column if not exists kyc_status text not null default 'none'
    check (kyc_status in ('none', 'pending_review', 'approved', 'rejected'));

create index if not exists idx_profiles_kyc_status on public.profiles(kyc_status);

-- =====================================================================
-- Tabla kyc_submissions
-- =====================================================================
create table if not exists public.kyc_submissions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,

    -- Documento (paths en bucket 'kyc-documents')
    doc_front_path text not null,
    doc_back_path  text not null,
    selfie_path    text not null,

    -- Datos extraídos por OCR (client-side)
    rut text,                          -- ej '12.345.678-9'
    full_name_extracted text,          -- nombre tal como salió del OCR
    ocr_confidence numeric(5,3) check (ocr_confidence between 0 and 1),

    -- Estado y revisión
    status text not null default 'pending_review'
        check (status in ('pending_review', 'approved', 'rejected')),
    reviewer_id uuid references public.profiles(id),
    reviewed_at timestamptz,
    rejection_reason text,
    auto_approved boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_kyc_submissions_user on public.kyc_submissions(user_id, created_at desc);
create index if not exists idx_kyc_submissions_status on public.kyc_submissions(status, created_at desc);

-- updated_at automático
create or replace function public.kyc_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_kyc_updated on public.kyc_submissions;
create trigger trg_kyc_updated before update on public.kyc_submissions
    for each row execute function public.kyc_set_updated_at();

-- =====================================================================
-- Trigger: sincronizar profiles.kyc_status con la última submission
-- =====================================================================
create or replace function public.sync_profile_kyc_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    update public.profiles
    set kyc_status = new.status
    where id = new.user_id;
    return new;
end;
$$;

drop trigger if exists trg_sync_profile_kyc on public.kyc_submissions;
create trigger trg_sync_profile_kyc after insert or update of status on public.kyc_submissions
    for each row execute function public.sync_profile_kyc_status();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.kyc_submissions enable row level security;

drop policy if exists "kyc_select_own" on public.kyc_submissions;
create policy "kyc_select_own" on public.kyc_submissions
    for select to authenticated
    using (user_id = auth.uid());

-- Insert: solo se permite vía RPC submit_kyc (que valida y normaliza).
-- La tabla en sí no acepta INSERT directo del cliente.
drop policy if exists "kyc_insert_via_rpc" on public.kyc_submissions;
create policy "kyc_insert_via_rpc" on public.kyc_submissions
    for insert to authenticated
    with check (false);

-- Update: bloqueado para clientes (las RPCs approve/reject corren security definer).
drop policy if exists "kyc_no_update" on public.kyc_submissions;
create policy "kyc_no_update" on public.kyc_submissions
    for update to authenticated
    using (false);

-- =====================================================================
-- RPC submit_kyc — el cliente la llama con los paths y datos del OCR
-- =====================================================================
create or replace function public.submit_kyc(
    p_doc_front_path text,
    p_doc_back_path text,
    p_selfie_path text,
    p_rut text default null,
    p_full_name_extracted text default null,
    p_ocr_confidence numeric default null
)
returns table (
    submission_id uuid,
    status text,
    auto_approved boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_status text := 'pending_review';
    v_auto boolean := false;
    v_rut_clean text;
    v_id uuid;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    -- Validar paths obligatorios
    if p_doc_front_path is null or p_doc_back_path is null or p_selfie_path is null then
        raise exception 'Missing required documents';
    end if;

    select * into v_profile from public.profiles where id = v_user_id;
    if not found then
        raise exception 'Profile not found';
    end if;

    -- Auto-aprobación heurística:
    --   1. RUT válido módulo 11.
    --   2. OCR confidence >= 0.7.
    --   3. Nombre extraído matchea (case-insensitive, sustring) con full_name del perfil.
    if p_rut is not null
       and is_valid_rut(p_rut)
       and p_ocr_confidence is not null
       and p_ocr_confidence >= 0.7
       and v_profile.full_name is not null
       and p_full_name_extracted is not null
       and (
           upper(v_profile.full_name) like '%' || upper(split_part(trim(p_full_name_extracted), ' ', 1)) || '%'
           or upper(p_full_name_extracted) like '%' || upper(split_part(trim(v_profile.full_name), ' ', 1)) || '%'
       )
    then
        v_status := 'approved';
        v_auto := true;
    end if;

    -- Normalizar RUT
    v_rut_clean := upper(regexp_replace(coalesce(p_rut, ''), '[^0-9K]', '', 'g'));

    insert into public.kyc_submissions (
        user_id, doc_front_path, doc_back_path, selfie_path,
        rut, full_name_extracted, ocr_confidence, status, auto_approved
    ) values (
        v_user_id, p_doc_front_path, p_doc_back_path, p_selfie_path,
        nullif(v_rut_clean, ''), nullif(p_full_name_extracted, ''),
        p_ocr_confidence, v_status, v_auto
    )
    returning id into v_id;

    -- El trigger sync_profile_kyc_status ya escribió profiles.kyc_status

    return query select v_id, v_status, v_auto;
end;
$$;

grant execute on function public.submit_kyc(text, text, text, text, text, numeric) to authenticated;

-- =====================================================================
-- RPCs admin: approve / reject
-- =====================================================================
create or replace function public.approve_kyc(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    -- Solo admin/staff puede aprobar manualmente. Asumimos columna profiles.is_admin
    -- (si no existe, esto falla gracefully — agregar la columna en otra migration
    -- cuando se construya el panel admin).
    if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
        raise exception 'Forbidden: admin only';
    end if;
    update public.kyc_submissions
    set status = 'approved', reviewer_id = auth.uid(), reviewed_at = now()
    where id = p_submission_id;
end;
$$;

create or replace function public.reject_kyc(p_submission_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
        raise exception 'Forbidden: admin only';
    end if;
    update public.kyc_submissions
    set status = 'rejected', reviewer_id = auth.uid(), reviewed_at = now(),
        rejection_reason = p_reason
    where id = p_submission_id;
end;
$$;

-- Asegurar columna is_admin (idempotente)
alter table public.profiles add column if not exists is_admin boolean not null default false;

grant execute on function public.approve_kyc(uuid) to authenticated;
grant execute on function public.reject_kyc(uuid, text) to authenticated;

-- =====================================================================
-- Storage bucket: kyc-documents
--   IMPORTANTE: Supabase no expone CREATE BUCKET por SQL en todos los planes.
--   Si esta sección falla, créalo desde el Dashboard:
--     Storage → Create bucket → Name: kyc-documents → Public: NO
--   Las policies van por SQL.
-- =====================================================================

-- Crear bucket si la API lo permite (idempotente)
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

-- RLS storage: cada usuario sólo ve/escribe en su carpeta.
-- Convención de path: kyc-documents/{user_id}/{front|back|selfie}-{timestamp}.jpg

drop policy if exists "kyc_storage_select_own" on storage.objects;
create policy "kyc_storage_select_own" on storage.objects
    for select to authenticated
    using (
        bucket_id = 'kyc-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "kyc_storage_insert_own" on storage.objects;
create policy "kyc_storage_insert_own" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'kyc-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "kyc_storage_update_own" on storage.objects;
create policy "kyc_storage_update_own" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'kyc-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "kyc_storage_delete_own" on storage.objects;
create policy "kyc_storage_delete_own" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'kyc-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- =====================================================================
-- INSTRUCCIONES:
-- 1. Correr este script en Supabase SQL Editor.
-- 2. Verificar bucket:  Storage → debe aparecer 'kyc-documents' privado.
-- 3. Si tienes profiles existentes pre-KYC, su kyc_status quedó 'none'.
--    Eso bloquea el ingreso (gate global del frontend). Si quieres dejarlos
--    entrar mientras migran, marca individualmente:
--      update profiles set kyc_status = 'approved' where id = '<tu_uuid>';
-- =====================================================================
