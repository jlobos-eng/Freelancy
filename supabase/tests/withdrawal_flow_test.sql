-- ============================================================================
-- withdrawal_flow_test.sql — Test de integración del flujo de retiro (rollback)
-- ============================================================================
-- Simula: worker con saldo liberado registra cuenta bancaria y retira.
-- Verifica:
--   - request_withdrawal crea el retiro (respetando el saldo disponible)
--   - wallet_balance.available descuenta el retiro en vuelo
--   - simulate_process_withdrawal marca el retiro como 'paid'
--   - la validación de RUT chileno (is_valid_rut) en bank_accounts
--
-- NO persiste nada (subtransacción revertida). En PASS: NOTICE. En FALLA: EXCEPTION.
-- CÓMO CORRERLO: Supabase SQL Editor → pegar → Run.
-- ============================================================================
do $$
declare
  a uuid; client uuid; g uuid; ba uuid; wid uuid;
  v_avail_antes bigint; v_avail_despues bigint; v_wamount bigint; v_sim text;
  fails text := '';
begin
  select id into a from public.profiles limit 1;
  select id into client from public.profiles where id <> a limit 1;
  select id into g from public.gigs limit 1;
  if a is null or client is null or g is null then
    raise notice 'Faltan fixtures (2 perfiles + 1 gig); test omitido.'; return;
  end if;

  begin
    -- Saldo disponible para "a": una transacción liberada de $45.000 neto
    insert into public.transactions (gig_id, payer_id, payee_id, amount_gross, amount_fee, amount_net, provider, status)
      values (g, client, a, 50000, 5000, 45000, 'mercadopago', 'released');
    -- Cuenta bancaria válida (RUT chileno válido módulo 11)
    insert into public.bank_accounts (user_id, holder_name, holder_rut, bank_code, account_type, account_number, is_primary)
      values (a, 'Juan Perez', '11.111.111-1', '012', 'rut', '12345678', true)
      returning id into ba;

    select available into v_avail_antes from public.wallet_balance where user_id = a;

    perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
    set local role authenticated;
    wid := public.request_withdrawal(20000, ba);
    v_sim := public.simulate_process_withdrawal(wid, false);
    reset role;

    select amount into v_wamount from public.withdrawals where id = wid;
    select available into v_avail_despues from public.wallet_balance where user_id = a;

    if wid is null                          then fails := fails || 'no se creó retiro; '; end if;
    if v_wamount is distinct from 20000     then fails := fails || 'amount!=20000; '; end if;
    if v_sim is distinct from 'paid'        then fails := fails || 'simulate!=paid; '; end if;
    if v_avail_antes is distinct from 45000 then fails := fails || format('avail_antes=%s (esp 45000); ', v_avail_antes); end if;
    if v_avail_despues is distinct from 25000 then fails := fails || format('avail_despues=%s (esp 25000); ', v_avail_despues); end if;

    raise exception 'ROLLBACK_SENTINEL';
  exception when others then
    reset role;
    if SQLERRM <> 'ROLLBACK_SENTINEL' then fails := fails || 'excepción inesperada: ' || SQLERRM || '; '; end if;
  end;

  if fails <> '' then
    raise exception 'WITHDRAWAL FLOW TEST FAILED: %', fails;
  else
    raise notice 'Withdrawal flow test: PASS ✅ (retiro creado, available 45000→25000, simulate=paid)';
  end if;
end $$;
