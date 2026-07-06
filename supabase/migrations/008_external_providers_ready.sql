-- ================================================================
-- External providers readiness migration
-- Purpose: constraints and indexes needed by payment providers, Resend
-- email audit logs and TikTok Business API integrations.
-- ================================================================

BEGIN;

-- One active connector per organization/provider. This supports upsert from
-- the TikTok OAuth callback and future provider refresh jobs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_connections_org_provider
  ON public.integration_connections(organization_id, provider);

CREATE INDEX IF NOT EXISTS idx_integration_connections_provider_status
  ON public.integration_connections(provider, status, updated_at DESC);

-- Provider ad accounts should be idempotently importable.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_accounts_org_platform_external
  ON public.ad_accounts(organization_id, platform, external_account_id);

-- Email observability for Resend and future transactional email providers.
CREATE INDEX IF NOT EXISTS idx_email_events_provider_message
  ON public.email_events(provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_org_template_created
  ON public.email_events(organization_id, template_key, created_at DESC);

-- Fast financial-provider investigation.
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_reference
  ON public.payment_intents(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_status_created
  ON public.payment_intents(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status
  ON public.webhook_events(provider, status, created_at DESC);

-- Optional Supabase Storage buckets. These statements are safe on Supabase and
-- skipped automatically in environments without the storage schema.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES
      ('payment-proofs', 'payment-proofs', false),
      ('creative-assets', 'creative-assets', false),
      ('organization-logos', 'organization-logos', true),
      ('support-attachments', 'support-attachments', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

COMMIT;
