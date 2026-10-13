import "server-only";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { serverEnv } from "@/lib/env/env.server";
import { ensureAdvertisersInOrganizationForAllocation } from "@/services/payments.service";

/**
 * Vincula a su ficha de Hecom las cuentas TikTok de los 4 BMs que nadie vinculó
 * (las crea gerencia directo en TikTok y no aparecían en el panel del cliente).
 * Solo cuando el nombre de la cuenta empieza con el nombre de UN cliente; lo ambiguo
 * se reporta y no se toca. Caso: 444 cuentas sin vincular el 12/10/2026.
 */

const API = "https://business-api.tiktok.com/open_api/v1.3";
/** Cuentas de reserva o internas: nunca se asignan solas. */
const SKIP_NAME = /^(libre|holistic|gian libre)|libre\s*\d|probe/i;
const SKIP_WORDS = new Set(["usd", "agencia", "de", "la", "del"]);

export type AutoMapResult = {
  totalTikTok: number;
  unlinked: number;
  linked: Array<{ advertiserId: string; name: string; bm: string; cliente: string }>;
  ambiguous: Array<{ advertiserId: string; name: string; candidates: string[] }>;
  /** Vinculadas a un cliente pero en TikTok se llaman como otro (caso Yim 200 renombrada "Adriana Trujillo 207"). */
  mismatched: NameMismatch[];
  errors: string[];
};

export type NameMismatch = {
  advertiserId: string;
  name: string;
  bm: string;
  linkedCliente: string;
  nameCliente: string;
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Cliente = { id: string; name: string; n: string; fee: number | null };

/** Cliente cuyo nombre abre el nombre de la cuenta; si no, por las 2 primeras palabras. */
export function matchClientes(accountName: string, clientes: Cliente[]): Cliente[] {
  const an = norm(accountName);
  const byPrefix = clientes
    .filter((c) => an === c.n || an.startsWith(`${c.n} `))
    .sort((a, b) => b.n.length - a.n.length);
  if (byPrefix.length) {
    // El nombre más largo gana ("Frank Cari Mexico" sobre "Frank Cari") solo si es único.
    const longest = byPrefix[0]!.n.length;
    return byPrefix.filter((c) => c.n.length === longest);
  }
  const toks = an.split(" ").filter((t) => !/^\d/.test(t) && !SKIP_WORDS.has(t));
  if (toks.length < 2) return [];
  const two = `${toks[0]} ${toks[1]}`;
  const byTwo = clientes.filter((c) => c.n === two || c.n.startsWith(`${two} `));
  if (byTwo.length) return byTwo;
  // Nombre completo en TikTok y corto en Hecom: "Jamil Giordano Abuhadba Gentille" ↔ "Jamil Abuhadba".
  // Nombre + apellido paterno (el penúltimo antes del serial). "Jorge Zerda Pérez" NO es "Jorge Perez".
  const nameToks: string[] = [];
  for (const t of an.split(" ")) {
    if (/^\d/.test(t)) break;
    nameToks.push(t);
  }
  if (nameToks.length < 3) return [];
  const short = `${nameToks[0]} ${nameToks[nameToks.length - 2]}`;
  return clientes.filter((c) => c.n === short);
}

/**
 * Cuentas cuyo nombre en TikTok apunta a un cliente distinto del vinculado en Hecom.
 * Solo cuando el nombre apunta a un cliente sin dudas; los nombres libres o internos se saltan.
 * TikTok no deja renombrar por API: soporte corrige el nombre (o el vínculo) a mano.
 */
export function findNameMismatches(
  accounts: Array<{ id: string; name: string; bm: string }>,
  links: Array<{ client_id: string; advertiser_id: string }>,
  clientes: Cliente[],
  skipIds: Set<string> = new Set(),
): NameMismatch[] {
  const byId = new Map(clientes.map((c) => [c.id, c]));
  const linkedTo = new Map<string, string[]>();
  for (const l of links) {
    const id = String(l.advertiser_id);
    linkedTo.set(id, [...(linkedTo.get(id) ?? []), l.client_id]);
  }
  const out: NameMismatch[] = [];
  for (const acc of accounts) {
    const owners = linkedTo.get(acc.id);
    if (!owners?.length || skipIds.has(acc.id) || SKIP_NAME.test(acc.name)) continue;
    const matches = matchClientes(acc.name, clientes);
    if (matches.length !== 1 || owners.includes(matches[0]!.id)) continue;
    const linked = owners.map((id) => byId.get(id)?.name ?? id).join(", ");
    // Misma persona con otra ficha ("Frank Cari - Mexico" / "Frank Alexander", "Oscar Eduardo Vidal" / "Oscar Vidal"):
    // si el nombre de la cuenta también trae 2+ palabras del cliente vinculado, no es error.
    const accToks = new Set(norm(acc.name).split(" "));
    const samePerson = owners.some((id) => {
      const toks = (byId.get(id)?.n ?? "").split(" ").filter((t) => t.length >= 3);
      return toks.filter((t) => accToks.has(t)).length >= 2;
    });
    if (samePerson) continue;
    out.push({ advertiserId: acc.id, name: acc.name, bm: acc.bm, linkedCliente: linked, nameCliente: matches[0]!.name });
  }
  return out;
}

async function listBcAccounts(bm: string, bc: string): Promise<Array<{ id: string; name: string; bm: string }>> {
  const out: Array<{ id: string; name: string; bm: string }> = [];
  const token = serverEnv.tiktokAccessToken.trim();
  type Page = { code: number; message?: string; data?: { advertiser_account_list?: Array<Record<string, unknown>>; page_info?: { total_number?: number } } };
  const fetchPage = async (page: number): Promise<Page> => {
    const res = await fetch(`${API}/advertiser/balance/get/?bc_id=${bc}&page=${page}&page_size=50`, {
      headers: { "Access-Token": token },
      cache: "no-store",
    });
    // IDs grandes como string exacto (Number pierde precisión).
    return JSON.parse(await res.text(), (k, v, ctx?: { source?: string }) =>
      typeof v === "number" && /_id$/.test(k) && ctx?.source ? ctx.source : v,
    ) as Page;
  };
  for (let page = 1; page <= 100; page++) {
    let j = await fetchPage(page);
    // TikTok corta a veces (51010 time out, límite de consultas): reintenta antes de rendirse.
    for (let attempt = 1; j.code !== 0 && attempt <= 3; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      j = await fetchPage(page);
    }
    if (j.code !== 0) throw new Error(`TikTok BM${bm}: ${j.code} ${j.message ?? ""}`);
    for (const r of j.data?.advertiser_account_list ?? []) {
      out.push({ id: String(r.advertiser_id), name: String(r.advertiser_name ?? "").trim(), bm });
    }
    if (page * 50 >= (j.data?.page_info?.total_number ?? 0)) break;
  }
  return out;
}

export async function autoMapTikTokAccounts(opts: { commit: boolean }): Promise<AutoMapResult> {
  const hecom = createHecomAdminClient();
  const admin = createAdminClient();

  const all = async <T,>(table: string, select: string): Promise<T[]> => {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await hecom.from(table).select(select).range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };

  const [clientesRaw, links] = await Promise.all([
    all<{ id: string; name: string; tiktok_default_fee: number | null }>("clientes", "id,name,tiktok_default_fee"),
    all<{ client_id: string; advertiser_id: string; fee: number | null }>("cliente_tiktok_cuentas", "client_id,advertiser_id,fee"),
  ]);
  const linked = new Set(links.map((l) => String(l.advertiser_id)));
  const feeByCliente = new Map<string, number>();
  for (const l of links) if (l.fee != null && !feeByCliente.has(l.client_id)) feeByCliente.set(l.client_id, l.fee);
  const clientes: Cliente[] = clientesRaw
    .map((c) => ({ id: c.id, name: c.name, n: norm(c.name), fee: feeByCliente.get(c.id) ?? c.tiktok_default_fee ?? null }))
    .filter((c) => c.n.length >= 4 && c.n !== "holistic");

  // Cuentas liberadas a mano por gerencia: no se reasignan solas.
  const { data: freed } = await admin.from("ad_accounts").select("external_account_id").not("metadata->liberada", "is", null);
  const skipIds = new Set((freed ?? []).map((r) => String(r.external_account_id)));

  const accounts = (
    await Promise.all(Object.entries(HECOM_BM_BUCKET_TO_BC).map(([bm, bc]) => listBcAccounts(bm, bc)))
  ).flat();
  const unlinked = accounts.filter((a) => !linked.has(a.id));

  const result: AutoMapResult = {
    totalTikTok: accounts.length,
    unlinked: unlinked.length,
    linked: [],
    ambiguous: [],
    mismatched: findNameMismatches(accounts, links, clientes, skipIds),
    errors: [],
  };
  const newByCliente = new Map<string, Array<{ advertiserId: string; name: string }>>();

  for (const acc of unlinked) {
    if (skipIds.has(acc.id) || SKIP_NAME.test(acc.name)) continue;
    const matches = matchClientes(acc.name, clientes);
    if (matches.length > 1) {
      result.ambiguous.push({ advertiserId: acc.id, name: acc.name, candidates: matches.map((m) => m.name) });
      continue;
    }
    const cliente = matches[0];
    if (!cliente) continue;
    result.linked.push({ advertiserId: acc.id, name: acc.name, bm: acc.bm, cliente: cliente.name });
    if (!opts.commit) continue;

    const { error } = await hecom.from("cliente_tiktok_cuentas").insert({
      client_id: cliente.id,
      advertiser_id: acc.id,
      advertiser_name: acc.name,
      bm_bucket: acc.bm,
      fee: cliente.fee,
      sync_enabled: true,
    });
    if (error) {
      result.errors.push(`${acc.name}: ${error.message}`);
      continue;
    }
    const { data: rows } = await admin.from("ad_accounts").select("id,metadata,external_business_id").eq("external_account_id", acc.id);
    for (const r of rows ?? []) {
      const metadata = { ...((r.metadata as Record<string, unknown>) ?? {}), hecom_cliente_id: cliente.id, hecom_cliente_name: cliente.name };
      await admin
        .from("ad_accounts")
        .update({ metadata, external_business_id: r.external_business_id || HECOM_BM_BUCKET_TO_BC[acc.bm] })
        .eq("id", r.id);
    }
    const list = newByCliente.get(cliente.id) ?? [];
    list.push({ advertiserId: acc.id, name: acc.name });
    newByCliente.set(cliente.id, list);
  }

  // Que aparezcan ya en el panel del cliente (Cuentas Ads / asignar saldo).
  for (const [clienteId, advertisers] of newByCliente) {
    try {
      const orgId = await resolveOrganizationIdForHecomCliente(clienteId);
      if (!orgId) continue;
      const cliente = clientes.find((c) => c.id === clienteId);
      await ensureAdvertisersInOrganizationForAllocation({
        organizationId: orgId,
        clienteId,
        clienteName: cliente?.name,
        userId: null,
        advertisers: advertisers.map((a) => ({ advertiserId: a.advertiserId, name: a.name, status: "active" })),
      });
    } catch (e) {
      result.errors.push(`panel ${clienteId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}
