// Vincula a su ficha de Hecom (y en Ads Holistic) las cuentas TikTok de los 4 BMs que no
// están vinculadas, cuando el nombre de la cuenta empieza con el nombre de un solo cliente.
// Entrada: JSON de pares { id, bm, name, clienteId } (lo arma el análisis previo).
// Caso: 12/10/2026, 444 cuentas sin vincular.
//   node --use-system-ca --env-file=.env.local scripts/_mapear-cuentas.mjs <pares.json> [--commit]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const COMMIT = process.argv.includes("--commit");
const pares = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const BCS = { "10": "7652451146933698576", "30": "7564426417577148433", "200": "7575005779271614480", "300": "7680955666005196801" };
const hecom = createClient(process.env.HECOM_SUPABASE_URL, process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ids = [...new Set(pares.map((p) => p.clienteId))];
const { data: clientes } = await hecom.from("clientes").select("id,name,tiktok_default_fee").in("id", ids);
const byId = new Map(clientes.map((c) => [c.id, c]));
const { data: fees } = await hecom.from("cliente_tiktok_cuentas").select("client_id,fee").in("client_id", ids).not("fee", "is", null);
const feeOf = new Map(fees.map((f) => [f.client_id, f.fee]));

let ok = 0, skip = 0;
for (const p of pares) {
  const c = byId.get(p.clienteId);
  const { data: ex } = await hecom.from("cliente_tiktok_cuentas").select("client_id").eq("advertiser_id", p.id).maybeSingle();
  if (ex) { skip++; console.log(`· ${p.name}: ya vinculada a ${ex.client_id === p.clienteId ? "este cliente" : "OTRO cliente"}, se salta`); continue; }
  const fee = feeOf.get(p.clienteId) ?? c.tiktok_default_fee ?? null;
  console.log(`${COMMIT ? "✓" : "→"} ${p.name} (BM${p.bm}) → ${c.name} · fee ${fee ?? "-"}`);
  if (!COMMIT) continue;
  const { error } = await hecom.from("cliente_tiktok_cuentas").insert({ client_id: p.clienteId, advertiser_id: p.id, advertiser_name: p.name, bm_bucket: p.bm, fee, sync_enabled: true });
  if (error) { console.log("   Hecom:", error.message); continue; }
  const { data: rows } = await admin.from("ad_accounts").select("id,metadata,external_business_id").eq("external_account_id", p.id);
  for (const r of rows ?? []) {
    const metadata = { ...(r.metadata ?? {}), hecom_cliente_id: p.clienteId, hecom_cliente_name: c.name };
    const { error: e2 } = await admin.from("ad_accounts").update({ metadata, external_business_id: r.external_business_id || BCS[p.bm] }).eq("id", r.id);
    if (e2) console.log("   Ads:", e2.message);
  }
  ok++;
}
console.log(`\n${COMMIT ? "vinculadas" : "por vincular"}: ${COMMIT ? ok : pares.length - skip} · saltadas ${skip}`);
