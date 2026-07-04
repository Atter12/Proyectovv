-- Default Media — esquema inicial Supabase Auth + multi-tenant
-- Ejecutar en Supabase SQL Editor o via CLI (supabase db push)

-- ---------------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.profile_status AS ENUM ('email_pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_role AS ENUM (
    'owner', 'admin', 'advertiser', 'finance', 'viewer', 'support'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM ('active', 'invited', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_status AS ENUM ('active', 'frozen', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM (
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
  CREATE TYPE public.payment_intent_status AS ENUM (
    'requires_payment', 'processing', 'succeeded', 'failed', 'cancelled'
  );
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
    'pending', 'active', 'paused', 'closed'
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

CREATE OR REPLACE FUNCTION public.make_avatar_initials(full_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[];
BEGIN
  parts := regexp_split_to_array(trim(full_name), '\s+');
  IF array_length(parts, 1) IS NULL OR array_length(parts, 1) = 0 THEN
    RETURN 'U';
  ELSIF array_length(parts, 1) = 1 THEN
    RETURN upper(substr(parts[1], 1, 2));
  ELSE
    RETURN upper(substr(parts[1], 1, 1) || substr(parts[2], 1, 1));
  END IF;
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
-- Tablas core
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_initials text NOT NULL DEFAULT 'U',
  status public.profile_status NOT NULL DEFAULT 'email_pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status public.org_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.membership_role NOT NULL DEFAULT 'advertiser',
  status public.membership_status NOT NULL DEFAULT 'active',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Cartera Default',
  balance numeric(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status public.wallet_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status public.transaction_status NOT NULL DEFAULT 'pending',
  reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets (id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  gateway text NOT NULL,
  status public.payment_intent_status NOT NULL DEFAULT 'requires_payment',
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'meta',
  external_id text,
  status public.ad_account_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts (id) ON DELETE CASCADE,
  balance numeric(14, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id)
);

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  referred_organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  status public.referral_status NOT NULL DEFAULT 'pending',
  commission_rate numeric(5, 2) NOT NULL DEFAULT 5.00,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
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
-- Triggers updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_intents_updated_at ON public.payment_intents;
CREATE TRIGGER trg_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ad_accounts_updated_at ON public.ad_accounts;
CREATE TRIGGER trg_ad_accounts_updated_at
  BEFORE UPDATE ON public.ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth triggers: profile on signup, org+wallet on email confirm
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

  INSERT INTO public.profiles (id, email, full_name, avatar_initials, status)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    public.make_avatar_initials(v_full_name),
    'email_pending'
  )
  ON CONFLICT (id) DO NOTHING;

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

  UPDATE public.profiles
  SET status = 'active', updated_at = now()
  WHERE id = NEW.id;

  IF EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = NEW.id AND om.status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  v_org_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'organization_name'), ''),
    'Mi organización'
  );

  INSERT INTO public.organizations (name, slug)
  VALUES (v_org_name, public.slugify_org_name(v_org_name))
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_memberships (
    organization_id, user_id, role, status, is_default
  ) VALUES (
    v_org_id, NEW.id, 'owner', 'active', true
  );

  INSERT INTO public.wallets (organization_id, name, balance, currency)
  VALUES (v_org_id, 'Cartera Default', 0, 'USD')
  RETURNING id INTO v_wallet_id;

  v_referral_code := lower(regexp_replace(
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'user'),
    '[^a-z0-9]+', '-', 'g'
  )) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  INSERT INTO public.referral_codes (organization_id, user_id, code)
  VALUES (v_org_id, NEW.id, v_referral_code);

  INSERT INTO public.audit_logs (
    organization_id, user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_org_id,
    NEW.id,
    'organization.created',
    'organization',
    v_org_id::text,
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
-- Row Level Security
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

-- profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- organizations
DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT USING (public.user_has_org_access(id));

-- memberships
DROP POLICY IF EXISTS memberships_select_own ON public.organization_memberships;
CREATE POLICY memberships_select_own ON public.organization_memberships
  FOR SELECT USING (auth.uid() = user_id);

-- wallets (read-only for members; writes via service role)
DROP POLICY IF EXISTS wallets_select_member ON public.wallets;
CREATE POLICY wallets_select_member ON public.wallets
  FOR SELECT USING (public.user_has_org_access(organization_id));

-- wallet_transactions (read-only for members)
DROP POLICY IF EXISTS wallet_tx_select_member ON public.wallet_transactions;
CREATE POLICY wallet_tx_select_member ON public.wallet_transactions
  FOR SELECT USING (public.user_has_org_access(organization_id));

-- payment_intents (read-only for members)
DROP POLICY IF EXISTS payment_intents_select_member ON public.payment_intents;
CREATE POLICY payment_intents_select_member ON public.payment_intents
  FOR SELECT USING (public.user_has_org_access(organization_id));

-- ad_accounts
DROP POLICY IF EXISTS ad_accounts_select_member ON public.ad_accounts;
CREATE POLICY ad_accounts_select_member ON public.ad_accounts
  FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS ad_accounts_insert_member ON public.ad_accounts;
CREATE POLICY ad_accounts_insert_member ON public.ad_accounts
  FOR INSERT WITH CHECK (public.user_has_org_access(organization_id));

-- ad_account_balances (via ad account org)
DROP POLICY IF EXISTS ad_balances_select_member ON public.ad_account_balances;
CREATE POLICY ad_balances_select_member ON public.ad_account_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ad_accounts aa
      WHERE aa.id = ad_account_id
        AND public.user_has_org_access(aa.organization_id)
    )
  );

-- referral_codes
DROP POLICY IF EXISTS referral_codes_select_member ON public.referral_codes;
CREATE POLICY referral_codes_select_member ON public.referral_codes
  FOR SELECT USING (public.user_has_org_access(organization_id));

-- referrals
DROP POLICY IF EXISTS referrals_select_member ON public.referrals;
CREATE POLICY referrals_select_member ON public.referrals
  FOR SELECT USING (
    public.user_has_org_access(referrer_organization_id)
    OR (referred_organization_id IS NOT NULL AND public.user_has_org_access(referred_organization_id))
  );

-- email_events (own user only)
DROP POLICY IF EXISTS email_events_select_own ON public.email_events;
CREATE POLICY email_events_select_own ON public.email_events
  FOR SELECT USING (auth.uid() = user_id);

-- audit_logs (org members)
DROP POLICY IF EXISTS audit_logs_select_member ON public.audit_logs;
CREATE POLICY audit_logs_select_member ON public.audit_logs
  FOR SELECT USING (
    organization_id IS NOT NULL AND public.user_has_org_access(organization_id)
  );

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
GRANT SELECT ON public.ad_accounts TO authenticated;
GRANT SELECT, INSERT ON public.ad_accounts TO authenticated;
GRANT SELECT ON public.ad_account_balances TO authenticated;
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.email_events TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
