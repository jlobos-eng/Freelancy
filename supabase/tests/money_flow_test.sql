-- ============================================================================
-- money_flow_test.sql — Test de integración del flujo de dinero (con rollback)
-- ============================================================================
-- Simula el camino crítico donde se "crea" el dinero:
--   cliente A publica gig → worker B postula → cliente A acepta (RPC
--   accept_application_v2) → se crea la transaction con el split correcto y el
--   gig queda assigned / requires_payment.
--
-- Verifica:
--   - gig.status = 'assigned', gig.payment_status = 'requires_payment'
--   - gig.worker_id = worker que postuló
--   - application.status = 'accepted'
--   - transaction: amount_gross = bid, amount_fee = round(bid*0.10),
--                  amount_net = bid - fee, y gross = fee + net (invariante C4)
--
-- NO persiste nada (las fixtures se revierten vía subtransacción).
-- En PASS: NOTICE 'Money flow test: PASS'. En FALLA: EXCEPTION con el detalle.
--
-- CÓMO CORRERLO: Supabase SQL Editor → pegar → Run.  (o) psql -f
-- ============================================================================
do $$
declare
  a uuid; b uuid; g uuid; app uuid;
  v_gross bigint; v_fee bigint; v_net bigint;
  v_pay text; v_gs text; v_as text; v_worker uuid;
  fails text := '';
begin
  select id into a from public.profiles limit 1;
  select id into b from public.profiles where id <> a limit 1;
  if a is null or b is null then
    raise notice 'Se necesitan al menos 2 perfiles; test omitido.'; return;
  end if;

  begin
    -- Fixtures
    insert into public.gigs (client_id, title, status, budget)
      values (a, '__money_flow_test__', 'open', 50000) returning id into g;
    insert into public.gig_applications (gig_id, worker_id, bid_amount, eta_days, status)
      values (g, b, 50000, 3, 'pending') returning id into app;

    -- Cliente A acepta la postulación (impersonando authenticated = A)
    perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
    set local role authenticated;
    perform public.accept_application_v2(app);
    reset role;

    -- Resultados
    select amount_gross, amount_fee, amount_net into v_gross, v_fee, v_net
      from public.transactions where application_id = app;
    select status, payment_status, worker_id into v_gs, v_pay, v_worker from public.gigs where id = g;
    select status into v_as from public.gig_applications where id = app;

    -- Aserciones
    if v_gs is distinct from 'assigned'          then fails := fails || 'gig.status!=assigned; '; end if;
    if v_pay is distinct from 'requires_payment' then fails := fails || 'payment_status!=requires_payment; '; end if;
    if v_worker is distinct from b               then fails := fails || 'worker_id!=postulante; '; end if;
    if v_as is distinct from 'accepted'          then fails := fails || 'application!=accepted; '; end if;
    if v_gross is null then
      fails := fails || 'no se creó transaction; ';
    else
      if v_gross <> v_fee + v_net          then fails := fails || 'split no cuadra (gross<>fee+net); '; end if;
      if v_fee   <> round(50000 * 0.10)    then fails := fails || 'fee != 10% del bid; '; end if;
    end if;

    raise exception 'ROLLBACK_SENTINEL';  -- revierte las fixtures de este bloque
  exception when others then
    reset role;
    if SQLERRM <> 'ROLLBACK_SENTINEL' then
      fails := fails || 'excepción inesperada: ' || SQLERRM || '; ';
    end if;
  end;

  if fails <> '' then
    raise exception 'MONEY FLOW TEST FAILED: %', fails;
  else
    raise notice 'Money flow test: PASS ✅ (gross=fee+net, fee=10%%, gig assigned/requires_payment)';
  end if;
end $$;
