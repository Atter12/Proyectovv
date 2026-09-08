-- Cupo crédito Holistic (candado Stripe): monto pedido + tope suave.

BEGIN;

CREATE TABLE IF NOT EXISTS public.credit_lock_profiles (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  hecom_cliente_id text,
  -- Monto de crédito que pide / aprueba el equipo (USD cents).
  requested_credit_cents bigint
    CHECK (requested_credit_cents IS NULL OR requested_credit_cents >= 5000),
  -- % extra sugerido en tarjeta vs cupo (ej. 15 → “tené ~15% más”).
  card_headroom_percent numeric(5,2) NOT NULL DEFAULT 15
    CHECK (card_headroom_percent >= 0 AND card_headroom_percent <= 100),
  -- Pausar fondeo al alcanzar este % del cupo (exposición Hecom).
  soft_cap_percent numeric(5,2) NOT NULL DEFAULT 90
    CHECK (soft_cap_percent > 0 AND soft_cap_percent <= 100),
  -- Si true, no fondear sin tarjeta Stripe activa (anti-vivo).
  require_card boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_lock_profiles_hecom
  ON public.credit_lock_profiles(hecom_cliente_id)
  WHERE hecom_cliente_id IS NOT NULL;

COMMIT;
