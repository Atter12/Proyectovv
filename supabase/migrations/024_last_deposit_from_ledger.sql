-- =============================================================================
-- "Última recarga" leía de wallet_transactions, que quedó vacía cuando la
-- plataforma pasó al ledger de doble entrada: 0 filas contra 51 depósitos
-- reales. Resultado: el panel mostraba "Sin registros" para todos los clientes
-- y todos los métodos, incluidas las recargas por Stripe.
--
-- Esta migración cambia SOLO esa columna, para que la tome de ledger_journals,
-- que es donde los depósitos existen de verdad. El resto de la vista queda
-- exactamente como estaba, incluido pending_refunds, que sigue leyendo la
-- tabla legacy: si esa parte también quedó muerta, es otro problema y merece
-- su propio cambio, no un arreglo de paso sin verificar.
-- =============================================================================

CREATE OR REPLACE VIEW public.v_payments_page_summary AS
SELECT
  organization_id,
  id AS wallet_id,
  name,
  currency,
  balance_cents,
  status,
  (
    SELECT lj.posted_at
    FROM ledger_journals lj
    WHERE lj.wallet_id = w.id
      AND lj.journal_type = 'deposit_confirmed'
      AND lj.status = 'posted'
    ORDER BY lj.posted_at DESC NULLS LAST
    LIMIT 1
  ) AS last_deposit_at,
  (
    SELECT count(*)::integer AS count
    FROM payment_intents pi
    WHERE pi.organization_id = w.organization_id
      AND (pi.status::text = ANY (ARRAY['created'::text, 'requires_payment'::text, 'processing'::text]))
  ) AS pending_payment_intents,
  (
    SELECT count(*)::integer AS count
    FROM wallet_transactions wt
    WHERE wt.organization_id = w.organization_id
      AND wt.type::text = 'refund'::text
      AND wt.status::text = 'pending'::text
  ) AS pending_refunds,
  (
    SELECT count(*)::integer AS count
    FROM ad_accounts aa
      LEFT JOIN ad_account_balances ab ON ab.ad_account_id = aa.id
    WHERE aa.organization_id = w.organization_id
      AND aa.status::text = 'active'::text
      AND COALESCE(ab.balance_cents, 0::bigint) = 0
  ) AS accounts_ready_for_allocation
FROM wallets w
WHERE status::text = 'active'::text;
