// Congela a un cliente por orden de gerencia: pausa sus campañas activas, deja el cupo
// de BM10/30 en lo gastado y devuelve al BM el cash de BM200/300 (REFUND).
// No toca el ledger: lo que tenga a favor sigue registrado en Hecom.
// Caso: Jesús Jiménez, 11/10/2026.
//   node --use-system-ca --env-file=.env.local scripts/_congelar-cliente.mjs <adv1,adv2,...>            # solo muestra
//   node --use-system-ca --env-file=.env.local scripts/_congelar-cliente.mjs <adv1,adv2,...> --commit   # aplica
const TOKEN = String(process.env.TIKTOK_ACCESS_TOKEN || "").trim();
if (!TOKEN) throw new Error("Falta TIKTOK_ACCESS_TOKEN");
const API = "https://business-api.tiktok.com/open_api/v1.3";
const COMMIT = process.argv.includes("--commit");
const ADVS = (process.argv[2] || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!ADVS.length) throw new Error("Uso: _congelar-cliente.mjs <adv,...> [--commit]");
const BCS = { "10": "7652451146933698576", "30": "7564426417577148433", "200": "7575005779271614480", "300": "7680955666005196801" };
const PORTFOLIO_BM200 = "7654590612498563857";

// IDs grandes como string exacto.
const parse = (txt) => JSON.parse(txt, (k, v, ctx) => (typeof v === "number" && /_id$/.test(k) && ctx?.source ? ctx.source : v));
const get = async (path) => parse(await (await fetch(`${API}${path}`, { headers: { "Access-Token": TOKEN } })).text());
const post = async (path, body) =>
  parse(await (await fetch(`${API}${path}`, { method: "POST", headers: { "Access-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) })).text());

async function findAccount(adv) {
  for (const [bm, bc] of Object.entries(BCS)) {
    const j = await get(`/advertiser/balance/get/?bc_id=${bc}&filtering=${encodeURIComponent(JSON.stringify({ keyword: adv }))}&page_size=10`);
    const row = (j.data?.advertiser_account_list ?? []).find((r) => String(r.advertiser_id) === adv);
    if (row) return { bm, bc, row };
  }
  return null;
}

console.log(COMMIT ? "== APLICANDO ==" : "== SOLO MUESTRA (--commit para aplicar) ==");
for (const adv of ADVS) {
  const acc = await findAccount(adv);
  if (!acc) { console.log(`\n${adv}: no está en ningún BM`); continue; }
  const { bm, bc, row } = acc;
  console.log(`\n${row.advertiser_name} (${adv}) · BM${bm} · ${row.advertiser_status}`);

  const camps = await get(`/campaign/get/?advertiser_id=${adv}&page_size=1000`);
  const active = (camps.data?.list ?? []).filter((c) => c.operation_status === "ENABLE").map((c) => String(c.campaign_id));
  console.log(`  campañas activas: ${active.length}`);
  if (COMMIT && active.length) {
    const r = await post("/campaign/status/update/", { advertiser_id: adv, campaign_ids: active, operation_status: "DISABLE" });
    console.log(`  pausa: ${r.code} ${r.message}`);
  }

  if (bm === "10" || bm === "30") {
    const budget = Number(row.budget ?? 0);
    const cost = Number(row.budget_cost ?? 0);
    const target = Math.ceil(cost * 100) / 100;
    console.log(`  cupo: presupuesto ${budget.toFixed(2)} (${row.budget_mode}), gastado ${cost.toFixed(2)} → ${target.toFixed(2)}`);
    if (COMMIT && (budget > target || row.budget_mode !== "CUSTOM_BUDGET")) {
      const r = await post("/advertiser/update/", { bc_id: bc, budget_update_type: "UPDATE", advertiser_budgets: [{ advertiser_id: adv, budget: target, budget_mode: "CUSTOM_BUDGET" }] });
      const failed = r.data?.advertiser_budgets?.find?.((x) => x.status === "FAILED");
      console.log(`  cupo TikTok: ${r.code} ${r.message}${failed ? ` · ${failed.error_msg ?? JSON.stringify(failed)}` : ""}`);
    }
    continue;
  }

  const cash = Math.floor(Number(row.valid_cash_balance ?? row.account_balance ?? 0) * 100) / 100;
  console.log(`  cash: ${cash.toFixed(2)} → devolver al BM`);
  if (!COMMIT || !(cash > 0)) continue;
  const body = { bc_id: bc, advertiser_id: adv, transfer_type: "REFUND", cash_amount: cash, request_id: `congelar-${adv}-${Date.now()}` };
  let r = await post("/bc/transfer/", bm === "200" ? { ...body, payment_portfolio_id: PORTFOLIO_BM200 } : body);
  if (r.code !== 0 && bm === "300") r = await post("/bc/transfer/", body);
  // TikTok retiene unos centavos hasta 3 h después de pausar: se devuelve el máximo que deja.
  const max = r.code === 40002 ? Number(/maximum amount you can transfer out is ([\d.]+)/.exec(r.message)?.[1]) : NaN;
  if (max > 0) {
    const retry = { ...body, cash_amount: Math.floor(max * 100) / 100, request_id: `${body.request_id}-max` };
    r = await post("/bc/transfer/", bm === "200" ? { ...retry, payment_portfolio_id: PORTFOLIO_BM200 } : retry);
    console.log(`  (TikTok retiene ${(cash - retry.cash_amount).toFixed(2)} por 3 h; volver a correr luego)`);
  }
  console.log(`  REFUND: ${r.code} ${r.message}`);
}
