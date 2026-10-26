/**
 * Prueba real de "Frenar gasto" con cuentas LIBRES (sin dueño, sin campañas), nunca de clientes.
 *   listar:  node --import jiti/register --env-file=.env.local scripts/_probar-frenar-gasto.ts
 *   probar:  ... scripts/_probar-frenar-gasto.ts --bm=30 --adv=<id> --commit
 * BM10/30: sube el cupo a gastado+$1, baja $0.50, luego deja en $0.
 * BM200/300: carga $1 del BM, baja $0.50 (REFUND), luego deja en $0 (REFUND del resto).
 */
import { listFreeAccountsWithMembers } from "@/lib/hecom/free-tiktok-accounts.server";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { setSharedBmAdvertiserBudgetAbsolute, transferBcFundsToAdvertiser } from "@/lib/integrations/tiktok/bc-finance.server";
import { bajarSaldoCuenta, congelarCuenta } from "@/lib/ops/frenar-gasto.server";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? "";
const bm = arg("bm");
const adv = arg("adv");
const COMMIT = process.argv.includes("--commit");
const TK = "https://business-api.tiktok.com/open_api/v1.3";
const token = String(process.env.TIKTOK_ACCESS_TOKEN || "").trim();

async function live(bmB: string, id: string) {
  const r = await fetch(`${TK}/advertiser/balance/get/?bc_id=${HECOM_BM_BUCKET_TO_BC[bmB]}&filtering=${encodeURIComponent(JSON.stringify({ keyword: id }))}&page_size=10`, { headers: { "Access-Token": token } });
  const j = JSON.parse(await r.text(), (k, v, ctx?: { source?: string }) => (typeof v === "number" && /_id$/.test(k) && ctx?.source ? ctx.source : v));
  const row = (j.data?.advertiser_account_list ?? []).find((x: Record<string, unknown>) => String(x.advertiser_id) === id);
  return row ? { status: row.advertiser_status, budget: Number(row.budget), cost: Number(row.budget_cost), mode: row.budget_mode, cash: Number(row.valid_cash_balance ?? row.account_balance) } : null;
}

if (!adv) {
  for (const b of ["30", "10", "300", "200"]) {
    const list = await listFreeAccountsWithMembers(b);
    const sample = list.slice(0, 3);
    for (const a of sample) console.log(`BM${b} ${a.advertiserId} ${a.name}`, JSON.stringify(await live(b, a.advertiserId)));
  }
  process.exit(0);
}

const free = await listFreeAccountsWithMembers(bm);
if (!free.some((a) => a.advertiserId === adv)) throw new Error("Esa cuenta no es libre: no se prueba.");
console.log("antes", await live(bm, adv));
if (!COMMIT) process.exit(0);

const shared = bm === "10" || bm === "30";
if (shared) {
  const l = (await live(bm, adv))!;
  const r = await setSharedBmAdvertiserBudgetAbsolute({ bcId: HECOM_BM_BUCKET_TO_BC[bm]!, advertiserId: adv, budgetUsd: Math.round((l.cost + 1) * 100) / 100, preferBudgetMode: "CUSTOM_BUDGET" });
  console.log("preparo cupo +$1 →", r.newBudget);
} else {
  const r = await transferBcFundsToAdvertiser({ bcId: HECOM_BM_BUCKET_TO_BC[bm]!, advertiserId: adv, cashAmount: 10, requestId: `prueba-frenar-${adv}-${Date.now()}` });
  console.log("preparo cash +$1 →", r.ok);
}
await new Promise((r) => setTimeout(r, 4000));
console.log("tras preparar", await live(bm, adv));
console.log("BAJAR →", await bajarSaldoCuenta({ bm, advertiserId: adv, amountUsd: shared ? 0.5 : 5 }));
await new Promise((r) => setTimeout(r, 4000));
console.log("tras bajar", await live(bm, adv));
console.log("CONGELAR →", await congelarCuenta({ bm, advertiserId: adv }));
await new Promise((r) => setTimeout(r, 4000));
console.log("final", await live(bm, adv));
