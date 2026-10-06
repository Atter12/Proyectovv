import assert from "node:assert/strict";
import test from "node:test";
import { buildProductPerformance, OTHERS, productFromCampaignName } from "./product-performance.ts";

test("lee el producto en los formatos de nombre que usan los clientes", () => {
  const cases: Array<[string, string]> = [
    ["TESTEO/SAFEBONE/WEB/25SEP2026", "SAFEBONE"],
    ["CBO/CURCUMA/WEB/11AGOSTO2026", "CURCUMA"],
    ["PR2109_TEST_GLUCORA_PE_C_v166-v175", "GLUCORA"],
    ["Copia 1 de PR1109 | TIROBALANCE V7 CAP 4.5 - ESCALADO", "TIROBALANCE"],
    ["oregano  / 2.00 / 27set26", "OREGANO"],
    ["PR2209_OREGANO_PE_L2_V91_V98_ABO", "OREGANO"],
    ["SMART CREATINE GUMMIES V2", "SMART CREATINE GUMMIES"],
    ["Copy 1 of Copia 1 de Madrid", "MADRID"],
    ["2X1!!!", OTHERS],
    ["Jesus Fuentes 200.0 USD - Agencia|7670389863890468871|BM200", OTHERS],
  ];
  for (const [name, product] of cases) assert.equal(productFromCampaignName(name), product, name);
});

test("junta campañas del mismo producto y marca escalar / revisar / apagar", () => {
  const { rows, averageCostPerResult } = buildProductPerformance([
    // CURCUMA: $100 · 40 conv → CPA 2.5 (barato)
    { campaignName: "TESTEO/CURCUMA/WEB/10AGO", spend: 60, impressions: 1000, clicks: 20, conversions: 25 },
    { campaignName: "CBO/CURCUMA/WEB/11AGO", spend: 40, impressions: 1000, clicks: 10, conversions: 15 },
    // COLAGENO: $100 · 10 conv → CPA 10 (caro)
    { campaignName: "TESTEO/COLAGENO/WEB/14AGO", spend: 100, impressions: 2000, clicks: 10, conversions: 10 },
    // CALCITRIN: $30 sin ventas → apagar
    { campaignName: "TESTEO/CALCITRIN/WEB/7AGO", spend: 30, impressions: 500, clicks: 3, conversions: 0 },
    // MENTRA: $5 → muy poco para opinar
    { campaignName: "TESTEO/MENTRA/WEB/5OCT", spend: 5, impressions: 100, clicks: 1, conversions: 0 },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.product, r]));
  assert.equal(averageCostPerResult, 4.7); // 235 / 50
  assert.equal(by.CURCUMA.campaigns.length, 2);
  assert.equal(by.CURCUMA.costPerResult, 2.5);
  assert.equal(by.CURCUMA.verdict, "scale");
  assert.equal(by.COLAGENO.verdict, "review");
  assert.equal(by.CALCITRIN.verdict, "stop");
  assert.equal(by.MENTRA.verdict, "low_data");
  assert.equal(rows[0].product, "CURCUMA"); // ordenado por gasto (empate con COLAGENO, va primero el insertado)
});

test("sin datos de conversiones no se opina", () => {
  const { rows, hasConversions } = buildProductPerformance([
    { campaignName: "TESTEO/CURCUMA/WEB/10AGO", spend: 60, impressions: null, clicks: null, conversions: null },
  ]);
  assert.equal(hasConversions, false);
  assert.equal(rows[0].verdict, "no_data");
  assert.equal(rows[0].ctr, null);
});
