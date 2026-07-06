-- Migration: Storage bucket privado 'certifications' + policies por owner
--
-- M5.3 — el lancy sube su credencial a {auth.uid()}/{filename}.
-- - Bucket privado, máx 5 MB, sólo PDF/PNG/JPG/WebP.
-- - Sólo el dueño puede leer/escribir/borrar dentro de su carpeta.
-- - El admin verifica desde dashboard con service_role (bypass RLS).
-- - El cliente final ve sólo el badge "Verificado", no el archivo.
--
-- DEPENDE: 2026_04_25_certifications.sql (tabla certifications + RLS).

-- 1) Crear el bucket privado (idempotente)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'certifications',
    'certifications',
    false,
    5242880, -- 5 MB
    array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================================
-- 2) Policies sobre storage.objects.
--    Scoping: la primera "carpeta" del path debe coincidir con auth.uid().
--    Convención del cliente: '{user_id}/{worker_skill_id}/{timestamp}.{ext}'.
-- =====================================================================

drop policy if exists "cert_upload_own" on storage.objects;
create policy "cert_upload_own"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'certifications'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "cert_read_own" on storage.objects;
create policy "cert_read_own"
    on storage.objects for select
    to authenticated
    using (
        bucket_id = 'certifications'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "cert_update_own" on storage.objects;
create policy "cert_update_own"
    on storage.objects for update
    to authenticated
    using (
        bucket_id = 'certifications'
        and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
        bucket_id = 'certifications'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "cert_delete_own" on storage.objects;
create policy "cert_delete_own"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'certifications'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- FIN
-- =====================================================================
-- INSTRUCCIONES PARA EL USUARIO:
-- 1. Esta migración crea el bucket sin necesidad de tocar el dashboard.
-- 2. Para verificar:
--      select id, name, public, file_size_limit from storage.buckets
--       where id = 'certifications';
-- 3. Para leer un documento como admin (service_role) usar
--    storage.from('certifications').createSignedUrl(path, ttl) desde una
--    Edge Function autorizada.
-- =====================================================================
