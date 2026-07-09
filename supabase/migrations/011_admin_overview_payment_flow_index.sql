-- Speeds up admin overview payment flow analytics (last 30 days by created_at).
-- Safe to run more than once.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_admin_payment_intents_created_at
  ON public.payment_intents(created_at DESC);

COMMIT;
