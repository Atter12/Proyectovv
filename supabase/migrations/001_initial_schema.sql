-- Default Media — esquema inicial alineado al frontend actual.
-- Ejecutar en Supabase SQL Editor o vía Supabase CLI.
-- Incluye: Auth users -> profiles, organizations, memberships y wallets.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Dominio y enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE DOMAIN public.email AS text
    CHECK (VALUE ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_profile_status AS ENUM ('email_pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.onboarding_status AS ENUM (
    'email_verification_pending', 'organization_pending', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_status AS ENUM ('active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'owner', 'admin', 'advertiser', 'finance', 'viewer', 'support'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM ('active', 'invited', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_status AS ENUM ('active', 'frozen', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_transaction_type AS ENUM (
    'deposit', 'withdrawal', 'allocation', 'refund', 'adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_status AS ENUM (
    'pending', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_provider AS ENUM ('stripe', 'culqi', 'mercadopago', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'created', 'requires_payment', 'processing', 'succeeded', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_platform AS ENUM ('meta', 'google', 'tiktok', 'linkedin', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_account_status AS ENUM (
    'active', 'pending', 'disabled', 'review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.referral_status AS ENUM (
    'pending', 'active', 'paused', 'closed', 'converted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.slugify_org_name(org_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
BEGIN
  base_slug := lower(regexp_replace(
    translate(org_name, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'),
    '[^a-z0-9]+', '-', 'g'
  ));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'org';
  END IF;
  RETURN substr(base_slug, 1, 48) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_org_access(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_org_id
      AND om.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email public.email NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  phone text,
  status public.user_profile_status NOT NULL DEFAULT 'email_pending',
  email_verified boolean NOT NULL DEFAULT false,
  onboarding_status public.onboarding_status NOT NULL DEFAULT 'email_verification_pending',
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  legal_name text,
  tax_id text,
  website_url text,
  logo_url text,
  status public.organization_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'advertiser',
  status public.membership_status NOT NULL DEFAULT 'active',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT organization_memberships_unique UNIQUE (organization_id, user_id),
  CONSTRAINT organization_memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT organization_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT organization_memberships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Cartera Default',
  currency text NOT NULL DEFAULT 'USD',
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  status public.wallet_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallets_pkey PRIMARY KEY (id),
  CONSTRAINT wallets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  type public.wallet_transaction_type NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status public.transaction_status NOT NULL DEFAULT 'pending',
  balance_after_cents bigint,
  description text,
  external_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE,
  CONSTRAINT wallet_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT wallet_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  wallet_id uuid NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  provider public.payment_provider NOT NULL,
  provider_reference text,
  status public.payment_status NOT NULL DEFAULT 'created',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_intents_pkey PRIMARY KEY (id),
  CONSTRAINT payment_intents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT payment_intents_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE,
  CONSTRAINT payment_intents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  platform public.ad_platform NOT NULL,
  external_account_id text,
  status public.ad_account_status NOT NULL DEFAULT 'pending',
  daily_budget_cents bigint NOT NULL DEFAULT 0 CHECK (daily_budget_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT ad_accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT ad_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.ad_account_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL UNIQUE,
  organization_id uuid NOT NULL,
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_account_balances_pkey PRIMARY KEY (id),
  CONSTRAINT ad_account_balances_ad_account_id_fkey FOREIGN KEY (ad_account_id) REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  CONSTRAINT ad_account_balances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_pkey PRIMARY KEY (id),
  CONSTRAINT referral_codes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL,
  referrer_user_id uuid,
  referred_organization_id uuid,
  status public.referral_status NOT NULL DEFAULT 'pending',
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_referral_code_id_fkey FOREIGN KEY (referral_code_id) REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  CONSTRAINT referrals_referrer_user_id_fkey FOREIGN KEY (referrer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT referrals_referred_organization_id_fkey FOREIGN KEY (referred_organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  provider text NOT NULL DEFAULT 'supabase',
  provider_message_id text,
  email public.email NOT NULL,
  template_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_events_pkey PRIMARY KEY (id),
  CONSTRAINT email_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL,
  CONSTRAINT email_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL,
  CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON public.organization_memberships (organization_id);
CREATE INDEX IF NOT EXISTS idx_wallets_org ON public.wallets (organization_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON public.wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_org ON public.payment_intents (organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_org ON public.ad_accounts (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_intents_updated_at ON public.payment_intents;
CREATE TRIGGER trg_payment_intents_updated_at BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ad_accounts_updated_at ON public.ad_accounts;
CREATE TRIGGER trg_ad_accounts_updated_at BEFORE UPDATE ON public.ad_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
BEGIN
  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1),
    'Usuario'
  );

  INSERT INTO public.profiles (
    id, email, full_name, status, email_verified, onboarding_status
  ) VALUES (
    NEW.id, NEW.email, v_full_name, 'email_pending', false, 'email_verification_pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name text;
  v_org_id uuid;
  v_wallet_id uuid;
  v_referral_code text;
BEGIN
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, status, email_verified, onboarding_status
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1), 'Usuario'),
    'active',
    true,
    'completed'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    status = 'active',
    email_verified = true,
    onboarding_status = 'completed',
    updated_at = now();

  SELECT om.organization_id INTO v_org_id
  FROM public.organization_memberships om
  WHERE om.user_id = NEW.id AND om.status = 'active'
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_org_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'organization_name'), ''),
    'Mi organización'
  );

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (v_org_name, public.slugify_org_name(v_org_name), NEW.id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_memberships (
    organization_id, user_id, role, status
  ) VALUES (
    v_org_id, NEW.id, 'owner', 'active'
  );

  INSERT INTO public.wallets (organization_id, name, balance_cents, currency, status)
  VALUES (v_org_id, 'Cartera Default', 0, 'USD', 'active')
  RETURNING id INTO v_wallet_id;

  v_referral_code := lower(regexp_replace(
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'user'),
    '[^a-z0-9]+', '-', 'g'
  )) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  INSERT INTO public.referral_codes (organization_id, user_id, code)
  VALUES (v_org_id, NEW.id, v_referral_code)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_org_id,
    NEW.id,
    'organization.created',
    'organization',
    v_org_id,
    jsonb_build_object('wallet_id', v_wallet_id, 'source', 'email_confirmation')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member ON public.organizations
FOR SELECT USING (public.user_has_org_access(id));

DROP POLICY IF EXISTS memberships_select_own ON public.organization_memberships;
CREATE POLICY memberships_select_own ON public.organization_memberships
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS wallets_select_member ON public.wallets;
CREATE POLICY wallets_select_member ON public.wallets
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS wallet_tx_select_member ON public.wallet_transactions;
CREATE POLICY wallet_tx_select_member ON public.wallet_transactions
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS payment_intents_select_member ON public.payment_intents;
CREATE POLICY payment_intents_select_member ON public.payment_intents
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS ad_accounts_select_member ON public.ad_accounts;
CREATE POLICY ad_accounts_select_member ON public.ad_accounts
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS ad_accounts_insert_member ON public.ad_accounts;
CREATE POLICY ad_accounts_insert_member ON public.ad_accounts
FOR INSERT WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS ad_balances_select_member ON public.ad_account_balances;
CREATE POLICY ad_balances_select_member ON public.ad_account_balances
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS referral_codes_select_member ON public.referral_codes;
CREATE POLICY referral_codes_select_member ON public.referral_codes
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS referrals_select_member ON public.referrals;
CREATE POLICY referrals_select_member ON public.referrals
FOR SELECT USING (
  referrer_user_id = auth.uid()
  OR (referred_organization_id IS NOT NULL AND public.user_has_org_access(referred_organization_id))
);

DROP POLICY IF EXISTS email_events_select_own ON public.email_events;
CREATE POLICY email_events_select_own ON public.email_events
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS audit_logs_select_member ON public.audit_logs;
CREATE POLICY audit_logs_select_member ON public.audit_logs
FOR SELECT USING (organization_id IS NOT NULL AND public.user_has_org_access(organization_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_memberships TO authenticated;
GRANT SELECT ON public.wallets TO authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT SELECT ON public.payment_intents TO authenticated;
GRANT SELECT, INSERT ON public.ad_accounts TO authenticated;
GRANT SELECT ON public.ad_account_balances TO authenticated;
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.email_events TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
