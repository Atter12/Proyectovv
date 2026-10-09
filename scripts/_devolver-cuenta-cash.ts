/**
 * Devuelve a la cartera el saldo cash de una cuenta TikTok de BM200/BM300 (cuenta
 * castigada o que el cliente ya no usa): REFUND del advertiser al BM y el mismo monto
 * vuelve a la cartera en el ledger. Caso: Jair Santiago 200.0 castigada, 09/10/2026.
 *
 *   TIKTOK_BC_FUNDING_ENABLED=true JITI_ALIAS='{"@/":"<repo>/","server-only":"<repo>/scripts/_empty-module.cjs"}' \
 *   node --use-system-ca --import jiti/register --env-file=.env.local \
 *     scripts/_devolver-cuenta-cash.ts --ad-account=<uuid> [--commit]
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getWalletLedgerBalance, refundAdAccountToWallet } from "@/lib/ledger/ledger.server";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1]?.trim() ?? "";
const COMMIT = process.argv.includes("--commit");
const AD_ACCOUNT = arg("ad-account");
if (!AD_ACCOUNT) throw new Error("Uso: --ad-account=<uuid> [--commit]");
const TOKEN = String(process.env.TIKTOK_ACCESS_TOKEN || "").trim();
if (!TOKEN) throw new Error("Falta TIKTOK_ACCESS_TOKEN");
const API = "https://business-api.tiktok.com/open_api/v1.3";

// IDs grandes como string exacto.
const parse = (txt: string) =>
  JSON.parse(txt, (k, v, ctx?: { source?: string }) =>
    typeof v === "number" && /_id$/.test(k) && ctx?.source ? ctx.source : v,
  );
const get = async (path: string) => parse(await (await fetch(`${API}${path}`, { headers: { "Access-Token": TOKEN } })).text());
const post = async (path: string, body: unknown) =>
  parse(await (await fetch(`${API}${path}`, { method: "POST", headers: { "Access-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) })).text());

const admin = createAdminClient();
const { data: acc } = await admin.from("ad_accounts").select("id,name,external_account_id,organization_id").eq("id", AD_ACCOUNT).single();
if (!acc) throw new Error("No existe esa cuenta.");
const adv = String(acc.external_account_id);
const { data: led } = await admin.from("v_ad_account_ledger_balances").select("available_balance_cents").eq("ad_account_id", AD_ACCOUNT).single();
const ledgerCents = Number(led?.available_balance_cents ?? 0);

let row: Record<string, unknown> | null = null;
let bcId = "";
for (const bc of [HECOM_BM_BUCKET_TO_BC["200"], HECOM_BM_BUCKET_TO_BC["300"]]) {
  const j = await get(`/advertiser/balance/get/?bc_id=${bc}&filtering=${encodeURIComponent(JSON.stringify({ keyword: adv }))}&page=1&page_size=10`);
  row = (j.data?.advertiser_account_list ?? []).find((r: Record<string, unknown>) => String(r.advertiser_id) === adv) ?? null;
  if (row) { bcId = String(bc); break; }
}
if (!row) throw new Error("La cuenta no está en BM200/BM300 (solo cuentas cash).");
const cash = Math.floor(Number(row.valid_cash_balance ?? 0) * 100) / 100;
const backCents = Math.min(Math.round(cash * 100), ledgerCents);
console.log(`${acc.name} (${adv}) · ${row.advertiser_status} · BM ${bcId}`);
console.log(`TikTok cash disponible ${cash} · frozen ${row.frozen_balance} · ledger cuenta $${(ledgerCents / 100).toFixed(2)}`);
console.log(`→ REFUND $${cash} al BM y $${(backCents / 100).toFixed(2)} vuelven a la cartera`);
if (!COMMIT) { console.log("\nSolo muestra. Con --commit se aplica."); process.exit(0); }
if (process.env.TIKTOK_BC_FUNDING_ENABLED !== "true") throw new Error("Pasar TIKTOK_BC_FUNDING_ENABLED=true.");
if (cash <= 0) throw new Error("No hay cash para devolver.");

const pf = await get(`/payment_portfolio/get/?bc_id=${bcId}&page=1&page_size=50`);
const portfolios: Array<string | null> = [
  ...((pf.data?.payment_portfolios ?? pf.data?.list ?? []) as Array<Record<string, unknown>>)
    .filter((p) => String(p.payment_portfolio_type) === "NON_SHARED")
    .map((p) => String(p.payment_portfolio_id)),
  null,
];
let done = false;
for (const portfolio of portfolios) {
  const body: Record<string, unknown> = { bc_id: bcId, advertiser_id: adv, transfer_type: "REFUND", cash_amount: cash, request_id: `devolver-cash-${AD_ACCOUNT}-${Date.now()}` };
  if (portfolio) body.payment_portfolio_id = portfolio;
  const r = await post("/bc/transfer/", body);
  console.log(`REFUND ${portfolio ? `portfolio ${portfolio}` : "sin portfolio"}: ${r.code} ${r.message}`);
  if (r.code === 0) { done = true; break; }
}
if (!done) throw new Error("TikTok no dejó sacar el saldo. No se tocó el ledger.");

const j = await refundAdAccountToWallet({
  organizationId: acc.organization_id,
  adAccountId: AD_ACCOUNT,
  amountCents: backCents,
  idempotencyKey: `devolver-cash:${AD_ACCOUNT}:${new Date().toISOString().slice(0, 10)}`,
  description: "Saldo de cuenta cash devuelto a cartera",
  metadata: { reason: "cuenta_cash_a_cartera", advertiser_id: adv, tiktok_status: row.advertiser_status },
});
const w = await getWalletLedgerBalance(acc.organization_id);
console.log(`✓ journal ${j} · cartera $${((w?.availableBalanceCents ?? 0) / 100).toFixed(2)}`);
process.exit(0);
