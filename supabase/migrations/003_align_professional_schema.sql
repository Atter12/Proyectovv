-- Alineación incremental con esquema profesional (no destructivo).
-- Ejecutar después de 001 y 002.

-- ---------------------------------------------------------------------------
-- Wallets y organizaciones
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS reserved_balance_cents bigint NOT NULL DEFAULT 0
    CHECK (reserved_balance_cents >= 0);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Payment intents — columnas de ciclo de vida
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS succeeded_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

-- ---------------------------------------------------------------------------
-- Webhook events — estado e idempotencia
-- ---------------------------------------------------------------------------
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS error_message text;

-- ---------------------------------------------------------------------------
-- Creative analysis — columnas profesionales
-- ---------------------------------------------------------------------------
ALTER TABLE public.creative_analysis_results
  ADD COLUMN IF NOT EXISTS overall_score numeric,
  ADD COLUMN IF NOT EXISTS clarity_score numeric,
  ADD COLUMN IF NOT EXISTS brand_score numeric,
  ADD COLUMN IF NOT EXISTS compliance_score numeric,
  ADD COLUMN IF NOT EXISTS recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS detected_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_output jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Migrar datos legacy score/signals si existen
UPDATE public.creative_analysis_results
SET
  overall_score = COALESCE(overall_score, score),
  compliance_score = COALESCE(
    compliance_score,
    NULLIF((signals->>'policy')::numeric, NULL)
  ),
  clarity_score = COALESCE(
    clarity_score,
    NULLIF((signals->>'hook')::numeric, NULL)
  ),
  brand_score = COALESCE(
    brand_score,
    NULLIF((signals->>'retention')::numeric, NULL)
  )
WHERE overall_score IS NULL OR clarity_score IS NULL;

-- ---------------------------------------------------------------------------
-- Campañas y métricas diarias
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM (
    'draft', 'active', 'paused', 'completed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  ad_account_id uuid,
  name text NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  daily_budget_cents bigint NOT NULL DEFAULT 0 CHECK (daily_budget_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT campaigns_ad_account_fkey FOREIGN KEY (ad_account_id)
    REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.ad_account_daily_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  metric_date date NOT NULL,
  spend_cents bigint NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  conversions bigint NOT NULL DEFAULT 0,
  revenue_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_account_daily_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT ad_account_daily_metrics_unique UNIQUE (ad_account_id, metric_date),
  CONSTRAINT ad_account_daily_metrics_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT ad_account_daily_metrics_account_fkey FOREIGN KEY (ad_account_id)
    REFERENCES public.ad_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.campaign_daily_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  metric_date date NOT NULL,
  spend_cents bigint NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  conversions bigint NOT NULL DEFAULT 0,
  revenue_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_daily_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_daily_metrics_unique UNIQUE (campaign_id, metric_date),
  CONSTRAINT campaign_daily_metrics_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT campaign_daily_metrics_campaign_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON public.campaigns (organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_account_metrics_org_date
  ON public.ad_account_daily_metrics (organization_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_org_date
  ON public.campaign_daily_metrics (organization_id, metric_date DESC);

-- ---------------------------------------------------------------------------
-- Vista de rendimiento 30 días
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_campaign_performance_30d AS
SELECT
  c.organization_id,
  COALESCE(SUM(cdm.spend_cents), 0)::bigint AS spend_cents,
  COALESCE(SUM(cdm.impressions), 0)::bigint AS impressions,
  COALESCE(SUM(cdm.clicks), 0)::bigint AS clicks,
  COALESCE(SUM(cdm.conversions), 0)::bigint AS conversions,
  COALESCE(SUM(cdm.revenue_cents), 0)::bigint AS revenue_cents
FROM public.campaigns c
LEFT JOIN public.campaign_daily_metrics cdm
  ON cdm.campaign_id = c.id
  AND cdm.metric_date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY c.organization_id;

ALTER VIEW public.v_campaign_performance_30d SET (security_invoker = true);
ALTER VIEW public.v_organization_wallet_summary SET (security_invoker = true);

GRANT SELECT ON public.v_campaign_performance_30d TO authenticated;

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.support_ticket_status AS ENUM (
    'open', 'pending', 'resolved', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  created_by uuid,
  subject text NOT NULL,
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT support_tickets_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  author_user_id uuid,
  body text NOT NULL,
  is_internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_pkey PRIMARY KEY (id),
  CONSTRAINT support_messages_ticket_fkey FOREIGN KEY (ticket_id)
    REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT support_messages_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT support_messages_author_fkey FOREIGN KEY (author_user_id)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org
  ON public.support_tickets (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
  ON public.support_messages (ticket_id, created_at ASC);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  title text NOT NULL,
  body text,
  channel text NOT NULL DEFAULT 'in_app',
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT notifications_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  channel text NOT NULL DEFAULT 'in_app',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT notification_preferences_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org
  ON public.notifications (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — campañas, métricas, support, notifications
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_account_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_select_member ON public.campaigns;
CREATE POLICY campaigns_select_member ON public.campaigns
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS ad_account_metrics_select_member ON public.ad_account_daily_metrics;
CREATE POLICY ad_account_metrics_select_member ON public.ad_account_daily_metrics
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS campaign_metrics_select_member ON public.campaign_daily_metrics;
CREATE POLICY campaign_metrics_select_member ON public.campaign_daily_metrics
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS support_tickets_select_member ON public.support_tickets;
CREATE POLICY support_tickets_select_member ON public.support_tickets
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS support_tickets_insert_member ON public.support_tickets;
CREATE POLICY support_tickets_insert_member ON public.support_tickets
FOR INSERT WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS support_messages_select_member ON public.support_messages;
CREATE POLICY support_messages_select_member ON public.support_messages
FOR SELECT USING (
  public.user_has_org_access(organization_id)
  AND (
    is_internal_note = false
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = support_messages.organization_id
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'support')
    )
  )
);

DROP POLICY IF EXISTS support_messages_insert_member ON public.support_messages;
CREATE POLICY support_messages_insert_member ON public.support_messages
FOR INSERT WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
FOR SELECT USING (
  user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.user_has_org_access(organization_id))
);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
FOR UPDATE USING (
  user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.user_has_org_access(organization_id))
);

DROP POLICY IF EXISTS notification_prefs_select_own ON public.notification_preferences;
CREATE POLICY notification_prefs_select_own ON public.notification_preferences
FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON public.campaigns TO authenticated;
GRANT SELECT ON public.ad_account_daily_metrics TO authenticated;
GRANT SELECT ON public.campaign_daily_metrics TO authenticated;
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.notification_preferences TO authenticated;

-- ---------------------------------------------------------------------------
-- Limpieza: triggers updated_at duplicados e índice duplicado memberships
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_organization_memberships_user_org;
DROP INDEX IF EXISTS public.organization_memberships_user_id_organization_id_idx;

DROP TRIGGER IF EXISTS trg_organization_onboarding_steps_updated_at ON public.organization_onboarding_steps;
CREATE TRIGGER trg_organization_onboarding_steps_updated_at
BEFORE UPDATE ON public.organization_onboarding_steps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
