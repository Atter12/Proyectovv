// Hernan Lora (Hecom b5541d6f…): devuelve al BM todo el cash de sus cuentas
// TikTok y baja el cupo de su cuenta BM30 a lo ya gastado. Pedido 02/10/2026.
//   node --env-file=.env.local scripts/_hernan-lora-quitar-saldo.mjs            # solo muestra
//   node --env-file=.env.local scripts/_hernan-lora-quitar-saldo.mjs --commit   # ejecuta
const token = String(process.env.TIKTOK_ACCESS_TOKEN || "").trim();
if (!token) throw new Error("Falta TIKTOK_ACCESS_TOKEN");
const API = "https://business-api.tiktok.com/open_api/v1.3";
const COMMIT = process.argv.includes("--commit");

const BM200 = "7575005779271614480";
const BM300 = "7680955666005196801";
const BM30 = "7564426417577148433";

// Cuentas cash (NON_SHARED): se devuelve el cash al portfolio principal del BM.
const CASH = [
  { bc: BM200, adv: "7647225635513040916" }, // Hernan Lora 200.0 USD
  { bc: BM200, adv: "7647225268356300820" }, // Hernan Lora 201.0 USD
  { bc: BM200, adv: "7647225049560219668" }, // Hernan Lora 202.0 USD
  { bc: BM300, adv: "7688736873191784469" }, // Hernan Lora 300.0 USD - Agencia
  { bc: BM300, adv: "7688737182290378773" }, // Hernan Lora 301.0 USD - Agencia
];
// Cuentas SHARED (línea de crédito): presupuesto = gastado, cupo libre 0.
const SHARED = [
  { bc: BM30, adv: "7626390352800006151" }, // Hernan Lora 31.0 USD - Agencia
  { bc: BM30, adv: "7626391513676906503" }, // Hernan Lora 30.0 USD - Agencia
];
const PORTFOLIO_NAME = { [BM200]: /BM Entreprise 200/i, [BM300]: /^Portfolio 4540$/ };

// IDs grandes como string exacto (Number pierde precisión).
const parse = (txt) =>
  JSON.parse(txt, (k, v, ctx) =>
    typeof v === "number" && /_id$/.test(k) && ctx?.source ? ctx.source : v,
  );
const getJson = async (path) =>
  parse(await (await fetch(`${API}${path}`, { headers: { "Access-Token": token } })).text());
const postJson = async (path, body) =>
  parse(
    await (
      await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Access-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).text(),
  );

async function balanceRow(bc, adv) {
  for (let page = 1; page <= 40; page++) {
    const j = await getJson(`/advertiser/balance/get/?bc_id=${bc}&page=${page}&page_size=50`);
    if (j.code !== 0) throw new Error(`balance: ${j.code} ${j.message}`);
    const row = (j.data?.advertiser_account_list ?? []).find((r) => String(r.advertiser_id) === adv);
    if (row) return row;
    if (page * 50 >= (j.data?.page_info?.total_number ?? 0)) break;
  }
  return null;
}

const portfolioCache = {};
async function mainPortfolio(bc) {
  if (portfolioCache[bc]) return portfolioCache[bc];
  const pj = await getJson(`/payment_portfolio/get/?bc_id=${bc}&page=1&page_size=50`);
  if (pj.code !== 0) throw new Error(`portfolio: ${pj.code} ${pj.message}`);
  const list = (pj.data?.payment_portfolios ?? pj.data?.list ?? []).map((p) => ({
    id: String(p.payment_portfolio_id),
    type: p.payment_portfolio_type,
    name: p.payment_portfolio_name,
  }));
  const nonShared = list.filter((p) => p.type === "NON_SHARED");
  const named = nonShared.filter((p) => PORTFOLIO_NAME[bc]?.test(p.name || ""));
  const pick = named.length === 1 ? named[0] : nonShared.length === 1 ? nonShared[0] : null;
  if (!pick) {
    console.log(`  Portfolios de ${bc}:`, list);
    throw new Error(`No sé cuál es el portfolio principal de ${bc}. No se toca esa cuenta.`);
  }
  portfolioCache[bc] = pick;
  return pick;
}

let total = 0;
console.log(COMMIT ? "== EJECUTANDO ==" : "== SOLO MUESTRA (agrega --commit para ejecutar) ==");

for (const { bc, adv } of CASH) {
  try {
    const row = await balanceRow(bc, adv);
    if (!row) {
      console.log(`\n${adv}: no está en el BM ${bc}`);
      continue;
    }
    const cash = Math.floor(Number(row.account_balance ?? 0) * 100) / 100;
    console.log(`\n${row.advertiser_name} (${adv}) cash ${cash}`);
    if (!(cash > 0)) continue;
    const portfolio = await mainPortfolio(bc);
    const body = {
      bc_id: bc,
      advertiser_id: adv,
      transfer_type: "REFUND",
      cash_amount: cash,
      payment_portfolio_id: portfolio.id,
      request_id: `refund-lora-${adv.slice(-6)}-${Date.now()}`.slice(0, 32),
    };
    console.log(`  REFUND ${cash} → portfolio «${portfolio.name}»`);
    if (!COMMIT) {
      total += cash;
      continue;
    }
    const r = await postJson("/bc/transfer/", body);
    console.log(`  Respuesta: ${r.code} ${r.message}`);
    if (r.code === 0) total += cash;
    await new Promise((res) => setTimeout(res, 1500));
    const after = await balanceRow(bc, adv);
    console.log(`  Después: cash ${after?.account_balance}`);
  } catch (error) {
    console.log(`  ERROR ${adv}: ${error.message}`);
  }
}

for (const { bc, adv } of SHARED) {
  const row = await balanceRow(bc, adv);
  if (!row) {
    console.log(`\n${adv}: no está en el BM ${bc}`);
    continue;
  }
  const cost = Number(row.budget_cost ?? 0);
  const budget = Number(row.budget ?? 0);
  console.log(`\n${row.advertiser_name} (${adv}) presupuesto ${budget}, gastado ${cost}, libre ${(budget - cost).toFixed(2)}`);
  if (budget <= cost) continue;
  const newBudget = Math.ceil(cost * 100) / 100;
  console.log(`  Presupuesto ${budget} → ${newBudget}`);
  if (!COMMIT) continue;
  const r = await postJson("/advertiser/update/", {
    bc_id: bc,
    budget_update_type: "UPDATE",
    advertiser_budgets: [{ advertiser_id: adv, budget: newBudget, budget_mode: "CUSTOM_BUDGET" }],
  });
  console.log(`  Respuesta: ${r.code} ${r.message}`);
}

console.log(`\nTotal cash ${COMMIT ? "devuelto" : "a devolver"}: ${total.toFixed(2)} USD`);
