/** Frozen payment evidence sent to Hecom. These amounts never reprice a payment. */
export type WalletFunding = {
  schema_version: 1;
  currency: "USD";
  mode: "wallet_topup" | "credit_debt" | "unknown";
  payment_intent_id: string;
  hecom_client_id: string;
  provider: string;
  ledger_journal_id: string | null;
  source: string | null;
  gross_cents: number;
  wallet_credit_cents: number;
  holistic_fee_cents: number;
  gateway_surcharge_cents: number;
  unclassified_cents: number;
  fee_holistic_percent: number | null;
  fee_gateway_percent: number | null;
};

export type WalletFundingIntent = {
  id: string;
  amountCents: number;
  currency: string;
  provider: string;
  metadata: Record<string, unknown> | null;
};

function cents(value: unknown): number | null {
  if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value : null;
}

function percent(value: unknown): number | null {
  if (typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value)) value = Number(value);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const units = Math.round(value * 100);
  return Number.isSafeInteger(units) && Math.abs(value * 100 - units) < 1e-7
    ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function feeAtRate(credit: number, rate: number): number | null {
  // Matches the quoted gross rounding using integer hundredths of a percent.
  const units = Math.round(rate * 100);
  const result = (BigInt(credit) * BigInt(units) + BigInt(5000)) / BigInt(10000);
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}

function matchesAdjustedQuote(meta: Record<string, unknown>, charge: number, currency: string,
  rate: number, credit: number, fee: number, gross: number): boolean {
  if (typeof meta.amount_adjusted_at !== "string" || !Number.isFinite(Date.parse(meta.amount_adjusted_at))) return false;
  // Exact inverse used by manual-deposit.shared.ts; use only the frozen quote.
  if (currency === "USD") return Math.round(gross / (1 + rate / 100)) === credit && gross - credit === fee;
  const fx = typeof meta.fx_rate_usd_pen === "number" ? meta.fx_rate_usd_pen :
    typeof meta.fx_rate_usd_pen === "string" && /^\d+(?:\.\d+)?$/.test(meta.fx_rate_usd_pen) ? Number(meta.fx_rate_usd_pen) : null;
  if (fx === null || !Number.isFinite(fx) || fx <= 0) return false;
  const creditPen = Math.round(charge / (1 + rate / 100));
  return Math.round((creditPen / 100 / fx) * 100) === credit &&
    Math.round((charge / 100 / fx) * 100) === gross && gross - credit === fee;
}

/**
 * No current client fee, gateway default, exchange rate or name matching is used.
 * Older intents without separate percentages keep their fee unclassified.
 */
export function buildWalletFunding(
  intent: WalletFundingIntent,
  expected: { clientId: string; paymentIntentId: string; provider: string; ledgerJournalId?: string },
): WalletFunding | null {
  const meta = intent.metadata ?? {};
  const client = text(meta.hecom_cliente_id);
  const provider = intent.provider.trim().toLowerCase();
  if (intent.id !== expected.paymentIntentId || client !== expected.clientId || provider !== expected.provider ||
      !["stripe", "manual", "cobrana", "crypto"].includes(provider)) return null;
  const charge = cents(intent.amountCents);
  const usd = cents(meta.gross_usd_cents);
  const currency = intent.currency.toUpperCase();
  if (charge === null || charge <= 0 || !["USD", "PEN"].includes(currency)) return null;
  if (meta.gross_usd_cents != null && (usd === null || usd <= 0)) return null;
  if (currency === "USD" && usd !== null && usd !== charge) return null;
  const gross = usd ?? (currency === "USD" ? charge : null);
  if (gross === null || gross <= 0) return null;
  const source = text(meta.source);
  const ledger = text(meta.ledger_journal_id) ?? text(expected.ledgerJournalId);
  const result: WalletFunding = {
    schema_version: 1, currency: "USD", mode: "unknown",
    payment_intent_id: intent.id, hecom_client_id: client, provider,
    ledger_journal_id: ledger, source, gross_cents: gross,
    wallet_credit_cents: 0, holistic_fee_cents: 0, gateway_surcharge_cents: 0,
    unclassified_cents: gross, fee_holistic_percent: null, fee_gateway_percent: null,
  };

  if (meta.purpose === "credito_lock_debt" || source === "credito_detach") {
    // Debt already contains the charge's fee. The Credit engine assigns it once.
    result.mode = "credit_debt";
    const gateway = cents(meta.gateway_surcharge_cents);
    if (gateway !== null && gateway <= gross) {
      result.gateway_surcharge_cents = gateway;
      result.unclassified_cents = gross - gateway;
    }
    return result;
  }
  if (meta.skip_wallet_credit === true || !ledger ||
      !(meta.input_mode === "desired_credit" || source === "auto_recharge_calendar")) return result;
  if (meta.wallet_credit_currency != null && meta.wallet_credit_currency !== "USD") return result;

  const credit = cents(meta.credit_amount_cents);
  const fee = cents(meta.fee_amount_cents);
  // Some confirmation paths set gross_amount_cents to the PEN charge. The
  // credit/fee fields remain USD, as does gross_usd_cents; never add PEN here.
  const quoted = currency === "USD" ? cents(meta.gross_amount_cents) :
    credit !== null && fee !== null && Number.isSafeInteger(credit + fee) ? credit + fee : null;
  if (credit === null || credit <= 0 || credit > gross || fee === null || quoted === null ||
      !Number.isSafeInteger(credit + fee) || credit + fee !== quoted || quoted > gross) return result;
  result.mode = "wallet_topup";
  result.wallet_credit_cents = credit;
  result.unclassified_cents = gross - credit;

  const ownRate = percent(meta.fee_holistic_percent);
  const gatewayRate = percent(meta.fee_stripe_surcharge_percent);
  const totalRate = percent(meta.fee_percent);
  if (ownRate === null || gatewayRate === null || totalRate === null ||
      Math.round((ownRate + gatewayRate) * 100) !== Math.round(totalRate * 100) ||
      (provider !== "stripe" && gatewayRate !== 0)) return result;
  const totalFee = feeAtRate(credit, totalRate);
  const ownFee = feeAtRate(credit, ownRate);
  const adjustedOwnOnly = provider === "manual" && gatewayRate === 0 &&
    matchesAdjustedQuote(meta, charge, currency, totalRate, credit, fee, gross);
  if (!adjustedOwnOnly && (totalFee !== fee || ownFee === null || ownFee > fee)) return result;
  result.holistic_fee_cents = adjustedOwnOnly ? fee : ownFee as number;
  result.gateway_surcharge_cents = fee - result.holistic_fee_cents;
  result.unclassified_cents = gross - quoted;
  result.fee_holistic_percent = ownRate;
  result.fee_gateway_percent = gatewayRate;
  return result;
}
