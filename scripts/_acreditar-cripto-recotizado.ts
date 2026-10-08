/**
 * Acredita una recarga cripto que NOWPayments dejó en «partially_paid» porque
 * volvió a cotizar mientras confirmaba, aunque el cliente mandó EXACTAMENTE lo
 * que se le pidió primero.
 *
 * Caso de origen: Wilder Remolina, 08/10/2026. Pidió 75.494282 USDT, llegó
 * 75.494282 y NOWPayments recotizó a 75.736217 → partially_paid.
 *
 * Solo acredita si lo pagado ≥ la PRIMERA cotización (estado «waiting»). Acredita
 * el crédito original de la orden (no recalcula).
 *
 *   HECOM_COBROS_BRIDGE_ENABLED=true JITI_ALIAS='{"@/":"<repo>/","server-only":"<repo>/scripts/_empty-module.cjs"}' \
 *   node --use-system-ca --import jiti/register --env-file=.env.local \
 *     scripts/_acreditar-cripto-recotizado.ts --intent=<uuid> [--commit]
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentIntentByIdInternal, mergePaymentIntentMetadata } from "@/lib/payments/payment-intents.server";
import { processSuccessfulPaymentIntent } from "@/lib/payments/create-intent.server";
import { getWalletLedgerBalance } from "@/lib/ledger/ledger.server";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1]?.trim() ?? "";
const COMMIT = process.argv.includes("--commit");
const ID = arg("intent");
if (!ID) throw new Error("Uso: --intent=<uuid> [--commit]");

const intent = await getPaymentIntentByIdInternal(ID);
if (!intent) throw new Error("No existe ese intent.");
if (intent.provider !== "crypto") throw new Error("No es una recarga cripto.");
if (intent.status === "succeeded") throw new Error("Ya está acreditado.");
const meta = intent.metadata as Record<string, unknown>;

const { data: events } = await createAdminClient()
  .from("webhook_events")
  .select("created_at,payload")
  .contains("payload", { order_id: ID })
  .order("created_at");
const list = (events ?? []).map((e) => e.payload as Record<string, unknown>);
const first = list.find((p) => p.payment_status === "waiting");
const last = list[list.length - 1];
if (!first || !last) throw new Error("No hay avisos de NOWPayments para esta orden.");
const quoted = Number(first.pay_amount);
const paid = Math.max(...list.map((p) => Number(p.actually_paid) || 0));

console.log(`${meta.hecom_cliente_name} · orden $${intent.amountCents / 100} → crédito $${Number(meta.credit_amount_cents) / 100}`);
console.log(`Primera cotización ${quoted} ${first.pay_currency} · pagado ${paid} · último estado ${last.payment_status} (pidió ${last.pay_amount})`);
if (!(paid + 1e-6 >= quoted)) throw new Error("Pagó menos que la primera cotización: revisar a mano.");
if (!/partially_paid|confirmed|sending|finished/.test(String(last.payment_status))) throw new Error("El pago no está confirmado en la red.");
console.log("→ Pagó lo cotizado. Se acredita el crédito completo de la orden.");

if (!COMMIT) {
  console.log("\nSolo muestra. Con --commit se aplica.");
  process.exit(0);
}
if (process.env.HECOM_COBROS_BRIDGE_ENABLED !== "true") throw new Error("Pasar HECOM_COBROS_BRIDGE_ENABLED=true para que el cobro llegue a Hecom.");
await mergePaymentIntentMetadata(ID, {
  credited_manually: {
    reason: "nowpayments_recotizo",
    quoted_pay_amount: quoted,
    actually_paid: paid,
    last_status: last.payment_status,
    at: new Date().toISOString(),
  },
});
await processSuccessfulPaymentIntent({ provider: "crypto", paymentIntentId: ID });
const after = await getPaymentIntentByIdInternal(ID);
const wallet = await getWalletLedgerBalance(intent.organizationId);
console.log(`✓ ${after?.status} · Hecom ${JSON.stringify((after?.metadata as Record<string, unknown>)?.hecom_cobro_sync ?? null)}`);
console.log(`Cartera ahora: $${((wallet?.availableBalanceCents ?? 0) / 100).toFixed(2)}`);
