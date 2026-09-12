-- Isolated support-chat pilot. Existing manual payments and ledger RPC are unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.support_recharge_reservations (
  intent_id uuid primary key references public.payment_intents(id),
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 1000),
  proof_attempts integer not null default 0 check (proof_attempts between 0 and 5),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes'
);
create index support_recharge_amount_time on public.support_recharge_reservations(amount_cents, created_at);
create index support_recharge_actor on public.support_recharge_reservations(created_by, created_at desc);

create table public.support_recharge_proofs (
  intent_id uuid primary key references public.support_recharge_reservations(intent_id),
  content_hash text not null unique,
  operation_code text unique,
  verified boolean not null default false,
  amount_cents bigint,
  storage_path text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

create table public.support_recharge_receipts (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at timestamptz not null,
  authenticated boolean not null default false,
  signer text not null check (signer = 'notificacionesbcp.com.pe'),
  matched_intent_id uuid unique references public.support_recharge_reservations(intent_id),
  created_at timestamptz not null default now()
);
create index support_recharge_receipt_amount_time on public.support_recharge_receipts(amount_cents, paid_at) where matched_intent_id is null;

-- Also prevents a concurrent manager approval from posting a second bot deposit.
-- Ordinary manual payment journals are outside this index.
create unique index support_recharge_single_deposit on public.ledger_journals(source_id)
  where source_table='payment_intents' and journal_type='deposit_confirmed'
    and metadata->>'source'='support_recharge_bot';

alter table public.support_recharge_reservations enable row level security;
alter table public.support_recharge_proofs enable row level security;
alter table public.support_recharge_receipts enable row level security;
revoke all on public.support_recharge_reservations, public.support_recharge_proofs, public.support_recharge_receipts from public, anon, authenticated;
grant select, insert, update on public.support_recharge_reservations, public.support_recharge_proofs, public.support_recharge_receipts to service_role;
grant usage, select on sequence public.support_recharge_receipts_id_seq to service_role;

create function public.support_recharge_create(p_org uuid, p_actor uuid, p_credit bigint, p_fee numeric, p_fx numeric, p_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_wallet uuid; v_id uuid; v_base bigint; v_amount bigint; v_credit_pen bigint;
  v_fee_usd bigint; v_count integer; v_offset integer;
begin
  if p_credit is null or p_credit < 100 or p_credit > 10000 or p_fee is null or p_fee < 0 or p_fee > 100
     or p_fx is null or p_fx < 1 or p_fx > 10 then
    raise exception 'Monto o cotización fuera del límite de la prueba (máximo USD 100).';
  end if;
  -- The only creation entry point: reserve + insert in the same short transaction.
  perform pg_advisory_xact_lock(92841063);
  select r.intent_id into v_id from public.support_recharge_reservations r
    join public.payment_intents i on i.id=r.intent_id
    where r.created_by=p_actor and r.expires_at > now()
      and i.status in ('created','requires_payment','processing')
    order by r.created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  select count(*) into v_count from public.support_recharge_reservations
    where created_by=p_actor and created_at > now()-interval '1 hour';
  if v_count >= 5 then raise exception 'Ya creaste cinco recargas en una hora. Contacta a soporte.'; end if;
  select w.id into v_wallet from public.wallets w where w.organization_id=p_org
    and w.currency='USD' and w.status='active' order by w.created_at limit 1;
  if v_wallet is null then raise exception 'No se encontró una cartera USD activa.'; end if;
  v_credit_pen := round(p_credit*p_fx);
  v_base := round(v_credit_pen*(1+p_fee/100));
  if v_base <= 1000 then raise exception 'El total debe superar S/ 10.00 para esta prueba.'; end if;
  v_fee_usd := round(p_credit*p_fee/100);
  -- Keep amounts reserved for 24h, even after completion/cancellation, against delayed mail.
  select n into v_offset from generate_series(0,99) n where not exists (
    select 1 from public.support_recharge_reservations r where r.amount_cents=v_base+n
      and r.created_at > now()-interval '24 hours'
  ) order by n limit 1;
  if v_offset is null then raise exception 'No hay un monto exclusivo disponible. Inténtalo más tarde.'; end if;
  v_amount := v_base+v_offset;
  insert into public.payment_intents(organization_id,wallet_id,created_by,amount_cents,currency,provider,status,idempotency_key,expires_at,metadata)
    values(p_org,v_wallet,p_actor,v_amount,'PEN','manual','requires_payment',gen_random_uuid()::text,now()+interval '30 minutes',
      coalesce(p_context,'{}') || jsonb_build_object(
        'source','support_recharge_bot','purpose','support_chat_topup','charge_currency','PEN',
        'recipient_phone','964290361','recipient_holder','Holistic Marketing PE EIRL','recipient_bank','BCP',
        'credit_amount_cents',p_credit,'wallet_credit_currency','USD','fee_percent',p_fee,
        'credit_pen_cents',v_credit_pen,'fee_pen_cents',v_base-v_credit_pen,'fee_amount_cents',v_fee_usd,
        'gross_usd_cents',p_credit+v_fee_usd,'gross_pen_cents',v_amount,'pen_discriminator_cents',v_offset,
        'fx_rate_usd_pen',p_fx,'manual_review_status','bot_pending','requires_manager_approval',false)) returning id into v_id;
  insert into public.support_recharge_reservations(intent_id,organization_id,created_by,amount_cents) values(v_id,p_org,p_actor,v_amount);
  return v_id;
end $$;

create function public.support_recharge_claim_proof_attempt(p_intent uuid,p_actor uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.support_recharge_reservations set proof_attempts=proof_attempts+1
    where intent_id=p_intent and created_by=p_actor and proof_attempts<5
      and created_at>now()-interval '24 hours';
  return found;
end $$;

create function public.support_recharge_confirm(p_intent uuid,p_receipt bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_i public.payment_intents%rowtype;
  v_r public.support_recharge_reservations%rowtype;
  v_b public.support_recharge_receipts%rowtype;
  v_p public.support_recharge_proofs%rowtype;
  v_journal uuid;
begin
  perform pg_advisory_xact_lock(92841063);
  select * into v_i from public.payment_intents where id=p_intent for update;
  if not found then return null; end if;
  select * into v_r from public.support_recharge_reservations where intent_id=p_intent;
  if not found then return null; end if;
  select * into v_b from public.support_recharge_receipts where id=p_receipt for update;
  if not found then return null; end if;
  if v_i.status='succeeded' and v_b.matched_intent_id=p_intent then
    return null;
  end if;
  if v_i.metadata->>'source' is distinct from 'support_recharge_bot'
     or v_i.provider <> 'manual' or v_i.currency <> 'PEN'
     or v_i.status not in ('requires_payment','processing')
     or v_i.organization_id <> v_r.organization_id or v_i.created_by <> v_r.created_by
     or v_i.amount_cents <> v_r.amount_cents
     or not v_b.authenticated or v_b.signer <> 'notificacionesbcp.com.pe'
     or v_b.matched_intent_id is not null or v_b.amount_cents <> v_r.amount_cents
     or v_b.paid_at < v_r.created_at or v_b.paid_at > v_r.expires_at
     or v_b.paid_at > now()+interval '30 seconds'
     or v_r.created_at < now()-interval '24 hours'
     or v_i.metadata->>'recipient_phone' is distinct from '964290361'
     or v_i.metadata->>'recipient_bank' is distinct from 'BCP'
     or v_i.metadata->>'recipient_holder' is distinct from 'Holistic Marketing PE EIRL'
     or v_i.metadata->>'wallet_credit_currency' is distinct from 'USD'
     or (v_i.metadata->>'credit_amount_cents')::bigint not between 100 and 10000 then return null; end if;
  select * into v_p from public.support_recharge_proofs where intent_id=p_intent;
  if not found then return null; end if;
  if not v_p.verified or v_p.amount_cents is distinct from v_r.amount_cents then return null; end if;
  -- A concurrent ordinary manual request with the same amount is ambiguous.
  if exists(select 1 from public.payment_intents i where i.id<>p_intent
    and i.provider='manual' and i.currency='PEN' and i.amount_cents=v_r.amount_cents
    and i.metadata->>'source' is distinct from 'support_recharge_bot'
    and i.created_at between v_r.created_at-interval '24 hours' and v_r.expires_at
    and i.status in ('created','requires_payment','processing','succeeded')) then return null; end if;
  -- No relaxation of OCR/rate controls and no second approval of a reused voucher.
  if exists(select 1 from public.payment_intents i where i.id<>p_intent and i.status='succeeded'
    and (i.metadata->>'voucher_content_hash'=v_p.content_hash
      or (v_p.operation_code is not null and i.metadata->>'voucher_operation_code'=v_p.operation_code))) then return null; end if;
  v_journal := public.ledger_confirm_deposit(p_intent,'support-bot:'||v_b.fingerprint,'voucher-payment-approval:'||p_intent::text,
    jsonb_build_object('approval_source','support_bot_verified_bank_email','bank_receipt_id',v_b.id,'auto_approved',true));
  update public.support_recharge_receipts set matched_intent_id=p_intent where id=p_receipt;
  update public.payment_intents set metadata=metadata||jsonb_build_object(
    'manual_review_status','approved','approval_source','support_bot_verified_bank_email',
    'bank_receipt_id',v_b.id,'auto_approved',true,'approved_at',now(),'voucher_content_hash',v_p.content_hash,
    'voucher_operation_code',v_p.operation_code) where id=p_intent;
  return v_journal;
end $$;

revoke all on function public.support_recharge_create(uuid,uuid,bigint,numeric,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.support_recharge_confirm(uuid,bigint) from public, anon, authenticated;
revoke all on function public.support_recharge_claim_proof_attempt(uuid,uuid) from public, anon, authenticated;
grant execute on function public.support_recharge_create(uuid,uuid,bigint,numeric,numeric,jsonb) to service_role;
grant execute on function public.support_recharge_confirm(uuid,bigint) to service_role;
grant execute on function public.support_recharge_claim_proof_attempt(uuid,uuid) to service_role;
commit;
