-- Run only after migration 028 inside a transaction that is ALWAYS rolled back.
-- Uses a fresh synthetic organization/wallet, never an existing customer's funds.
do $$
declare
  v_org uuid; v_wallet uuid; v_actor uuid; v_intent uuid; v_receipt bigint;
  v_amount bigint; v_journal uuid; v_second uuid; v_n integer; v_manual uuid;
begin
  select id into strict v_actor from public.profiles where email='popo258789@gmail.com';
  insert into public.organizations(name,slug) values('BOT ROLLBACK TEST','bot-rollback-'||gen_random_uuid()::text) returning id into v_org;
  select id into v_wallet from public.wallets where organization_id=v_org;
  if v_wallet is null then
    insert into public.wallets(organization_id,currency) values(v_org,'USD') returning id into v_wallet;
  end if;
  v_intent:=public.support_recharge_create(v_org,v_actor,9971,10,3.17283,'{}');
  if (select organization_id from public.payment_intents where id=v_intent)<>v_org then raise exception 'Refuse to test an existing intent'; end if;
  if public.support_recharge_create(v_org,v_actor,9971,10,3.17283,'{}')<>v_intent then raise exception 'Active retry duplicated'; end if;
  select amount_cents into v_amount from public.payment_intents where id=v_intent;
  insert into public.support_recharge_receipts(fingerprint,amount_cents,paid_at,signer)
    values('synthetic-'||gen_random_uuid()::text,v_amount,now(),'notificacionesbcp.com.pe') returning id into v_receipt;
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Unverified receipt accepted'; end if;
  update public.support_recharge_receipts set authenticated=true where id=v_receipt;
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Missing proof accepted'; end if;
  insert into public.support_recharge_proofs(intent_id,content_hash,operation_code,amount_cents,storage_path,analysis)
    values(v_intent,'synthetic-'||gen_random_uuid()::text,'synthetic-'||gen_random_uuid()::text,v_amount,'synthetic-only','{}');
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Unverified proof accepted'; end if;
  update public.support_recharge_proofs set verified=true where intent_id=v_intent;
  update public.support_recharge_receipts set amount_cents=v_amount+1 where id=v_receipt;
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Wrong cents accepted'; end if;
  update public.support_recharge_receipts set amount_cents=v_amount,paid_at=now()-interval '1 second' where id=v_receipt;
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Receipt before intent accepted'; end if;
  update public.support_recharge_receipts set paid_at=now()+interval '31 minutes' where id=v_receipt;
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Late receipt accepted'; end if;
  update public.support_recharge_receipts set paid_at=now() where id=v_receipt;
  update public.payment_intents set metadata=metadata||'{"source":"ordinary_manual"}'::jsonb where id=v_intent;
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Non-bot intent accepted'; end if;
  update public.payment_intents set metadata=metadata||'{"source":"support_recharge_bot"}'::jsonb where id=v_intent;
  insert into public.payment_intents(organization_id,wallet_id,amount_cents,currency,provider,status)
    values(v_org,v_wallet,v_amount,'PEN','manual','requires_payment') returning id into v_manual;
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Ambiguous manual payment accepted'; end if;
  update public.payment_intents set status='cancelled' where id=v_manual;
  for v_n in 1..5 loop
    if not public.support_recharge_claim_proof_attempt(v_intent,v_actor) then raise exception 'Valid attempt refused'; end if;
  end loop;
  if public.support_recharge_claim_proof_attempt(v_intent,v_actor) then raise exception 'Sixth proof attempt allowed'; end if;
  v_journal:=public.support_recharge_confirm(v_intent,v_receipt);
  if v_journal is null then raise exception 'Valid bank + proof not credited'; end if;
  if (select balance_cents from public.wallets where id=v_wallet)<>9971 then raise exception 'Incorrect USD net balance'; end if;
  if (select currency from public.ledger_journals where id=v_journal)<>'USD' then raise exception 'Wrong ledger currency'; end if;
  if public.support_recharge_confirm(v_intent,v_receipt) is not null then raise exception 'Replay reported new credit'; end if;
  -- Same idempotency key used by manager approvals must return the original journal.
  v_second:=public.ledger_confirm_deposit(v_intent,null,'voucher-payment-approval:'||v_intent::text,'{}');
  if v_second<>v_journal then raise exception 'Manager replay duplicated'; end if;
  v_second:=public.ledger_confirm_deposit(v_intent,null,'different-key-'||gen_random_uuid()::text,'{}');
  if v_second<>v_journal then raise exception 'Different idempotency key duplicated bot credit'; end if;
  if (select count(*) from public.ledger_journals where source_table='payment_intents' and source_id=v_intent)<>1 then raise exception 'More than one journal'; end if;
  if (select balance_cents from public.wallets where id=v_wallet)<>9971 then raise exception 'Replay changed balance'; end if;
  if (select matched_intent_id from public.support_recharge_receipts where id=v_receipt)<>v_intent then raise exception 'Receipt not claimed'; end if;
  v_second:=public.support_recharge_create(v_org,v_actor,9971,10,3.17283,'{}');
  if v_second=v_intent or (select amount_cents from public.payment_intents where id=v_second)=v_amount then raise exception 'Exact amount reused within 24h'; end if;
  if public.support_recharge_confirm(v_second,v_receipt) is not null then raise exception 'Receipt used twice'; end if;
  if has_function_privilege('anon','public.support_recharge_confirm(uuid,bigint)','EXECUTE') or has_function_privilege('authenticated','public.support_recharge_confirm(uuid,bigint)','EXECUTE') then raise exception 'Public can confirm'; end if;
end $$;
select 'PASS: isolated USD credit, proof, DKIM receipt gates, exact cents, expiry, manual isolation, deduplication, attempt cap, service-only RPC' as rollback_tests;
