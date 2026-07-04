-- Vistas consolidadas para reducir round trips en dashboard y pagos.

CREATE OR REPLACE VIEW public.v_payments_page_summary AS
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
  ) AS pending_payment_intents,
  (
    SELECT COUNT(*)::int
    FROM public.wallet_transactions wt
    WHERE wt.organization_id = w.organization_id
      AND wt.type = 'refund'
      AND wt.status = 'pending'
  ) AS pending_refunds,
  (
    SELECT COUNT(*)::int
    FROM public.ad_accounts aa
    LEFT JOIN public.ad_account_balances ab ON ab.ad_account_id = aa.id
    WHERE aa.organization_id = w.organization_id
      AND aa.status = 'active'
      AND COALESCE(ab.balance_cents, 0) = 0
  ) AS accounts_ready_for_allocation
FROM public.wallets w
WHERE w.status = 'active';

ALTER VIEW public.v_payments_page_summary SET (security_invoker = true);
GRANT SELECT ON public.v_payments_page_summary TO authenticated;

CREATE OR REPLACE VIEW public.v_organization_dashboard_counts AS
SELECT
  o.id AS organization_id,
  (
    SELECT COUNT(*)::int FROM public.ad_accounts aa
    WHERE aa.organization_id = o.id
  ) AS total_ad_accounts,
  (
    SELECT COUNT(*)::int FROM public.campaigns c
    WHERE c.organization_id = o.id
  ) AS total_campaigns,
  (
    SELECT COUNT(*)::int FROM public.ad_accounts aa
    WHERE aa.organization_id = o.id AND aa.status = 'active'
  ) AS active_ad_accounts
FROM public.organizations o;

ALTER VIEW public.v_organization_dashboard_counts SET (security_invoker = true);
GRANT SELECT ON public.v_organization_dashboard_counts TO authenticated;
