-- Depósitos con fee Hecom: payment_intents.amount_cents = bruto (cobrado),
-- metadata.credit_amount_cents = neto que entra a la cartera.
-- ledger_confirm_deposit acredita el neto cuando viene en metadata.

CREATE OR REPLACE FUNCTION public.ledger_confirm_deposit(
  p_payment_intent_id uuid,
  p_provider_reference text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pi public.payment_intents%ROWTYPE;
  v_wallet_available_account_id uuid;
  v_external_funding_account_id uuid;
  v_journal_id uuid;
  v_key text;
  v_meta jsonb;
  v_credit_cents bigint;
  v_fee_cents bigint;
BEGIN
  SELECT *
  INTO v_pi
  FROM public.payment_intents pi
  WHERE pi.id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent % not found', p_payment_intent_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.ledger_has_org_role(v_pi.organization_id, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Not authorized to confirm this deposit';
  END IF;

  PERFORM public.ensure_wallet_ledger_accounts(v_pi.wallet_id);

  v_wallet_available_account_id := public.get_ledger_account_id(v_pi.wallet_id, NULL, 'wallet_available');
  v_external_funding_account_id := public.get_ledger_account_id(v_pi.wallet_id, NULL, 'external_funding');

  v_meta := COALESCE(v_pi.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb);

  v_credit_cents := COALESCE(
    NULLIF(btrim(COALESCE(v_meta->>'credit_amount_cents', '')), '')::bigint,
    v_pi.amount_cents
  );

  IF v_credit_cents IS NULL OR v_credit_cents <= 0 THEN
    RAISE EXCEPTION 'credit_amount_cents must be positive';
  END IF;

  IF v_credit_cents > v_pi.amount_cents THEN
    RAISE EXCEPTION 'credit_amount_cents (%) cannot exceed payment amount (%)',
      v_credit_cents, v_pi.amount_cents;
  END IF;

  v_fee_cents := GREATEST(v_pi.amount_cents - v_credit_cents, 0);

  v_key := COALESCE(
    p_idempotency_key,
    'payment_intent:' || p_payment_intent_id::text || ':confirm'
  );

  -- Acredita solo el neto (ej. pagan $110 @ 10% → cartera $100).
  v_journal_id := public.ledger_post_two_sided(
    v_pi.organization_id,
    v_pi.wallet_id,
    'deposit_confirmed',
    v_wallet_available_account_id,
    v_external_funding_account_id,
    v_credit_cents,
    v_pi.currency,
    'payment_intents',
    v_pi.id,
    v_pi.provider::text,
    COALESCE(p_provider_reference, v_pi.provider_reference),
    v_key,
    CASE
      WHEN v_fee_cents > 0 THEN 'Deposit confirmed (net after Holistic fee)'
      ELSE 'Deposit confirmed'
    END,
    v_meta || jsonb_build_object(
      'payment_intent_id', v_pi.id,
      'gross_amount_cents', v_pi.amount_cents,
      'credit_amount_cents', v_credit_cents,
      'fee_amount_cents', v_fee_cents
    ),
    auth.uid()
  );

  UPDATE public.payment_intents pi
  SET
    status = 'succeeded',
    provider_reference = COALESCE(p_provider_reference, pi.provider_reference),
    succeeded_at = COALESCE(pi.succeeded_at, now()),
    updated_at = now(),
    metadata = COALESCE(pi.metadata, '{}'::jsonb) || jsonb_build_object(
      'ledger_journal_id', v_journal_id,
      'credit_amount_cents', v_credit_cents,
      'fee_amount_cents', v_fee_cents,
      'gross_amount_cents', v_pi.amount_cents
    )
  WHERE pi.id = v_pi.id;

  PERFORM public.recalculate_legacy_balances(v_pi.wallet_id);

  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_pi.organization_id,
    auth.uid(),
    'ledger.deposit_confirmed',
    'payment_intent',
    v_pi.id,
    jsonb_build_object(
      'ledger_journal_id', v_journal_id,
      'amount_cents', v_pi.amount_cents,
      'credit_amount_cents', v_credit_cents,
      'fee_amount_cents', v_fee_cents,
      'currency', v_pi.currency
    )
  );

  RETURN v_journal_id;
END;
$$;

COMMENT ON FUNCTION public.ledger_confirm_deposit(uuid, text, text, jsonb) IS
  'Confirms a verified payment intent and posts a net deposit journal. Uses metadata.credit_amount_cents when present (Hecom fee); otherwise credits full amount_cents.';
