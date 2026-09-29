import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { isAgencyCreditCliente } from "@/lib/hecom/is-agency-credit-cliente.server";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import { resolveManualPaymentManagerEmails } from "@/lib/email/manual-payment-notify.server";
import { escapeHtml, wrapInternalEmail } from "@/lib/email/templates/layout";

/**
 * Guardián de prepago (cron cada 15 min).
 *
 * En Ads Holistic todo cliente es prepago: lo que puede gastar en TikTok
 * (presupuesto − gastado) no debe superar su saldo en cartera. Hoy el tope
 * solo se aplica al recargar o al abrir la cuenta en vivo; entre esos
 * momentos un cambio en TikTok o un error de configuración deja gastar de más.
 *
 * Modo "alert" (default): detecta, registra en audit_logs y avisa a gerencia.
 * No escribe en TikTok. Es la versión automática del dry-run de
 * scripts/cap-ads-holistic-shared-budgets.mjs.
 */

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";
/** BM con presupuesto compartido (SHARED): ahí el cupo lo fija la agencia. */
const SHARED_BUCKETS = ["10", "30"] as const;
/** Margen para no avisar por centavos. */
const TOLERANCE_USD = 1;
/** Si el mismo problema sigue, se vuelve a avisar pasadas estas horas. */
const REALERT_AFTER_HOURS = 6;
const MANAGER_EMAILS_PER_SECOND = 2;
const AUDIT_ACTION = "prepago_guard.run";

export type PrepagoGuardIncident = {
  kind: "budget_over_balance" | "credit_without_approval";
  hecomClienteId: string;
  clienteName: string;
  advertiserId?: string;
  advertiserName?: string;
  bm?: string;
  /** Lo que TikTok deja gastar hoy (presupuesto − gastado). */
  tiktokRemainingUsd?: number;
  ledgerUsd?: number;
  /** Cuánto de más puede gastar respecto a su saldo. */
  excessUsd?: number;
  unlimited?: boolean;
  /** Presupuesto que debería tener: gastado + saldo. */
  targetBudgetUsd?: number;
};

export type PrepagoGuardResult = {
  mode: "alert";
  scannedAdvertisers: number;
  adsClientes: number;
  incidents: PrepagoGuardIncident[];
  alerted: boolean;
  alertReason: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Lee todas las filas (Supabase devuelve de a 1000). `eq` filtra por igualdad. */
async function fetchAllRows<T>(
  table: string,
  select: string,
  eq: Record<string, string> = {},
): Promise<T[]> {
  const admin = createAdminClient();
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = admin.from(table).select(select);
    for (const [column, value] of Object.entries(eq)) query = query.eq(column, value);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Clientes Hecom que usan Ads Holistic: login vinculado o algún pago acreditado. */
async function loadAdsClienteIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const links = await fetchAllRows<{ hecom_cliente_id: string | null }>(
    "hecom_cliente_user_links",
    "hecom_cliente_id",
  );
  for (const l of links) if (l.hecom_cliente_id) ids.add(String(l.hecom_cliente_id));
  const payments = await fetchAllRows<{ hecom_cliente_id: string | null }>(
    "payment_intents",
    "hecom_cliente_id:metadata->>hecom_cliente_id",
    { status: "succeeded" },
  );
  for (const p of payments) if (p.hecom_cliente_id) ids.add(String(p.hecom_cliente_id));
  return ids;
}

type TikTokBudgetRow = {
  bm: string;
  advertiserId: string;
  name: string;
  budget: number;
  cost: number;
  mode: string;
};

async function scanSharedBc(bm: string, bcId: string, token: string): Promise<TikTokBudgetRow[]> {
  const out: TikTokBudgetRow[] = [];
  for (let page = 1; page <= 40; page++) {
    const url = `${TIKTOK_API}/advertiser/balance/get/?bc_id=${bcId}&page=${page}&page_size=50`;
    const res = await fetch(url, { headers: { "Access-Token": token } });
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: {
        advertiser_account_list?: Array<Record<string, unknown>>;
        page_info?: { total_number?: number };
      };
    };
    if (json.code !== 0) throw new Error(`BM${bm}: ${json.message ?? "TikTok error"}`);
    for (const r of json.data?.advertiser_account_list ?? []) {
      out.push({
        bm,
        advertiserId: String(r.advertiser_id ?? ""),
        name: String(r.advertiser_name ?? ""),
        budget: Number(r.budget) || 0,
        cost: Number(r.budget_cost) || 0,
        mode: String(r.budget_mode ?? "").toUpperCase(),
      });
    }
    if (page * 50 >= (json.data?.page_info?.total_number ?? 0)) break;
  }
  return out;
}

export async function runPrepagoGuard(
  options: { notify?: boolean; record?: boolean } = {},
): Promise<PrepagoGuardResult> {
  // notify/record en false = prueba local: solo detecta, no avisa ni registra.
  const notify = options.notify !== false;
  const record = options.record !== false;
  const token = serverEnv.tiktokAccessToken.trim();
  if (!token) throw new Error("Falta TIKTOK_ACCESS_TOKEN para leer presupuestos.");

  const adsClienteIds = await loadAdsClienteIds();

  // Cuenta TikTok → cliente Hecom y mejor saldo de cartera (mismo criterio que
  // el script de tope: la fila con más saldo gana).
  const adAccounts = await fetchAllRows<{
    id: string;
    name: string | null;
    external_account_id: string | null;
    hecom_cliente_id: string | null;
    hecom_cliente_name: string | null;
  }>(
    "ad_accounts",
    "id,name,external_account_id,hecom_cliente_id:metadata->>hecom_cliente_id,hecom_cliente_name:metadata->>hecom_cliente_name",
    { platform: "tiktok" },
  );
  const balances = await fetchAllRows<{ ad_account_id: string; available_balance_cents: number | null }>(
    "v_ad_account_ledger_balances",
    "ad_account_id,available_balance_cents",
  );
  const balanceByAdAccount = new Map(
    balances.map((b) => [b.ad_account_id, Math.max(0, (Number(b.available_balance_cents) || 0) / 100)]),
  );

  const byAdvertiser = new Map<string, { ledgerUsd: number; hecomId: string | null; clienteName: string | null }>();
  for (const a of adAccounts) {
    const adv = String(a.external_account_id ?? "").trim();
    if (!adv) continue;
    const entry = byAdvertiser.get(adv) ?? { ledgerUsd: 0, hecomId: null, clienteName: null };
    entry.ledgerUsd = Math.max(entry.ledgerUsd, balanceByAdAccount.get(a.id) ?? 0);
    if (a.hecom_cliente_id) {
      entry.hecomId = String(a.hecom_cliente_id);
      entry.clienteName = a.hecom_cliente_name || entry.clienteName || a.name;
    }
    byAdvertiser.set(adv, entry);
  }

  const tiktokRows: TikTokBudgetRow[] = [];
  for (const bm of SHARED_BUCKETS) {
    const bcId = HECOM_BM_BUCKET_TO_BC[bm];
    if (bcId) tiktokRows.push(...(await scanSharedBc(bm, bcId, token)));
  }

  const incidents: PrepagoGuardIncident[] = [];
  const clientesSeen = new Map<string, string>();

  for (const row of tiktokRows) {
    const holistic = byAdvertiser.get(row.advertiserId);
    if (!holistic?.hecomId || !adsClienteIds.has(holistic.hecomId)) continue;
    const clienteName = holistic.clienteName ?? holistic.hecomId;
    clientesSeen.set(holistic.hecomId, clienteName);

    const unlimited = row.mode === "UNLIMITED";
    const remaining = round2(row.budget - row.cost);
    const excess = round2(remaining - holistic.ledgerUsd);
    if (!unlimited && excess <= TOLERANCE_USD) continue;

    incidents.push({
      kind: "budget_over_balance",
      hecomClienteId: holistic.hecomId,
      clienteName,
      advertiserId: row.advertiserId,
      advertiserName: row.name,
      bm: row.bm,
      tiktokRemainingUsd: unlimited ? undefined : remaining,
      ledgerUsd: round2(holistic.ledgerUsd),
      excessUsd: unlimited ? undefined : excess,
      unlimited,
      targetBudgetUsd: round2(row.cost + holistic.ledgerUsd),
    });
  }

  // Red de seguridad: en Ads nadie debe ser crédito sin aprobación de gerencia.
  // Hoy no existe crédito aprobado en Ads, así que cualquier caso es un error.
  for (const [hecomId, clienteName] of clientesSeen) {
    if (await isAgencyCreditCliente(hecomId)) {
      incidents.push({ kind: "credit_without_approval", hecomClienteId: hecomId, clienteName });
    }
  }

  incidents.sort((a, b) => (b.unlimited ? 1e9 : b.excessUsd ?? 0) - (a.unlimited ? 1e9 : a.excessUsd ?? 0));

  const { alerted, reason } = notify
    ? await alertIfNeeded(incidents)
    : { alerted: false, reason: "prueba_sin_aviso" };

  if (record) await createAdminClient().from("audit_logs").insert({
    action: AUDIT_ACTION,
    entity_type: "prepago_guard",
    metadata: {
      mode: "alert",
      scanned_advertisers: tiktokRows.length,
      ads_clientes: clientesSeen.size,
      incidents_count: incidents.length,
      incidents_hash: incidentsHash(incidents),
      alerted,
      alert_reason: reason,
      incidents: incidents.slice(0, 200),
    },
  });

  return {
    mode: "alert",
    scannedAdvertisers: tiktokRows.length,
    adsClientes: clientesSeen.size,
    incidents,
    alerted,
    alertReason: reason,
  };
}

/** Huella del problema: cambia si aparece otra cuenta o el exceso sube de a $10. */
function incidentsHash(incidents: PrepagoGuardIncident[]): string {
  const key = incidents
    .map((i) => `${i.kind}:${i.advertiserId ?? i.hecomClienteId}:${i.unlimited ? "U" : Math.floor((i.excessUsd ?? 0) / 10)}`)
    .sort()
    .join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/** Avisa solo si el problema es nuevo o lleva horas sin avisarse. */
async function alertIfNeeded(
  incidents: PrepagoGuardIncident[],
): Promise<{ alerted: boolean; reason: string }> {
  if (incidents.length === 0) return { alerted: false, reason: "sin_incidentes" };

  const hash = incidentsHash(incidents);
  const { data: lastAlert } = await createAdminClient()
    .from("audit_logs")
    .select("created_at, metadata")
    .eq("action", AUDIT_ACTION)
    .eq("metadata->>alerted", "true")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string; metadata: { incidents_hash?: string } }>();

  if (lastAlert?.metadata?.incidents_hash === hash) {
    const hoursSince = (Date.now() - new Date(lastAlert.created_at).getTime()) / 3_600_000;
    if (hoursSince < REALERT_AFTER_HOURS) return { alerted: false, reason: "ya_avisado" };
  }

  const managers = resolveManualPaymentManagerEmails();
  if (managers.length === 0) return { alerted: false, reason: "sin_destinatarios" };

  const email = buildGuardEmail(incidents);
  let sent = 0;
  for (let i = 0; i < managers.length; i += MANAGER_EMAILS_PER_SECOND) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    const batch = await Promise.allSettled(
      managers.slice(i, i + MANAGER_EMAILS_PER_SECOND).map((to) =>
        sendTransactionalEmail({
          to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          templateKey: "ops.prepago_guard.alert",
          idempotencyKey: `email:prepago_guard:${hash}:${new Date().toISOString().slice(0, 13)}:${to}`,
          metadata: { incidents_hash: hash, incidents_count: incidents.length },
        }),
      ),
    );
    sent += batch.filter((r) => r.status === "fulfilled").length;
  }
  return { alerted: sent > 0, reason: sent > 0 ? "nuevo_o_vencido" : "envio_fallido" };
}

function usd(value: number | undefined): string {
  return value == null ? "—" : `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildGuardEmail(incidents: PrepagoGuardIncident[]) {
  const budget = incidents.filter((i) => i.kind === "budget_over_balance");
  const credit = incidents.filter((i) => i.kind === "credit_without_approval");
  const clientes = new Set(incidents.map((i) => i.hecomClienteId)).size;
  const subject = `[Aviso] Prepago: ${budget.length} cuenta${budget.length === 1 ? "" : "s"} TikTok pueden gastar más que su saldo · ${clientes} cliente${clientes === 1 ? "" : "s"}`;

  const rowsHtml = budget
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 12px 10px 0;border-top:1px solid #e8e4dd;font-size:14px;color:#1a1917;vertical-align:top;">${escapeHtml(i.clienteName)}<br /><span style="font-size:12px;color:#57524b;">${escapeHtml(i.advertiserName ?? "")} · BM${escapeHtml(i.bm ?? "")}</span></td>
          <td align="right" style="padding:10px 0;border-top:1px solid #e8e4dd;font-size:14px;color:#1a1917;vertical-align:top;white-space:nowrap;">${i.unlimited ? "Ilimitado" : usd(i.tiktokRemainingUsd)}</td>
          <td align="right" style="padding:10px 0 10px 12px;border-top:1px solid #e8e4dd;font-size:14px;color:#1a1917;vertical-align:top;white-space:nowrap;">${usd(i.ledgerUsd)}</td>
          <td align="right" style="padding:10px 0 10px 12px;border-top:1px solid #e8e4dd;font-size:14px;font-weight:700;color:#8f1d12;vertical-align:top;white-space:nowrap;">${i.unlimited ? "Sin tope" : usd(i.excessUsd)}</td>
        </tr>`,
    )
    .join("");

  const creditHtml = credit.length
    ? `<p style="margin:0 0 16px;padding:14px 18px;background:#fbeeec;border-radius:6px;font-size:15px;line-height:1.5;color:#8f1d12;">
         El sistema trata como crédito, sin aprobación de gerencia, a: <b>${credit.map((c) => escapeHtml(c.clienteName)).join(", ")}</b>. En Ads todos deben ser prepago.
       </p>`
    : "";

  const bodyHtml = `
      <p style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:#1a1917;">${budget.length} cuenta${budget.length === 1 ? "" : "s"} pueden gastar más que su saldo</p>
      <p style="margin:10px 0 24px;font-size:15px;line-height:1.5;color:#57524b;">El guardián de prepago revisó los presupuestos en TikTok contra el saldo en cartera. Está en <b>modo solo aviso</b>: no cambió nada. Para corregir, abre la cuenta del cliente en Ads o ajusta su presupuesto en TikTok al valor sugerido.</p>
      ${creditHtml}
      ${
        budget.length
          ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding:0 12px 8px 0;font-size:12px;color:#57524b;">Cliente / cuenta</td>
          <td align="right" style="padding:0 0 8px;font-size:12px;color:#57524b;">Puede gastar en TikTok</td>
          <td align="right" style="padding:0 0 8px 12px;font-size:12px;color:#57524b;">Saldo en cartera</td>
          <td align="right" style="padding:0 0 8px 12px;font-size:12px;color:#57524b;">De más</td>
        </tr>
        ${rowsHtml}
      </table>`
          : ""
      }`;

  const html = wrapInternalEmail({
    label: "Guardián de prepago",
    preview: subject,
    bodyHtml,
    footerNote: `Holistic Marketing · aviso interno para gerencia · revisión automática cada 15 minutos`,
  });

  const text = [
    subject,
    "Modo solo aviso: no se cambió nada.",
    ...credit.map((c) => `CRÉDITO SIN APROBACIÓN: ${c.clienteName}`),
    ...budget.map(
      (i) =>
        `${i.clienteName} · ${i.advertiserName} · BM${i.bm}: puede gastar ${i.unlimited ? "ilimitado" : usd(i.tiktokRemainingUsd)}, saldo ${usd(i.ledgerUsd)}, de más ${i.unlimited ? "sin tope" : usd(i.excessUsd)}. Presupuesto sugerido ${usd(i.targetBudgetUsd)}.`,
    ),
  ].join("\n");

  return { subject, html, text };
}

/** Solo para vistas previas y pruebas locales del correo. */
export const buildGuardEmailForPreview = buildGuardEmail;
