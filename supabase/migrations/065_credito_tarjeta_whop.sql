-- Anti-vivos: tarjeta guardada en Whop para clientes con crédito Holistic.
-- Cada lunes se cobra la deuda; si la tarjeta rechaza y no paga en 48 h, se congela.
-- Acceso solo desde el servidor con service_role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.credit_card_methods (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  hecom_cliente_id text,
  provider text NOT NULL DEFAULT 'whop' CHECK (provider IN ('whop')),
  whop_member_id text,
  whop_payment_method_id text,
  whop_setup_intent_id text,
  card_brand text,
  card_last4 text,
  card_exp_month smallint,
  card_exp_year smallint,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'detached')),
  -- Autorización del cliente para el cobro automático (texto que aceptó, quién y cuándo).
  consent_at timestamptz,
  consent_by uuid,
  consent_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_card_methods_hecom
  ON public.credit_card_methods(hecom_cliente_id)
  WHERE hecom_cliente_id IS NOT NULL;

-- Estado del cobro automático por cliente.
ALTER TABLE public.credit_lock_profiles
  ADD COLUMN IF NOT EXISTS autocharge_failed_since timestamptz;
ALTER TABLE public.credit_lock_profiles
  ADD COLUMN IF NOT EXISTS autocharge_last_error text;
ALTER TABLE public.credit_lock_profiles
  ADD COLUMN IF NOT EXISTS autocharge_last_charge_at timestamptz;
ALTER TABLE public.credit_lock_profiles
  ADD COLUMN IF NOT EXISTS autocharge_frozen_at timestamptz;

ALTER TABLE public.credit_card_methods ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.credit_card_methods TO service_role;

COMMIT;
