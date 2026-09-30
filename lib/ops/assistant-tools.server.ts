import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { getClienteModalidades } from "@/lib/ops/cliente-modalidad.server";
import { foldText, round2 } from "@/lib/ops/assistant-answer";
import { loadAssistantBrief } from "@/lib/ops/assistant-brief.server";

/**
 * Herramientas de datos (solo lectura) para el asistente de gerencia.
 * Cada una devuelve JSON chico y en español, listo para que el modelo lo lea.
 * Fuentes: Hecom (fichas, gastos, cobros) y Ads Holistic (pagos, cartera, cuentas).
 */

const TZ = "America/Lima";
const CACHE_MS = 60_000;

type Cliente = { id: string; name: string; emails: string[] };
type Base = {
  at: number;
  clientes: Cliente[];
  byId: Map<string, Cliente>;
  /** advertiser TikTok → cliente Hecom */
  advToCliente: Map<string, string>;
  /** advertiser → nombre de la cuenta */
  advName: Map<string, string>;
  /** ad_account (Holistic) → advertiser */
  adIdToAdv: Map<string, string>;
  /** organización Holistic → cliente (solo si la org es de un único cliente) */
  orgToCliente: Map<string, string>;
  /** Clientes que usan Ads Holistic (login o algún pago por la plataforma). */
  adsIds: Set<string>;
};

let base: Base | null = null;

const admin = () => createAdminClient() as unknown as SupabaseClient;

async function fetchAll<T>(client: SupabaseClient, table: string, select: string, apply?: (q: never) => unknown): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    let q = client.from(table).select(select) as unknown;
    if (apply) q = apply(q as never);
    const { data, error } = await (q as { range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function loadBase(): Promise<Base> {
  if (base && Date.now() - base.at < CACHE_MS) return base;
  const hecom = createHecomAdminClient();
  const [clientes, cuentas, ads, links, pis] = await Promise.all([
    fetchAll<{ id: string; name: string | null; emails: string[] | null }>(hecom, "clientes", "id,name,emails"),
    fetchAll<{ client_id: string; advertiser_id: string | null; advertiser_name: string | null }>(
      hecom,
      "cliente_tiktok_cuentas",
      "client_id,advertiser_id,advertiser_name",
    ),
    fetchAll<{ id: string; organization_id: string; name: string | null; external_account_id: string | null; hecom_cliente_id: string | null }>(
      admin(),
      "ad_accounts",
      "id,organization_id,name,external_account_id,hecom_cliente_id:metadata->>hecom_cliente_id",
      (q: never) => (q as { eq: (c: string, v: string) => unknown }).eq("platform", "tiktok") as never,
    ),
    fetchAll<{ hecom_cliente_id: string | null }>(admin(), "hecom_cliente_user_links", "hecom_cliente_id"),
    fetchAll<{ hecom_cliente_id: string | null }>(
      admin(),
      "payment_intents",
      "hecom_cliente_id:metadata->>hecom_cliente_id",
      (q: never) => (q as { eq: (c: string, v: string) => unknown }).eq("status", "succeeded") as never,
    ),
  ]);
  const adsIds = new Set<string>(
    [...links, ...pis].map((r) => String(r.hecom_cliente_id ?? "")).filter(Boolean),
  );
  const list: Cliente[] = clientes
    .filter((c) => c.name && !/^\[DUP\]/i.test(c.name))
    .map((c) => ({ id: String(c.id), name: String(c.name).trim(), emails: (c.emails ?? []).map(String) }));
  const advToCliente = new Map<string, string>();
  const advName = new Map<string, string>();
  for (const c of cuentas) {
    if (!c.advertiser_id) continue;
    advToCliente.set(String(c.advertiser_id), String(c.client_id));
    if (c.advertiser_name) advName.set(String(c.advertiser_id), String(c.advertiser_name).trim());
  }
  const adIdToAdv = new Map<string, string>();
  const orgClientes = new Map<string, Set<string>>();
  for (const a of ads) {
    const adv = String(a.external_account_id ?? "");
    if (adv) {
      adIdToAdv.set(a.id, adv);
      if (a.name && !advName.has(adv)) advName.set(adv, String(a.name).trim());
      if (a.hecom_cliente_id && !advToCliente.has(adv)) advToCliente.set(adv, String(a.hecom_cliente_id));
    }
    const cid = a.hecom_cliente_id ? String(a.hecom_cliente_id) : advToCliente.get(adv);
    if (cid) {
      const s = orgClientes.get(a.organization_id) ?? new Set<string>();
      s.add(cid);
      orgClientes.set(a.organization_id, s);
    }
  }
  const orgToCliente = new Map<string, string>();
  for (const [org, set] of orgClientes) if (set.size === 1) orgToCliente.set(org, [...set][0]!);
  base = {
    at: Date.now(),
    clientes: list,
    byId: new Map(list.map((c) => [c.id, c])),
    advToCliente,
    advName,
    adIdToAdv,
    orgToCliente,
    adsIds,
  };
  return base;
}

// ---------- formato

const usd = (v: number) => round2(Number(v) || 0);

function limaDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function limaYmd(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

/** Inicio del día Lima (UTC-5) en ISO. */
function limaDayStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00-05:00`).toISOString();
}

type Intent = {
  id: string;
  organization_id?: string | null;
  created_at: string;
  succeeded_at: string | null;
  status: string;
  provider: string | null;
  amount_cents: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
};

const STATUS_ES: Record<string, string> = {
  succeeded: "pagado",
  requires_payment: "pendiente (no pagó todavía)",
  processing: "en revisión",
  cancelled: "cancelado",
  failed: "rechazado/fallido",
  refunded: "reembolsado",
};

function metodoPago(p: Intent): string {
  const m = p.metadata ?? {};
  const source = String(m.source ?? "");
  if (source === "agency_bm_bridge") return "Recarga de gerente desde el BM (sin pago del cliente)";
  if (source === "tiktok_balance_import") return "Saldo de TikTok pasado a cartera (transferencia)";
  if (p.provider === "stripe") return "Stripe (tarjeta)";
  if (p.provider === "cobrana") {
    const opt = String(m.cobrana_option ?? m.cobrana_method ?? "");
    return `Yape/Plin por Cobrana${opt ? ` (${opt})` : ""}`;
  }
  if (p.provider === "crypto") return "Cripto (USDT)";
  if (p.provider === "manual") {
    const va = (m.voucher_analysis ?? {}) as Record<string, unknown>;
    const bank = String(va.originBank ?? va.paymentChannel ?? "").trim();
    const method = String(m.manual_pay_method ?? "").toLowerCase();
    const kind = method === "yape" ? "Yape con voucher" : method === "plin" ? "Plin con voucher" : "Transferencia/depósito con voucher";
    return `${kind}${bank ? ` (${bank})` : ""}`;
  }
  return String(p.provider ?? "otro");
}

function pagoRow(p: Intent, b: Base) {
  const m = p.metadata ?? {};
  const cid = String(m.hecom_cliente_id ?? "");
  const credit = Number(m.credit_amount_cents);
  const grossUsd = Number(m.gross_usd_cents);
  const penCents = Number(m.gross_pen_cents);
  return {
    cliente:
      b.byId.get(cid)?.name ||
      String(m.hecom_cliente_name ?? "").trim() ||
      b.byId.get(b.orgToCliente.get(String(p.organization_id ?? "")) ?? "")?.name ||
      String(m.customer_full_name ?? "").trim() ||
      "(sin ficha vinculada)",
    fecha: limaDate(p.succeeded_at ?? p.created_at),
    estado: STATUS_ES[p.status] ?? p.status,
    medio: metodoPago(p),
    acreditado_a_cartera_usd: Number.isFinite(credit) && credit > 0 ? usd(credit / 100) : null,
    cobrado:
      String(m.charge_currency ?? p.currency ?? "").toUpperCase() === "PEN" && Number.isFinite(penCents)
        ? `S/ ${(penCents / 100).toFixed(2)}${Number.isFinite(grossUsd) ? ` (≈ USD ${(grossUsd / 100).toFixed(2)})` : ""}`
        : `USD ${((Number(p.amount_cents) || 0) / 100).toFixed(2)}`,
    ...(m.manual_review_status ? { revision_voucher: String(m.manual_review_status) } : {}),
  };
}

const emailCache = new Map<string, string>();
async function emailOf(userId: string): Promise<string> {
  if (!userId) return "";
  if (emailCache.has(userId)) return emailCache.get(userId)!;
  const { data } = await admin().auth.admin.getUserById(userId).catch(() => ({ data: null }));
  const email = data?.user?.email ?? "";
  emailCache.set(userId, email);
  return email;
}

/** Recargas de gerente (fondeo desde el BM sin pago del cliente) con cliente, cuenta y quién la hizo. */
async function recargasGerente(b: Base, sinceIso: string, untilIso: string, clienteId?: string) {
  const { data } = await admin()
    .from("ledger_journals")
    .select("created_at,organization_id,metadata")
    .eq("journal_type", "allocation_to_ad_account")
    .eq("metadata->>source", "agency_bm")
    .gte("created_at", sinceIso)
    .lt("created_at", untilIso)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = [];
  for (const j of data ?? []) {
    const m = (j.metadata ?? {}) as Record<string, unknown>;
    const adv = String(m.tiktok_advertiser_id ?? "");
    const cid = b.advToCliente.get(adv) ?? b.orgToCliente.get(String(j.organization_id)) ?? "";
    if (clienteId && cid !== clienteId) continue;
    rows.push({
      fecha: limaDate(j.created_at),
      cliente: b.byId.get(cid)?.name ?? "(sin ficha)",
      cuenta: b.advName.get(adv) ?? adv,
      monto_usd: usd((Number(m.tiktok_amount_cents) || 0) / 100),
      hecho_por: await emailOf(String(m.requested_by ?? "")),
    });
  }
  return rows;
}

// ---------- herramientas

function tipoCliente(b: Base, cid: string, modalidades: Record<string, { modalidad: string; nota?: string }>): string {
  const mod = modalidades[cid];
  if (mod?.modalidad === "acuerdo") return `Paga después (acuerdo con gerencia)${mod.nota ? `. Nota: ${mod.nota}` : ""}`;
  if (!b.adsIds.has(cid)) return "Cliente de agencia en Hecom (no usa Ads Holistic; se le cobra por Hecom)";
  return "Prepago en Ads Holistic (debe pagar antes de gastar)";
}

export async function buscarClientes(args: { texto: string }) {
  const b = await loadBase();
  const q = foldText(String(args.texto ?? ""));
  if (q.length < 2) return { error: "Escribe al menos 2 letras del nombre." };
  const tokens = q.split(/[^a-z0-9@.]+/).filter((t) => t.length >= 2);
  const scored = b.clientes
    .map((c) => {
      const name = foldText(c.name);
      const emails = c.emails.map((e) => e.toLowerCase());
      let score = 0;
      if (name === q) score += 100;
      if (name.includes(q)) score += 50;
      for (const t of tokens) if (name.split(/\s+/).some((p) => p.startsWith(t))) score += 10;
      if (emails.some((e) => e.includes(q))) score += 60;
      return { c, score };
    })
    .filter((x) => x.score >= Math.max(10, tokens.length * 10))
    .sort((a, b2) => b2.score - a.score)
    .slice(0, 8);
  return {
    coincidencias: scored.map((x) => ({ cliente_id: x.c.id, nombre: x.c.name })),
    nota: scored.length === 0 ? "No encontré clientes con ese nombre." : undefined,
  };
}

export async function estadoCliente(args: { cliente_id: string }) {
  const b = await loadBase();
  const cid = String(args.cliente_id ?? "").trim();
  const cliente = b.byId.get(cid);
  if (!cliente) return { error: "Cliente no encontrado. Usa buscar_clientes primero." };
  const hecom = createHecomAdminClient();
  const today = todayYmdInTz(TZ);
  const yesterday = shiftYmd(today, -1);
  const month = today.slice(0, 7);
  const advs = [...b.advToCliente.entries()].filter(([, c]) => c === cid).map(([a]) => a);
  const adIds = [...b.adIdToAdv.entries()].filter(([, a]) => advs.includes(a)).map(([id]) => id);

  const [gastos, cobros, pagos, links, modalidades] = await Promise.all([
    fetchAll<{ gasto: number | null; fee: number | null; mes: string | null; tiktok_stat_date: string | null }>(
      hecom,
      "gastos",
      "gasto,fee,mes,tiktok_stat_date",
      (q: never) => (q as { eq: (c: string, v: string) => unknown }).eq("client_id", cid) as never,
    ),
    hecom.from("cobros").select("fecha,monto,metodo,periodo_resumen,notas").eq("client_id", cid).order("fecha", { ascending: false }).limit(8),
    admin()
      .from("payment_intents")
      .select("id,organization_id,created_at,succeeded_at,status,provider,amount_cents,currency,metadata")
      .eq("metadata->>hecom_cliente_id", cid)
      .order("created_at", { ascending: false })
      .limit(12),
    admin().from("hecom_cliente_user_links").select("user_id,email").eq("hecom_cliente_id", cid),
    getClienteModalidades().catch(() => ({}) as Record<string, never>),
  ]);

  let cargoMes = 0;
  let gastoHoy = 0;
  let gastoAyer = 0;
  for (const g of gastos) {
    const c = (Number(g.gasto) || 0) * (1 + (Number(g.fee) || 0) / 100);
    if (String(g.mes ?? "").startsWith(month)) cargoMes += c;
    if (g.tiktok_stat_date === today) gastoHoy += c;
    if (g.tiktok_stat_date === yesterday) gastoAyer += c;
  }
  const { data: cobrosMes } = await hecom.from("cobros").select("monto").eq("client_id", cid).eq("periodo_resumen", month);
  const cobradoMes = (cobrosMes ?? []).reduce((s, r) => s + (Number(r.monto) || 0), 0);

  // Movimientos de saldo a sus cuentas (asignaciones, recuperaciones)
  const movsRaw: Array<{ at: number; fecha: string; tipo: string; monto_usd: number; cuenta: string }> = [];
  let saldoEnCuentas = 0;
  if (adIds.length) {
    const { data: bal } = await admin().from("v_ad_account_ledger_balances").select("ad_account_id,available_balance_cents").in("ad_account_id", adIds);
    saldoEnCuentas = (bal ?? []).reduce((s, r) => s + Math.max(0, Number(r.available_balance_cents) || 0) / 100, 0);
    const { data: js } = await admin()
      .from("ledger_journals")
      .select("id,created_at,journal_type,metadata,description")
      .in("metadata->>tiktok_advertiser_id", advs)
      .in("journal_type", ["allocation_to_ad_account", "ad_account_refund_to_wallet"])
      .order("created_at", { ascending: false })
      .limit(15);
    for (const j of js ?? []) {
      const m = (j.metadata ?? {}) as Record<string, unknown>;
      const adv = String(m.tiktok_advertiser_id ?? "");
      const amount = Number(m.tiktok_amount_cents) / 100;
      const src = String(m.source ?? "");
      movsRaw.push({
        at: new Date(j.created_at).getTime(),
        fecha: limaDate(j.created_at),
        tipo:
          j.journal_type === "ad_account_refund_to_wallet"
            ? "saldo recuperado de la cuenta a la cartera"
            : src === "agency_bm"
              ? "recarga de gerente a la cuenta (sin pago del cliente)"
              : /Transferencia/i.test(String(j.description ?? ""))
                ? "transferencia entre sus cuentas"
                : "asignó saldo de su cartera a la cuenta",
        monto_usd: Number.isFinite(amount) && amount > 0 ? usd(amount) : 0,
        cuenta: b.advName.get(adv) ?? adv,
      });
    }
  }

  const acceso = await Promise.all(
    (links.data ?? []).map(async (l) => {
      const { data } = await admin().auth.admin.getUserById(String(l.user_id)).catch(() => ({ data: null }));
      const iso = data?.user?.last_sign_in_at ?? null;
      return { email: l.email ?? data?.user?.email ?? "", ultimo_inicio_de_sesion: limaDate(iso) || "nunca", iso };
    }),
  );
  const intentsList = (pagos.data ?? []) as Intent[];
  const pagosList = intentsList.map((p) => {
    const row = pagoRow(p, b);
    if (p.status !== "succeeded") return row;
    const paidAt = new Date(p.succeeded_at ?? p.created_at).getTime();
    const destino = movsRaw
      .filter((mv) => mv.tipo.startsWith("asignó") && mv.at >= paidAt - 60_000 && mv.at <= paidAt + 6 * 3_600_000)
      .sort((a, c) => a.at - c.at)[0];
    return destino ? { ...row, luego_lo_asigno_a: `${destino.cuenta} (${destino.fecha}, USD ${destino.monto_usd.toFixed(2)})` } : row;
  });
  const pagados30 = intentsList.filter(
    (p) => p.status === "succeeded" && String(p.metadata?.source ?? "") === "dashboard" && Date.now() - new Date(p.succeeded_at ?? p.created_at).getTime() < 30 * 86_400_000,
  ).length;
  const ultimoIngresoIso = (acceso as Array<{ iso: string | null }>).map((a) => a.iso).filter(Boolean).sort().at(-1) ?? null;
  const diasSinEntrar = ultimoIngresoIso ? Math.floor((Date.now() - new Date(ultimoIngresoIso).getTime()) / 86_400_000) : null;
  const usoPlataforma = !acceso.length
    ? "No tiene usuario en la plataforma."
    : `${diasSinEntrar === null ? "Nunca inició sesión" : diasSinEntrar <= 1 ? "Inició sesión hace poco" : `Su último inicio de sesión fue hace ${diasSinEntrar} días (la sesión puede seguir abierta)`}. Pagos completados por la plataforma en los últimos 30 días: ${pagados30}.`;
  const ultimaRecargaPagada = pagosList.find((p) => p.estado === "pagado" && !/gerente|TikTok pasado/.test(p.medio)) ?? null;

  return {
    cliente: cliente.name,
    tipo: tipoCliente(b, cid, modalidades as Record<string, { modalidad: string; nota?: string }>),
    uso_de_la_plataforma: usoPlataforma,
    hoy: today,
    mes: {
      periodo: month,
      gastado_con_fee_usd: usd(cargoMes),
      cobrado_usd: usd(cobradoMes),
      debe_usd: usd(Math.max(0, cargoMes - cobradoMes)),
      a_favor_usd: usd(Math.max(0, cobradoMes - cargoMes)),
    },
    gasto_hoy_con_fee_usd: usd(gastoHoy),
    gasto_ayer_con_fee_usd: usd(gastoAyer),
    saldo_asignado_en_sus_cuentas_usd: usd(saldoEnCuentas),
    ultima_recarga_pagada_por_la_plataforma: ultimaRecargaPagada,
    pagos_en_la_plataforma_recientes: pagosList.slice(0, 8),
    cobros_registrados_en_hecom_recientes: (cobros.data ?? []).map((c) => ({
      fecha: c.fecha,
      monto_usd: usd(Number(c.monto) || 0),
      metodo: c.metodo ?? "",
      periodo: c.periodo_resumen ?? "",
    })),
    movimientos_de_saldo_a_sus_cuentas: movsRaw.slice(0, 8).map((m) => ({ fecha: m.fecha, tipo: m.tipo, monto_usd: m.monto_usd, cuenta: m.cuenta })),
    cuentas_tiktok: { cantidad: advs.length, nombres: advs.slice(0, 12).map((a) => b.advName.get(a) ?? a) },
    acceso_a_la_plataforma: acceso.length
      ? acceso.map((a) => ({ email: a.email, ultimo_inicio_de_sesion: a.ultimo_inicio_de_sesion }))
      : "No tiene usuario vinculado a su ficha.",
  };
}

export async function pagos(args: { desde?: string; hasta?: string; cliente_id?: string }) {
  const b = await loadBase();
  const today = todayYmdInTz(TZ);
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(args.desde ?? "")) ? String(args.desde) : today;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(args.hasta ?? "")) ? String(args.hasta) : desde;
  const hecom = createHecomAdminClient();
  let cobrosQ = hecom.from("cobros").select("client_id,fecha,monto,metodo,periodo_resumen").gte("fecha", desde).lte("fecha", hasta).limit(1000);
  if (args.cliente_id) cobrosQ = cobrosQ.eq("client_id", args.cliente_id);
  let piQ = admin()
    .from("payment_intents")
    .select("id,organization_id,created_at,succeeded_at,status,provider,amount_cents,currency,metadata")
    .gte("created_at", limaDayStartIso(shiftYmd(desde, -1)))
    .lt("created_at", limaDayStartIso(shiftYmd(hasta, 1)))
    .limit(1000);
  if (args.cliente_id) piQ = piQ.eq("metadata->>hecom_cliente_id", args.cliente_id);
  const [cobros, pis] = await Promise.all([cobrosQ, piQ]);

  const cobrosRows = (cobros.data ?? []).map((c) => ({
    cliente: b.byId.get(String(c.client_id))?.name ?? "(sin ficha)",
    fecha: c.fecha,
    monto_usd: usd(Number(c.monto) || 0),
    metodo: c.metodo ?? "",
  }));
  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const d = limaYmd(iso);
    return d >= desde && d <= hasta;
  };
  const intents = (pis.data ?? []) as Intent[];
  const pagados = intents.filter((p) => p.status === "succeeded" && inRange(p.succeeded_at ?? p.created_at) && String(p.metadata?.source ?? "") === "dashboard");
  const pendientes = intents.filter((p) => ["requires_payment", "processing"].includes(p.status) && inRange(p.created_at));
  const gerente = await recargasGerente(b, limaDayStartIso(desde), limaDayStartIso(shiftYmd(hasta, 1)), args.cliente_id);

  const totalPlataforma = pagados.reduce((s, p) => s + (Number(p.metadata?.credit_amount_cents) || 0) / 100, 0);
  return {
    rango: desde === hasta ? desde : `${desde} a ${hasta}`,
    nota: "Los pagos por la plataforma se sincronizan a Hecom como cobros: no sumes las dos listas, son la misma plata vista desde dos lados.",
    recargas_pagadas_en_la_plataforma: {
      cantidad: pagados.length,
      total_acreditado_a_cartera_usd: usd(totalPlataforma),
      detalle: pagados.slice(0, 40).map((p) => pagoRow(p, b)),
    },
    cobros_registrados_en_hecom: {
      cantidad: cobrosRows.length,
      total_usd: usd(cobrosRows.reduce((s, c) => s + c.monto_usd, 0)),
      detalle: cobrosRows.slice(0, 40),
    },
    intentos_de_pago_pendientes: pendientes.slice(0, 20).map((p) => pagoRow(p, b)),
    recargas_de_gerente_sin_pago: {
      cantidad: gerente.length,
      total_usd: usd(gerente.reduce((s2, g) => s2 + g.monto_usd, 0)),
      detalle: gerente.slice(0, 30),
    },
  };
}

export async function actividadReciente(args: { horas?: number }) {
  const b = await loadBase();
  const horas = Math.min(168, Math.max(1, Number(args.horas) || 24));
  const since = new Date(Date.now() - horas * 3_600_000).toISOString();
  const [pis, js] = await Promise.all([
    admin()
      .from("payment_intents")
      .select("id,organization_id,created_at,succeeded_at,status,provider,amount_cents,currency,metadata")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300),
    admin()
      .from("ledger_journals")
      .select("created_at,journal_type,organization_id,metadata,description")
      .gte("created_at", since)
      .in("journal_type", ["allocation_to_ad_account", "ad_account_refund_to_wallet"])
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const eventos: Array<{ cuando: string; at: string; cliente: string; que_hizo: string }> = [];
  for (const p of (pis.data ?? []) as Intent[]) {
    if (String(p.metadata?.source ?? "") === "agency_bm_bridge") continue; // se muestra como recarga de gerente
    const row = pagoRow(p, b);
    if (!row.cliente) continue;
    const accion =
      p.status === "succeeded"
        ? `pagó una recarga: ${row.cobrado} por ${row.medio}`
        : p.status === "processing"
          ? `subió un voucher de ${row.cobrado} (en revisión)`
          : p.status === "requires_payment"
            ? `inició un pago de ${row.cobrado} por ${row.medio} y todavía no lo completa`
            : `pago de ${row.cobrado} ${STATUS_ES[p.status] ?? p.status}`;
    eventos.push({ cuando: limaDate(p.succeeded_at ?? p.created_at), at: p.succeeded_at ?? p.created_at, cliente: row.cliente, que_hizo: accion });
  }
  for (const j of js.data ?? []) {
    const m = (j.metadata ?? {}) as Record<string, unknown>;
    const adv = String(m.tiktok_advertiser_id ?? "");
    const cid = b.advToCliente.get(adv) ?? b.orgToCliente.get(String(j.organization_id));
    const cliente = cid ? b.byId.get(cid)?.name : null;
    if (!cliente) continue;
    const amount = Number(m.tiktok_amount_cents) / 100;
    const cuenta = b.advName.get(adv) ?? "una cuenta";
    const monto = Number.isFinite(amount) && amount > 0 ? `USD ${amount.toFixed(2)}` : "saldo";
    const que =
      j.journal_type === "ad_account_refund_to_wallet"
        ? `recuperó saldo de ${cuenta} a su cartera`
        : String(m.source ?? "") === "agency_bm"
          ? `un gerente (${(await emailOf(String(m.requested_by ?? ""))) || "sin dato"}) le cargó ${monto} a ${cuenta} desde el BM, sin pago del cliente`
          : /Transferencia/i.test(String(j.description ?? ""))
            ? `transfirió ${monto} a ${cuenta}`
            : `asignó ${monto} de su cartera a ${cuenta}`;
    eventos.push({ cuando: limaDate(j.created_at), at: j.created_at, cliente, que_hizo: que });
  }
  eventos.sort((a, c) => (a.at < c.at ? 1 : -1));
  const porCliente = new Map<string, number>();
  for (const e of eventos) porCliente.set(e.cliente, (porCliente.get(e.cliente) ?? 0) + 1);
  return {
    ventana: `últimas ${horas} horas`,
    clientes_con_movimiento: porCliente.size,
    eventos: eventos.slice(0, 60).map((e) => ({ cuando: e.cuando, cliente: e.cliente, que_hizo: e.que_hizo })),
  };
}

export async function gastoPorDia(args: { fecha?: string }) {
  const b = await loadBase();
  const today = todayYmdInTz(TZ);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(args.fecha ?? "")) ? String(args.fecha) : today;
  const hecom = createHecomAdminClient();
  const rows = await fetchAll<{ client_id: string; gasto: number | null; fee: number | null }>(
    hecom,
    "gastos",
    "client_id,gasto,fee",
    (q: never) => (q as { eq: (c: string, v: string) => unknown }).eq("tiktok_stat_date", fecha) as never,
  );
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.client_id, (by.get(r.client_id) ?? 0) + (Number(r.gasto) || 0) * (1 + (Number(r.fee) || 0) / 100));
  const list = [...by.entries()]
    .map(([id, v]) => ({ cliente: b.byId.get(id)?.name ?? "(sin ficha)", gasto_con_fee_usd: usd(v) }))
    .filter((r) => r.gasto_con_fee_usd >= 0.5)
    .sort((a, c) => c.gasto_con_fee_usd - a.gasto_con_fee_usd);
  return {
    fecha,
    nota: fecha === today ? "El gasto de hoy se sincroniza durante el día: puede estar incompleto." : undefined,
    clientes_con_gasto: list.length,
    total_usd: usd(list.reduce((s, r) => s + r.gasto_con_fee_usd, 0)),
    detalle: list.slice(0, 50),
  };
}

export async function deudasDelMes(args: { incluir_sin_deuda?: boolean; solo_ads_holistic?: boolean }) {
  const brief = await loadAssistantBrief();
  const modalidades = (await getClienteModalidades().catch(() => ({}))) as Record<string, { modalidad: string }>;
  const b = await loadBase();
  const idByName = new Map(b.clientes.map((c) => [c.name, c.id]));
  const list = brief.clientes
    .filter((c) => args.incluir_sin_deuda || c.debt > 0.5)
    .filter((c) => !args.solo_ads_holistic || b.adsIds.has(idByName.get(c.name) ?? ""))
    .sort((a, c) => c.debt - a.debt)
    .slice(0, 40)
    .map((c) => ({
      cliente: c.name,
      tipo: idByName.has(c.name) ? tipoCliente(b, idByName.get(c.name)!, modalidades) : "sin ficha",
      gastado_con_fee_usd: c.cargoMonth,
      cobrado_usd: c.paidMonth,
      debe_usd: c.debt,
      ultimo_cobro: c.lastCobro,
    }));
  return { mes: brief.monthLabel, clientes: list, total_deuda_usd: usd(list.reduce((s, r) => s + r.debe_usd, 0)) };
}

export async function resumenGeneral() {
  const brief = await loadAssistantBrief();
  return {
    hoy: brief.today,
    mes: brief.monthLabel,
    cobros_hoy_en_hecom: { total_usd: brief.pagosHoyTotal, clientes: brief.pagosHoy.slice(0, 15) },
    clientes_con_gasto_hoy: brief.activosHoy.length,
    top_gasto_hoy: brief.activosHoy.slice(0, 10),
    clientes_en_rojo: brief.rojos.length,
    vouchers_pendientes_de_revision: brief.pendingVouchers,
    recargas_ultimos_7_dias: brief.recarga7d,
    alertas: brief.alertas,
  };
}

// ---------- definición para el modelo

export const ASSISTANT_TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_clientes",
      description: "Busca clientes por nombre, apellido o email. Úsala siempre antes de estado_cliente si solo tienes el nombre.",
      parameters: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] },
    },
  },
  {
    type: "function",
    function: {
      name: "estado_cliente",
      description:
        "Todo de un cliente: tipo (prepago o paga después), gasto y deuda del mes, gasto de hoy y ayer, última recarga pagada (fecha, monto, medio), pagos recientes en la plataforma (incluye pendientes), cobros en Hecom, a qué cuentas TikTok asignó saldo, sus cuentas y su acceso (último ingreso).",
      parameters: { type: "object", properties: { cliente_id: { type: "string" } }, required: ["cliente_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "pagos",
      description:
        "Pagos en un rango de fechas (YYYY-MM-DD, hora Lima). Sin fechas = hoy. Devuelve recargas pagadas por la plataforma (con medio), cobros registrados en Hecom, intentos pendientes y recargas de gerente. Opcional cliente_id.",
      parameters: {
        type: "object",
        properties: { desde: { type: "string" }, hasta: { type: "string" }, cliente_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "actividad_reciente",
      description: "Qué hicieron los clientes en las últimas N horas (por defecto 24): pagos, vouchers, pagos pendientes, asignaciones de saldo a cuentas, transferencias y recargas de gerente.",
      parameters: { type: "object", properties: { horas: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "gasto_por_dia",
      description: "Clientes con gasto de anuncios (con fee) en una fecha YYYY-MM-DD. Sin fecha = hoy.",
      parameters: { type: "object", properties: { fecha: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "deudas_del_mes",
      description:
        "Clientes que deben este mes (gastado con fee − cobrado), de mayor a menor, con su tipo (prepago, paga después o cliente de agencia en Hecom). solo_ads_holistic=true deja solo clientes de la plataforma.",
      parameters: {
        type: "object",
        properties: { incluir_sin_deuda: { type: "boolean" }, solo_ads_holistic: { type: "boolean" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumen_general",
      description: "Pulso del día: cobros de hoy, clientes con gasto, clientes en rojo, vouchers pendientes, recargas de 7 días y alertas.",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

export const TOOL_LABELS: Record<string, string> = {
  buscar_clientes: "Hecom · Fichas",
  estado_cliente: "Ficha del cliente (Hecom + Ads Holistic)",
  pagos: "Pagos (Ads Holistic + Hecom)",
  actividad_reciente: "Actividad reciente (Ads Holistic)",
  gasto_por_dia: "Hecom · Gasto de ads",
  deudas_del_mes: "Hecom · Cartera del mes",
  resumen_general: "Resumen del día",
};

export async function runAssistantTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "buscar_clientes":
      return buscarClientes(args as { texto: string });
    case "estado_cliente":
      return estadoCliente(args as { cliente_id: string });
    case "pagos":
      return pagos(args as { desde?: string; hasta?: string; cliente_id?: string });
    case "actividad_reciente":
      return actividadReciente(args as { horas?: number });
    case "gasto_por_dia":
      return gastoPorDia(args as { fecha?: string });
    case "deudas_del_mes":
      return deudasDelMes(args as { incluir_sin_deuda?: boolean });
    case "resumen_general":
      return resumenGeneral();
    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}
