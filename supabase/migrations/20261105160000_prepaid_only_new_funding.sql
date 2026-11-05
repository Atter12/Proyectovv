-- Owner decision: no new agency credit. Preserve historical records and reversals.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
create or replace function public.reject_new_agency_credit()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare m jsonb;
begin
  if TG_TABLE_NAME='credit_lock_profiles' then
    if NEW.approval_status::text='approved' and
       (TG_OP='INSERT' or NEW.approval_status is distinct from OLD.approval_status
        or NEW.requested_credit_cents is distinct from OLD.requested_credit_cents) then
      raise exception 'Nuevo crédito desactivado: solo prepago.' using errcode='23514';
    end if;
    return NEW;
  end if;
  m := coalesce(NEW.metadata,'{}'::jsonb);
  if TG_TABLE_NAME='ledger_journals' then
    if NEW.journal_type::text <> 'deposit_confirmed' then return NEW; end if;
    if TG_OP='UPDATE' and NEW.status::text='reversed' and NEW.reversed_by_journal_id is not null then return NEW; end if;
  end if;
  if TG_OP='UPDATE' and NEW.metadata is not distinct from OLD.metadata and NEW.status is not distinct from OLD.status then return NEW; end if;
  if m->>'source' in ('agency_bm_bridge','adelanto_staff','tiktok_balance_import')
     or m->>'purpose' in ('staff_fund_from_bm','transfer_existing_tiktok_balance') then
    raise exception 'Nuevo crédito desactivado: solo fondos prepago comprobados.' using errcode='23514';
  end if;
  return NEW;
end $$;
drop trigger if exists reject_new_agency_credit on public.payment_intents;
create trigger reject_new_agency_credit before insert or update of metadata,status on public.payment_intents
for each row execute function public.reject_new_agency_credit();
drop trigger if exists reject_new_agency_credit on public.ledger_journals;
create trigger reject_new_agency_credit before insert or update of metadata,status on public.ledger_journals
for each row execute function public.reject_new_agency_credit();
drop trigger if exists reject_new_agency_credit on public.credit_lock_profiles;
create trigger reject_new_agency_credit before insert or update of approval_status,requested_credit_cents on public.credit_lock_profiles
for each row execute function public.reject_new_agency_credit();
commit;
