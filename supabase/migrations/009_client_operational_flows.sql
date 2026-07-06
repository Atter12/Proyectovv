-- ================================================================
-- Client operational flows alignment
-- Purpose: close customer-side flows before extracting admin panel.
-- Aligns the repo with the referenced production schema for vouchers,
-- ad account configuration, notifications, support chat, referrals and
-- creative upload/analysis jobs.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- Ad accounts: customer-side configuration fields.
-- Archiving is represented with metadata.archived_at to avoid destructive
-- deletes and keep financial history intact.
-- ----------------------------------------------------------------
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS external_business_id text,
  ADD COLUMN IF NOT EXISTS external_account_name text,
  ADD COLUMN IF NOT EXISTS monthly_limit_cents bigint NOT NULL DEFAULT 0 CHECK (monthly_limit_cents >= 0),
  ADD COLUMN IF NOT EXISTS auto_recharge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recharge_threshold_cents bigint NOT NULL DEFAULT 0 CHECK (recharge_threshold_cents >= 0),
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Lima',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_status_updated
  ON public.ad_accounts(organization_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_archived_at
  ON public.ad_accounts((metadata->>'archived_at'))
  WHERE metadata ? 'archived_at';

-- ----------------------------------------------------------------
-- Manual payments: metadata on payment_intents stores the voucher pointer
-- in the private payment-proofs bucket.
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_intents_org_provider_status
  ON public.payment_intents(organization_id, provider, status, created_at DESC);

-- ----------------------------------------------------------------
-- Refund requests: the customer request is stored as wallet_transactions
-- type refund + status pending. Admin approval remains out of repo.
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_org_type_status
  ON public.wallet_transactions(organization_id, type, status, created_at DESC);

-- ----------------------------------------------------------------
-- Notifications: align legacy channel/metadata columns with referenced
-- type/data schema used by the client dropdown.
-- ----------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'channel'
  ) THEN
    EXECUTE 'UPDATE public.notifications SET type = COALESCE(NULLIF(type, ''''), NULLIF(channel, ''''), ''info'')';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    EXECUTE 'UPDATE public.notifications SET data = CASE WHEN data IS DISTINCT FROM ''{}''::jsonb THEN data WHEN metadata IS NOT NULL THEN metadata ELSE ''{}''::jsonb END';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, read_at, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_org_read_created
  ON public.notifications(organization_id, read_at, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- ----------------------------------------------------------------
-- Support: align legacy names with referenced support_tickets/support_messages
-- schema. Old columns remain for backwards compatibility.
-- ----------------------------------------------------------------
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name = 'created_by'
  ) THEN
    EXECUTE 'UPDATE public.support_tickets SET requester_user_id = created_by WHERE requester_user_id IS NULL';
  END IF;
END $$;

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS internal_note boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_messages' AND column_name = 'author_user_id'
  ) THEN
    EXECUTE 'UPDATE public.support_messages SET sender_user_id = author_user_id WHERE sender_user_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_messages' AND column_name = 'is_internal_note'
  ) THEN
    EXECUTE 'UPDATE public.support_messages SET internal_note = is_internal_note';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_requester_created
  ON public.support_tickets(requester_user_id, created_at DESC)
  WHERE requester_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_org_status_updated
  ON public.support_tickets(organization_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created
  ON public.support_messages(ticket_id, created_at ASC);

DROP POLICY IF EXISTS support_messages_select_member ON public.support_messages;
CREATE POLICY support_messages_select_member ON public.support_messages
FOR SELECT USING (
  public.user_has_org_access(organization_id)
  AND (
    COALESCE(internal_note, false) = false
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = support_messages.organization_id
        AND om.status = 'active'
        AND om.role::text IN ('owner', 'admin', 'support')
    )
  )
);

-- ----------------------------------------------------------------
-- Referrals: click tracking and attribution created during provisioning.
-- ----------------------------------------------------------------
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS wallet_transaction_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
  ON public.referrals(referrer_user_id, status, created_at DESC)
  WHERE referrer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_referred_org
  ON public.referrals(referred_organization_id)
  WHERE referred_organization_id IS NOT NULL;

-- ----------------------------------------------------------------
-- Creative analyzer: upload pipeline and queued jobs.
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'creative_analysis_status'
  ) THEN
    EXECUTE 'ALTER TYPE public.creative_analysis_status ADD VALUE IF NOT EXISTS ''queued''';
  END IF;
END $$;

ALTER TABLE public.creative_assets
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS public_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS width integer CHECK (width IS NULL OR width > 0),
  ADD COLUMN IF NOT EXISTS height integer CHECK (height IS NULL OR height > 0),
  ADD COLUMN IF NOT EXISTS duration_seconds numeric CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  ADD COLUMN IF NOT EXISTS checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.creative_analysis_jobs
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS input jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'creative_analysis_jobs' AND column_name = 'created_by'
  ) THEN
    EXECUTE 'UPDATE public.creative_analysis_jobs SET requested_by = created_by WHERE requested_by IS NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_creative_assets_org_created
  ON public.creative_assets(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creative_jobs_org_status_created
  ON public.creative_analysis_jobs(organization_id, status, created_at DESC);

-- ----------------------------------------------------------------
-- Storage buckets used by current client flows.
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES
      ('payment-proofs', 'payment-proofs', false),
      ('creative-assets', 'creative-assets', false),
      ('support-attachments', 'support-attachments', false),
      ('organization-logos', 'organization-logos', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- Onboarding manual completion: allow authenticated members to upsert steps
-- if this endpoint is used later. Current UI mostly infers from real data.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS onboarding_steps_insert_member ON public.organization_onboarding_steps;
CREATE POLICY onboarding_steps_insert_member ON public.organization_onboarding_steps
FOR INSERT WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS onboarding_steps_update_member ON public.organization_onboarding_steps;
CREATE POLICY onboarding_steps_update_member ON public.organization_onboarding_steps
FOR UPDATE USING (public.user_has_org_access(organization_id))
WITH CHECK (public.user_has_org_access(organization_id));

GRANT SELECT, INSERT, UPDATE ON public.organization_onboarding_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT SELECT, INSERT ON public.creative_assets TO authenticated;
GRANT SELECT, INSERT ON public.creative_analysis_jobs TO authenticated;
GRANT SELECT ON public.creative_analysis_results TO authenticated;

COMMIT;
