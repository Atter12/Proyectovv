-- Pagos transaccionales, webhooks idempotentes y vistas de resumen.

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_idempotency
  ON public.wallet_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS checkout_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency
  ON public.payment_intents (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider_ref
  ON public.payment_intents (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_events_provider_event_unique UNIQUE (provider, event_id)
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_onboarding_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  step_key text NOT NULL,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_onboarding_steps_pkey PRIMARY KEY (id),
  CONSTRAINT organization_onboarding_steps_org_step_unique UNIQUE (organization_id, step_key),
  CONSTRAINT organization_onboarding_steps_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE
);

ALTER TABLE public.organization_onboarding_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_steps_select_member ON public.organization_onboarding_steps;
CREATE POLICY onboarding_steps_select_member ON public.organization_onboarding_steps
FOR SELECT USING (public.user_has_org_access(organization_id));

DO $$ BEGIN
  CREATE TYPE public.creative_analysis_status AS ENUM (
    'pending', 'processing', 'completed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.creative_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'image',
  storage_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creative_assets_pkey PRIMARY KEY (id),
  CONSTRAINT creative_assets_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT creative_assets_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.creative_analysis_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  creative_asset_id uuid,
  status public.creative_analysis_status NOT NULL DEFAULT 'pending',
  provider text,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creative_analysis_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT creative_analysis_jobs_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT creative_analysis_jobs_asset_fkey FOREIGN KEY (creative_asset_id)
    REFERENCES public.creative_assets(id) ON DELETE SET NULL,
  CONSTRAINT creative_analysis_jobs_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.creative_analysis_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE,
  organization_id uuid NOT NULL,
  score numeric,
  summary text,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creative_analysis_results_pkey PRIMARY KEY (id),
  CONSTRAINT creative_analysis_results_job_fkey FOREIGN KEY (job_id)
    REFERENCES public.creative_analysis_jobs(id) ON DELETE CASCADE,
  CONSTRAINT creative_analysis_results_org_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE
);

ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_analysis_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creative_assets_select_member ON public.creative_assets;
CREATE POLICY creative_assets_select_member ON public.creative_assets
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS creative_jobs_select_member ON public.creative_analysis_jobs;
CREATE POLICY creative_jobs_select_member ON public.creative_analysis_jobs
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS creative_results_select_member ON public.creative_analysis_results;
CREATE POLICY creative_results_select_member ON public.creative_analysis_results
FOR SELECT USING (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS ad_balances_insert_member ON public.ad_account_balances;
CREATE POLICY ad_balances_insert_member ON public.ad_account_balances
FOR INSERT WITH CHECK (public.user_has_org_access(organization_id));

CREATE OR REPLACE VIEW public.v_organization_wallet_summary AS
SELECT
  w.organization_id,
  w.id AS wallet_id,
  w.name,
  w.currency,
  w.balance_cents,
  w.status,
  (
    SELECT wt.created_at
    FROM public.wallet_transactions wt
    WHERE wt.wallet_id = w.id
      AND wt.type = 'deposit'
      AND wt.status = 'completed'
    ORDER BY wt.created_at DESC
    LIMIT 1
  ) AS last_deposit_at,
  (
    SELECT COUNT(*)::int
    FROM public.payment_intents pi
    WHERE pi.organization_id = w.organization_id
      AND pi.status IN ('created', 'requires_payment', 'processing')
  ) AS pending_payment_intents
FROM public.wallets w;

CREATE OR REPLACE FUNCTION public.post_wallet_transaction(
  p_organization_id uuid,
  p_wallet_id uuid,
  p_type public.wallet_transaction_type,
  p_amount_cents bigint,
  p_currency text DEFAULT 'USD',
  p_status public.transaction_status DEFAULT 'completed',
  p_description text DEFAULT NULL,
  p_external_reference text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_balance bigint;
  v_new_balance bigint;
  v_tx_id uuid;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.wallet_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  SELECT balance_cents INTO v_balance
  FROM public.wallets
  WHERE id = p_wallet_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;

  IF p_type IN ('deposit', 'refund') THEN
    v_new_balance := v_balance + p_amount_cents;
  ELSIF p_type = 'adjustment' THEN
    v_new_balance := v_balance + p_amount_cents;
  ELSE
    v_new_balance := v_balance - p_amount_cents;
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'insufficient_balance';
    END IF;
  END IF;

  UPDATE public.wallets
  SET balance_cents = v_new_balance,
      updated_at = now()
  WHERE id = p_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id,
    organization_id,
    type,
    amount_cents,
    currency,
    status,
    balance_after_cents,
    description,
    external_reference,
    idempotency_key,
    created_by,
    metadata
  ) VALUES (
    p_wallet_id,
    p_organization_id,
    p_type,
    p_amount_cents,
    p_currency,
    p_status,
    v_new_balance,
    p_description,
    p_external_reference,
    p_idempotency_key,
    p_created_by,
    p_metadata
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_wallet_transaction(
  uuid, uuid, public.wallet_transaction_type, bigint, text,
  public.transaction_status, text, text, text, uuid, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.post_wallet_transaction(
  uuid, uuid, public.wallet_transaction_type, bigint, text,
  public.transaction_status, text, text, text, uuid, jsonb
) TO service_role;

GRANT SELECT ON public.v_organization_wallet_summary TO authenticated;
