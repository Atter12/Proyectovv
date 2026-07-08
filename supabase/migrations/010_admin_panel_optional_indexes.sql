-- Optional performance indexes for the standalone admin panel.
-- Safe to run more than once. Does not create new product tables.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_admin_payment_intents_manual_review
  ON public.payment_intents(provider, status, created_at DESC)
  WHERE provider = 'manual';

CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_refunds
  ON public.wallet_transactions(type, status, created_at DESC)
  WHERE type = 'refund';

CREATE INDEX IF NOT EXISTS idx_admin_support_tickets_status_updated
  ON public.support_tickets(status, priority, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_ad_accounts_status_platform
  ON public.ad_accounts(status, platform, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_webhook_events_status_created
  ON public.webhook_events(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity_created
  ON public.audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_reconciliation_items_run_status
  ON public.financial_reconciliation_items(reconciliation_run_id, status, created_at DESC);

COMMIT;
