-- ================================================================
-- Professional financial ledger migration for Supabase/PostgreSQL
-- Project context: multi-tenant ads SaaS with wallets, payments and ad accounts.
-- Purpose:
--   1. Add a real double-entry ledger.
--   2. Stop using wallets.balance_cents as the accounting source of truth.
--   3. Keep legacy balance columns synchronized as compatibility/cache fields.
--   4. Add transactional ad spend records.
--   5. Add idempotent RPCs for deposit confirmation, allocation, reservation,
--      ad spend recording, refund/release and journal reversal.
--
-- Recommended file name:
--   supabase/migrations/006_professional_financial_ledger.sql
--
-- IMPORTANT BEFORE RUNNING:
--   - Run this in staging first.
--   - Confirm current wallets.balance_cents, wallets.reserved_balance_cents,
--     ad_account_balances.balance_cents and ad_account_balances.reserved_balance_cents
--     are the official opening balances. This migration creates opening ledger
--     journals from those values.
--   - After cutover, write financial changes only through the RPC functions below.
--   - Views are created with security_invoker=true for Supabase/RLS safety.
-- ================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 0. Extensions and enum types
-- ---------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ledger_account_kind'
  ) THEN
    CREATE TYPE public.ledger_account_kind AS ENUM (
      'asset',
      'liability',
      'equity',
      'revenue',
      'expense'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ledger_entry_direction'
  ) THEN
    CREATE TYPE public.ledger_entry_direction AS ENUM ('debit', 'credit');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ledger_journal_status'
  ) THEN
    CREATE TYPE public.ledger_journal_status AS ENUM (
      'draft',
      'posted',
      'reversed',
      'void'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------
-- 1. Core ledger tables
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  wallet_id uuid NOT NULL
    REFERENCES public.wallets(id) ON DELETE CASCADE,

  ad_account_id uuid
    REFERENCES public.ad_accounts(id) ON DELETE CASCADE,

  code text NOT NULL,
  name text NOT NULL,

  -- Examples:
  -- wallet_available, wallet_reserved, external_funding,
  -- legacy_opening_equity, ad_account_available, ad_account_reserved,
  -- ad_spend_expense, platform_fee_revenue, refunds_clearing
  account_type text NOT NULL,

  account_kind public.ledger_account_kind NOT NULL,
  normal_balance public.ledger_entry_direction NOT NULL,

  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),

  is_system boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ledger_accounts_code_not_blank CHECK (btrim(code) <> ''),
  CONSTRAINT ledger_accounts_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT ledger_accounts_type_not_blank CHECK (btrim(account_type) <> ''),
  CONSTRAINT ledger_accounts_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE IF NOT EXISTS public.ledger_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  wallet_id uuid NOT NULL
    REFERENCES public.wallets(id) ON DELETE CASCADE,

  journal_type text NOT NULL,
  status public.ledger_journal_status NOT NULL DEFAULT 'posted',

  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',

  -- Optional source pointer. Examples:
  -- source_table='payment_intents', source_id=<payment_intent_id>
  -- source_table='ad_spend_transactions', source_id=<spend_tx_id>
  source_table text,
  source_id uuid,

  provider text,
  provider_reference text,

  idempotency_key text,

  reversal_of_journal_id uuid
    REFERENCES public.ledger_journals(id),

  reversed_by_journal_id uuid
    REFERENCES public.ledger_journals(id),

  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by uuid REFERENCES auth.users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ledger_journals_type_not_blank CHECK (btrim(journal_type) <> ''),
  CONSTRAINT ledger_journals_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT ledger_journals_reversal_self_check CHECK (reversal_of_journal_id IS NULL OR reversal_of_journal_id <> id),
  CONSTRAINT ledger_journals_reversed_by_self_check CHECK (reversed_by_journal_id IS NULL OR reversed_by_journal_id <> id)
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  journal_id uuid NOT NULL
    REFERENCES public.ledger_journals(id) ON DELETE RESTRICT,

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  wallet_id uuid NOT NULL
    REFERENCES public.wallets(id) ON DELETE CASCADE,

  account_id uuid NOT NULL
    REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,

  direction public.ledger_entry_direction NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ledger_entries_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

-- Transaction-level source of truth for provider ad spend.
CREATE TABLE IF NOT EXISTS public.ad_spend_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  wallet_id uuid NOT NULL
    REFERENCES public.wallets(id) ON DELETE CASCADE,

  ad_account_id uuid NOT NULL
    REFERENCES public.ad_accounts(id) ON DELETE CASCADE,

  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ad_set_id uuid REFERENCES public.ad_sets(id) ON DELETE SET NULL,
  ad_id uuid REFERENCES public.ads(id) ON DELETE SET NULL,

  provider text NOT NULL,
  external_spend_id text,

  spend_source text NOT NULL DEFAULT 'available'
    CHECK (spend_source IN ('available', 'reserved')),

  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',

  occurred_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),

  ledger_journal_id uuid UNIQUE
    REFERENCES public.ledger_journals(id) ON DELETE RESTRICT,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ad_spend_transactions_provider_not_blank CHECK (btrim(provider) <> ''),
  CONSTRAINT ad_spend_transactions_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

-- Optional but useful for provider/payment reconciliation runs.
CREATE TABLE IF NOT EXISTS public.financial_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  reconciliation_type text NOT NULL
    CHECK (reconciliation_type IN ('payments', 'ad_spend', 'wallet', 'full')),

  period_start timestamptz,
  period_end timestamptz,

  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),

  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.financial_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  reconciliation_run_id uuid NOT NULL
    REFERENCES public.financial_reconciliation_runs(id) ON DELETE CASCADE,

  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,

  item_type text NOT NULL,
  source_reference text,
  ledger_journal_id uuid REFERENCES public.ledger_journals(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'matched'
    CHECK (status IN ('matched', 'missing_in_ledger', 'missing_in_provider', 'amount_mismatch', 'currency_mismatch', 'ignored')),

  provider_amount_cents bigint,
  ledger_amount_cents bigint,
  currency text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- 2. Indexes and idempotency constraints
-- ---------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_org_code_currency
  ON public.ledger_accounts(organization_id, code, currency);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_wallet_type_currency
  ON public.ledger_accounts(wallet_id, account_type, currency)
  WHERE ad_account_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_ad_type_currency
  ON public.ledger_accounts(ad_account_id, account_type, currency)
  WHERE ad_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_org
  ON public.ledger_accounts(organization_id);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_wallet
  ON public.ledger_accounts(wallet_id);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_ad_account
  ON public.ledger_accounts(ad_account_id)
  WHERE ad_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_journals_org_idempotency
  ON public.ledger_journals(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_journals_org_source_type
  ON public.ledger_journals(organization_id, source_table, source_id, journal_type)
  WHERE source_table IN ('payment_intents', 'ad_spend_transactions', 'ledger_journals')
    AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_journals_org_created
  ON public.ledger_journals(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_journals_wallet_created
  ON public.ledger_journals(wallet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_journals_status
  ON public.ledger_journals(status);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal
  ON public.ledger_entries(journal_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account
  ON public.ledger_entries(account_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_org_created
  ON public.ledger_entries(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_spend_transactions_org_occurred
  ON public.ad_spend_transactions(organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_spend_transactions_ad_account_occurred
  ON public.ad_spend_transactions(ad_account_id, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_spend_transactions_provider_external
  ON public.ad_spend_transactions(organization_id, provider, external_spend_id)
  WHERE external_spend_id IS NOT NULL;

-- Hardening indexes for existing financial/event tables.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_org_idempotency
  ON public.payment_intents(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_reference
  ON public.payment_intents(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_event_id
  ON public.webhook_events(provider, event_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_transactions_wallet_idempotency
  ON public.wallet_transactions(wallet_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_org_created
  ON public.wallet_transactions(organization_id, created_at DESC);

-- ---------------------------------------------------------------
-- 3. Common trigger helpers
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_accounts_touch_updated_at ON public.ledger_accounts;
CREATE TRIGGER trg_ledger_accounts_touch_updated_at
BEFORE UPDATE ON public.ledger_accounts
FOR EACH ROW
EXECUTE FUNCTION public.ledger_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ledger_journals_touch_updated_at ON public.ledger_journals;
CREATE TRIGGER trg_ledger_journals_touch_updated_at
BEFORE UPDATE ON public.ledger_journals
FOR EACH ROW
EXECUTE FUNCTION public.ledger_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ad_spend_transactions_touch_updated_at ON public.ad_spend_transactions;
CREATE TRIGGER trg_ad_spend_transactions_touch_updated_at
BEFORE UPDATE ON public.ad_spend_transactions
FOR EACH ROW
EXECUTE FUNCTION public.ledger_touch_updated_at();

-- ---------------------------------------------------------------
-- 4. Scope validation triggers
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_ledger_account_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet_org uuid;
  v_wallet_currency text;
  v_ad_org uuid;
  v_ad_currency text;
  v_expected_normal public.ledger_entry_direction;
BEGIN
  SELECT w.organization_id, w.currency
  INTO v_wallet_org, v_wallet_currency
  FROM public.wallets w
  WHERE w.id = NEW.wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet % does not exist', NEW.wallet_id;
  END IF;

  NEW.organization_id := v_wallet_org;
  NEW.currency := v_wallet_currency;

  IF NEW.ad_account_id IS NOT NULL THEN
    SELECT aa.organization_id, aa.currency
    INTO v_ad_org, v_ad_currency
    FROM public.ad_accounts aa
    WHERE aa.id = NEW.ad_account_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ad account % does not exist', NEW.ad_account_id;
    END IF;

    IF v_ad_org <> v_wallet_org THEN
      RAISE EXCEPTION 'Ledger account scope mismatch: ad account and wallet belong to different organizations';
    END IF;

    IF v_ad_currency <> v_wallet_currency THEN
      RAISE EXCEPTION 'Ledger account currency mismatch: ad account currency % differs from wallet currency %', v_ad_currency, v_wallet_currency;
    END IF;
  END IF;

  v_expected_normal := CASE
    WHEN NEW.account_kind IN ('asset', 'expense') THEN 'debit'::public.ledger_entry_direction
    ELSE 'credit'::public.ledger_entry_direction
  END;

  IF NEW.normal_balance <> v_expected_normal THEN
    RAISE EXCEPTION 'Invalid normal balance %. Account kind % must use % normal balance',
      NEW.normal_balance, NEW.account_kind, v_expected_normal;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ledger_account_scope ON public.ledger_accounts;
CREATE TRIGGER trg_validate_ledger_account_scope
BEFORE INSERT OR UPDATE ON public.ledger_accounts
FOR EACH ROW
EXECUTE FUNCTION public.validate_ledger_account_scope();

CREATE OR REPLACE FUNCTION public.validate_ledger_journal_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet_org uuid;
  v_wallet_currency text;
BEGIN
  SELECT w.organization_id, w.currency
  INTO v_wallet_org, v_wallet_currency
  FROM public.wallets w
  WHERE w.id = NEW.wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet % does not exist', NEW.wallet_id;
  END IF;

  NEW.organization_id := v_wallet_org;
  NEW.currency := v_wallet_currency;

  IF NEW.status = 'posted'::public.ledger_journal_status AND NEW.posted_at IS NULL THEN
    NEW.posted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ledger_journal_scope ON public.ledger_journals;
CREATE TRIGGER trg_validate_ledger_journal_scope
BEFORE INSERT OR UPDATE ON public.ledger_journals
FOR EACH ROW
EXECUTE FUNCTION public.validate_ledger_journal_scope();

CREATE OR REPLACE FUNCTION public.validate_ledger_entry_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_journal_org uuid;
  v_journal_wallet uuid;
  v_journal_currency text;
  v_journal_status public.ledger_journal_status;
  v_account_org uuid;
  v_account_wallet uuid;
  v_account_currency text;
BEGIN
  SELECT lj.organization_id, lj.wallet_id, lj.currency, lj.status
  INTO v_journal_org, v_journal_wallet, v_journal_currency, v_journal_status
  FROM public.ledger_journals lj
  WHERE lj.id = NEW.journal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ledger journal % does not exist', NEW.journal_id;
  END IF;

  IF v_journal_status <> 'draft'::public.ledger_journal_status THEN
    RAISE EXCEPTION 'Ledger entries can only be inserted or updated while journal is draft. Current status=%', v_journal_status;
  END IF;

  SELECT la.organization_id, la.wallet_id, la.currency
  INTO v_account_org, v_account_wallet, v_account_currency
  FROM public.ledger_accounts la
  WHERE la.id = NEW.account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ledger account % does not exist', NEW.account_id;
  END IF;

  IF v_account_org <> v_journal_org OR v_account_wallet <> v_journal_wallet OR v_account_currency <> v_journal_currency THEN
    RAISE EXCEPTION 'Ledger entry scope mismatch between journal and account';
  END IF;

  NEW.organization_id := v_journal_org;
  NEW.wallet_id := v_journal_wallet;
  NEW.currency := v_journal_currency;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ledger_entry_scope ON public.ledger_entries;
CREATE TRIGGER trg_validate_ledger_entry_scope
BEFORE INSERT OR UPDATE ON public.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_ledger_entry_scope();

CREATE OR REPLACE FUNCTION public.prevent_posted_ledger_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status public.ledger_journal_status;
BEGIN
  SELECT lj.status
  INTO v_status
  FROM public.ledger_journals lj
  WHERE lj.id = OLD.journal_id;

  IF v_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'Posted ledger entries are immutable. Use ledger_reverse_journal instead.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_ledger_entry_update ON public.ledger_entries;
CREATE TRIGGER trg_prevent_posted_ledger_entry_update
BEFORE UPDATE ON public.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_posted_ledger_entry_mutation();

DROP TRIGGER IF EXISTS trg_prevent_posted_ledger_entry_delete ON public.ledger_entries;
CREATE TRIGGER trg_prevent_posted_ledger_entry_delete
BEFORE DELETE ON public.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_posted_ledger_entry_mutation();

-- ---------------------------------------------------------------
-- 5. Authorization helper
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_has_org_role(
  p_organization_id uuid,
  p_roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
      AND om.status::text = 'active'
      AND (
        p_roles IS NULL
        OR om.role::text = ANY (p_roles)
      )
  );
$$;

-- ---------------------------------------------------------------
-- 6. Account bootstrap helpers
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_wallet_ledger_accounts(p_wallet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_currency text;
BEGIN
  SELECT w.organization_id, w.currency
  INTO v_org, v_currency
  FROM public.wallets w
  WHERE w.id = p_wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet % does not exist', p_wallet_id;
  END IF;

  INSERT INTO public.ledger_accounts (
    organization_id,
    wallet_id,
    ad_account_id,
    code,
    name,
    account_type,
    account_kind,
    normal_balance,
    currency,
    is_system
  )
  VALUES
    (v_org, p_wallet_id, NULL, 'wallet:' || p_wallet_id::text || ':available', 'Wallet available balance', 'wallet_available', 'asset', 'debit', v_currency, true),
    (v_org, p_wallet_id, NULL, 'wallet:' || p_wallet_id::text || ':reserved', 'Wallet reserved balance', 'wallet_reserved', 'asset', 'debit', v_currency, true),
    (v_org, p_wallet_id, NULL, 'wallet:' || p_wallet_id::text || ':external_funding', 'External funding clearing', 'external_funding', 'liability', 'credit', v_currency, true),
    (v_org, p_wallet_id, NULL, 'wallet:' || p_wallet_id::text || ':legacy_opening', 'Legacy opening equity', 'legacy_opening_equity', 'equity', 'credit', v_currency, true),
    (v_org, p_wallet_id, NULL, 'wallet:' || p_wallet_id::text || ':fees', 'Platform fee revenue', 'platform_fee_revenue', 'revenue', 'credit', v_currency, true),
    (v_org, p_wallet_id, NULL, 'wallet:' || p_wallet_id::text || ':refunds', 'Refunds clearing', 'refunds_clearing', 'liability', 'credit', v_currency, true)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_ad_account_ledger_accounts(p_ad_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_currency text;
  v_wallet_id uuid;
BEGIN
  SELECT aa.organization_id, aa.currency, w.id
  INTO v_org, v_currency, v_wallet_id
  FROM public.ad_accounts aa
  JOIN public.wallets w ON w.organization_id = aa.organization_id
  WHERE aa.id = p_ad_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ad account % does not exist or organization has no wallet', p_ad_account_id;
  END IF;

  PERFORM public.ensure_wallet_ledger_accounts(v_wallet_id);

  INSERT INTO public.ledger_accounts (
    organization_id,
    wallet_id,
    ad_account_id,
    code,
    name,
    account_type,
    account_kind,
    normal_balance,
    currency,
    is_system
  )
  VALUES
    (v_org, v_wallet_id, p_ad_account_id, 'ad_account:' || p_ad_account_id::text || ':available', 'Ad account available balance', 'ad_account_available', 'asset', 'debit', v_currency, true),
    (v_org, v_wallet_id, p_ad_account_id, 'ad_account:' || p_ad_account_id::text || ':reserved', 'Ad account reserved balance', 'ad_account_reserved', 'asset', 'debit', v_currency, true),
    (v_org, v_wallet_id, p_ad_account_id, 'ad_account:' || p_ad_account_id::text || ':spend', 'Ad spend expense', 'ad_spend_expense', 'expense', 'debit', v_currency, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.ad_account_balances (
    ad_account_id,
    organization_id,
    balance_cents,
    reserved_balance_cents,
    currency,
    updated_at
  )
  VALUES (p_ad_account_id, v_org, 0, 0, v_currency, now())
  ON CONFLICT (ad_account_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ledger_account_id(
  p_wallet_id uuid,
  p_ad_account_id uuid,
  p_account_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_ad_account_id IS NULL THEN
    PERFORM public.ensure_wallet_ledger_accounts(p_wallet_id);
  ELSE
    PERFORM public.ensure_ad_account_ledger_accounts(p_ad_account_id);
  END IF;

  SELECT la.id
  INTO v_id
  FROM public.ledger_accounts la
  WHERE la.wallet_id = p_wallet_id
    AND la.account_type = p_account_type
    AND (
      (p_ad_account_id IS NULL AND la.ad_account_id IS NULL)
      OR la.ad_account_id = p_ad_account_id
    )
    AND la.status = 'active'
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Ledger account not found. wallet=%, ad_account=%, type=%',
      p_wallet_id, p_ad_account_id, p_account_type;
  END IF;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------
-- 7. Balance views and helpers
-- ---------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_ledger_account_balances
WITH (security_invoker = true) AS
SELECT
  la.id AS account_id,
  la.organization_id,
  la.wallet_id,
  la.ad_account_id,
  la.code,
  la.name,
  la.account_type,
  la.account_kind,
  la.normal_balance,
  la.currency,
  COALESCE(
    SUM(
      CASE
        WHEN lj.id IS NULL THEN 0
        WHEN la.normal_balance = 'debit'::public.ledger_entry_direction
             AND le.direction = 'debit'::public.ledger_entry_direction THEN le.amount_cents
        WHEN la.normal_balance = 'debit'::public.ledger_entry_direction
             AND le.direction = 'credit'::public.ledger_entry_direction THEN -le.amount_cents
        WHEN la.normal_balance = 'credit'::public.ledger_entry_direction
             AND le.direction = 'credit'::public.ledger_entry_direction THEN le.amount_cents
        WHEN la.normal_balance = 'credit'::public.ledger_entry_direction
             AND le.direction = 'debit'::public.ledger_entry_direction THEN -le.amount_cents
        ELSE 0
      END
    ),
    0
  )::bigint AS balance_cents
FROM public.ledger_accounts la
LEFT JOIN public.ledger_entries le
  ON le.account_id = la.id
LEFT JOIN public.ledger_journals lj
  ON lj.id = le.journal_id
 AND lj.status IN ('posted'::public.ledger_journal_status, 'reversed'::public.ledger_journal_status)
GROUP BY
  la.id,
  la.organization_id,
  la.wallet_id,
  la.ad_account_id,
  la.code,
  la.name,
  la.account_type,
  la.account_kind,
  la.normal_balance,
  la.currency;

CREATE OR REPLACE VIEW public.v_wallet_ledger_balances
WITH (security_invoker = true) AS
SELECT
  w.id AS wallet_id,
  w.organization_id,
  w.currency,
  COALESCE(SUM(v.balance_cents) FILTER (WHERE v.account_type = 'wallet_available'), 0)::bigint AS available_balance_cents,
  COALESCE(SUM(v.balance_cents) FILTER (WHERE v.account_type = 'wallet_reserved'), 0)::bigint AS reserved_balance_cents,
  COALESCE(SUM(v.balance_cents) FILTER (WHERE v.account_type = 'external_funding'), 0)::bigint AS external_funding_balance_cents,
  COALESCE(SUM(v.balance_cents) FILTER (WHERE v.account_type = 'platform_fee_revenue'), 0)::bigint AS platform_fee_revenue_cents,
  COALESCE(SUM(v.balance_cents) FILTER (WHERE v.account_type = 'refunds_clearing'), 0)::bigint AS refunds_clearing_cents,
  now() AS calculated_at
FROM public.wallets w
LEFT JOIN public.v_ledger_account_balances v
  ON v.wallet_id = w.id
 AND v.ad_account_id IS NULL
GROUP BY w.id, w.organization_id, w.currency;

CREATE OR REPLACE VIEW public.v_ad_account_ledger_balances
WITH (security_invoker = true) AS
SELECT
  aa.id AS ad_account_id,
  aa.organization_id,
  w.id AS wallet_id,
  aa.currency,
  COALESCE(SUM(v.balance_cents) FILTER (WHERE v.account_type = 'ad_account_available'), 0)::bigint AS available_balance_cents,
  COALESCE(SUM(v.balance_cents) FILTER (WHERE v.account_type = 'ad_account_reserved'), 0)::bigint AS reserved_balance_cents,
  COALESCE(SUM(v.balance_cents) FILTER (WHERE v.account_type = 'ad_spend_expense'), 0)::bigint AS lifetime_spend_cents,
  now() AS calculated_at
FROM public.ad_accounts aa
JOIN public.wallets w ON w.organization_id = aa.organization_id
LEFT JOIN public.v_ledger_account_balances v
  ON v.ad_account_id = aa.id
GROUP BY aa.id, aa.organization_id, w.id, aa.currency;

CREATE OR REPLACE VIEW public.v_wallet_ledger_integrity
WITH (security_invoker = true) AS
SELECT
  w.id AS wallet_id,
  w.organization_id,
  w.currency,
  w.balance_cents AS legacy_available_balance_cents,
  w.reserved_balance_cents AS legacy_reserved_balance_cents,
  COALESCE(v.available_balance_cents, 0) AS ledger_available_balance_cents,
  COALESCE(v.reserved_balance_cents, 0) AS ledger_reserved_balance_cents,
  w.balance_cents - COALESCE(v.available_balance_cents, 0) AS available_difference_cents,
  w.reserved_balance_cents - COALESCE(v.reserved_balance_cents, 0) AS reserved_difference_cents
FROM public.wallets w
LEFT JOIN public.v_wallet_ledger_balances v ON v.wallet_id = w.id;

CREATE OR REPLACE FUNCTION public.get_ledger_account_balance_cents(p_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(v.balance_cents, 0)::bigint
  FROM public.v_ledger_account_balances v
  WHERE v.account_id = p_account_id;
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_available_balance_cents(p_wallet_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(v.available_balance_cents, 0)::bigint
  FROM public.v_wallet_ledger_balances v
  WHERE v.wallet_id = p_wallet_id;
$$;

CREATE OR REPLACE FUNCTION public.get_ad_account_available_balance_cents(p_ad_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(v.available_balance_cents, 0)::bigint
  FROM public.v_ad_account_ledger_balances v
  WHERE v.ad_account_id = p_ad_account_id;
$$;

-- ---------------------------------------------------------------
-- 8. Ledger posting helpers
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_ledger_journal_balanced(p_journal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_debits bigint;
  v_credits bigint;
BEGIN
  SELECT
    COALESCE(SUM(le.amount_cents) FILTER (WHERE le.direction = 'debit'::public.ledger_entry_direction), 0)::bigint,
    COALESCE(SUM(le.amount_cents) FILTER (WHERE le.direction = 'credit'::public.ledger_entry_direction), 0)::bigint
  INTO v_debits, v_credits
  FROM public.ledger_entries le
  WHERE le.journal_id = p_journal_id;

  IF v_debits <= 0 OR v_credits <= 0 THEN
    RAISE EXCEPTION 'Ledger journal % must contain debit and credit entries', p_journal_id;
  END IF;

  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'Unbalanced ledger journal %. debits=%, credits=%', p_journal_id, v_debits, v_credits;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_post_two_sided(
  p_organization_id uuid,
  p_wallet_id uuid,
  p_journal_type text,
  p_debit_account_id uuid,
  p_credit_account_id uuid,
  p_amount_cents bigint,
  p_currency text,
  p_source_table text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_provider_reference text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_journal_id uuid;
  v_existing_journal_id uuid;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Ledger amount must be positive';
  END IF;

  IF p_debit_account_id = p_credit_account_id THEN
    RAISE EXCEPTION 'Debit and credit accounts must be different';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT lj.id
    INTO v_existing_journal_id
    FROM public.ledger_journals lj
    WHERE lj.organization_id = p_organization_id
      AND lj.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing_journal_id IS NOT NULL THEN
      RETURN v_existing_journal_id;
    END IF;
  END IF;

  IF p_source_table IN ('payment_intents', 'ad_spend_transactions', 'ledger_journals')
     AND p_source_id IS NOT NULL THEN
    SELECT lj.id
    INTO v_existing_journal_id
    FROM public.ledger_journals lj
    WHERE lj.organization_id = p_organization_id
      AND lj.source_table = p_source_table
      AND lj.source_id = p_source_id
      AND lj.journal_type = p_journal_type
    LIMIT 1;

    IF v_existing_journal_id IS NOT NULL THEN
      RETURN v_existing_journal_id;
    END IF;
  END IF;

  INSERT INTO public.ledger_journals (
    organization_id,
    wallet_id,
    journal_type,
    status,
    amount_cents,
    currency,
    source_table,
    source_id,
    provider,
    provider_reference,
    idempotency_key,
    description,
    metadata,
    created_by,
    posted_at
  )
  VALUES (
    p_organization_id,
    p_wallet_id,
    p_journal_type,
    'draft',
    p_amount_cents,
    p_currency,
    p_source_table,
    p_source_id,
    p_provider,
    p_provider_reference,
    p_idempotency_key,
    p_description,
    v_metadata,
    p_created_by,
    NULL
  )
  RETURNING id INTO v_journal_id;

  INSERT INTO public.ledger_entries (
    journal_id,
    organization_id,
    wallet_id,
    account_id,
    direction,
    amount_cents,
    currency
  )
  VALUES
    (v_journal_id, p_organization_id, p_wallet_id, p_debit_account_id, 'debit', p_amount_cents, p_currency),
    (v_journal_id, p_organization_id, p_wallet_id, p_credit_account_id, 'credit', p_amount_cents, p_currency);

  PERFORM public.assert_ledger_journal_balanced(v_journal_id);

  UPDATE public.ledger_journals lj
  SET
    status = 'posted',
    posted_at = now(),
    updated_at = now()
  WHERE lj.id = v_journal_id;

  RETURN v_journal_id;
EXCEPTION
  WHEN unique_violation THEN
    IF p_idempotency_key IS NOT NULL THEN
      SELECT lj.id
      INTO v_existing_journal_id
      FROM public.ledger_journals lj
      WHERE lj.organization_id = p_organization_id
        AND lj.idempotency_key = p_idempotency_key
      LIMIT 1;

      IF v_existing_journal_id IS NOT NULL THEN
        RETURN v_existing_journal_id;
      END IF;
    END IF;

    IF p_source_table IN ('payment_intents', 'ad_spend_transactions', 'ledger_journals')
       AND p_source_id IS NOT NULL THEN
      SELECT lj.id
      INTO v_existing_journal_id
      FROM public.ledger_journals lj
      WHERE lj.organization_id = p_organization_id
        AND lj.source_table = p_source_table
        AND lj.source_id = p_source_id
        AND lj.journal_type = p_journal_type
      LIMIT 1;

      IF v_existing_journal_id IS NOT NULL THEN
        RETURN v_existing_journal_id;
      END IF;
    END IF;

    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_legacy_balances(p_wallet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet_available bigint := 0;
  v_wallet_reserved bigint := 0;
BEGIN
  SELECT
    COALESCE(v.available_balance_cents, 0),
    COALESCE(v.reserved_balance_cents, 0)
  INTO v_wallet_available, v_wallet_reserved
  FROM public.v_wallet_ledger_balances v
  WHERE v.wallet_id = p_wallet_id;

  v_wallet_available := COALESCE(v_wallet_available, 0);
  v_wallet_reserved := COALESCE(v_wallet_reserved, 0);

  UPDATE public.wallets w
  SET
    balance_cents = GREATEST(v_wallet_available, 0),
    reserved_balance_cents = GREATEST(v_wallet_reserved, 0),
    updated_at = now()
  WHERE w.id = p_wallet_id;

  INSERT INTO public.ad_account_balances (
    ad_account_id,
    organization_id,
    balance_cents,
    reserved_balance_cents,
    currency,
    updated_at
  )
  SELECT
    v.ad_account_id,
    v.organization_id,
    GREATEST(v.available_balance_cents, 0),
    GREATEST(v.reserved_balance_cents, 0),
    v.currency,
    now()
  FROM public.v_ad_account_ledger_balances v
  WHERE v.wallet_id = p_wallet_id
  ON CONFLICT (ad_account_id) DO UPDATE
  SET
    balance_cents = EXCLUDED.balance_cents,
    reserved_balance_cents = EXCLUDED.reserved_balance_cents,
    currency = EXCLUDED.currency,
    updated_at = now();
END;
$$;

-- ---------------------------------------------------------------
-- 9. Product RPCs
-- ---------------------------------------------------------------

-- Backend/webhook-only. Call this only after verifying the payment provider event
-- against Stripe, Mercado Pago, Culqi or manual admin approval.
CREATE OR REPLACE FUNCTION public.ledger_confirm_deposit(
  p_payment_intent_id uuid,
  p_provider_reference text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pi public.payment_intents%ROWTYPE;
  v_wallet_available_account_id uuid;
  v_external_funding_account_id uuid;
  v_journal_id uuid;
  v_key text;
BEGIN
  SELECT *
  INTO v_pi
  FROM public.payment_intents pi
  WHERE pi.id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent % not found', p_payment_intent_id;
  END IF;

  -- Authenticated users must have finance-level access.
  -- Service-role/backend calls usually have auth.uid() IS NULL and are allowed.
  IF auth.uid() IS NOT NULL
     AND NOT public.ledger_has_org_role(v_pi.organization_id, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized to confirm this deposit';
  END IF;

  PERFORM public.ensure_wallet_ledger_accounts(v_pi.wallet_id);

  v_wallet_available_account_id := public.get_ledger_account_id(v_pi.wallet_id, NULL, 'wallet_available');
  v_external_funding_account_id := public.get_ledger_account_id(v_pi.wallet_id, NULL, 'external_funding');

  v_key := COALESCE(
    p_idempotency_key,
    'payment_intent:' || p_payment_intent_id::text || ':confirm'
  );

  v_journal_id := public.ledger_post_two_sided(
    v_pi.organization_id,
    v_pi.wallet_id,
    'deposit_confirmed',
    v_wallet_available_account_id,
    v_external_funding_account_id,
    v_pi.amount_cents,
    v_pi.currency,
    'payment_intents',
    v_pi.id,
    v_pi.provider::text,
    COALESCE(p_provider_reference, v_pi.provider_reference),
    v_key,
    'Deposit confirmed',
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('payment_intent_id', v_pi.id),
    auth.uid()
  );

  UPDATE public.payment_intents pi
  SET
    status = 'succeeded',
    provider_reference = COALESCE(p_provider_reference, pi.provider_reference),
    succeeded_at = COALESCE(pi.succeeded_at, now()),
    updated_at = now(),
    metadata = COALESCE(pi.metadata, '{}'::jsonb) || jsonb_build_object('ledger_journal_id', v_journal_id)
  WHERE pi.id = v_pi.id;

  PERFORM public.recalculate_legacy_balances(v_pi.wallet_id);

  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_pi.organization_id,
    auth.uid(),
    'ledger.deposit_confirmed',
    'payment_intent',
    v_pi.id,
    jsonb_build_object('ledger_journal_id', v_journal_id, 'amount_cents', v_pi.amount_cents, 'currency', v_pi.currency)
  );

  RETURN v_journal_id;
END;
$$;

-- Move funds from wallet available balance to one ad account available balance.
CREATE OR REPLACE FUNCTION public.ledger_allocate_to_ad_account(
  p_ad_account_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_currency text;
  v_wallet_id uuid;
  v_wallet_available_account_id uuid;
  v_ad_available_account_id uuid;
  v_available bigint;
  v_journal_id uuid;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT aa.organization_id, aa.currency, w.id
  INTO v_org, v_currency, v_wallet_id
  FROM public.ad_accounts aa
  JOIN public.wallets w ON w.organization_id = aa.organization_id
  WHERE aa.id = p_ad_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ad account % not found or organization has no wallet', p_ad_account_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.ledger_has_org_role(v_org, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized to allocate funds';
  END IF;

  -- Serialize wallet movements for this organization/wallet.
  PERFORM 1 FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  PERFORM 1 FROM public.ad_accounts WHERE id = p_ad_account_id FOR UPDATE;

  PERFORM public.ensure_ad_account_ledger_accounts(p_ad_account_id);

  v_wallet_available_account_id := public.get_ledger_account_id(v_wallet_id, NULL, 'wallet_available');
  v_ad_available_account_id := public.get_ledger_account_id(v_wallet_id, p_ad_account_id, 'ad_account_available');

  v_available := public.get_ledger_account_balance_cents(v_wallet_available_account_id);

  IF v_available < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient wallet balance. available=%, requested=%', v_available, p_amount_cents;
  END IF;

  v_journal_id := public.ledger_post_two_sided(
    v_org,
    v_wallet_id,
    'allocation_to_ad_account',
    v_ad_available_account_id,
    v_wallet_available_account_id,
    p_amount_cents,
    v_currency,
    'ad_accounts',
    p_ad_account_id,
    NULL,
    NULL,
    p_idempotency_key,
    COALESCE(p_description, 'Allocation to ad account'),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('ad_account_id', p_ad_account_id),
    auth.uid()
  );

  PERFORM public.recalculate_legacy_balances(v_wallet_id);

  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_org,
    auth.uid(),
    'ledger.allocation_to_ad_account',
    'ad_account',
    p_ad_account_id,
    jsonb_build_object('ledger_journal_id', v_journal_id, 'amount_cents', p_amount_cents, 'currency', v_currency)
  );

  RETURN v_journal_id;
END;
$$;

-- Move ad account available balance into reserved balance.
CREATE OR REPLACE FUNCTION public.ledger_reserve_ad_account_budget(
  p_ad_account_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_currency text;
  v_wallet_id uuid;
  v_ad_available_account_id uuid;
  v_ad_reserved_account_id uuid;
  v_available bigint;
  v_journal_id uuid;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT aa.organization_id, aa.currency, w.id
  INTO v_org, v_currency, v_wallet_id
  FROM public.ad_accounts aa
  JOIN public.wallets w ON w.organization_id = aa.organization_id
  WHERE aa.id = p_ad_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ad account % not found or organization has no wallet', p_ad_account_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.ledger_has_org_role(v_org, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized to reserve funds';
  END IF;

  PERFORM 1 FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  PERFORM 1 FROM public.ad_accounts WHERE id = p_ad_account_id FOR UPDATE;

  PERFORM public.ensure_ad_account_ledger_accounts(p_ad_account_id);

  v_ad_available_account_id := public.get_ledger_account_id(v_wallet_id, p_ad_account_id, 'ad_account_available');
  v_ad_reserved_account_id := public.get_ledger_account_id(v_wallet_id, p_ad_account_id, 'ad_account_reserved');

  v_available := public.get_ledger_account_balance_cents(v_ad_available_account_id);

  IF v_available < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient ad account available balance. available=%, requested=%', v_available, p_amount_cents;
  END IF;

  v_journal_id := public.ledger_post_two_sided(
    v_org,
    v_wallet_id,
    'ad_account_budget_reserved',
    v_ad_reserved_account_id,
    v_ad_available_account_id,
    p_amount_cents,
    v_currency,
    'ad_accounts',
    p_ad_account_id,
    NULL,
    NULL,
    p_idempotency_key,
    COALESCE(p_description, 'Ad account budget reserved'),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('ad_account_id', p_ad_account_id),
    auth.uid()
  );

  PERFORM public.recalculate_legacy_balances(v_wallet_id);

  RETURN v_journal_id;
END;
$$;

-- Release reserved ad account budget back to ad account available balance.
CREATE OR REPLACE FUNCTION public.ledger_release_ad_account_budget(
  p_ad_account_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_currency text;
  v_wallet_id uuid;
  v_ad_available_account_id uuid;
  v_ad_reserved_account_id uuid;
  v_reserved bigint;
  v_journal_id uuid;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT aa.organization_id, aa.currency, w.id
  INTO v_org, v_currency, v_wallet_id
  FROM public.ad_accounts aa
  JOIN public.wallets w ON w.organization_id = aa.organization_id
  WHERE aa.id = p_ad_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ad account % not found or organization has no wallet', p_ad_account_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.ledger_has_org_role(v_org, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized to release funds';
  END IF;

  PERFORM 1 FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  PERFORM 1 FROM public.ad_accounts WHERE id = p_ad_account_id FOR UPDATE;

  PERFORM public.ensure_ad_account_ledger_accounts(p_ad_account_id);

  v_ad_available_account_id := public.get_ledger_account_id(v_wallet_id, p_ad_account_id, 'ad_account_available');
  v_ad_reserved_account_id := public.get_ledger_account_id(v_wallet_id, p_ad_account_id, 'ad_account_reserved');

  v_reserved := public.get_ledger_account_balance_cents(v_ad_reserved_account_id);

  IF v_reserved < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient ad account reserved balance. reserved=%, requested=%', v_reserved, p_amount_cents;
  END IF;

  v_journal_id := public.ledger_post_two_sided(
    v_org,
    v_wallet_id,
    'ad_account_budget_released',
    v_ad_available_account_id,
    v_ad_reserved_account_id,
    p_amount_cents,
    v_currency,
    'ad_accounts',
    p_ad_account_id,
    NULL,
    NULL,
    p_idempotency_key,
    COALESCE(p_description, 'Ad account budget released'),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('ad_account_id', p_ad_account_id),
    auth.uid()
  );

  PERFORM public.recalculate_legacy_balances(v_wallet_id);

  RETURN v_journal_id;
END;
$$;

-- Backend/integration-only. Records exact ad spend as a transaction and ledger journal.
CREATE OR REPLACE FUNCTION public.ledger_record_ad_spend(
  p_ad_account_id uuid,
  p_amount_cents bigint,
  p_occurred_at timestamptz DEFAULT now(),
  p_external_spend_id text DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_ad_set_id uuid DEFAULT NULL,
  p_ad_id uuid DEFAULT NULL,
  p_spend_source text DEFAULT 'available',
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_currency text;
  v_wallet_id uuid;
  v_provider text;
  v_source_account_id uuid;
  v_spend_expense_account_id uuid;
  v_source_balance bigint;
  v_journal_id uuid;
  v_spend_id uuid;
  v_key text;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_spend_source NOT IN ('available', 'reserved') THEN
    RAISE EXCEPTION 'Invalid spend source %. Expected available or reserved', p_spend_source;
  END IF;

  IF (p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '')
     AND (p_external_spend_id IS NULL OR btrim(p_external_spend_id) = '') THEN
    RAISE EXCEPTION 'Either idempotency_key or external_spend_id is required';
  END IF;

  SELECT aa.organization_id, aa.currency, aa.platform::text, w.id
  INTO v_org, v_currency, v_provider, v_wallet_id
  FROM public.ad_accounts aa
  JOIN public.wallets w ON w.organization_id = aa.organization_id
  WHERE aa.id = p_ad_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ad account % not found or organization has no wallet', p_ad_account_id;
  END IF;

  -- Service/backend calls are expected. Authenticated calls must have finance access.
  IF auth.uid() IS NOT NULL
     AND NOT public.ledger_has_org_role(v_org, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized to record ad spend';
  END IF;

  PERFORM 1 FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  PERFORM 1 FROM public.ad_accounts WHERE id = p_ad_account_id FOR UPDATE;

  PERFORM public.ensure_ad_account_ledger_accounts(p_ad_account_id);

  v_source_account_id := public.get_ledger_account_id(
    v_wallet_id,
    p_ad_account_id,
    CASE WHEN p_spend_source = 'reserved' THEN 'ad_account_reserved' ELSE 'ad_account_available' END
  );

  v_spend_expense_account_id := public.get_ledger_account_id(v_wallet_id, p_ad_account_id, 'ad_spend_expense');

  v_source_balance := public.get_ledger_account_balance_cents(v_source_account_id);

  IF v_source_balance < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient ad account % balance. available=%, requested=%', p_spend_source, v_source_balance, p_amount_cents;
  END IF;

  v_key := COALESCE(
    p_idempotency_key,
    CASE
      WHEN p_external_spend_id IS NOT NULL THEN 'ad_spend:' || p_ad_account_id::text || ':' || p_external_spend_id
      ELSE NULL
    END
  );

  IF p_external_spend_id IS NOT NULL THEN
    SELECT ast.id, ast.ledger_journal_id
    INTO v_spend_id, v_journal_id
    FROM public.ad_spend_transactions ast
    WHERE ast.organization_id = v_org
      AND ast.provider = v_provider
      AND ast.external_spend_id = p_external_spend_id
    LIMIT 1;

    IF v_journal_id IS NOT NULL THEN
      RETURN v_journal_id;
    END IF;
  END IF;

  INSERT INTO public.ad_spend_transactions (
    organization_id,
    wallet_id,
    ad_account_id,
    campaign_id,
    ad_set_id,
    ad_id,
    provider,
    external_spend_id,
    spend_source,
    amount_cents,
    currency,
    occurred_at,
    metadata
  )
  VALUES (
    v_org,
    v_wallet_id,
    p_ad_account_id,
    p_campaign_id,
    p_ad_set_id,
    p_ad_id,
    v_provider,
    p_external_spend_id,
    p_spend_source,
    p_amount_cents,
    v_currency,
    p_occurred_at,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_spend_id;

  v_journal_id := public.ledger_post_two_sided(
    v_org,
    v_wallet_id,
    'ad_spend_recorded',
    v_spend_expense_account_id,
    v_source_account_id,
    p_amount_cents,
    v_currency,
    'ad_spend_transactions',
    v_spend_id,
    v_provider,
    p_external_spend_id,
    v_key,
    'Ad spend recorded',
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('ad_account_id', p_ad_account_id, 'spend_source', p_spend_source),
    auth.uid()
  );

  UPDATE public.ad_spend_transactions ast
  SET ledger_journal_id = v_journal_id,
      updated_at = now()
  WHERE ast.id = v_spend_id;

  PERFORM public.recalculate_legacy_balances(v_wallet_id);

  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_org,
    auth.uid(),
    'ledger.ad_spend_recorded',
    'ad_spend_transaction',
    v_spend_id,
    jsonb_build_object('ledger_journal_id', v_journal_id, 'amount_cents', p_amount_cents, 'currency', v_currency)
  );

  RETURN v_journal_id;
EXCEPTION
  WHEN unique_violation THEN
    IF p_external_spend_id IS NOT NULL THEN
      SELECT ast.id, ast.ledger_journal_id
      INTO v_spend_id, v_journal_id
      FROM public.ad_spend_transactions ast
      WHERE ast.organization_id = v_org
        AND ast.provider = v_provider
        AND ast.external_spend_id = p_external_spend_id
      LIMIT 1;

      IF v_journal_id IS NOT NULL THEN
        RETURN v_journal_id;
      END IF;
    END IF;

    RAISE;
END;
$$;

-- Refund/recover funds from an ad account balance back to wallet available balance.
CREATE OR REPLACE FUNCTION public.ledger_refund_from_ad_account_to_wallet(
  p_ad_account_id uuid,
  p_amount_cents bigint,
  p_source_balance text DEFAULT 'available',
  p_idempotency_key text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_currency text;
  v_wallet_id uuid;
  v_wallet_available_account_id uuid;
  v_source_account_id uuid;
  v_source_balance_cents bigint;
  v_key text;
  v_journal_id uuid;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_source_balance NOT IN ('available', 'reserved') THEN
    RAISE EXCEPTION 'Invalid source balance %. Expected available or reserved', p_source_balance;
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT aa.organization_id, aa.currency, w.id
  INTO v_org, v_currency, v_wallet_id
  FROM public.ad_accounts aa
  JOIN public.wallets w ON w.organization_id = aa.organization_id
  WHERE aa.id = p_ad_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ad account % not found or organization has no wallet', p_ad_account_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.ledger_has_org_role(v_org, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized to refund funds';
  END IF;

  PERFORM 1 FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  PERFORM 1 FROM public.ad_accounts WHERE id = p_ad_account_id FOR UPDATE;

  PERFORM public.ensure_ad_account_ledger_accounts(p_ad_account_id);

  v_wallet_available_account_id := public.get_ledger_account_id(v_wallet_id, NULL, 'wallet_available');
  v_source_account_id := public.get_ledger_account_id(
    v_wallet_id,
    p_ad_account_id,
    CASE WHEN p_source_balance = 'reserved' THEN 'ad_account_reserved' ELSE 'ad_account_available' END
  );

  v_source_balance_cents := public.get_ledger_account_balance_cents(v_source_account_id);

  IF v_source_balance_cents < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient ad account % balance. available=%, requested=%', p_source_balance, v_source_balance_cents, p_amount_cents;
  END IF;

  v_key := p_idempotency_key;

  v_journal_id := public.ledger_post_two_sided(
    v_org,
    v_wallet_id,
    'ad_account_refund_to_wallet',
    v_wallet_available_account_id,
    v_source_account_id,
    p_amount_cents,
    v_currency,
    'ad_accounts',
    p_ad_account_id,
    NULL,
    NULL,
    v_key,
    COALESCE(p_description, 'Refund from ad account to wallet'),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('ad_account_id', p_ad_account_id, 'source_balance', p_source_balance),
    auth.uid()
  );

  PERFORM public.recalculate_legacy_balances(v_wallet_id);

  RETURN v_journal_id;
END;
$$;

-- Reversal is the only valid way to correct a posted journal.
CREATE OR REPLACE FUNCTION public.ledger_reverse_journal(
  p_journal_id uuid,
  p_reason text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_original public.ledger_journals%ROWTYPE;
  v_reversal_id uuid;
  v_existing uuid;
  v_key text;
BEGIN
  SELECT *
  INTO v_original
  FROM public.ledger_journals lj
  WHERE lj.id = p_journal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ledger journal % not found', p_journal_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.ledger_has_org_role(v_original.organization_id, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized to reverse journals';
  END IF;

  IF v_original.status = 'reversed'::public.ledger_journal_status AND v_original.reversed_by_journal_id IS NOT NULL THEN
    RETURN v_original.reversed_by_journal_id;
  END IF;

  IF v_original.status <> 'posted'::public.ledger_journal_status THEN
    RAISE EXCEPTION 'Only posted journals can be reversed. Current status=%', v_original.status;
  END IF;

  v_key := COALESCE(p_idempotency_key, 'reversal:' || p_journal_id::text);

  SELECT lj.id
  INTO v_existing
  FROM public.ledger_journals lj
  WHERE lj.organization_id = v_original.organization_id
    AND lj.idempotency_key = v_key
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.ledger_journals (
    organization_id,
    wallet_id,
    journal_type,
    status,
    amount_cents,
    currency,
    source_table,
    source_id,
    provider,
    provider_reference,
    idempotency_key,
    reversal_of_journal_id,
    description,
    metadata,
    created_by,
    posted_at
  )
  VALUES (
    v_original.organization_id,
    v_original.wallet_id,
    'journal_reversal',
    'draft',
    v_original.amount_cents,
    v_original.currency,
    'ledger_journals',
    v_original.id,
    v_original.provider,
    v_original.provider_reference,
    v_key,
    v_original.id,
    COALESCE(NULLIF(btrim(p_reason), ''), 'Ledger journal reversal'),
    jsonb_build_object('reversal_reason', p_reason, 'original_journal_id', v_original.id),
    auth.uid(),
    NULL
  )
  RETURNING id INTO v_reversal_id;

  INSERT INTO public.ledger_entries (
    journal_id,
    organization_id,
    wallet_id,
    account_id,
    direction,
    amount_cents,
    currency,
    metadata
  )
  SELECT
    v_reversal_id,
    le.organization_id,
    le.wallet_id,
    le.account_id,
    CASE
      WHEN le.direction = 'debit'::public.ledger_entry_direction THEN 'credit'::public.ledger_entry_direction
      ELSE 'debit'::public.ledger_entry_direction
    END,
    le.amount_cents,
    le.currency,
    jsonb_build_object('reverses_entry_id', le.id)
  FROM public.ledger_entries le
  WHERE le.journal_id = v_original.id;

  PERFORM public.assert_ledger_journal_balanced(v_reversal_id);

  UPDATE public.ledger_journals lj
  SET
    status = 'posted',
    posted_at = now(),
    updated_at = now()
  WHERE lj.id = v_reversal_id;

  UPDATE public.ledger_journals lj
  SET
    status = 'reversed',
    reversed_by_journal_id = v_reversal_id,
    updated_at = now()
  WHERE lj.id = v_original.id;

  PERFORM public.recalculate_legacy_balances(v_original.wallet_id);

  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_original.organization_id,
    auth.uid(),
    'ledger.journal_reversed',
    'ledger_journal',
    v_original.id,
    jsonb_build_object('reversal_journal_id', v_reversal_id, 'reason', p_reason)
  );

  RETURN v_reversal_id;
END;
$$;

-- ---------------------------------------------------------------
-- 10. Automatic account creation for future wallets/ad accounts
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.after_wallet_insert_ensure_ledger_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.ensure_wallet_ledger_accounts(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_wallet_insert_ensure_ledger_accounts ON public.wallets;
CREATE TRIGGER trg_after_wallet_insert_ensure_ledger_accounts
AFTER INSERT ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.after_wallet_insert_ensure_ledger_accounts();

CREATE OR REPLACE FUNCTION public.after_ad_account_insert_ensure_ledger_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.ensure_ad_account_ledger_accounts(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_ad_account_insert_ensure_ledger_accounts ON public.ad_accounts;
CREATE TRIGGER trg_after_ad_account_insert_ensure_ledger_accounts
AFTER INSERT ON public.ad_accounts
FOR EACH ROW
EXECUTE FUNCTION public.after_ad_account_insert_ensure_ledger_accounts();

-- ---------------------------------------------------------------
-- 11. Bootstrap existing data into ledger accounts and opening journals
-- ---------------------------------------------------------------

SELECT public.ensure_wallet_ledger_accounts(w.id)
FROM public.wallets w;

SELECT public.ensure_ad_account_ledger_accounts(aa.id)
FROM public.ad_accounts aa;

DO $$
DECLARE
  r record;
  v_debit_account_id uuid;
  v_credit_account_id uuid;
  v_journal_id uuid;
BEGIN
  -- Opening balances for wallet legacy available and reserved balances.
  FOR r IN
    SELECT w.id AS wallet_id,
           w.organization_id,
           w.currency,
           COALESCE(w.balance_cents, 0) AS balance_cents,
           COALESCE(w.reserved_balance_cents, 0) AS reserved_balance_cents
    FROM public.wallets w
  LOOP
    PERFORM public.ensure_wallet_ledger_accounts(r.wallet_id);
    v_credit_account_id := public.get_ledger_account_id(r.wallet_id, NULL, 'legacy_opening_equity');

    IF r.balance_cents > 0 THEN
      v_debit_account_id := public.get_ledger_account_id(r.wallet_id, NULL, 'wallet_available');

      v_journal_id := public.ledger_post_two_sided(
        r.organization_id,
        r.wallet_id,
        'legacy_wallet_available_opening',
        v_debit_account_id,
        v_credit_account_id,
        r.balance_cents,
        r.currency,
        'wallets',
        r.wallet_id,
        NULL,
        NULL,
        'legacy:wallet:' || r.wallet_id::text || ':available',
        'Opening balance from wallets.balance_cents',
        jsonb_build_object('legacy_table', 'wallets', 'legacy_column', 'balance_cents'),
        NULL
      );
    END IF;

    IF r.reserved_balance_cents > 0 THEN
      v_debit_account_id := public.get_ledger_account_id(r.wallet_id, NULL, 'wallet_reserved');

      v_journal_id := public.ledger_post_two_sided(
        r.organization_id,
        r.wallet_id,
        'legacy_wallet_reserved_opening',
        v_debit_account_id,
        v_credit_account_id,
        r.reserved_balance_cents,
        r.currency,
        'wallets',
        r.wallet_id,
        NULL,
        NULL,
        'legacy:wallet:' || r.wallet_id::text || ':reserved',
        'Opening balance from wallets.reserved_balance_cents',
        jsonb_build_object('legacy_table', 'wallets', 'legacy_column', 'reserved_balance_cents'),
        NULL
      );
    END IF;
  END LOOP;

  -- Opening balances for existing ad account balances.
  FOR r IN
    SELECT aa.id AS ad_account_id,
           aa.organization_id,
           aa.currency,
           w.id AS wallet_id,
           COALESCE(ab.balance_cents, 0) AS balance_cents,
           COALESCE(ab.reserved_balance_cents, 0) AS reserved_balance_cents
    FROM public.ad_accounts aa
    JOIN public.wallets w ON w.organization_id = aa.organization_id
    LEFT JOIN public.ad_account_balances ab ON ab.ad_account_id = aa.id
  LOOP
    PERFORM public.ensure_ad_account_ledger_accounts(r.ad_account_id);
    v_credit_account_id := public.get_ledger_account_id(r.wallet_id, NULL, 'legacy_opening_equity');

    IF r.balance_cents > 0 THEN
      v_debit_account_id := public.get_ledger_account_id(r.wallet_id, r.ad_account_id, 'ad_account_available');

      v_journal_id := public.ledger_post_two_sided(
        r.organization_id,
        r.wallet_id,
        'legacy_ad_account_available_opening',
        v_debit_account_id,
        v_credit_account_id,
        r.balance_cents,
        r.currency,
        'ad_accounts',
        r.ad_account_id,
        NULL,
        NULL,
        'legacy:ad_account:' || r.ad_account_id::text || ':available',
        'Opening balance from ad_account_balances.balance_cents',
        jsonb_build_object('legacy_table', 'ad_account_balances', 'legacy_column', 'balance_cents'),
        NULL
      );
    END IF;

    IF r.reserved_balance_cents > 0 THEN
      v_debit_account_id := public.get_ledger_account_id(r.wallet_id, r.ad_account_id, 'ad_account_reserved');

      v_journal_id := public.ledger_post_two_sided(
        r.organization_id,
        r.wallet_id,
        'legacy_ad_account_reserved_opening',
        v_debit_account_id,
        v_credit_account_id,
        r.reserved_balance_cents,
        r.currency,
        'ad_accounts',
        r.ad_account_id,
        NULL,
        NULL,
        'legacy:ad_account:' || r.ad_account_id::text || ':reserved',
        'Opening balance from ad_account_balances.reserved_balance_cents',
        jsonb_build_object('legacy_table', 'ad_account_balances', 'legacy_column', 'reserved_balance_cents'),
        NULL
      );
    END IF;
  END LOOP;
END $$;

-- Sync compatibility columns after opening journal creation.
SELECT public.recalculate_legacy_balances(w.id)
FROM public.wallets w;

-- ---------------------------------------------------------------
-- 12. Row Level Security and grants
-- ---------------------------------------------------------------

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_spend_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_reconciliation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_accounts_select_org_members ON public.ledger_accounts;
CREATE POLICY ledger_accounts_select_org_members
ON public.ledger_accounts
FOR SELECT
TO authenticated
USING (public.ledger_has_org_role(organization_id, NULL));

DROP POLICY IF EXISTS ledger_journals_select_org_members ON public.ledger_journals;
CREATE POLICY ledger_journals_select_org_members
ON public.ledger_journals
FOR SELECT
TO authenticated
USING (public.ledger_has_org_role(organization_id, NULL));

DROP POLICY IF EXISTS ledger_entries_select_org_members ON public.ledger_entries;
CREATE POLICY ledger_entries_select_org_members
ON public.ledger_entries
FOR SELECT
TO authenticated
USING (public.ledger_has_org_role(organization_id, NULL));

DROP POLICY IF EXISTS ad_spend_transactions_select_org_members ON public.ad_spend_transactions;
CREATE POLICY ad_spend_transactions_select_org_members
ON public.ad_spend_transactions
FOR SELECT
TO authenticated
USING (public.ledger_has_org_role(organization_id, NULL));

DROP POLICY IF EXISTS financial_reconciliation_runs_select_org_members ON public.financial_reconciliation_runs;
CREATE POLICY financial_reconciliation_runs_select_org_members
ON public.financial_reconciliation_runs
FOR SELECT
TO authenticated
USING (organization_id IS NULL OR public.ledger_has_org_role(organization_id, ARRAY['owner', 'admin', 'finance']));

DROP POLICY IF EXISTS financial_reconciliation_items_select_org_members ON public.financial_reconciliation_items;
CREATE POLICY financial_reconciliation_items_select_org_members
ON public.financial_reconciliation_items
FOR SELECT
TO authenticated
USING (organization_id IS NULL OR public.ledger_has_org_role(organization_id, ARRAY['owner', 'admin', 'finance']));

GRANT SELECT ON public.ledger_accounts TO authenticated;
GRANT SELECT ON public.ledger_journals TO authenticated;
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT SELECT ON public.ad_spend_transactions TO authenticated;
GRANT SELECT ON public.financial_reconciliation_runs TO authenticated;
GRANT SELECT ON public.financial_reconciliation_items TO authenticated;

GRANT SELECT ON public.v_ledger_account_balances TO authenticated;
GRANT SELECT ON public.v_wallet_ledger_balances TO authenticated;
GRANT SELECT ON public.v_ad_account_ledger_balances TO authenticated;
GRANT SELECT ON public.v_wallet_ledger_integrity TO authenticated;

GRANT ALL ON public.ledger_accounts TO service_role;
GRANT ALL ON public.ledger_journals TO service_role;
GRANT ALL ON public.ledger_entries TO service_role;
GRANT ALL ON public.ad_spend_transactions TO service_role;
GRANT ALL ON public.financial_reconciliation_runs TO service_role;
GRANT ALL ON public.financial_reconciliation_items TO service_role;

GRANT SELECT ON public.v_ledger_account_balances TO service_role;
GRANT SELECT ON public.v_wallet_ledger_balances TO service_role;
GRANT SELECT ON public.v_ad_account_ledger_balances TO service_role;
GRANT SELECT ON public.v_wallet_ledger_integrity TO service_role;

-- Revoke default PUBLIC execution for the newly created functions, then grant
-- only what should be callable directly.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'ledger_touch_updated_at',
        'validate_ledger_account_scope',
        'validate_ledger_journal_scope',
        'validate_ledger_entry_scope',
        'prevent_posted_ledger_entry_mutation',
        'ledger_has_org_role',
        'ensure_wallet_ledger_accounts',
        'ensure_ad_account_ledger_accounts',
        'get_ledger_account_id',
        'get_ledger_account_balance_cents',
        'get_wallet_available_balance_cents',
        'get_ad_account_available_balance_cents',
        'assert_ledger_journal_balanced',
        'ledger_post_two_sided',
        'recalculate_legacy_balances',
        'ledger_confirm_deposit',
        'ledger_allocate_to_ad_account',
        'ledger_reserve_ad_account_budget',
        'ledger_release_ad_account_budget',
        'ledger_record_ad_spend',
        'ledger_refund_from_ad_account_to_wallet',
        'ledger_reverse_journal',
        'after_wallet_insert_ensure_ledger_accounts',
        'after_ad_account_insert_ensure_ledger_accounts'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Read helpers may be called by authenticated users.
GRANT EXECUTE ON FUNCTION public.ledger_has_org_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ledger_account_balance_cents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_available_balance_cents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ad_account_available_balance_cents(uuid) TO authenticated;

-- Product-level financial RPCs callable from frontend only if RLS/role checks pass.
GRANT EXECUTE ON FUNCTION public.ledger_allocate_to_ad_account(uuid, bigint, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_reserve_ad_account_budget(uuid, bigint, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_release_ad_account_budget(uuid, bigint, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_refund_from_ad_account_to_wallet(uuid, bigint, text, text, text, jsonb) TO authenticated;

-- Service-role-only functions:
--   ledger_confirm_deposit
--   ledger_record_ad_spend
--   ledger_reverse_journal
--   ledger_post_two_sided
--   ensure/recalculate/assert/internal trigger functions
-- They were granted to service_role in the dynamic block above.

-- ---------------------------------------------------------------
-- 13. Comments/documentation inside DB
-- ---------------------------------------------------------------

COMMENT ON TABLE public.ledger_accounts IS 'Chart of accounts for wallet/ad account accounting. Balances are derived from ledger entries.';
COMMENT ON TABLE public.ledger_journals IS 'Immutable posted financial events. Each journal must balance debits and credits.';
COMMENT ON TABLE public.ledger_entries IS 'Double-entry ledger lines. Posted entries are immutable and corrected by reversal journals.';
COMMENT ON TABLE public.ad_spend_transactions IS 'Transaction-level ad spend source of truth for provider spend reconciliation.';
COMMENT ON VIEW public.v_wallet_ledger_balances IS 'Derived wallet balances. Use this as the accounting source of truth.';
COMMENT ON VIEW public.v_ad_account_ledger_balances IS 'Derived ad account balances and lifetime spend from the ledger.';
COMMENT ON VIEW public.v_wallet_ledger_integrity IS 'Compares legacy wallet balance columns with ledger-derived balances.';
COMMENT ON FUNCTION public.ledger_confirm_deposit(uuid, text, text, jsonb) IS 'Confirms a verified payment intent and posts a deposit journal. Intended for backend/webhook service-role calls.';
COMMENT ON FUNCTION public.ledger_allocate_to_ad_account(uuid, bigint, text, text, jsonb) IS 'Moves funds from wallet available balance to ad account available balance.';
COMMENT ON FUNCTION public.ledger_record_ad_spend(uuid, bigint, timestamptz, text, uuid, uuid, uuid, text, text, jsonb) IS 'Records provider ad spend transaction and posts the matching expense journal.';
COMMENT ON FUNCTION public.ledger_reverse_journal(uuid, text, text) IS 'Posts a reversing journal for a previously posted journal.';

COMMIT;

-- ================================================================
-- Post-migration validation queries
-- Run these manually after the migration.
-- ================================================================

-- 1. Every journal must balance.
-- SELECT
--   lj.id,
--   lj.journal_type,
--   SUM(le.amount_cents) FILTER (WHERE le.direction = 'debit') AS debits,
--   SUM(le.amount_cents) FILTER (WHERE le.direction = 'credit') AS credits
-- FROM public.ledger_journals lj
-- JOIN public.ledger_entries le ON le.journal_id = lj.id
-- GROUP BY lj.id, lj.journal_type
-- HAVING SUM(le.amount_cents) FILTER (WHERE le.direction = 'debit')
--     <> SUM(le.amount_cents) FILTER (WHERE le.direction = 'credit');

-- 2. Legacy wallet cache must match ledger after bootstrap.
-- SELECT *
-- FROM public.v_wallet_ledger_integrity
-- WHERE available_difference_cents <> 0
--    OR reserved_difference_cents <> 0;

-- 3. Wallet balances by organization.
-- SELECT *
-- FROM public.v_wallet_ledger_balances
-- ORDER BY organization_id;

-- 4. Ad account balances by organization.
-- SELECT *
-- FROM public.v_ad_account_ledger_balances
-- ORDER BY organization_id, ad_account_id;

-- ================================================================
-- RPC examples
-- ================================================================

-- Allocate $100.00 to an ad account.
-- SELECT public.ledger_allocate_to_ad_account(
--   '<ad_account_id>'::uuid,
--   10000,
--   'allocate:<ad_account_id>:2026-07-06:10000',
--   'Initial budget allocation',
--   '{}'::jsonb
-- );

-- Reserve $50.00 inside an ad account.
-- SELECT public.ledger_reserve_ad_account_budget(
--   '<ad_account_id>'::uuid,
--   5000,
--   'reserve:<ad_account_id>:campaign:<campaign_id>:5000',
--   'Campaign budget reserve',
--   jsonb_build_object('campaign_id', '<campaign_id>')
-- );

-- Backend-only: record $12.34 provider ad spend from reserved balance.
-- SELECT public.ledger_record_ad_spend(
--   '<ad_account_id>'::uuid,
--   1234,
--   now(),
--   '<provider_spend_id>',
--   '<campaign_id>'::uuid,
--   NULL,
--   NULL,
--   'reserved',
--   'spend:<provider>:<provider_spend_id>',
--   '{}'::jsonb
-- );
