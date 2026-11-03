-- Do not mint wallet money from non-cash Hecom adjustments or goodwill.
-- Existing genuine customer deposits are not modified by this guard.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
create or replace function public.reject_non_cash_wallet_adjustment()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare m jsonb;
begin
  m := coalesce(NEW.metadata,'{}'::jsonb);
  if TG_TABLE_NAME='ledger_journals' then
    if NEW.journal_type::text <> 'deposit_confirmed' then return NEW; end if;
    if TG_OP='UPDATE' and NEW.status::text='reversed' and NEW.reversed_by_journal_id is not null then return NEW; end if;
  end if;
  if TG_OP='UPDATE' and NEW.metadata is not distinct from OLD.metadata and NEW.status is not distinct from OLD.status then return NEW; end if;
  if m->>'source' in ('hecom_saldo_a_favor','saldo_a_favor_hecom','ops_ajuste','ajuste_staff')
     or m->>'purpose' in ('ajuste_cortesia','goodwill_rounding') or m->>'goodwill'='true' then
    raise exception 'No se permiten abonos de cartera por ajustes ni saldos a favor. Registra solo fondos reales.' using errcode='23514';
  end if;
  return NEW;
end $$;
drop trigger if exists reject_non_cash_wallet_adjustment on public.payment_intents;
create trigger reject_non_cash_wallet_adjustment before insert or update of metadata,status on public.payment_intents
for each row execute function public.reject_non_cash_wallet_adjustment();
drop trigger if exists reject_non_cash_wallet_adjustment on public.ledger_journals;
create trigger reject_non_cash_wallet_adjustment before insert or update of metadata,status on public.ledger_journals
for each row execute function public.reject_non_cash_wallet_adjustment();
commit;
