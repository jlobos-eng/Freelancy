-- ============================================================================
-- dispute_flow_test.sql — Test de integración del flujo de disputa (rollback)
-- ============================================================================
-- Propiedad crítica de dinero: mientras hay una disputa abierta, el pago NO se
-- puede liberar; al resolverse la disputa, el flujo se reanuda.
--
-- Simula: gig en review con pago escrowed →
--   1) cliente abre disputa (open_dispute)   → transaction pasa a 'disputed'
--   2) intentar completar el gig             → BLOQUEADO (guards)
--   3) retirar la disputa (withdraw_dispute) → transaction vuelve a 'escrowed'
--   4) completar el gig                       → payment_status = 'released'
--
-- NO persiste nada (subtransacción revertida). En PASS: NOTICE. En FALLA: EXCEPTION.
-- ============================================================================
do $$
declare
  c uuid; w uuid; g uuid; did uuid;
  v_tx text; v_pay text; bloqueado boolean := false; fails text := '';
begin
  select id into c from public.profiles limit 1;
  select id into w from public.profiles where id <> c limit 1;
  if c is null or w is null then raise notice 'Faltan 2 perfiles; test omitido.'; return; end if;

  begin
    insert into public.gigs (client_id, worker_id, title, status, payment_status, budget)
      values (c, w, '__dispute_test__', 'review', 'escrowed', 50000) returning id into g;
    insert into public.transactions (gig_id, payer_id, payee_id, amount_gross, amount_fee, amount_net, provider, status)
      values (g, c, w, 50000, 5000, 45000, 'mercadopago', 'escrowed');

    -- 1) Cliente abre disputa
    perform set_config('request.jwt.claims', json_build_object('sub',c,'role','authenticated')::text, true);
    set local role authenticated;
    did := public.open_dispute(g, 'work_incomplete', 'test');
    reset role;
    select status into v_tx from public.transactions where gig_id = g order by created_at desc limit 1;
    if v_tx is distinct from 'disputed' then fails := fails || format('tras abrir: tx=%s (esp disputed); ', v_tx); end if;

    -- 2) Completar con disputa abierta → debe bloquearse
    begin update public.gigs set status='completed' where id=g;
    exception when others then bloqueado := true; end;
    if not bloqueado then fails := fails || 'FUGA: se pudo completar con disputa abierta; '; end if;

    -- 3) Retirar disputa
    perform set_config('request.jwt.claims', json_build_object('sub',c,'role','authenticated')::text, true);
    set local role authenticated;
    perform public.withdraw_dispute(did);
    reset role;
    select status into v_tx from public.transactions where gig_id = g order by created_at desc limit 1;
    if v_tx is distinct from 'escrowed' then fails := fails || format('tras retirar: tx=%s (esp escrowed); ', v_tx); end if;

    -- 4) Completar → pago liberado
    update public.gigs set status='completed' where id=g;
    select payment_status into v_pay from public.gigs where id=g;
    if v_pay is distinct from 'released' then fails := fails || format('tras completar: payment_status=%s (esp released); ', v_pay); end if;

    raise exception 'ROLLBACK_SENTINEL';
  exception when others then
    reset role;
    if SQLERRM <> 'ROLLBACK_SENTINEL' then fails := fails || 'excepción inesperada: ' || SQLERRM || '; '; end if;
  end;

  if fails <> '' then
    raise exception 'DISPUTE FLOW TEST FAILED: %', fails;
  else
    raise notice 'Dispute flow test: PASS ✅ (disputa congela el pago, bloquea completar, y al resolver libera)';
  end if;
end $$;
