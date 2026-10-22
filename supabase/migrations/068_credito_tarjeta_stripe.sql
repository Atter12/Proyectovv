-- Tarjeta del crédito Holistic en Stripe (cuenta nueva de la LLC de Atlas).
-- Whop quedó suspendido el 21/10/2026: las tarjetas nuevas se guardan en Stripe.
-- Las columnas whop_* quedan para el historial; el cobro de los lunes solo usa Stripe.

BEGIN;

ALTER TABLE public.credit_card_methods
  DROP CONSTRAINT IF EXISTS credit_card_methods_provider_check;
ALTER TABLE public.credit_card_methods
  ADD CONSTRAINT credit_card_methods_provider_check CHECK (provider IN ('whop', 'stripe'));

ALTER TABLE public.credit_card_methods
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.credit_card_methods
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;
ALTER TABLE public.credit_card_methods
  ADD COLUMN IF NOT EXISTS stripe_setup_session_id text;

COMMIT;
