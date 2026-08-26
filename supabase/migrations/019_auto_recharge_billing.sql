-- Recarga automática programada (tarjeta guardada + cron calendario).

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_customers (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  default_payment_method_id text,
  card_brand text,
  card_last4 text,
  card_exp_month smallint,
  card_exp_year smallint,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'detached', 'requires_action')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auto_recharge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  hecom_cliente_id text,
  enabled boolean NOT NULL DEFAULT false,
  calendar_enabled boolean NOT NULL DEFAULT false,
  calendar_interval_days integer CHECK (calendar_interval_days IS NULL OR calendar_interval_days BETWEEN 7 AND 90),
  calendar_credit_cents bigint CHECK (calendar_credit_cents IS NULL OR calendar_credit_cents > 0),
  calendar_next_charge_at timestamptz,
  calendar_timezone text NOT NULL DEFAULT 'America/Lima',
  consecutive_failures integer NOT NULL DEFAULT 0,
  max_failures_before_pause integer NOT NULL DEFAULT 3,
  last_charge_at timestamptz,
  last_charge_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_recharge_rules_due
  ON public.auto_recharge_rules(calendar_next_charge_at)
  WHERE enabled = true AND calendar_enabled = true;

CREATE TABLE IF NOT EXISTS public.auto_recharge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.auto_recharge_rules(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Sin FK: algunos entornos legacy no tienen payment_intents en el mismo schema.
  payment_intent_id uuid,
  trigger_type text NOT NULL CHECK (trigger_type IN ('calendar', 'threshold', 'manual')),
  credit_cents bigint NOT NULL,
  gross_cents bigint NOT NULL,
  fee_cents bigint NOT NULL,
  status text NOT NULL,
  stripe_payment_intent_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_recharge_attempts_org_created
  ON public.auto_recharge_attempts(organization_id, created_at DESC);

COMMIT;
