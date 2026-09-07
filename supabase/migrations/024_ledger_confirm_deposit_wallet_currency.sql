-- Cobrana / manual PEN: payment_intents.amount_cents + currency = cargo en soles,
-- pero la cartera Holistic acredita USD (metadata.credit_amount_cents + wallet_credit_currency).
-- Sin esto, ledger_confirm_deposit postea el neto con currency=PEN y rompe / contamina la cartera USD.

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
  v_credit_currency text;
  v_gross_usd_cents bigint;
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

  v_credit_currency := upper(
    COALESCE(
      NULLIF(btrim(COALESCE(v_meta->>'wallet_credit_currency', '')), ''),
      v_pi.currency
    )
  );

  v_gross_usd_cents := NULLIF(btrim(COALESCE(v_meta->>'gross_usd_cents', '')), '')::bigint;

  IF v_credit_currency = upper(v_pi.currency) THEN
    IF v_credit_cents > v_pi.amount_cents THEN
      RAISE EXCEPTION 'credit_amount_cents (%) cannot exceed payment amount (%)',
        v_credit_cents, v_pi.amount_cents;
    END IF;
    v_fee_cents := GREATEST(v_pi.amount_cents - v_credit_cents, 0);
  ELSE
    -- Cargo en otra moneda (ej. PEN) → crédito cartera USD.
    IF v_gross_usd_cents IS NOT NULL AND v_credit_cents > v_gross_usd_cents THEN
      RAISE EXCEPTION 'credit_amount_cents (%) cannot exceed gross_usd_cents (%)',
        v_credit_cents, v_gross_usd_cents;
    END IF;
    v_fee_cents := COALESCE(
      NULLIF(btrim(COALESCE(v_meta->>'fee_amount_cents', '')), '')::bigint,
      CASE
        WHEN v_gross_usd_cents IS NOT NULL THEN GREATEST(v_gross_usd_cents - v_credit_cents, 0)
        ELSE 0
      END
    );
  END IF;

  v_key := COALESCE(
    p_idempotency_key,
    'payment_intent:' || p_payment_intent_id::text || ':confirm'
  );

  v_journal_id := public.ledger_post_two_sided(
    v_pi.organization_id,
    v_pi.wallet_id,
    'deposit_confirmed',
    v_wallet_available_account_id,
    v_external_funding_account_id,
    v_credit_cents,
    v_credit_currency,
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
      'charge_currency', upper(v_pi.currency),
      'credit_amount_cents', v_credit_cents,
      'fee_amount_cents', v_fee_cents,
      'wallet_credit_currency', v_credit_currency
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
      'gross_amount_cents', v_pi.amount_cents,
      'wallet_credit_currency', v_credit_currency
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
      'charge_currency', upper(v_pi.currency),
      'currency', v_credit_currency
    )
  );

  RETURN v_journal_id;
END;
$$;

COMMENT ON FUNCTION public.ledger_confirm_deposit(uuid, text, text, jsonb) IS
  'Confirms a verified payment intent and posts a net deposit journal in wallet_credit_currency (USD) when charge currency differs (PEN Yape/manual).';
