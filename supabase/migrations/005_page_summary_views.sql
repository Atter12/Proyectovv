-- Vistas consolidadas adicionales: overview y ad-accounts en menos round trips.

CREATE OR REPLACE VIEW public.v_overview_page_summary AS
SELECT
  o.id AS organization_id,
  w.id AS wallet_id,
  w.name AS wallet_name,
  w.currency AS wallet_currency,
  w.balance_cents AS wallet_balance_cents,
  dc.total_ad_accounts,
  dc.total_campaigns,
  dc.active_ad_accounts,
  COALESCE(cp.spend_cents, 0) AS spend_30d_cents,
  COALESCE(cp.impressions, 0) AS impressions_30d,
  COALESCE(cp.clicks, 0) AS clicks_30d,
  COALESCE(cp.conversions, 0) AS conversions_30d,
  COALESCE(cp.revenue_cents, 0) AS revenue_30d_cents,
  (
    SELECT COALESCE(SUM(adm.spend_cents), 0)::bigint
    FROM public.ad_account_daily_metrics adm
    WHERE adm.organization_id = o.id
      AND adm.metric_date = CURRENT_DATE
  ) AS today_spend_cents
FROM public.organizations o
LEFT JOIN public.wallets w
  ON w.organization_id = o.id AND w.status = 'active'
LEFT JOIN public.v_organization_dashboard_counts dc
  ON dc.organization_id = o.id
LEFT JOIN public.v_campaign_performance_30d cp
  ON cp.organization_id = o.id;

ALTER VIEW public.v_overview_page_summary SET (security_invoker = true);
GRANT SELECT ON public.v_overview_page_summary TO authenticated;

CREATE OR REPLACE VIEW public.v_ad_accounts_page_summary AS
SELECT
  aa.organization_id,
  COUNT(*)::int AS total_accounts,
  COUNT(*) FILTER (WHERE aa.status = 'active')::int AS active_accounts,
  COUNT(*) FILTER (WHERE aa.status = 'pending')::int AS pending_setup,
  COALESCE(SUM(ab.balance_cents), 0)::bigint AS assigned_balance_cents
FROM public.ad_accounts aa
LEFT JOIN public.ad_account_balances ab
  ON ab.ad_account_id = aa.id
GROUP BY aa.organization_id;

ALTER VIEW public.v_ad_accounts_page_summary SET (security_invoker = true);
GRANT SELECT ON public.v_ad_accounts_page_summary TO authenticated;
