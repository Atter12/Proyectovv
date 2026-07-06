-- ================================================================
-- Production external integrations and transactional email support
-- Adds secure integration connection storage for providers like TikTok
-- and hardens email event tracking for providers like Resend.
-- ================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- Email events: make the existing outbox/event table production-ready.
-- ----------------------------------------------------------------
ALTER TABLE public.email_events
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_events_org_created
  ON public.email_events(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_user_created
  ON public.email_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_status
  ON public.email_events(status, created_at DESC);

-- ----------------------------------------------------------------
-- External provider connections: OAuth/API credentials encrypted at app layer.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  provider text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'expired', 'error', 'revoked')),

  external_account_id text,
  encrypted_credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  scopes text[] NOT NULL DEFAULT '{}'::text[],

  last_synced_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT integration_connections_provider_not_blank CHECK (btrim(provider) <> ''),
  CONSTRAINT integration_connections_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_connections_org_provider_external
  ON public.integration_connections(organization_id, provider, external_account_id)
  WHERE external_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_connections_org_provider
  ON public.integration_connections(organization_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_integration_connections_last_synced
  ON public.integration_connections(provider, last_synced_at);

DROP TRIGGER IF EXISTS trg_integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER trg_integration_connections_updated_at
BEFORE UPDATE ON public.integration_connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- Internal API keys for future server-to-server integrations.
-- Store hashes only; never store raw API keys.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),

  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT api_keys_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT api_keys_prefix_not_blank CHECK (btrim(key_prefix) <> '')
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_status
  ON public.api_keys(organization_id, status);

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER trg_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- RLS and grants.
-- Mutations are intentionally service-role/backend only.
-- ----------------------------------------------------------------
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_connections_select_finance_admin ON public.integration_connections;
CREATE POLICY integration_connections_select_finance_admin
ON public.integration_connections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = integration_connections.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'admin', 'finance')
  )
);

DROP POLICY IF EXISTS api_keys_select_admin ON public.api_keys;
CREATE POLICY api_keys_select_admin
ON public.api_keys
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = api_keys.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS email_events_select_org_or_own ON public.email_events;
CREATE POLICY email_events_select_org_or_own
ON public.email_events
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = email_events.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role::text IN ('owner', 'admin', 'finance', 'support')
    )
  )
);

GRANT SELECT ON public.integration_connections TO authenticated;
GRANT SELECT ON public.api_keys TO authenticated;
GRANT SELECT ON public.email_events TO authenticated;

GRANT ALL ON public.integration_connections TO service_role;
GRANT ALL ON public.api_keys TO service_role;
GRANT ALL ON public.email_events TO service_role;

COMMENT ON TABLE public.integration_connections IS 'Encrypted external provider connections, e.g. TikTok Business OAuth tokens. Credentials are encrypted by the application before storage.';
COMMENT ON TABLE public.api_keys IS 'Internal API key registry. Store only key hashes, never raw keys.';
COMMENT ON TABLE public.email_events IS 'Transactional email event/outbox table used by providers like Resend.';

COMMIT;
