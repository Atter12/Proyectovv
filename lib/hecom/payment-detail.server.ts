import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildWalletFunding } from "@/lib/hecom/wallet-funding";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 100;
const PAYMENT_SELECT = "id,organization_id,wallet_id,status,amount_cents,currency,provider,provider_reference,created_at,succeeded_at,metadata";
const JOURNAL_SELECT = "id,organization_id,wallet_id,journal_type,status,source_table,source_id,amount_cents,currency,posted_at,reversal_of_journal_id,reversed_by_journal_id";
type Row = Record<string, unknown>;
type Query = { clientId: string; paymentId: string | null; receiptDate: string; month: string; start: string; end: string };

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function cents(value: unknown): number | null {
  if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function rate(value: unknown): number | null {
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) value = Number(value);
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
function date(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
}
function identifier(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}
function code(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_:-]{1,200}$/.test(value) ? value : null;
}
function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store, private", "Vary": "Authorization" } });
}
function authenticated(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  return timingSafeEqual(createHash("sha256").update(header.slice(7)).digest(), createHash("sha256").update(secret).digest());
}
function parseQuery(request: Request): Query | null {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => !["clientId", "receiptDate", "paymentId"].includes(key) || params.getAll(key).length !== 1)) return null;
  const clientId = identifier(params.get("clientId"));
  const paymentId = params.has("paymentId") ? identifier(params.get("paymentId")) : null;
  const receiptDate = params.get("receiptDate") ?? "";
  if (!clientId || (params.has("paymentId") && !paymentId) || !/^20\d{2}-\d{2}-\d{2}$/.test(receiptDate)) return null;
  const parsed = new Date(`${receiptDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== receiptDate) return null;
  const year = parsed.getUTCFullYear(), monthIndex = parsed.getUTCMonth();
  return { clientId, paymentId, receiptDate, month: receiptDate.slice(0, 7),
    start: new Date(Date.UTC(year, monthIndex, 1, 5)).toISOString(),
    end: new Date(Date.UTC(year, monthIndex + 1, 1, 5)).toISOString() };
}

function walletCredit(payment: Row, journals: Row[], available: boolean) {
  const empty = (status: string) => ({ verified: false, ledger_journal_id: null, amount_cents: null, currency: null, posted_at: null, status });
  if (!available) return empty("unavailable");
  const candidates = journals.filter(j => j.source_id === payment.id);
  if (!candidates.length) return empty("not_found");
  if (candidates.length !== 1) return empty("source_mismatch");
  const journal = candidates[0];
  if (journal.organization_id !== payment.organization_id || journal.wallet_id !== payment.wallet_id ||
      journal.source_table !== "payment_intents" || journal.journal_type !== "deposit_confirmed" ||
      journal.status !== "posted" || journal.reversal_of_journal_id || journal.reversed_by_journal_id ||
      payment.status !== "succeeded" || !identifier(journal.id) || !cents(journal.amount_cents) ||
      !["USD", "PEN"].includes(String(journal.currency))) return empty("source_mismatch");
  return { verified: true, ledger_journal_id: identifier(journal.id), amount_cents: cents(journal.amount_cents),
    currency: String(journal.currency), posted_at: date(journal.posted_at), status: "verified" };
}

function paymentDetail(payment: Row, query: Query, journals: Row[], journalsComplete: boolean) {
  const meta = record(payment.metadata);
  const wallet = walletCredit(payment, journals, journalsComplete);
  // An arbitrary metadata journal ID cannot prove a wallet credit. Only the
  // exact journal source, organization and wallet validated above can do so.
  const fundingMeta = { ...meta, ledger_journal_id: wallet.ledger_journal_id };
  let funding = payment.status === "succeeded" ? buildWalletFunding({ id: String(payment.id),
    amountCents: cents(payment.amount_cents) ?? 0, currency: String(payment.currency),
    provider: String(payment.provider), metadata: fundingMeta }, {
    clientId: query.clientId, paymentIntentId: String(payment.id), provider: String(payment.provider),
  }) : null;
  if (funding) {
    // source is a code, not a free-text metadata dump.
    funding = { ...funding, source: code(funding.source) };
    if (funding.mode === "wallet_topup" && (wallet.currency !== "USD" || wallet.amount_cents !== funding.wallet_credit_cents)) {
      funding = { ...funding, mode: "unknown", wallet_credit_cents: 0, holistic_fee_cents: 0,
        gateway_surcharge_cents: 0, unclassified_cents: funding.gross_cents,
        fee_holistic_percent: null, fee_gateway_percent: null };
    }
  }
  return {
    id: identifier(payment.id), status: code(payment.status), amount_cents: cents(payment.amount_cents),
    currency: /^[A-Z]{3}$/.test(String(payment.currency)) ? payment.currency : null,
    provider: code(payment.provider), provider_reference: code(payment.provider_reference),
    created_at: date(payment.created_at), succeeded_at: date(payment.succeeded_at),
    relationship: query.paymentId ? "exact_payment" : "same_client_month",
    funding, original: { fx_rate_usd_pen: rate(meta.fx_rate_usd_pen),
      charge_currency: /^[A-Z]{3}$/.test(String(payment.currency)) ? payment.currency : null,
      charge_amount_cents: cents(payment.amount_cents) }, wallet_credit: wallet,
  };
}

/** Read-only server bridge. Caller credentials never reach a browser or log. */
export async function handleHecomPaymentDetail(request: Request, dependencies: {
  secret: string; createAdmin: () => SupabaseClient;
}) {
  if (!dependencies.secret) return response({ ok: false, error: "bridge_not_configured" }, 503);
  if (!authenticated(request, dependencies.secret)) return response({ ok: false, error: "unauthorized" }, 401);
  const query = parseQuery(request);
  if (!query) return response({ ok: false, error: "invalid_query" }, 400);
  try {
    const admin = dependencies.createAdmin();
    const signal = AbortSignal.timeout(20_000);
    let select = admin.from("payment_intents").select(PAYMENT_SELECT)
      .eq("metadata->>hecom_cliente_id", query.clientId);
    if (query.paymentId) select = select.eq("id", query.paymentId);
    else select = select.or(`and(succeeded_at.gte.${query.start},succeeded_at.lt.${query.end}),and(succeeded_at.is.null,created_at.gte.${query.start},created_at.lt.${query.end})`);
    const { data, error } = await select.order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(query.paymentId ? 1 : LIMIT + 1).abortSignal(signal);
    if (error || !Array.isArray(data)) return response({ ok: false, error: "payment_source_unavailable" }, 502);
    // Defense in depth, including mocked/unexpected DB results. Do not reveal
    // whether an exact ID exists in a different client's account.
    const owned = data.filter(row => record(row.metadata).hecom_cliente_id === query.clientId &&
      identifier(row.id) && identifier(row.organization_id) && identifier(row.wallet_id) &&
      (!query.paymentId || row.id === query.paymentId));
    const hasMore = owned.length > LIMIT;
    const payments = owned.slice(0, LIMIT);
    let journals: Row[] = [], journalsComplete = true;
    if (payments.length) {
      try {
        const result = await admin.from("ledger_journals").select(JOURNAL_SELECT)
          .eq("source_table", "payment_intents").eq("journal_type", "deposit_confirmed")
          .in("source_id", payments.map(row => row.id)).limit(LIMIT + 1).abortSignal(signal);
        journalsComplete = !result.error && Array.isArray(result.data) && result.data.length <= LIMIT;
        if (journalsComplete) journals = result.data as Row[];
      } catch {
        journalsComplete = false;
      }
    }
    return response({ ok: true, source: "adsholistic", checkedAt: new Date().toISOString(),
      coverage: { mode: query.paymentId ? "exact_payment" : "client_month", month: query.month,
        complete: !hasMore, limit: LIMIT, returned: payments.length, hasMore, journalsComplete,
        dateBasis: "succeeded_at_or_created_at", timezone: "America/Lima" },
      payments: payments.map(payment => paymentDetail(payment, query, journals, journalsComplete)),
    });
  } catch {
    return response({ ok: false, error: "payment_source_unavailable" }, 502);
  }
}
