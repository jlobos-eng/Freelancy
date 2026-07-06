-- ============================================================================
-- rls_security_checks.sql — Regresión de seguridad (RLS + RPC de dinero)
-- ============================================================================
-- Verifica, impersonando roles reales (anon / authenticated) dentro de
-- subtransacciones que se revierten, que las protecciones NO se pueden burlar.
-- No persiste nada. Lanza EXCEPTION con la lista de fallas si alguna no pasa.
--
-- CÓMO CORRERLO
--   - Supabase → SQL Editor → pegar → Run.  (o)  psql "$DATABASE_URL" -f este_archivo
--   - Si todo pasa: NOTICE "RLS security checks: ALL PASS".
--   - Si algo falla: ERROR con el detalle (útil como gate en CI local).
--
-- Cubre los hallazgos cerrados: C3 (spoofing de notificaciones),
-- C6 (aislamiento de tokens MP + acceso anónimo), privacidad de chat,
-- visibilidad de gigs, y ownership de la RPC accept_application.
-- ============================================================================
do $$
declare
  v_user        uuid;   -- cualquier usuario para tests estructurales
  v_gig_msgs    uuid;   -- gig que tiene mensajes
  v_part        uuid;   -- participante de ese gig
  v_nonpart     uuid;   -- alguien que NO participa
  v_foreign_gig uuid;   -- gig no-'open' de otro dueño
  v_app         uuid;   -- una postulación (para probar accept_application)
  v_app_nonowner uuid;  -- alguien que NO es dueño del gig de esa postulación
  c int;
  fails text := '';
begin
  -- ---- Fixtures dinámicos (para que corra en cualquier estado de la BD) ----
  select id into v_user from public.profiles limit 1;
  if v_user is null then
    raise notice 'Sin perfiles: no hay nada que testear.'; return;
  end if;

  select m.gig_id, g.client_id into v_gig_msgs, v_part
  from public.messages m join public.gigs g on g.id = m.gig_id limit 1;

  select id into v_nonpart from public.profiles
   where id is distinct from v_part limit 1;

  select id into v_foreign_gig from public.gigs
   where status <> 'open'
     and client_id is distinct from v_nonpart
     and worker_id is distinct from v_nonpart
   limit 1;

  select ga.id, ga.gig_id into v_app, v_foreign_gig
  from public.gig_applications ga
  join public.gigs g on g.id = ga.gig_id
  where ga.status = 'pending'
  limit 1;
  if v_app is not null then
    select id into v_app_nonowner from public.profiles
     where id not in (select client_id from public.gigs where id = v_foreign_gig)
     limit 1;
  end if;

  -- ======================= TESTS ESTRUCTURALES =======================

  -- T1: authenticated NO puede leer mp_credentials
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_user,'role','authenticated')::text, true);
    set local role authenticated;
    perform 1 from public.mp_credentials;
    reset role;
    fails := fails || 'T1(mp_credentials legible por authenticated); ';
  exception when others then reset role; end;

  -- T2: anon NO puede leer profiles
  begin
    set local role anon;
    perform 1 from public.profiles;
    reset role;
    fails := fails || 'T2(profiles legible por anon); ';
  exception when others then reset role; end;

  -- T3: authenticated NO puede insertar notificación a nombre de otro (C3)
  if v_nonpart is not null then
    begin
      perform set_config('request.jwt.claims', json_build_object('sub',v_user,'role','authenticated')::text, true);
      set local role authenticated;
      insert into public.notifications (user_id, type, title)
      values (v_nonpart, 'new_message', '__test_spoof__');
      reset role;
      fails := fails || 'T3(spoofing de notificaciones posible); ';
    exception when others then reset role; end;
  end if;

  -- ==================== TESTS DEPENDIENTES DE DATOS ====================

  -- T4: no-participante ve 0 mensajes de un chat ajeno
  if v_gig_msgs is not null and v_nonpart is not null and v_nonpart is distinct from v_part then
    perform set_config('request.jwt.claims', json_build_object('sub',v_nonpart,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into c from public.messages where gig_id = v_gig_msgs;
    reset role;
    if c <> 0 then fails := fails || format('T4(no-participante vio %s mensajes ajenos); ', c); end if;
  end if;

  -- T5: participante SÍ ve los mensajes de su gig
  if v_gig_msgs is not null and v_part is not null then
    perform set_config('request.jwt.claims', json_build_object('sub',v_part,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into c from public.messages where gig_id = v_gig_msgs;
    reset role;
    if c = 0 then fails := fails || 'T5(participante NO ve sus mensajes); '; end if;
  end if;

  -- T6: authenticated NO ve un gig ajeno que no está 'open'
  if v_foreign_gig is not null and v_nonpart is not null then
    perform set_config('request.jwt.claims', json_build_object('sub',v_nonpart,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into c from public.gigs where id = v_foreign_gig;
    reset role;
    if c <> 0 then fails := fails || 'T6(vio gig ajeno no-open); '; end if;
  end if;

  -- T7 (RPC dinero): un NO-dueño no puede aceptar una postulación ajena
  if v_app is not null and v_app_nonowner is not null then
    begin
      perform set_config('request.jwt.claims', json_build_object('sub',v_app_nonowner,'role','authenticated')::text, true);
      set local role authenticated;
      perform public.accept_application(v_app);
      reset role;
      fails := fails || 'T7(no-dueño pudo aceptar postulación); ';
    exception when others then reset role; end;  -- se espera excepción "Only the gig owner..."
  end if;

  -- ============================ RESULTADO ============================
  if fails <> '' then
    raise exception 'RLS SECURITY CHECKS FAILED: %', fails;
  else
    raise notice 'RLS security checks: ALL PASS ✅';
  end if;
end $$;
